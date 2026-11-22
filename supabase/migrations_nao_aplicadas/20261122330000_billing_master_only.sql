-- Faturamento (BillingPanel e MasterHub): reabertura restrita ao master da plataforma.
--
-- Contexto: 20261112183024_contain_legacy_public_access colocou em quarentena o faturamento
-- legado (REVOKE ALL para anon e authenticated), porque as políticas liberavam contratos e
-- faturas a qualquer membro da instituição (inclusive UPDATE de contrato) e as funções
-- SECURITY DEFINER não verificavam quem as chamava. Com isso, nem o master usava o painel.
--
-- Esta migração reabre apenas o necessário ao master (vertice_private.is_master():
-- vertice_admins + sessão aal2), mantendo a quarentena para todos os demais perfis:
--   * contratos, faturas e ciclos: políticas antigas por membership removidas; leitura e
--     escrita só para o master;
--   * painéis (v_billing_dashboard, v_mrr_summary, v_mrr_by_tier): security_invoker, então
--     herdam a RLS das tabelas;
--   * create_contract e register_payment: passam a recusar quem não é master antes de
--     qualquer leitura ou escrita; EXECUTE concedido a authenticated.
-- Continuam em quarentena: assinatura digital, cancelamento, downgrade, degustação,
-- simulate_pricing, catálogo legado e jobs de cobrança.

begin;

-- 1. Tabelas ----------------------------------------------------------------------------
alter table public.vertice_contracts      enable row level security;
alter table public.vertice_invoices       enable row level security;
alter table public.vertice_billing_cycles enable row level security;

drop policy if exists contracts_insert on public.vertice_contracts;
drop policy if exists contracts_select on public.vertice_contracts;
drop policy if exists contracts_update on public.vertice_contracts;
drop policy if exists invoices_insert  on public.vertice_invoices;
drop policy if exists invoices_select  on public.vertice_invoices;
drop policy if exists billing_cycles_insert on public.vertice_billing_cycles;
drop policy if exists billing_cycles_select on public.vertice_billing_cycles;

create policy contracts_master on public.vertice_contracts
  for all to authenticated
  using ((select vertice_private.is_master()))
  with check ((select vertice_private.is_master()));

create policy invoices_master on public.vertice_invoices
  for all to authenticated
  using ((select vertice_private.is_master()))
  with check ((select vertice_private.is_master()));

create policy billing_cycles_master_read on public.vertice_billing_cycles
  for select to authenticated
  using ((select vertice_private.is_master()));

revoke all on public.vertice_contracts, public.vertice_invoices, public.vertice_billing_cycles
  from public, anon, authenticated;
grant select, insert, update on public.vertice_contracts to authenticated;
grant select on public.vertice_invoices to authenticated;
grant select on public.vertice_billing_cycles to authenticated;

-- 2. Painéis -----------------------------------------------------------------------------
alter view public.v_billing_dashboard set (security_invoker = true);
alter view public.v_mrr_summary       set (security_invoker = true);
alter view public.v_mrr_by_tier       set (security_invoker = true);
revoke all on public.v_billing_dashboard, public.v_mrr_summary, public.v_mrr_by_tier
  from public, anon, authenticated;
grant select on public.v_billing_dashboard, public.v_mrr_summary, public.v_mrr_by_tier
  to authenticated;

-- 3. Funções -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_contract(p_institution_id uuid, p_package_code text, p_price_per_student numeric, p_min_monthly numeric, p_max_monthly numeric DEFAULT NULL::numeric, p_student_count integer DEFAULT 0, p_implementation_fee numeric DEFAULT 0, p_with_trial boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_contract_id uuid;
  v_contract_number text;
  v_starts date := CURRENT_DATE;
  v_trial_ends date;
  v_cooling_off date;
  v_min_commitment date;
  v_status text;
BEGIN
  IF NOT coalesce(vertice_private.is_master(), false) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'master_required';
  END IF;

  -- Gerar número do contrato: VRT-YYYYMM-XXXX
  SELECT 'VRT-' || to_char(now(), 'YYYYMM') || '-' ||
         lpad((COALESCE(MAX(CAST(split_part(contract_number, '-', 3) AS integer)), 0) + 1)::text, 4, '0')
  INTO v_contract_number
  FROM vertice_contracts
  WHERE contract_number LIKE 'VRT-' || to_char(now(), 'YYYYMM') || '-%';

  IF p_with_trial THEN
    v_trial_ends := v_starts + INTERVAL '90 days';
    v_status := 'trial';
  ELSE
    v_status := 'active';
  END IF;

  v_cooling_off := v_starts + INTERVAL '7 days';
  v_min_commitment := v_starts + INTERVAL '90 days';

  INSERT INTO vertice_contracts (
    institution_id, package_code, price_per_student, min_monthly, max_monthly,
    student_count, implementation_fee, starts_at, trial_ends_at,
    cooling_off_expires_at, min_commitment_ends_at, status, contract_number, signed_at
  ) VALUES (
    p_institution_id, p_package_code, p_price_per_student, p_min_monthly, p_max_monthly,
    p_student_count, p_implementation_fee, v_starts, v_trial_ends,
    v_cooling_off, v_min_commitment, v_status, v_contract_number, now()
  )
  RETURNING id INTO v_contract_id;

  -- Ativar módulos do pacote
  PERFORM activate_package(p_institution_id, p_package_code, v_status,
    CASE WHEN p_with_trial THEN 90 ELSE NULL END);

  -- Se tem implementação, gerar fatura de implementação (cobrada mesmo no trial)
  IF p_implementation_fee > 0 THEN
    INSERT INTO vertice_invoices (
      contract_id, institution_id, invoice_number, invoice_type,
      subtotal, total, due_date, status, line_items
    ) VALUES (
      v_contract_id, p_institution_id,
      'IMP-' || v_contract_number,
      'implementacao',
      p_implementation_fee, p_implementation_fee,
      CURRENT_DATE + INTERVAL '5 days',
      'pending',
      jsonb_build_array(jsonb_build_object(
        'description', 'Taxa de implementação — Pacote ' || initcap(p_package_code),
        'amount', p_implementation_fee
      ))
    );
  END IF;

  RETURN jsonb_build_object(
    'contract_id', v_contract_id,
    'contract_number', v_contract_number,
    'status', v_status,
    'trial_ends_at', v_trial_ends,
    'cooling_off_expires_at', v_cooling_off,
    'min_commitment_ends_at', v_min_commitment,
    'monthly_value_after_trial', GREATEST(p_min_monthly, p_price_per_student * p_student_count)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_payment(p_invoice_id uuid, p_payment_method text DEFAULT 'pix'::text, p_payment_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_invoice vertice_invoices%ROWTYPE;
BEGIN
  IF NOT coalesce(vertice_private.is_master(), false) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'master_required';
  END IF;

  SELECT * INTO v_invoice FROM vertice_invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Fatura não encontrada');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('error', 'Fatura já paga');
  END IF;

  UPDATE vertice_invoices SET
    status = 'paid',
    paid_at = now(),
    payment_method = p_payment_method,
    payment_reference = p_payment_reference,
    updated_at = now()
  WHERE id = p_invoice_id;

  UPDATE vertice_billing_cycles SET status = 'paid'
  WHERE id = v_invoice.billing_cycle_id;

  -- Se contrato estava suspenso, reativar
  UPDATE vertice_contracts SET status = 'active', updated_at = now()
  WHERE id = v_invoice.contract_id AND status = 'suspended';

  RETURN jsonb_build_object(
    'success', true,
    'invoice_number', v_invoice.invoice_number,
    'amount', v_invoice.total,
    'paid_at', now()
  );
END;
$function$;

revoke all on function public.create_contract(uuid,text,numeric,numeric,numeric,integer,numeric,boolean) from public, anon, authenticated;
revoke all on function public.register_payment(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_contract(uuid,text,numeric,numeric,numeric,integer,numeric,boolean) to authenticated;
grant execute on function public.register_payment(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
