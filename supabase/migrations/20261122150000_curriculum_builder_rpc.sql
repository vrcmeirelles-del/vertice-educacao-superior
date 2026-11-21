-- Construção Curricular — gravação e publicação pelo servidor.
-- Problemas corrigidos:
--  1. o portal gravava em vertice_app.curriculum_* como se fossem tabelas do schema público,
--     e authenticated não tem uso do schema vertice_app: nenhuma matriz era gravada (0 em produção);
--  2. as chaves estrangeiras apontam para vertice_app.institutions/courses, que só espelham
--     parte do portal: a função espelha IES e curso, como vertice_planning.course_planning;
--  3. não havia publicação: a matriz ficava sempre em rascunho e não podia ser importada;
--  4. cada salvamento apagava e recriava as competências (ids instáveis): agora o rascunho é
--     atualizado no lugar, e editar uma matriz publicada abre uma nova versão em rascunho;
--  5. a regra de escrita das tabelas aceitava qualquer membro da IES: a função restringe a
--     gestão, coordenação e NDE (coordenação/NDE com vínculo validado ao curso), com MFA.
begin;

create function public.vertice_curriculum_build(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); v_role text; v_course public.vertice_courses; v_inst public.vertice_institutions;
 b vertice_app.curriculum_builds; latest vertice_app.curriculum_builds; comp jsonb; disc jsonb; v_cid uuid; kept uuid[] := '{}';
 n integer; result jsonb;
begin
 if uid is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 v_role := vertice_private.member_role(p_institution);
 if v_role is null then raise exception 'Acesso institucional ou verificação de segurança (MFA) pendente.' using errcode='42501'; end if;
 select * into v_course from public.vertice_courses where id=p_course and institution_id=p_institution;
 if not found then raise exception 'Curso não pertence à instituição autorizada.' using errcode='42501'; end if;
 if v_role in ('coordenador','nde') and not exists(select 1 from public.vertice_learning_staff_scope s
    where s.user_id=uid and s.institution_id=p_institution and s.course_id=p_course and s.active) then
  raise exception 'Seu vínculo com este curso precisa ser validado pela gestão.' using errcode='42501';
 end if;
 if p_action not in ('get','save','publish') then raise exception 'Operação inválida.' using errcode='22023'; end if;
 if p_action<>'get' and v_role not in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde') then
  raise exception 'A matriz curricular é editada pela gestão, pela coordenação ou pelo NDE.' using errcode='42501';
 end if;
 if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;

 select * into latest from vertice_app.curriculum_builds x where x.institution_id=p_institution and x.course_id=p_course
  order by x.version desc, x.updated_at desc nulls last limit 1;

 if p_action='save' then
  if jsonb_typeof(p_payload->'competencies') is distinct from 'array' or jsonb_array_length(p_payload->'competencies') not between 1 and 40 then
   raise exception 'Informe de 1 a 40 competências.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'competencies') c where jsonb_typeof(c)<>'object'
     or length(btrim(coalesce(c->>'code','')))  not between 1 and 20
     or length(btrim(coalesce(c->>'title',''))) not between 1 and 300
     or length(coalesce(c->>'description','')) > 4000
     or (c->>'origin_period' is not null and (c->>'origin_period' !~ '^\d{1,2}$' or (c->>'origin_period')::int not between 1 and 12))
     or coalesce(c->>'period_status','proposed') not in ('proposed','validated')
     or (c->>'period_status'='validated' and c->>'origin_period' is null)
     or jsonb_typeof(coalesce(c->'disciplines','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(c->'disciplines','[]'::jsonb))>80
     or exists(select 1 from jsonb_array_elements(coalesce(c->'disciplines','[]'::jsonb)) d where jsonb_typeof(d)<>'object'
        or length(btrim(coalesce(d->>'discipline_name',''))) not between 1 and 200
        or coalesce(d->>'category','') not in ('profissional','instrumental','basica'))) then
   raise exception 'Competências incompletas: código (até 20), título, período de 1 a 12 (obrigatório quando homologado) e disciplinas com nome e categoria.' using errcode='22023';
  end if;
  if (select count(distinct lower(btrim(c->>'code'))) from jsonb_array_elements(p_payload->'competencies') c)<>jsonb_array_length(p_payload->'competencies') then
   raise exception 'Códigos de competência repetidos.' using errcode='22023';
  end if;
  if length(coalesce(p_payload->>'graduate_profile',''))>20000 or length(coalesce(p_payload->>'dcn_reference',''))>500
     or length(coalesce(p_payload->>'graduate_profile_source',''))>500
     or (nullif(btrim(coalesce(p_payload->>'dcn_document_url','')),'') is not null and (p_payload->>'dcn_document_url' !~ '^https://' or length(p_payload->>'dcn_document_url')>1000)) then
   raise exception 'Perfil do egresso até 20.000 caracteres; referência e fonte até 500; link da DCN com https://.' using errcode='22023';
  end if;
  -- Espelho da IES e do curso do portal (mesmo padrão do Planejamento).
  select * into v_inst from public.vertice_institutions where id=p_institution;
  insert into vertice_app.institutions(id,slug,name,status,activated_at)
   values(p_institution,'portal-'||p_institution::text,v_inst.name,'active',now()) on conflict(id) do nothing;
  insert into vertice_app.courses(id,institution_id,code,name)
   values(p_course,p_institution,'portal-'||p_course::text,v_course.name) on conflict(id) do nothing;
  if not exists(select 1 from vertice_app.courses where id=p_course and institution_id=p_institution) then
   raise exception 'Vínculo institucional do curso inconsistente.' using errcode='23514';
  end if;

  if latest.id is not null and latest.status='draft' then
   if nullif(p_payload->>'buildId','') is not null and p_payload->>'buildId'<>latest.id::text then
    raise exception 'A matriz foi alterada em outra sessão. Recarregue antes de salvar.' using errcode='40001';
   end if;
   update vertice_app.curriculum_builds set graduate_profile=p_payload->>'graduate_profile',
    graduate_profile_source=nullif(btrim(coalesce(p_payload->>'graduate_profile_source','')),''),
    dcn_reference=p_payload->>'dcn_reference',dcn_document_url=nullif(btrim(coalesce(p_payload->>'dcn_document_url','')),''),updated_at=now()
   where id=latest.id returning * into b;
  else
   insert into vertice_app.curriculum_builds(institution_id,course_id,version,status,graduate_profile,graduate_profile_source,dcn_reference,dcn_document_url,created_by)
   values(p_institution,p_course,coalesce(latest.version,0)+1,'draft',p_payload->>'graduate_profile',
    nullif(btrim(coalesce(p_payload->>'graduate_profile_source','')),''),p_payload->>'dcn_reference',
    nullif(btrim(coalesce(p_payload->>'dcn_document_url','')),''),uid)
   returning * into b;
  end if;

  n := 0;
  for comp in select value from jsonb_array_elements(p_payload->'competencies') loop
   v_cid := null;
   if nullif(comp->>'id','') is not null then
    update vertice_app.curriculum_competencies set code=btrim(comp->>'code'),title=btrim(comp->>'title'),
     description=nullif(comp->>'description',''),sort_order=n,
     origin_period=nullif(comp->>'origin_period','')::smallint,period_status=nullif(comp->>'period_status','')
    where id::text=comp->>'id' and build_id=b.id returning id into v_cid;
   end if;
   if v_cid is null then
    insert into vertice_app.curriculum_competencies(build_id,code,title,description,sort_order,origin_period,period_status)
    values(b.id,btrim(comp->>'code'),btrim(comp->>'title'),nullif(comp->>'description',''),n,
     nullif(comp->>'origin_period','')::smallint,nullif(comp->>'period_status',''))
    returning id into v_cid;
   end if;
   kept := kept || v_cid;
   delete from vertice_app.curriculum_discipline_links where competency_id=v_cid;
   insert into vertice_app.curriculum_discipline_links(competency_id,discipline_name,category,source,sort_order)
   select v_cid,btrim(d.value->>'discipline_name'),d.value->>'category','manual',(d.ordinality-1)::int
   from jsonb_array_elements(coalesce(comp->'disciplines','[]'::jsonb)) with ordinality d;
   n := n+1;
  end loop;
  delete from vertice_app.curriculum_competencies where build_id=b.id and not (id = any(kept));
 end if;

 if p_action='publish' then
  if latest.id is null or latest.status<>'draft' or (nullif(p_payload->>'buildId','') is not null and p_payload->>'buildId'<>latest.id::text) then
   raise exception 'Somente a versão mais recente em rascunho pode ser publicada.' using errcode='23514';
  end if;
  if not exists(select 1 from vertice_app.curriculum_competencies c where c.build_id=latest.id) then
   raise exception 'Inclua ao menos uma competência antes de publicar.' using errcode='23514';
  end if;
  update vertice_app.curriculum_builds set status='archived',updated_at=now()
   where institution_id=p_institution and course_id=p_course and status='published';
  update vertice_app.curriculum_builds set status='published',updated_at=now() where id=latest.id;
 end if;

 select * into b from vertice_app.curriculum_builds x where x.institution_id=p_institution and x.course_id=p_course
  order by x.version desc, x.updated_at desc nulls last limit 1;
 if b.id is null then
  return jsonb_build_object('build',null,'publishedVersion',null,'canWrite',v_role in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'));
 end if;
 return jsonb_build_object(
  'build',jsonb_build_object('id',b.id,'version',b.version,'status',b.status,'graduate_profile',coalesce(b.graduate_profile,''),
    'graduate_profile_source',coalesce(b.graduate_profile_source,''),'dcn_reference',coalesce(b.dcn_reference,''),
    'dcn_document_url',coalesce(b.dcn_document_url,''),'updated_at',b.updated_at),
  'competencies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'title',c.title,'description',coalesce(c.description,''),
     'sort_order',c.sort_order,'origin_period',c.origin_period,'period_status',c.period_status,
     'disciplines',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'discipline_name',l.discipline_name,'category',l.category,'sort_order',l.sort_order) order by l.sort_order, l.id)
        from vertice_app.curriculum_discipline_links l where l.competency_id=c.id),'[]'::jsonb)) order by c.sort_order nulls last, c.code)
    from vertice_app.curriculum_competencies c where c.build_id=b.id),'[]'::jsonb),
  'publishedVersion',(select max(x.version) from vertice_app.curriculum_builds x where x.institution_id=p_institution and x.course_id=p_course and x.status='published'),
  'canWrite',v_role in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde'));
end $$;
revoke all on function public.vertice_curriculum_build(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_curriculum_build(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
