-- Reuse the validated, aggregated Fato & Ordem learning bridge.
-- Authorization is the intersection of new Teaching scope and the native learning
-- metrics RLS (including the teacher's subject assignment). No raw events,
-- per-person identifiers, evidence creation, AC credit or sync calls.
begin;
create function public.vertice_teaching_fo_metrics(
 p_institution uuid, p_course uuid, p_semester text default null, p_module text default null
) returns table (
 semester text, subject_code text, module text, competency text, participants integer,
 attempts integer, graded integer, correct integer, updated_at timestamptz
)
language sql stable security invoker set search_path='' as $$
 select m.semester,m.subject_code,m.module,m.competency,m.participants,
        m.attempts,m.graded,m.correct,m.updated_at
 from public.vertice_learning_course_metrics m
 where vertice_private.teaching_access(p_institution,p_course,'read')
   and m.institution_id=p_institution and m.course_id=p_course and m.participants>=5
   and m.module in ('oab','cfc','enade','enamed','residencia','delegado','pf','estadual','federal','defensoria','mp')
   and (p_semester is null or m.semester=p_semester)
   and (p_module is null or m.module=p_module)
 order by m.semester desc,m.module,m.subject_code,m.competency
 limit 100
$$;

revoke all on function public.vertice_teaching_fo_metrics(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.vertice_teaching_fo_metrics(uuid,uuid,text,text) to authenticated;
comment on function public.vertice_teaching_fo_metrics(uuid,uuid,text,text) is
 'Leitura somente: agregados Fato & Ordem já publicados por Aprendizagem Conectada. Preserva escopo/Vínculo MFA, autorização por disciplina e mínimo de cinco. Superior, sem ENEM.';
notify pgrst, 'reload schema';
commit;
