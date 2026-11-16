-- Central nativa do Master. Somente registros de acompanhamento; não modifica processos acadêmicos.
create table vertice_private.master_homologation_entries (
 id uuid primary key,
 seq bigint generated always as identity unique not null,
 module_key text not null check(module_key in ('conecta','planejamento','sapiens','tcc','ac','estagio')),
 institution_id uuid not null references public.vertice_institutions(id),
 course_id uuid references public.vertice_courses(id),
 kind text not null check(kind in ('evidence','observation','module','checklist')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=24000),
 created_by uuid not null,
 created_at timestamptz not null default now()
);
alter table vertice_private.master_homologation_entries enable row level security;
revoke all on vertice_private.master_homologation_entries from public,anon,authenticated;
revoke all on sequence vertice_private.master_homologation_entries_seq_seq from public,anon,authenticated;
create index master_homologation_scope_idx on vertice_private.master_homologation_entries(institution_id,course_id,module_key,kind,seq desc);
create index master_homologation_course_idx on vertice_private.master_homologation_entries(course_id) where course_id is not null;
create index master_homologation_check_idx on vertice_private.master_homologation_entries(module_key,institution_id,course_id,(payload->>'key'),seq desc) where kind='checklist';

create or replace function vertice_private.master_homologation(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_id uuid;v_module text;v_inst uuid;v_course uuid;v_body jsonb;v_existing vertice_private.master_homologation_entries;
 v_saved vertice_private.master_homologation_entries;v_latest bigint;v_before bigint;v_items jsonb;v_snapshots jsonb;
 v_more boolean;v_next bigint;v_evidence vertice_private.master_homologation_entries;v_key text;v_result text;v_status text;
 v_check text;v_check_row vertice_private.master_homologation_entries;v_expected bigint;v_reason text;
begin
 if auth.uid() is null or not coalesce(vertice_private.is_master(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'Central restrita ao Master com segundo fator' using errcode='42501';
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>26000 then raise exception 'Registro inválido ou extenso';end if;
 if p_action in ('state','history') then
  v_before:=nullif(p_payload->>'before','')::bigint;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.seq desc),'[]'::jsonb) into v_items from
   (select * from vertice_private.master_homologation_entries where v_before is null or seq<v_before order by seq desc limit 200) q;
  select min((x->>'seq')::bigint) into v_next from jsonb_array_elements(v_items) x;
  select exists(select 1 from vertice_private.master_homologation_entries where seq<v_next) into v_more;
  if p_action='state' then
   select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_snapshots from
    (select distinct on (module_key,institution_id,course_id,kind,coalesce(payload->>'key','')) *
     from vertice_private.master_homologation_entries where kind in ('module','checklist')
     order by module_key,institution_id,course_id,kind,coalesce(payload->>'key',''),seq desc) q;
  end if;
  return jsonb_build_object('entries',v_items,'current',coalesce(v_snapshots,'[]'::jsonb),'next_before',case when v_more then v_next else null end,'fetched_at',now());
 end if;
 if p_action not in ('evidence','observation','module','checklist') then raise exception 'Ação inválida';end if;
 v_id:=nullif(p_payload->>'id','')::uuid;v_module:=p_payload->>'module_key';v_inst:=nullif(p_payload->>'institution_id','')::uuid;v_course:=nullif(p_payload->>'course_id','')::uuid;
 if v_id is null or v_module not in ('conecta','planejamento','sapiens','tcc','ac','estagio') or v_module is null then raise exception 'Selecione um módulo válido';end if;
 if v_inst is null or not exists(select 1 from public.vertice_institutions where id=v_inst) then raise exception 'Instituição não localizada';end if;
 if v_course is not null and not exists(select 1 from public.vertice_courses where id=v_course and institution_id=v_inst) then raise exception 'Curso não pertence à instituição';end if;
 if length(btrim(coalesce(p_payload->>'responsible','')))<2 or length(p_payload->>'responsible')>180 then raise exception 'Informe o responsável';end if;
 v_reason:=btrim(coalesce(p_payload->>'note',''));
 if length(v_reason)<5 or length(v_reason)>8000 then raise exception 'Registre uma justificativa ou resultado com ao menos cinco caracteres';end if;
 -- Allowlist: nenhum campo do registro concede permissão ou altera outro módulo.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_body from jsonb_each(p_payload)
 where key=any(array['title','note','responsible','environment','dataNature','profile','date','url','expected','version','branch','sha','status','next','pending','decisions','key','result','evidenceId','confirmHuman','outcome']);
 if coalesce(v_body->>'url','')<>'' and (v_body->>'url' !~ '^https://[^[:space:]]+$' or length(v_body->>'url')>2400) then raise exception 'Use uma URL HTTPS válida';end if;
 -- Mesmo request/conteúdo não duplica. Request alterado é recusado antes de validar revisão.
 perform pg_advisory_xact_lock(hashtextextended('master-homologation-request:'||v_id::text,0));
 select * into v_existing from vertice_private.master_homologation_entries where id=v_id;
 if v_existing.id is not null then
  if v_existing.module_key=v_module and v_existing.institution_id=v_inst and v_existing.course_id is not distinct from v_course and v_existing.kind=p_action and v_existing.payload=v_body and v_existing.created_by=auth.uid() then return to_jsonb(v_existing);end if;
  raise exception 'Identificador já usado por outro conteúdo' using errcode='40001';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('master-homologation-scope:'||v_module||':'||v_inst::text||':'||coalesce(v_course::text,'institution'),0));
 if p_action in ('evidence','observation') then
  if length(btrim(coalesce(v_body->>'title','')))<3 or length(v_body->>'title')>200 then raise exception 'Informe o título';end if;
  if coalesce(v_body->>'environment','') not in ('Local','Demonstração','Produção') then raise exception 'Informe o ambiente';end if;
  if coalesce(v_body->>'dataNature','') not in ('Sintéticos','Reais','Não informado') then raise exception 'Informe a natureza dos dados';end if;
  if coalesce(v_body->>'outcome','') not in ('Passou','Falhou','Parcial','Não testado') then raise exception 'Informe o resultado do teste';end if;
  if length(coalesce(v_body->>'profile',''))=0 then raise exception 'Informe o perfil exercitado';end if;
  if coalesce(v_body->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Informe a data da verificação';end if;
  perform (v_body->>'date')::date;
  if p_action='evidence' and coalesce(v_body->>'url','')='' then raise exception 'Vincule a URL da evidência';end if;
 elsif p_action in ('module','checklist') then
  v_key:=case when p_action='checklist' then coalesce(v_body->>'key','') else '' end;
  if p_action='checklist' and v_key not in ('version','access','journey','documents','integration','mobile','failure','acceptance') then raise exception 'Item inválido';end if;
  select seq into v_latest from vertice_private.master_homologation_entries
   where module_key=v_module and institution_id=v_inst and course_id is not distinct from v_course and kind=p_action and coalesce(payload->>'key','')=v_key order by seq desc limit 1;
  v_expected:=nullif(p_payload->>'expected_seq','')::bigint;
  if v_expected is null or v_expected<>coalesce(v_latest,0) then raise exception 'Registro atualizado em outra sessão. Recarregue antes de salvar.' using errcode='40001';end if;
  if p_action='checklist' then
   v_result:=coalesce(v_body->>'result','');
   if v_result not in ('Pendente','Atendido','Falhou','Não aplicável') then raise exception 'Resultado inválido';end if;
   if v_result='Atendido' then
    select * into v_evidence from vertice_private.master_homologation_entries where id=nullif(v_body->>'evidenceId','')::uuid and kind='evidence' and module_key=v_module and institution_id=v_inst and course_id is not distinct from v_course;
    if v_evidence.id is null then raise exception 'Vincule evidência do mesmo módulo, instituição e curso';end if;
   end if;
  else
   v_status:=coalesce(v_body->>'status','');
   if v_status not in ('Em desenvolvimento','Em revisão','Bloqueado','Validado','Homologado','Publicado') then raise exception 'Status inválido';end if;
   if v_status='Homologado' then
    if coalesce(v_body->'confirmHuman','false'::jsonb)<>'true'::jsonb then raise exception 'O aceite exige confirmação humana explícita';end if;
    select * into v_evidence from vertice_private.master_homologation_entries where id=nullif(v_body->>'evidenceId','')::uuid and kind='evidence' and module_key=v_module and institution_id=v_inst and course_id is not distinct from v_course and payload->>'environment'='Produção' and payload->>'dataNature'='Reais' and payload->>'outcome'='Passou';
    if v_evidence.id is null then raise exception 'O aceite exige evidência aprovada no teste, em produção com dados reais, no mesmo escopo';end if;
    foreach v_check in array array['version','access','journey','documents','integration','mobile','failure','acceptance'] loop
     select * into v_check_row from vertice_private.master_homologation_entries where kind='checklist' and module_key=v_module and institution_id=v_inst and course_id is not distinct from v_course and payload->>'key'=v_check order by seq desc limit 1;
     if v_check_row.id is null or coalesce(v_check_row.payload->>'result','') not in ('Atendido','Não aplicável') then raise exception 'Conclua o checklist deste escopo antes do aceite';end if;
     if v_check in ('version','access','journey','acceptance') and v_check_row.payload->>'result'<>'Atendido' then raise exception 'Versão, acesso, jornada e aceite devem estar atendidos';end if;
     if v_check in ('journey','acceptance') and not exists(select 1 from vertice_private.master_homologation_entries e where e.id=nullif(v_check_row.payload->>'evidenceId','')::uuid and e.kind='evidence' and e.module_key=v_module and e.institution_id=v_inst and e.course_id is not distinct from v_course and e.payload->>'environment'='Produção' and e.payload->>'dataNature'='Reais' and e.payload->>'outcome'='Passou') then raise exception 'Jornada e aceite exigem evidência real de produção';end if;
    end loop;
   end if;
  end if;
 end if;
 insert into vertice_private.master_homologation_entries(id,module_key,institution_id,course_id,kind,payload,created_by)
 values(v_id,v_module,v_inst,v_course,p_action,v_body,auth.uid()) returning * into v_saved;
 return to_jsonb(v_saved);
end;$$;
revoke all on function vertice_private.master_homologation(text,jsonb) from public,anon,authenticated;
grant execute on function vertice_private.master_homologation(text,jsonb) to authenticated;
create or replace function public.vertice_master_homologation(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $rpc$
 select vertice_private.master_homologation(p_action,p_payload);
$rpc$;
revoke all on function public.vertice_master_homologation(text,jsonb) from public,anon,authenticated;
grant execute on function public.vertice_master_homologation(text,jsonb) to authenticated;
comment on function public.vertice_master_homologation(text,jsonb) is 'Central Master com MFA. Registros de acompanhamento e aceite humano; não aprova nem altera documentos ou processos institucionais.';
