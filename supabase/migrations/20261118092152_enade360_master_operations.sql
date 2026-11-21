-- Acompanhamento nativo do Master; NÃO executa migrações, merges ou publicações.
-- Aplicar somente após aprovação explícita e no projeto/ambiente autorizado.
begin;
create table vertice_private.enade360_operation_events (
 id uuid primary key,
 seq bigint generated always as identity unique not null,
 front text not null check(front in ('core','github','supabase','render','extraction','ocr','classification','index','sapiens','planning','r2','r3','r4','r5','r6','science','access')),
 institution_id uuid references public.vertice_institutions(id),
 course_id uuid references public.vertice_courses(id),
 environment text not null check(environment in ('Local','Demonstração','Homologação','Produção')),
 kind text not null check(kind in ('revision','approval')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=60000),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 check(course_id is null or institution_id is not null)
);
alter table vertice_private.enade360_operation_events enable row level security;
revoke all on vertice_private.enade360_operation_events from public,anon,authenticated;
revoke all on sequence vertice_private.enade360_operation_events_seq_seq from public,anon,authenticated;
create index enade360_operation_scope_idx on vertice_private.enade360_operation_events(environment,institution_id,course_id,front,seq desc);

create function vertice_private.enade360_operations(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_inst uuid;v_course uuid;v_env text;v_front text;v_id uuid;v_body jsonb;v_before bigint;v_next bigint;v_more boolean;
 v_entries jsonb;v_current jsonb;v_latest bigint;v_expected bigint;v_status text;v_test jsonb;v_check jsonb;v_key text;
 v_existing vertice_private.enade360_operation_events;v_saved vertice_private.enade360_operation_events;
 v_tests text[]:=array['local','sintético','autenticado','dados reais'];
 v_checks text[]:=array['version','local','synthetic','provenance','access','authenticated','real','scientific','approval','migration','deploy','smoke'];
begin
 if auth.uid() is null or not coalesce(vertice_private.is_master(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'Área restrita ao Master com MFA/AAL2' using errcode='42501',detail='Master com MFA/AAL2 obrigatório.';
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65000 then raise exception 'Registro inválido ou extenso';end if;
 v_inst:=nullif(p_payload->>'institution_id','')::uuid;v_course:=nullif(p_payload->>'course_id','')::uuid;v_env:=p_payload->>'environment';
 if v_env is null or v_env not in ('Local','Demonstração','Homologação','Produção') then raise exception 'Ambiente inválido';end if;
 if v_inst is not null and not exists(select 1 from public.vertice_institutions where id=v_inst) then raise exception 'Instituição não localizada';end if;
 if v_course is not null and (v_inst is null or not exists(select 1 from public.vertice_courses where id=v_course and institution_id=v_inst)) then raise exception 'Curso não pertence à instituição';end if;
 if p_action='state' then
  v_before:=nullif(p_payload->>'before','')::bigint;
  -- Projeção sem created_by: a identidade fica na trilha privada, nunca no cliente/exportação.
  select coalesce(jsonb_agg(to_jsonb(q) order by q.seq desc),'[]'::jsonb) into v_entries from
   (select id,seq,front,institution_id,course_id,environment,kind,payload,created_at
    from vertice_private.enade360_operation_events where institution_id is not distinct from v_inst and course_id is not distinct from v_course and environment=v_env and (v_before is null or seq<v_before) order by seq desc limit 100) q;
  select min((x->>'seq')::bigint) into v_next from jsonb_array_elements(v_entries) x;
  select exists(select 1 from vertice_private.enade360_operation_events where institution_id is not distinct from v_inst and course_id is not distinct from v_course and environment=v_env and seq<v_next) into v_more;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_current from
   (select distinct on(front) id,seq,front,institution_id,course_id,environment,kind,payload,created_at from vertice_private.enade360_operation_events where institution_id is not distinct from v_inst and course_id is not distinct from v_course and environment=v_env and kind='revision' order by front,seq desc) q;
  return jsonb_build_object('entries',v_entries,'current',v_current,'next_before',case when v_more then v_next else null end,'fetched_at',now());
 end if;
 if p_action not in ('revision','approval') then raise exception 'Ação inválida';end if;
 v_id:=nullif(p_payload->>'id','')::uuid;v_front:=p_payload->>'front';v_body:=p_payload->'payload';
 if v_id is null or v_front is null or v_front not in ('core','github','supabase','render','extraction','ocr','classification','index','sapiens','planning','r2','r3','r4','r5','r6','science','access') then raise exception 'Frente inválida';end if;
 if v_body is null or jsonb_typeof(v_body)<>'object' or octet_length(v_body::text)>60000 then raise exception 'Conteúdo inválido ou extenso';end if;
 if exists(select 1 from jsonb_object_keys(v_body) k where k<>all(array['status','version','branch','url','migration','note','failure','cause','correction','dependencies','risks','decisions','next','provenance','tests','checks','confirmHuman','action','target','approvalReference'])) then raise exception 'Campo não permitido';end if;
 foreach v_key in array array['status','version','branch','url','migration','note','failure','cause','correction','dependencies','risks','decisions','next','provenance','action','target','approvalReference'] loop
  if v_body?v_key and (jsonb_typeof(v_body->v_key)<>'string' or length(v_body->>v_key)>4000) then raise exception 'Campo textual inválido: %',v_key;end if;
 end loop;
 if length(btrim(coalesce(v_body->>'note','')))<5 then raise exception 'Informe resultado ou justificativa';end if;
 foreach v_key in array array['url','approvalReference'] loop
  if coalesce(v_body->>v_key,'')<>'' and (v_body->>v_key !~ '^https://[^[:space:]@]+$' or length(v_body->>v_key)>2400) then raise exception 'Use URL HTTPS sem credenciais';end if;
 end loop;
 if v_body?'confirmHuman' and jsonb_typeof(v_body->'confirmHuman')<>'boolean' then raise exception 'Confirmação humana inválida';end if;
 perform pg_advisory_xact_lock(hashtextextended('enade360-operation-request:'||v_id::text,0));
 select * into v_existing from vertice_private.enade360_operation_events where id=v_id;
 if v_existing.id is not null then
  if v_existing.front=v_front and v_existing.institution_id is not distinct from v_inst and v_existing.course_id is not distinct from v_course and v_existing.environment=v_env and v_existing.kind=p_action and v_existing.payload=v_body and v_existing.created_by=auth.uid() then return to_jsonb(v_existing)-'created_by';end if;
  raise exception 'Identificador já utilizado por conteúdo diferente' using errcode='40001';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('enade360-operation-scope:'||v_front||':'||coalesce(v_inst::text,'generic')||':'||coalesce(v_course::text,'institution')||':'||v_env,0));
 if p_action='approval' then
  if coalesce(v_body->>'action','') not in ('merge','migração','alteração de banco','publicação','mudança de produção') or length(btrim(coalesce(v_body->>'target','')))<3 or length(btrim(coalesce(v_body->>'version','')))<1 or coalesce(v_body->>'approvalReference','')='' or coalesce(v_body->'confirmHuman','false'::jsonb)<>'true'::jsonb then raise exception 'Aprovação exige ação, alvo, versão, URL e confirmação explícita';end if;
 else
  select seq into v_latest from vertice_private.enade360_operation_events where front=v_front and institution_id is not distinct from v_inst and course_id is not distinct from v_course and environment=v_env and kind='revision' order by seq desc limit 1;
  v_expected:=nullif(p_payload->>'expected_seq','')::bigint;
  if v_expected is null or v_expected<>coalesce(v_latest,0) then raise exception 'Registro atualizado em outra sessão. Recarregue antes de salvar.' using errcode='40001';end if;
  v_status:=coalesce(v_body->>'status','');
  if v_status not in ('em desenvolvimento','em revisão','integrado','publicado','comprovadamente funcional','não confirmado','bloqueado','pronto para homologação','homologado') then raise exception 'Status inválido';end if;
  if jsonb_typeof(v_body->'tests') is distinct from 'array' then raise exception 'Informe os quatro níveis de teste';end if;
  if jsonb_array_length(v_body->'tests')<>4 or (select count(distinct x->>'level') from jsonb_array_elements(v_body->'tests') x where x->>'level'=any(v_tests))<>4 then raise exception 'Níveis de teste ausentes ou duplicados';end if;
  for v_test in select * from jsonb_array_elements(v_body->'tests') loop
   if jsonb_typeof(v_test->'executed') is distinct from 'boolean' or jsonb_typeof(v_test->'validated') is distinct from 'boolean' or jsonb_typeof(v_test->'result') is distinct from 'string' or jsonb_typeof(v_test->'evidence') is distinct from 'string' then raise exception 'Teste inválido';end if;
   if coalesce(v_test->>'outcome','') not in ('não executado','passou','falhou','parcial') then raise exception 'Resultado do teste inválido';end if;
   if (v_test->>'validated')::boolean and (not (v_test->>'executed')::boolean or v_test->>'outcome'='não executado' or v_test->>'evidence' !~ '^https://[^[:space:]@]+$' or length(btrim(v_test->>'result'))=0) then raise exception 'Teste validado exige execução, resultado e URL HTTPS';end if;
   if coalesce(v_test->>'evidence','')<>'' and v_test->>'evidence' !~ '^https://[^[:space:]@]+$' then raise exception 'URL de teste inválida';end if;
  end loop;
  if jsonb_typeof(v_body->'checks') is distinct from 'array' then raise exception 'Informe os checklists';end if;
  if jsonb_array_length(v_body->'checks')<>12 or (select count(distinct x->>'key') from jsonb_array_elements(v_body->'checks') x where x->>'key'=any(v_checks))<>12 then raise exception 'Itens de checklist ausentes ou duplicados';end if;
  for v_check in select * from jsonb_array_elements(v_body->'checks') loop
   if coalesce(v_check->>'result','') not in ('pendente','atendido','não aplicável') or jsonb_typeof(v_check->'note') is distinct from 'string' or jsonb_typeof(v_check->'evidence') is distinct from 'string' then raise exception 'Checklist inválido';end if;
   if v_check->>'result'<>'pendente' and length(btrim(v_check->>'note'))=0 then raise exception 'Checklist exige justificativa';end if;
   if v_check->>'result'='atendido' and v_check->>'evidence' !~ '^https://[^[:space:]@]+$' then raise exception 'Checklist atendido exige URL HTTPS';end if;
   if coalesce(v_check->>'evidence','')<>'' and v_check->>'evidence' !~ '^https://[^[:space:]@]+$' then raise exception 'URL de checklist inválida';end if;
  end loop;
  if v_status in ('integrado','publicado','comprovadamente funcional','pronto para homologação','homologado') and (length(btrim(coalesce(v_body->>'version','')))=0 or coalesce(v_body->>'url','')='') then raise exception 'Status exige versão e URL verificável';end if;
  if v_status in ('comprovadamente funcional','pronto para homologação','homologado') then
   if v_env in ('Local','Demonstração') or not exists(select 1 from jsonb_array_elements(v_body->'tests') x where x->>'level'='autenticado' and x->'validated'='true'::jsonb and x->>'outcome'='passou') or not exists(select 1 from jsonb_array_elements(v_body->'tests') x where x->>'level'='dados reais' and x->'validated'='true'::jsonb and x->>'outcome'='passou') then raise exception 'Funcionamento exige testes autenticados e reais validados em homologação ou produção';end if;
   if length(btrim(coalesce(v_body->>'failure','')))>0 or length(btrim(coalesce(v_body->>'dependencies','')))>0 or exists(select 1 from jsonb_array_elements(v_body->'tests') x where x->'executed'='true'::jsonb and x->>'outcome' in ('falhou','parcial')) then raise exception 'Falhas e dependências pendentes impedem esse status';end if;
  end if;
  if v_status in ('pronto para homologação','homologado') then
   if exists(select 1 from jsonb_array_elements(v_body->'checks') x where x->>'key'=any(v_checks[1:8]) and (v_status='homologado' or x->>'key'<>'scientific') and x->>'result'<>'atendido') then raise exception 'Conclua desenvolvimento e homologação com evidências';end if;
  end if;
  if v_status='homologado' then
   if coalesce(v_body->'confirmHuman','false'::jsonb)<>'true'::jsonb then raise exception 'Homologação exige aceite humano explícito';end if;
   if v_env='Produção' and exists(select 1 from jsonb_array_elements(v_body->'checks') x where x->>'result'<>'atendido') then raise exception 'Conclua também o checklist de produção';end if;
  end if;
 end if;
 insert into vertice_private.enade360_operation_events(id,front,institution_id,course_id,environment,kind,payload,created_by) values(v_id,v_front,v_inst,v_course,v_env,p_action,v_body,auth.uid()) returning * into v_saved;
 return to_jsonb(v_saved)-'created_by';
end;$$;
revoke all on function vertice_private.enade360_operations(text,jsonb) from public,anon,authenticated;
grant execute on function vertice_private.enade360_operations(text,jsonb) to authenticated;
create function public.vertice_enade360_operations(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select vertice_private.enade360_operations(p_action,p_payload); $$;
revoke all on function public.vertice_enade360_operations(text,jsonb) from public,anon,authenticated;
grant execute on function public.vertice_enade360_operations(text,jsonb) to authenticated;
comment on function public.vertice_enade360_operations(text,jsonb) is 'Trilha privada do Master com AAL2, somente acompanhamento. Não executa operações externas nem homologa indicadores ou documentos.';
commit;
