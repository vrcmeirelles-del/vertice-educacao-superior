-- Coordenação e NDE por curso.
-- vertice_memberships só admite gestor/equipe/leitor, e 106 políticas reconhecem "equipe" sem
-- reconhecer "coordenador": trocar o papel institucional tiraria acessos. A função no curso fica
-- numa camada própria, atribuída pela gestão, sobre um vínculo institucional já existente.
-- Consumidores: vertice_private.teaching_access (Avalia 360°, Atividades de Ensino e demais) e
-- vertice_curriculum_build (Construção Curricular).
begin;

create table public.vertice_course_staff_functions(
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 course_role text not null check (course_role in ('coordenador','nde')),
 active boolean not null default true,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 revoked_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz,
 primary key(institution_id,course_id,user_id,course_role),
 foreign key(course_id,institution_id) references public.vertice_courses(id,institution_id) on delete cascade
);
create index vertice_course_staff_functions_user on public.vertice_course_staff_functions(user_id,institution_id) where active;
alter table public.vertice_course_staff_functions enable row level security;
revoke all on public.vertice_course_staff_functions from public,anon,authenticated;

-- Função ativa do usuário no curso: exige MFA e vínculo institucional vigente.
create function vertice_private.course_function(inst uuid,course uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when vertice_private.member_role(inst) is null then null else
  (select f.course_role from public.vertice_course_staff_functions f
   where f.user_id=(select auth.uid()) and f.institution_id=inst and f.course_id=course and f.active
   order by (f.course_role='coordenador') desc limit 1) end
$$;
revoke all on function vertice_private.course_function(uuid,uuid) from public,anon,authenticated;

create or replace function vertice_private.teaching_access(inst uuid, course uuid, mode text)
 returns boolean language sql stable security definer set search_path to '' as $function$
 select coalesce(
   (select auth.uid()) is not null and (select auth.jwt()->>'aal')='aal2'
   and exists(select 1 from public.vertice_courses c join public.vertice_institutions i on i.id=c.institution_id
              where c.id=course and c.institution_id=inst and i.tier='superior')
   and (vertice_private.member_role(inst) in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador')
      or vertice_private.course_function(inst,course)='coordenador'
      or (mode='read' and vertice_private.course_function(inst,course)='nde')
      or (exists(select 1 from public.vertice_learning_staff_scope st
                 where st.user_id=(select auth.uid()) and st.institution_id=inst and st.course_id=course and st.active)
          and (vertice_private.member_role(inst)='coordenador'
             or (mode='read' and vertice_private.member_role(inst)='nde')
             or (mode in ('read','record') and vertice_private.member_role(inst)='equipe')))),false)
$function$;

-- Gestão das funções: list/grant/revoke (gestão da IES ou master); mine (qualquer membro com MFA).
create function public.vertice_course_staff(p_institution uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); v_role text; v_user uuid; v_course uuid; v_fn text; n integer;
begin
 if uid is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 v_role := vertice_private.member_role(p_institution);
 if v_role is null then raise exception 'Acesso institucional ou verificação de segurança (MFA) pendente.' using errcode='42501'; end if;
 if p_action='mine' then
  return coalesce((select jsonb_agg(jsonb_build_object('course_id',f.course_id,'function',f.course_role) order by f.course_id,f.course_role)
   from public.vertice_course_staff_functions f where f.user_id=uid and f.institution_id=p_institution and f.active),'[]'::jsonb);
 end if;
 if p_action not in ('list','grant','revoke') then raise exception 'Operação inválida.' using errcode='22023'; end if;
 if v_role not in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador') then
  raise exception 'Somente a gestão da instituição atribui coordenação e NDE.' using errcode='42501';
 end if;
 if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
 if p_action in ('grant','revoke') then
  v_fn := p_payload->>'function';
  if v_fn not in ('coordenador','nde') then raise exception 'Função deve ser coordenador ou nde.' using errcode='22023'; end if;
  if coalesce(p_payload->>'course_id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Curso inválido.' using errcode='22023'; end if;
  v_course := (p_payload->>'course_id')::uuid;
  if not exists(select 1 from public.vertice_courses c where c.id=v_course and c.institution_id=p_institution) then
   raise exception 'Curso não pertence à instituição.' using errcode='42501';
  end if;
  if p_action='grant' then
   select u.id into v_user from auth.users u where lower(u.email)=lower(btrim(coalesce(p_payload->>'email','')))
    and u.email_confirmed_at is not null;
   if v_user is null or not exists(select 1 from public.vertice_memberships m where m.user_id=v_user and m.institution_id=p_institution) then
    raise exception 'Esta pessoa ainda não tem acesso à instituição. Convide-a pela Equipe e aguarde o aceite.' using errcode='23514';
   end if;
   insert into public.vertice_course_staff_functions(institution_id,course_id,user_id,course_role,active,granted_by,granted_at)
   values(p_institution,v_course,v_user,v_fn,true,uid,now())
   on conflict(institution_id,course_id,user_id,course_role) do update
    set active=true,granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_by=null,revoked_at=null;
  else
   if coalesce(p_payload->>'user_id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Pessoa inválida.' using errcode='22023'; end if;
   update public.vertice_course_staff_functions set active=false,revoked_by=uid,revoked_at=now()
    where institution_id=p_institution and course_id=v_course and user_id=(p_payload->>'user_id')::uuid and course_role=v_fn and active;
   get diagnostics n = row_count;
   if n=0 then raise exception 'Função não encontrada ou já encerrada.' using errcode='23514'; end if;
  end if;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('course_id',f.course_id,'course_name',c.name,'user_id',f.user_id,'email',u.email,
    'function',f.course_role,'active',f.active,'granted_at',f.granted_at,'revoked_at',f.revoked_at)
    order by f.active desc,c.name,f.course_role,u.email)
  from public.vertice_course_staff_functions f join public.vertice_courses c on c.id=f.course_id
  join auth.users u on u.id=f.user_id where f.institution_id=p_institution),'[]'::jsonb);
end $$;
revoke all on function public.vertice_course_staff(uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_course_staff(uuid,text,jsonb) to authenticated;

create or replace function public.vertice_curriculum_build(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); v_role text; v_course public.vertice_courses; v_inst public.vertice_institutions;
 b vertice_app.curriculum_builds; latest vertice_app.curriculum_builds; comp jsonb; disc jsonb; v_cid uuid; kept uuid[] := '{}';
 n integer; result jsonb; v_fn text; v_writer boolean;
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
 -- Função no curso (coordenação/NDE) atribuída pela gestão, sobre o papel institucional.
 v_fn := vertice_private.course_function(p_institution,p_course);
 v_writer := v_role in ('master','gestor','reitor','diretor_geral','diretor_pedagogico','procurador','coordenador','nde')
   or coalesce(v_fn in ('coordenador','nde'),false);
 if p_action not in ('get','save','publish') then raise exception 'Operação inválida.' using errcode='22023'; end if;
 if p_action<>'get' and not v_writer then
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
  return jsonb_build_object('build',null,'publishedVersion',null,'canWrite',v_writer);
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
  'canWrite',v_writer);
end $$;

notify pgrst, 'reload schema';
commit;
