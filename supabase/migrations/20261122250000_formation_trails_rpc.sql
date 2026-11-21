-- Trilhas de Formação ENADE — leitura e gravação pelo servidor.
-- As tabelas ficam em vertice_app (formation_trails, trail_question_links, trail_analysis_snapshots,
-- v_trail_diagnostic), sem acesso pelo navegador: nada era gravado (0 registros em produção).
-- Regras: MFA e vínculo com a IES para ler; para gravar, gestão da IES ou coordenação/NDE do curso
-- (função atribuída em 20261122170000 ou papel coordenador/nde com vínculo validado).
-- A discrepância de cada questão é calculada no servidor (IES − nacional, em pontos percentuais).
begin;

create function vertice_private.trail_can_write(inst uuid, course uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(
  vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
  or vertice_private.course_function(inst,course) in ('coordenador','nde')
  or (vertice_private.member_role(inst) in ('coordenador','nde') and exists(
     select 1 from public.vertice_learning_staff_scope s
     where s.user_id=(select auth.uid()) and s.institution_id=inst and s.course_id=course and s.active)),false)
$$;
revoke all on function vertice_private.trail_can_write(uuid,uuid) from public,anon,authenticated;

create function vertice_private.trail_can_read(inst uuid, course uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(
  vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','cpa')
  or vertice_private.trail_can_write(inst,course)
  or exists(select 1 from public.vertice_learning_staff_scope s
     where s.user_id=(select auth.uid()) and s.institution_id=inst and s.course_id=course and s.active
       and vertice_private.member_role(inst) is not null),false)
$$;
revoke all on function vertice_private.trail_can_read(uuid,uuid) from public,anon,authenticated;

create function public.vertice_formation_trails(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); v_role text; p jsonb := coalesce(p_payload,'{}'::jsonb);
 v_id uuid; v_trail vertice_app.formation_trails; n integer := 0; comp record; v_build uuid;
 v_kw text[]; v_nat numeric; v_ies numeric;
begin
 if uid is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 v_role := vertice_private.member_role(p_institution);
 if v_role is null then raise exception 'Acesso institucional ou verificação de segurança (MFA) pendente.' using errcode='42501'; end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;

 -- Visão institucional (Sapiens, Governança): só os cursos que a pessoa pode ler.
 if p_action='institution_diagnostic' then
  return jsonb_build_object(
   'diagnostic',coalesce((select jsonb_agg(to_jsonb(d) order by d.total_discrepancy nulls last, d.code)
     from vertice_app.v_trail_diagnostic d
     where d.institution_id=p_institution and vertice_private.trail_can_read(p_institution,d.course_id)),'[]'::jsonb),
   'trails',(select count(*) from vertice_app.formation_trails t where t.institution_id=p_institution and vertice_private.trail_can_read(p_institution,t.course_id)),
   'questions',(select count(*) from vertice_app.trail_question_links q join vertice_app.formation_trails t on t.id=q.trail_id
     where t.institution_id=p_institution and vertice_private.trail_can_read(p_institution,t.course_id)));
 end if;

 if not exists(select 1 from public.vertice_courses c where c.id=p_course and c.institution_id=p_institution) then
  raise exception 'Curso não pertence à instituição autorizada.' using errcode='42501';
 end if;
 if not vertice_private.trail_can_read(p_institution,p_course) then
  raise exception 'Seu vínculo com este curso precisa ser validado pela gestão.' using errcode='42501';
 end if;
 if p_action not in ('get','save_trail','delete_trail','import_curriculum','add_question','delete_question','save_snapshot') then
  raise exception 'Operação inválida.' using errcode='22023';
 end if;
 if p_action<>'get' and not vertice_private.trail_can_write(p_institution,p_course) then
  raise exception 'As trilhas são editadas pela gestão, pela coordenação ou pelo NDE do curso.' using errcode='42501';
 end if;

 if p_action='save_trail' then
  if length(btrim(coalesce(p->>'code',''))) not between 1 and 20 or length(btrim(coalesce(p->>'name',''))) not between 1 and 300
     or length(coalesce(p->>'description',''))>4000
     or (p ? 'keywords' and (jsonb_typeof(p->'keywords')<>'array' or jsonb_array_length(p->'keywords')>30
        or exists(select 1 from jsonb_array_elements(p->'keywords') k where jsonb_typeof(k)<>'string' or length(k#>>'{}') not between 1 and 80))) then
   raise exception 'Trilha incompleta: código (até 20), nome (até 300), descrição até 4.000 e até 30 palavras-chave de até 80 caracteres.' using errcode='22023';
  end if;
  v_kw := coalesce((select array_agg(distinct btrim(k#>>'{}')) from jsonb_array_elements(coalesce(p->'keywords','[]'::jsonb)) k),'{}');
  v_id := nullif(p->>'id','')::uuid;
  if exists(select 1 from vertice_app.formation_trails t where t.institution_id=p_institution and t.course_id=p_course
     and lower(t.code)=lower(btrim(p->>'code')) and t.id is distinct from v_id) then
   raise exception 'Já existe uma trilha com este código no curso.' using errcode='23505';
  end if;
  if v_id is null then
   insert into vertice_app.formation_trails(institution_id,course_id,code,name,description,keywords,created_at,updated_at)
   values(p_institution,p_course,btrim(p->>'code'),btrim(p->>'name'),nullif(p->>'description',''),v_kw,now(),now());
  else
   update vertice_app.formation_trails set code=btrim(p->>'code'),name=btrim(p->>'name'),description=nullif(p->>'description',''),
    keywords=v_kw,updated_at=now() where id=v_id and institution_id=p_institution and course_id=p_course;
   if not found then raise exception 'Trilha não encontrada neste curso.' using errcode='42501'; end if;
  end if;
 elsif p_action='delete_trail' then
  delete from vertice_app.formation_trails where id=nullif(p->>'id','')::uuid and institution_id=p_institution and course_id=p_course;
  if not found then raise exception 'Trilha não encontrada neste curso.' using errcode='42501'; end if;
 elsif p_action='import_curriculum' then
  -- Versão publicada vigente; sem publicada, a mais recente.
  select b.id into v_build from vertice_app.curriculum_builds b where b.institution_id=p_institution and b.course_id=p_course
   order by (b.status='published') desc, b.version desc limit 1;
  if v_build is null then raise exception 'Nenhuma versão da Construção Curricular encontrada para este curso.' using errcode='23514'; end if;
  for comp in select c.id,c.code,c.title,c.description from vertice_app.curriculum_competencies c where c.build_id=v_build order by c.sort_order,c.code loop
   if not exists(select 1 from vertice_app.formation_trails t where t.institution_id=p_institution and t.course_id=p_course
      and (t.curriculum_competency_id=comp.id or lower(t.code)=lower(comp.code))) then
    insert into vertice_app.formation_trails(institution_id,course_id,code,name,description,curriculum_competency_id,keywords,created_at,updated_at)
    values(p_institution,p_course,left(comp.code,20),left(comp.title,300),comp.description,comp.id,'{}',now(),now());
    n := n+1;
   end if;
  end loop;
 elsif p_action='add_question' then
  select * into v_trail from vertice_app.formation_trails t where t.id=nullif(p->>'trail_id','')::uuid and t.institution_id=p_institution and t.course_id=p_course;
  if v_trail.id is null then raise exception 'Trilha não encontrada neste curso.' using errcode='42501'; end if;
  if (p->>'enade_year' is not null and (p->>'enade_year' !~ '^\d{4}$' or (p->>'enade_year')::int not between 2004 and 2100))
     or (p->>'question_number' is not null and (p->>'question_number' !~ '^\d{1,3}$' or (p->>'question_number')::int not between 1 and 200))
     or (p->>'national_correct_pct' is not null and (p->>'national_correct_pct' !~ '^\d{1,3}([.,]\d{1,2})?$' or replace(p->>'national_correct_pct',',','.')::numeric>100))
     or (p->>'ies_correct_pct' is not null and (p->>'ies_correct_pct' !~ '^\d{1,3}([.,]\d{1,2})?$' or replace(p->>'ies_correct_pct',',','.')::numeric>100))
     or length(coalesce(p->>'question_text',''))>4000 then
   raise exception 'Questão inválida: ano 2004–2100, número 1–200, percentuais de 0 a 100 e enunciado até 4.000 caracteres.' using errcode='22023';
  end if;
  v_nat := replace(p->>'national_correct_pct',',','.')::numeric; v_ies := replace(p->>'ies_correct_pct',',','.')::numeric;
  insert into vertice_app.trail_question_links(trail_id,enade_year,question_number,question_text,national_correct_pct,ies_correct_pct,discrepancy,source,created_at)
  values(v_trail.id,(p->>'enade_year')::int,(p->>'question_number')::int,nullif(p->>'question_text',''),v_nat,v_ies,
   case when v_nat is not null and v_ies is not null then round(v_ies-v_nat,2) end,'manual',now());
 elsif p_action='delete_question' then
  delete from vertice_app.trail_question_links q using vertice_app.formation_trails t
   where q.id=nullif(p->>'id','')::uuid and t.id=q.trail_id and t.institution_id=p_institution and t.course_id=p_course;
  if not found then raise exception 'Questão não encontrada neste curso.' using errcode='42501'; end if;
 elsif p_action='save_snapshot' then
  if length(coalesce(p->>'summary',''))>2000 then raise exception 'Resumo até 2.000 caracteres.' using errcode='22023'; end if;
  -- Ranking e fragilidades vêm do diagnóstico do servidor, não do navegador.
  insert into vertice_app.trail_analysis_snapshots(institution_id,course_id,analysis_date,trail_rankings,weakest_disciplines,summary,created_by,created_at)
  select p_institution,p_course,current_date,
   coalesce(jsonb_agg(jsonb_build_object('trail_id',d.trail_id,'name',d.name,'total_discrepancy',d.total_discrepancy,'avg_discrepancy',d.avg_discrepancy,
     'question_count',d.question_count,'status',d.status) order by d.total_discrepancy nulls last),'[]'::jsonb),
   coalesce(jsonb_agg(jsonb_build_object('trail',d.name,'discrepancy',d.avg_discrepancy,
     'suggested_action',case when d.status='critico' then 'Oficina de retomada urgente' else 'Revisão de ementa e materiais' end))
     filter (where d.status in ('critico','atencao')),'[]'::jsonb),
   nullif(p->>'summary',''),uid,now()
  from vertice_app.v_trail_diagnostic d where d.institution_id=p_institution and d.course_id=p_course;
 end if;

 return jsonb_build_object(
  'trails',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'code',t.code,'name',t.name,'description',t.description,
     'curriculum_competency_id',t.curriculum_competency_id,'keywords',coalesce(to_jsonb(t.keywords),'[]'::jsonb)) order by t.code)
    from vertice_app.formation_trails t where t.institution_id=p_institution and t.course_id=p_course),'[]'::jsonb),
  'questions',coalesce((select jsonb_agg(to_jsonb(q) order by q.enade_year desc nulls last, q.question_number)
    from vertice_app.trail_question_links q join vertice_app.formation_trails t on t.id=q.trail_id
    where t.institution_id=p_institution and t.course_id=p_course),'[]'::jsonb),
  'diagnostic',coalesce((select jsonb_agg(to_jsonb(d) order by d.total_discrepancy nulls last, d.code)
    from vertice_app.v_trail_diagnostic d where d.institution_id=p_institution and d.course_id=p_course),'[]'::jsonb),
  'imported',n,
  'canWrite',vertice_private.trail_can_write(p_institution,p_course));
end $$;
revoke all on function public.vertice_formation_trails(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_formation_trails(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
