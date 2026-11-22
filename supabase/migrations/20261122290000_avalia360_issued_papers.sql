-- Avalia 360° — emissão registrada dos cadernos e leitura do QR (etapas 1 e 2).
-- Cada caderno impresso recebe um token aleatório (64 hex) que vai no QR e um código curto
-- (8 caracteres) para digitação. O banco guarda só o hash SHA-256 do token. O caderno fica ligado à
-- aplicação (versão validada e mapa de versões), à versão impressa e ao aluno do cadastro do curso.
-- Ao ler o QR, o servidor devolve aluno e versão; ao salvar, aluno e versão vêm do caderno
-- registrado, não do navegador. A correção reutiliza vertice_private.avalia_score_sheet.
-- A leitura automática das marcações (etapa 3) não faz parte desta migração.
begin;

create table public.vertice_avalia_issued_papers (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.vertice_avalia_applications(id) on delete restrict,
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 short_code text not null check (short_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
 variant text not null check (variant ~ '^[A-L]$'),
 student_id uuid references public.vertice_student_registry(id) on delete restrict,
 student_label text check (student_label is null or length(btrim(student_label)) between 1 and 120),
 student_key text not null,
 status text not null default 'issued' check (status in ('issued','voided')),
 sheet_id uuid references public.vertice_avalia_sheets(id) on delete set null,
 issued_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 issued_at timestamptz not null default now(),
 voided_at timestamptz,
 constraint avalia_paper_identity check (student_id is not null or student_label is not null),
 constraint avalia_paper_voided check ((status='voided')=(voided_at is not null)),
 unique (application_id, short_code)
);
create unique index vertice_avalia_papers_active on public.vertice_avalia_issued_papers(application_id, student_key) where status='issued';
create index vertice_avalia_papers_app on public.vertice_avalia_issued_papers(application_id, issued_at desc);
alter table public.vertice_avalia_issued_papers enable row level security;
revoke all on public.vertice_avalia_issued_papers from public, anon, authenticated;
create trigger avalia_issued_papers_audit after insert or update on public.vertice_avalia_issued_papers
 for each row execute function vertice_private.audit_change();

create function vertice_private.avalia_token_hash(p_token text) returns text
language sql immutable set search_path='' as $$ select encode(pg_catalog.sha256(convert_to(p_token,'UTF8')),'hex') $$;
revoke all on function vertice_private.avalia_token_hash(text) from public,anon,authenticated;

-- Código curto sem caracteres ambíguos (sem I, O, 0, 1).
create function vertice_private.avalia_short_code() returns text
language sql volatile set search_path='' as $$
 select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1+(get_byte(b,i) % 32), 1), '' order by i)
 from (select decode(replace(gen_random_uuid()::text,'-',''),'hex') b) x, generate_series(0,7) i
$$;
revoke all on function vertice_private.avalia_short_code() from public,anon,authenticated;

create function vertice_private.avalia_paper_json(p public.vertice_avalia_issued_papers) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paperId',p.id,'applicationId',p.application_id,'shortCode',p.short_code,'variant',p.variant,
  'studentId',p.student_id,'label',coalesce(st.full_name,p.student_label),'enrollment',st.enrollment_code,
  'status',p.status,'issuedAt',p.issued_at,'sheetId',p.sheet_id,
  'sheet',(select jsonb_build_object('total',s.total_score,'max',s.max_score,'updatedAt',s.updated_at,
     'items',(select jsonb_agg(jsonb_build_object('q',i.question_id,'n',i.display_number,'kind',i.kind,'mark',i.chosen_label,
        'outcome',i.outcome,'score',i.score,'max',i.max_score) order by i.display_number)
      from public.vertice_avalia_item_scores i where i.sheet_id=s.id))
   from public.vertice_avalia_sheets s where s.id=p.sheet_id))
 from (select 1) one left join public.vertice_student_registry st on st.id=p.student_id
$$;
revoke all on function vertice_private.avalia_paper_json(public.vertice_avalia_issued_papers) from public,anon,authenticated;

create function public.vertice_avalia_papers(p_institution uuid,p_course uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid();
 a public.vertice_avalia_applications; d public.vertice_avalia_drafts; p public.vertice_avalia_issued_papers;
 row_in jsonb; sid uuid; skey text; label text; variant text; token text; code text; out jsonb := '[]'::jsonb;
 sheet uuid; tries integer;
begin
 if uid is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Cadernos restritos à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.' using errcode='22023'; end if;
 if p_action not in ('issue','list','scan','save','void') then raise exception 'Ação inválida.' using errcode='22023'; end if;

 -- Leitura do QR: o token identifica o caderno; o acesso é conferido pela aplicação.
 if p_action='scan' then
  code := upper(regexp_replace(coalesce(p_payload->>'code',''),'\s',''));
  if code ~ '^VA360:2:[0-9A-F]{64}$' then code := substr(code,9); end if;
  if code ~ '^[0-9A-F]{64}$' then
   select * into p from public.vertice_avalia_issued_papers x where x.token_hash=vertice_private.avalia_token_hash(lower(code));
  elsif code ~ '^[A-HJ-NP-Z2-9]{8}$' and nullif(p_payload->>'applicationId','') is not null then
   select * into p from public.vertice_avalia_issued_papers x where x.short_code=code and x.application_id::text=p_payload->>'applicationId';
  elsif code like 'VA360-DEMO:%' then
   raise exception 'Este QR é de demonstração e não está registrado. Gere os cadernos pela aplicação.' using errcode='22023';
  else
   raise exception 'Código não reconhecido. Leia o QR do caderno ou digite o código de 8 caracteres.' using errcode='22023';
  end if;
  if p.id is null then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  a := vertice_private.avalia_application_access(p.application_id,false);
  if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  if p.status='voided' then raise exception 'Caderno substituído por reimpressão. Use o caderno mais recente deste aluno.' using errcode='23514'; end if;
  return vertice_private.avalia_paper_json(p)||jsonb_build_object('applicationStatus',a.status);
 end if;

 if p_action in ('save','void') then
  select * into p from public.vertice_avalia_issued_papers x where x.id::text=p_payload->>'paperId';
  if p.id is null then raise exception 'Caderno não localizado.' using errcode='P0002'; end if;
  a := vertice_private.avalia_application_access(p.application_id,true);
 else
  a := vertice_private.avalia_application_access(nullif(p_payload->>'applicationId','')::uuid, p_action='issue');
 end if;
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(vertice_private.avalia_paper_json(x) order by lower(coalesce(st.full_name,x.student_label)), x.issued_at)
   from public.vertice_avalia_issued_papers x left join public.vertice_student_registry st on st.id=x.student_id
   where x.application_id=a.id and (x.status='issued' or coalesce((p_payload->>'includeVoided')::boolean,false))),'[]'::jsonb);
 end if;

 if p_action='void' then
  if p.status='voided' then raise exception 'Caderno já anulado.' using errcode='23514'; end if;
  update public.vertice_avalia_issued_papers set status='voided',voided_at=now() where id=p.id returning * into p;
  return vertice_private.avalia_paper_json(p);
 end if;

 if p_action='issue' then
  if jsonb_typeof(p_payload->'papers') is distinct from 'array' or jsonb_array_length(p_payload->'papers') not between 1 and 400 then
   raise exception 'Emita entre 1 e 400 cadernos por vez.' using errcode='22023';
  end if;
  for row_in in select value from jsonb_array_elements(p_payload->'papers') loop
   variant := upper(btrim(coalesce(row_in->>'variant','')));
   if not (a.variant_map ? variant) then raise exception 'Versão "%" não existe nesta aplicação.', variant using errcode='22023'; end if;
   sid := null; label := null;
   if nullif(row_in->>'studentId','') is not null then
    select s.id into sid from public.vertice_student_registry s
     where s.id::text=row_in->>'studentId' and s.institution_id=a.institution_id and s.course_id=a.course_id;
    if sid is null then raise exception 'Aluno fora do cadastro deste curso.' using errcode='22023'; end if;
    skey := sid::text;
   else
    label := nullif(left(btrim(coalesce(row_in->>'label','')),120),'');
    if label is null then raise exception 'Identifique cada caderno (aluno do cadastro ou código).' using errcode='22023'; end if;
    skey := 'label:'||lower(label);
   end if;
   -- Reimpressão: o caderno anterior do mesmo aluno deixa de valer.
   update public.vertice_avalia_issued_papers set status='voided',voided_at=now()
    where application_id=a.id and student_key=skey and status='issued';
   token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   tries := 0;
   loop
    code := vertice_private.avalia_short_code();
    exit when not exists(select 1 from public.vertice_avalia_issued_papers x where x.application_id=a.id and x.short_code=code);
    tries := tries+1; if tries>20 then raise exception 'Não foi possível gerar código único.' using errcode='P0001'; end if;
   end loop;
   insert into public.vertice_avalia_issued_papers(application_id,token_hash,short_code,variant,student_id,student_label,student_key,issued_by,sheet_id)
   values(a.id,vertice_private.avalia_token_hash(token),code,variant,sid,label,skey,uid,
    (select s.id from public.vertice_avalia_sheets s where s.application_id=a.id and s.student_key=skey))
   returning * into p;
   -- O token só é devolvido aqui, uma vez, para ir no QR impresso.
   out := out || jsonb_build_array(vertice_private.avalia_paper_json(p)||jsonb_build_object('token',token,'qr','VA360:2:'||upper(token)));
  end loop;
  return out;
 end if;

 -- save: aluno e versão vêm do caderno registrado.
 if p.status='voided' then raise exception 'Caderno substituído por reimpressão.' using errcode='23514'; end if;
 if (jsonb_typeof(coalesce(p_payload->'objective','{}'::jsonb))<>'object') or (jsonb_typeof(coalesce(p_payload->'discursive','{}'::jsonb))<>'object') then
  raise exception 'Respostas em formato inválido.' using errcode='22023';
 end if;
 d.snapshot := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);
 insert into public.vertice_avalia_sheets(application_id,student_id,student_label,student_key,variant,total_score,max_score,entered_by)
 values(a.id,p.student_id,case when p.student_id is null then p.student_label end,p.student_key,p.variant,0,0,uid)
 on conflict (application_id,student_key) do update set variant=excluded.variant,entered_by=uid,updated_at=now()
 returning id into sheet;
 perform vertice_private.avalia_score_sheet(sheet,a,d.snapshot,p.variant,coalesce(p_payload->'objective','{}'::jsonb),coalesce(p_payload->'discursive','{}'::jsonb));
 update public.vertice_avalia_issued_papers set sheet_id=sheet where id=p.id returning * into p;
 return vertice_private.avalia_paper_json(p);
end $$;
revoke all on function public.vertice_avalia_papers(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vertice_avalia_papers(uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
