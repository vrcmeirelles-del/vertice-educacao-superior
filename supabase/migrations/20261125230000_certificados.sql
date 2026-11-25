-- Certificados de Extensão e de Atividades de Ensino com código de verificação público.
--
-- Fonte das horas (nada é digitado no certificado):
--   extensão: soma dos lançamentos validados ou integralizados do estudante no projeto
--             (crédito, correção e estorno; vertice_extension_hour_entries);
--   ensino:   minutos do estudante na atividade validada (vertice_private.teaching_activity_students).
-- O certificado guarda um retrato do que foi emitido (nome, atividade, minutos, signatário) e o sha256
-- desse conteúdo. A assinatura é a identificação do signatário informada por quem emite, com o
-- registro de quem emitiu; não é assinatura digital ICP-Brasil.
-- Emitir e revogar exigem gestão com MFA (mesmas permissões de cada módulo). A verificação pública
-- recebe só o código e devolve só o que está impresso no certificado, sem CPF, e-mail ou matrícula.

create table public.vertice_certificates(
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete restrict,
  course_id uuid,
  kind text not null check (kind in ('extensao','ensino')),
  source_id uuid not null,
  holder_ref uuid not null,
  holder_name text not null check (length(btrim(holder_name)) between 2 and 200),
  activity_title text not null check (length(btrim(activity_title)) between 2 and 300),
  minutes integer not null check (minutes > 0 and minutes <= 600000),
  period_start date,
  period_end date,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  signer_name text not null check (length(btrim(signer_name)) between 3 and 200),
  signer_role text not null check (length(btrim(signer_role)) between 3 and 200),
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  status text not null default 'emitido' check (status in ('emitido','revogado')),
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text check (revoked_reason is null or length(revoked_reason) between 5 and 2000),
  foreign key (course_id, institution_id) references public.vertice_courses(id, institution_id) on delete restrict,
  check ((status = 'revogado') = (revoked_at is not null and revoked_by is not null and revoked_reason is not null))
);
-- Um certificado vigente por estudante e origem; revogado libera nova emissão.
create unique index vertice_certificates_active on public.vertice_certificates(kind, source_id, holder_ref) where status = 'emitido';
create index vertice_certificates_scope on public.vertice_certificates(institution_id, kind, source_id);
create index vertice_certificates_course on public.vertice_certificates(course_id, institution_id);
alter table public.vertice_certificates enable row level security;
revoke all on public.vertice_certificates from public, anon, authenticated;

-- Conteúdo emitido é imutável; só a revogação altera o registro, e uma vez.
create function vertice_private.certificate_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'certificado não pode ser apagado; revogue com justificativa' using errcode = '42501'; end if;
  if old.status = 'revogado' then raise exception 'certificado revogado é imutável' using errcode = '42501'; end if;
  if (new.id, new.institution_id, new.course_id, new.kind, new.source_id, new.holder_ref, new.holder_name, new.activity_title, new.minutes,
      new.period_start, new.period_end, new.code, new.content_sha256, new.signer_name, new.signer_role, new.issued_by, new.issued_at)
     is distinct from
     (old.id, old.institution_id, old.course_id, old.kind, old.source_id, old.holder_ref, old.holder_name, old.activity_title, old.minutes,
      old.period_start, old.period_end, old.code, old.content_sha256, old.signer_name, old.signer_role, old.issued_by, old.issued_at) then
    raise exception 'conteúdo do certificado é imutável' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger vertice_certificates_guard before update or delete on public.vertice_certificates for each row execute function vertice_private.certificate_guard();

-- Código legível: 12 caracteres sem 0/O/1/I, em três blocos (cerca de 60 bits).
create function vertice_private.certificate_code() returns text language plpgsql volatile set search_path = '' as $$
declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(12); s text := ''; i int;
begin
  for i in 0..11 loop s := s || substr(a, (get_byte(b, i) % 32) + 1, 1); if i in (3, 7) then s := s || '-'; end if; end loop;
  return s;
end $$;

-- Escopo e permissão de uma origem. Devolve instituição, curso, título, período e se o usuário pode emitir.
create function vertice_private.certificate_source(p_kind text, p_source uuid)
returns table(institution_id uuid, course_id uuid, title text, period_start date, period_end date, can_issue boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind = 'extensao' then
    return query select p.institution_id, null::uuid, p.title, p.start_date, p.end_date,
      coalesce(vertice_private.is_master() or vertice_private.extension_project_manager(p), false)
      from public.vertice_extension_projects p where p.id = p_source and p.deleted_at is null;
  elsif p_kind = 'ensino' then
    return query select a.institution_id, a.course_id, a.title, a.activity_date, a.activity_date,
      coalesce(a.status = 'validada' and vertice_private.teaching_access(a.institution_id, a.course_id, 'certify'), false)
      from public.vertice_teaching_activities a where a.id = p_source;
  else
    raise exception 'tipo de certificado inválido' using errcode = '22023';
  end if;
end $$;

-- Quem tem direito e quantos minutos, calculado das fontes.
create function vertice_private.certificate_eligible(p_kind text, p_source uuid)
returns table(holder_ref uuid, holder_name text, minutes integer)
language sql stable security definer set search_path = '' as $$
  select s.id, btrim(s.full_name), sum(h.minutes)::integer
  from public.vertice_extension_students s
  join public.vertice_extension_hour_entries h on h.student_id = s.id and h.project_id = s.project_id
  where p_kind = 'extensao' and s.project_id = p_source and s.deleted_at is null and s.removed_at is null
    and h.hour_state in ('validada','integralizada') and nullif(btrim(s.full_name), '') is not null
  group by s.id, s.full_name having sum(h.minutes) > 0
  union all
  select r.id, btrim(r.full_name), t.minutes
  from vertice_private.teaching_activity_students t
  join public.vertice_student_registry r on r.id = t.student_id
  join public.vertice_teaching_activities a on a.id = t.activity_id and a.status = 'validada'
  where p_kind = 'ensino' and t.activity_id = p_source and t.removed_at is null and t.minutes > 0
    and nullif(btrim(r.full_name), '') is not null
$$;

-- Lista para a tela: elegíveis com o certificado vigente, se houver.
create function public.vertice_certificate_roster(p_kind text, p_source uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record;
begin
  select * into s from vertice_private.certificate_source(p_kind, p_source);
  if s.institution_id is null or not s.can_issue then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  return jsonb_build_object('title', s.title, 'institution', (select i.name from public.vertice_institutions i where i.id = s.institution_id), 'eligible', coalesce((select jsonb_agg(jsonb_build_object(
      'holderRef', e.holder_ref, 'holderName', e.holder_name, 'minutes', e.minutes,
      'certificate', (select jsonb_build_object('id', c.id, 'code', c.code, 'minutes', c.minutes, 'issuedAt', c.issued_at,
                        'signerName', c.signer_name, 'signerRole', c.signer_role, 'holderName', c.holder_name, 'activityTitle', c.activity_title,
                        'periodStart', c.period_start, 'periodEnd', c.period_end, 'outdated', c.minutes <> e.minutes)
                      from public.vertice_certificates c where c.kind = p_kind and c.source_id = p_source and c.holder_ref = e.holder_ref and c.status = 'emitido'))
      order by e.holder_name) from vertice_private.certificate_eligible(p_kind, p_source) e), '[]'::jsonb));
end $$;

-- Emite para todos os elegíveis ainda sem certificado vigente. Idempotente; devolve quantos emitiu.
create function public.vertice_certificate_issue(p_kind text, p_source uuid, p_signer_name text, p_signer_role text)
returns integer language plpgsql security definer set search_path = '' as $$
declare s record; e record; v_n integer := 0; v_code text; v_hash text;
begin
  select * into s from vertice_private.certificate_source(p_kind, p_source);
  if s.institution_id is null or not s.can_issue then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_signer_name, ''))) < 3 or length(btrim(coalesce(p_signer_role, ''))) < 3 then
    raise exception 'signatário obrigatório' using errcode = '22023';
  end if;
  for e in select * from vertice_private.certificate_eligible(p_kind, p_source) x
           where not exists (select 1 from public.vertice_certificates c where c.kind = p_kind and c.source_id = p_source and c.holder_ref = x.holder_ref and c.status = 'emitido') loop
    loop
      v_code := vertice_private.certificate_code();
      exit when not exists (select 1 from public.vertice_certificates where code = v_code);
    end loop;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(p_kind, p_source, e.holder_ref, e.holder_name, s.title, e.minutes,
                s.period_start, s.period_end, v_code, btrim(p_signer_name), btrim(p_signer_role))::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.vertice_certificates(institution_id, course_id, kind, source_id, holder_ref, holder_name, activity_title, minutes,
      period_start, period_end, code, content_sha256, signer_name, signer_role, issued_by)
    values (s.institution_id, s.course_id, p_kind, p_source, e.holder_ref, e.holder_name, btrim(s.title), e.minutes,
      s.period_start, s.period_end, v_code, v_hash, btrim(p_signer_name), btrim(p_signer_role), auth.uid());
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Revogação com justificativa (erro de emissão, horas corrigidas). O código passa a constar como revogado.
create function public.vertice_certificate_revoke(p_certificate uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.vertice_certificates; s record;
begin
  select * into c from public.vertice_certificates where id = p_certificate for update;
  if c.id is null then raise exception 'certificado inexistente' using errcode = '42501'; end if;
  select * into s from vertice_private.certificate_source(c.kind, c.source_id);
  if s.institution_id is null or not s.can_issue then raise exception 'acesso negado ou MFA pendente' using errcode = '42501'; end if;
  if c.status <> 'emitido' then raise exception 'certificado já revogado' using errcode = '22023'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'justificativa obrigatória' using errcode = '22023'; end if;
  update public.vertice_certificates set status = 'revogado', revoked_at = now(), revoked_by = auth.uid(), revoked_reason = btrim(p_reason) where id = c.id;
end $$;

-- Verificação pública pelo código: só o que está impresso no certificado.
create function public.vertice_certificate_verify(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when c.id is null then jsonb_build_object('found', false) else jsonb_build_object(
    'found', true, 'status', c.status, 'kind', c.kind, 'holderName', c.holder_name, 'activityTitle', c.activity_title,
    'minutes', c.minutes, 'periodStart', c.period_start, 'periodEnd', c.period_end, 'issuedAt', c.issued_at,
    'signerName', c.signer_name, 'signerRole', c.signer_role, 'institution', i.name, 'contentSha256', c.content_sha256,
    'revokedAt', c.revoked_at) end
  from (select 1) one
  left join public.vertice_certificates c on c.code = upper(btrim(coalesce(p_code, '')))
  left join public.vertice_institutions i on i.id = c.institution_id
$$;

revoke all on function vertice_private.certificate_guard(), vertice_private.certificate_code(),
  vertice_private.certificate_source(text, uuid), vertice_private.certificate_eligible(text, uuid) from public, anon, authenticated;
revoke all on function public.vertice_certificate_roster(text, uuid), public.vertice_certificate_issue(text, uuid, text, text),
  public.vertice_certificate_revoke(uuid, text), public.vertice_certificate_verify(text) from public, anon;
grant execute on function public.vertice_certificate_roster(text, uuid), public.vertice_certificate_issue(text, uuid, text, text),
  public.vertice_certificate_revoke(uuid, text) to authenticated;
grant execute on function public.vertice_certificate_verify(text) to anon, authenticated;
