-- Avalia 360° — leitura das imagens de um caderno salvo, para reabrir em edição.
-- Devolve só as imagens citadas na versão vigente e confirmadas no escopo do caderno.
-- O serviço vertice-avalia-media chama esta RPC com o JWT do docente e emite URLs curtas.
begin;

create function public.vertice_avalia_draft_media(p_institution uuid,p_course uuid,p_discipline text,p_draft uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := auth.uid(); d public.vertice_avalia_drafts;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Imagens restritas à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 select * into d from public.vertice_avalia_drafts r
  where r.id=p_draft and r.institution_id=p_institution and r.course_id=p_course
    and lower(r.discipline)=lower(vertice_private.avalia_discipline(p_discipline))
    and (r.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate'));
 if not found then raise exception 'Rascunho não localizado neste curso e disciplina.' using errcode='P0002'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('questionId',q.value->>'id','imageId',m.id,'path',m.path,
    'sha256',m.sha256,'mime',m.mime,'sizeBytes',m.size_bytes) order by q.ordinality, i.ordinality)
  from jsonb_array_elements(d.snapshot->'questions') with ordinality q
  cross join lateral jsonb_array_elements(coalesce(q.value->'images','[]'::jsonb)) with ordinality i
  join public.vertice_avalia_media m on m.id::text=i.value->>'imageId' and m.path=i.value->>'path'
   and m.status='confirmed' and m.institution_id=d.institution_id and m.course_id=d.course_id
   and m.question_id=q.value->>'id'),'[]'::jsonb);
end $$;
revoke all on function public.vertice_avalia_draft_media(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.vertice_avalia_draft_media(uuid,uuid,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
