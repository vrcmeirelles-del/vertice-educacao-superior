-- Discursiva: conjunto de treino da pré-nota por modelo treinado (sem IA externa).
-- Somente leitura. Devolve as respostas já homologadas pelo docente no próprio curso,
-- com a questão congelada na prova. Mesma autorização (papel, escopo de curso e MFA aal2)
-- da RPC principal; nenhum identificador de estudante sai da função.
begin;
create or replace function public.vertice_discursiva_training_set(p_institution_id uuid,p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not vertice_discursiva.authorize(p_institution_id,p_course_id) then
  raise exception 'Acesso ao curso ou MFA pendente' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('question',q.content,'answer',t.answer,'score',t.final_score))
  from (
   select s.answer,s.final_score,s.question_id,e.snapshot
   from vertice_discursiva.submissions s
   join vertice_discursiva.exams e on e.id=s.exam_id
   where e.institution_id=p_institution_id and e.course_id=p_course_id
     and s.final_score is not null and s.reviewed_at is not null
   order by s.reviewed_at desc
   limit 1000
  ) t
  cross join lateral (
   select x->'content' content from jsonb_array_elements(t.snapshot) x
   where x->>'id'=t.question_id::text limit 1
  ) q
 ),'[]'::jsonb);
end;$$;
revoke all on function public.vertice_discursiva_training_set(uuid,uuid) from public,anon;
grant execute on function public.vertice_discursiva_training_set(uuid,uuid) to authenticated;
commit;
