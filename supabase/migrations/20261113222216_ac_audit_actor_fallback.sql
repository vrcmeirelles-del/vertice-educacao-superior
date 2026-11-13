-- Aplicada no projeto em 13/11/2026 (versão 20261113222216).
-- actor_name é NOT NULL e vinha só do e-mail do JWT. Gravações pelo backend (service role,
-- ex.: portal do estudante) não têm e-mail e falhavam. Mantém o e-mail quando existe;
-- senão registra o papel do chamador, preservando a rastreabilidade.
create or replace function vertice_private.audit_ac_submissions()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare c jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  insert into vertice_ac_audit (institution_id, event_type, aggregate_type, aggregate_id, actor_name, actor_role, payload)
  values (
    coalesce(new.institution_id, old.institution_id),
    tg_op,
    'submission',
    coalesce(new.id, old.id),
    coalesce(c->>'email', 'servico:' || coalesce(c->>'role', current_user)),
    case when c->>'email' is null then 'service' else 'system' end,
    case tg_op
      when 'DELETE' then to_jsonb(old)
      else jsonb_build_object('status', new.status, 'title', new.title, 'old_status', case when old is not null then old.status else null end)
    end
  );
  return coalesce(new, old);
end;
$function$;

create or replace function vertice_private.audit_ac_ledger()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare c jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  insert into vertice_ac_audit (institution_id, event_type, aggregate_type, aggregate_id, actor_name, actor_role, payload)
  values (new.institution_id, 'LEDGER_ENTRY', 'ledger', new.id,
    coalesce(c->>'email', 'servico:' || coalesce(c->>'role', current_user)),
    case when c->>'email' is null then 'service' else 'system' end,
    jsonb_build_object('delta_minutes', new.delta_minutes, 'entry_type', new.entry_type, 'student_id', new.student_id, 'submission_id', new.submission_id));
  return new;
end;
$function$;
