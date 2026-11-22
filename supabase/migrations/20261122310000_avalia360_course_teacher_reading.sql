-- Avalia 360°: leitura e lançamento de cartões por qualquer professor do curso.
-- Antes: só o autor do caderno, quem criou a aplicação e a coordenação liam e lançavam.
-- Agora: quem tem acesso 'record' ao curso (equipe com vínculo ativo, coordenação, gestão; sempre com MFA)
-- pode, enquanto a aplicação estiver aberta, listar a aplicação, abrir o detalhe, ler o QR, ver os cadernos
-- emitidos e lançar folhas. Emitir/anular cadernos, excluir folha, encerrar a aplicação e as análises
-- continuam restritos ao autor, a quem criou a aplicação e à coordenação.
-- As funções longas são alteradas por troca de trecho conferido (o trecho precisa ocorrer exatamente uma vez).
begin;

create function vertice_private.avalia_application_reader(p_application uuid, p_write boolean)
returns public.vertice_avalia_applications language plpgsql stable security definer set search_path='' as $$
declare a public.vertice_avalia_applications; d public.vertice_avalia_drafts;
begin
 select * into a from public.vertice_avalia_applications where id=p_application;
 if not found or not vertice_private.avalia_access(a.institution_id,a.course_id,'record') then
  raise exception 'Aplicação não localizada.' using errcode='P0002';
 end if;
 select * into d from public.vertice_avalia_drafts where id=a.draft_id;
 if a.status<>'open' and not (d.created_by=auth.uid() or a.created_by=auth.uid()
    or vertice_private.avalia_access(a.institution_id,a.course_id,'validate')) then
  raise exception 'Aplicação encerrada: disponível só para o autor e a coordenação.' using errcode='P0002';
 end if;
 if p_write and a.status<>'open' then raise exception 'Aplicação encerrada: lançamentos bloqueados.' using errcode='23514'; end if;
 return a;
end $$;
revoke all on function vertice_private.avalia_application_reader(uuid,boolean) from public,anon,authenticated;

do $mig$
declare
 d text; i integer;
 pairs text[][];
begin
 -- vertice_avalia_application
 pairs := array[
  [$o$'sheets',(select count(*) from public.vertice_avalia_sheets s where s.application_id=x.id))$o$,
   $n$'sheets',(select count(*) from public.vertice_avalia_sheets s where s.application_id=x.id),
    'canManage',(r.created_by=uid or x.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate')))$n$],
  [$o$and (r.created_by=uid or x.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate'))),'[]'::jsonb);$o$,
   $n$and (r.created_by=uid or x.created_by=uid or x.status='open' or vertice_private.avalia_access(p_institution,p_course,'validate'))),'[]'::jsonb);$n$],
  [$o$a := vertice_private.avalia_application_access(nullif(p_payload->>'id','')::uuid, p_action in ('save_sheets','delete_sheet','close'));$o$,
   $n$if p_action in ('get','save_sheets') then
  a := vertice_private.avalia_application_reader(nullif(p_payload->>'id','')::uuid, p_action='save_sheets');
 else
  a := vertice_private.avalia_application_access(nullif(p_payload->>'id','')::uuid, p_action in ('save_sheets','delete_sheet','close'));
 end if;$n$],
  [$o$'appliedOn',a.applied_on,'variantCount',a.variant_count,'variantMap',a.variant_map,'status',a.status,$o$,
   $n$'appliedOn',a.applied_on,'variantCount',a.variant_count,'variantMap',a.variant_map,'status',a.status,
   'canManage',(d.created_by=uid or a.created_by=uid or vertice_private.avalia_access(p_institution,p_course,'validate')),$n$]
 ];
 d := pg_get_functiondef('public.vertice_avalia_application(uuid,uuid,text,jsonb)'::regprocedure);
 for i in 1..array_length(pairs,1) loop
  if (length(d)-length(replace(d,pairs[i][1],'')))/length(pairs[i][1])<>1 then
   raise exception 'vertice_avalia_application: trecho % não encontrado exatamente uma vez (definição divergente).', i;
  end if;
  d := replace(d,pairs[i][1],pairs[i][2]);
 end loop;
 execute d;

 -- vertice_avalia_papers: scan, list e save pela regra de leitura; issue e void seguem restritos.
 pairs := array[
  [$o$a := vertice_private.avalia_application_access(p.application_id,false);$o$,
   $n$a := vertice_private.avalia_application_reader(p.application_id,false);$n$],
  [$o$a := vertice_private.avalia_application_access(p.application_id,true);$o$,
   $n$if p_action='save' then a := vertice_private.avalia_application_reader(p.application_id,true);
  else a := vertice_private.avalia_application_access(p.application_id,true); end if;$n$],
  [$o$a := vertice_private.avalia_application_access(nullif(p_payload->>'applicationId','')::uuid, p_action='issue');$o$,
   $n$if p_action='list' then a := vertice_private.avalia_application_reader(nullif(p_payload->>'applicationId','')::uuid,false);
 else a := vertice_private.avalia_application_access(nullif(p_payload->>'applicationId','')::uuid, p_action='issue'); end if;$n$]
 ];
 d := pg_get_functiondef('public.vertice_avalia_papers(uuid,uuid,text,jsonb)'::regprocedure);
 for i in 1..array_length(pairs,1) loop
  if (length(d)-length(replace(d,pairs[i][1],'')))/length(pairs[i][1])<>1 then
   raise exception 'vertice_avalia_papers: trecho % não encontrado exatamente uma vez (definição divergente).', i;
  end if;
  d := replace(d,pairs[i][1],pairs[i][2]);
 end loop;
 execute d;
end $mig$;

notify pgrst, 'reload schema';
commit;
