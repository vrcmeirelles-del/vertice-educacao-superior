-- Catálogo de módulos e degustação: reabertura controlada.
--
-- Contexto: 20261112183024_contain_legacy_public_access colocou em quarentena o catálogo
-- (vertice_module_catalog) e as funções de degustação, que eram SECURITY DEFINER sem verificar
-- quem chamava: qualquer usuário autenticado podia iniciar ou cancelar degustação em qualquer
-- instituição. Além disso, start_module_tasting ativava o módulo automaticamente após 15 dias,
-- com mensalidade de R$ 500 a R$ 2.000 e registro de add-on no contrato, o que contraria o
-- modelo comercial da Vértice: a contratação é intermediada pela equipe.
--
-- Esta migração:
--   * libera a leitura do catálogo (nome, descrição, pacote, abas; sem preço) a usuários autenticados;
--   * start_module_tasting / cancel_module_tasting: só o gestor da própria instituição ou o master
--     (vertice_private.member_role, que exige sessão aal2);
--   * a degustação passa a ser de 15 dias, sem ativação automática, sem add-on no contrato e sem
--     valor na mensagem; ao fim, expira e a equipe Vértice conduz a proposta.
-- Continuam em quarentena: get_active_tabs, is_tab_active e get_module_catalog_for_ies
-- (liberá-las passaria a bloquear abas no portal, decisão separada), simulate_pricing,
-- assinatura digital, cancelamento e downgrade de contrato.

begin;

-- 1. Catálogo ----------------------------------------------------------------------------
alter table public.vertice_module_catalog enable row level security;
drop policy if exists module_catalog_read on public.vertice_module_catalog;
create policy module_catalog_read on public.vertice_module_catalog
  for select to authenticated
  using (true);
revoke all on public.vertice_module_catalog from public, anon, authenticated;
grant select on public.vertice_module_catalog to authenticated;

-- 2. Degustação --------------------------------------------------------------------------
-- A regra de origem não aceitava 'degustacao', valor que as próprias funções usam: a degustação
-- falhava sempre. Inclui o valor, preservando os demais.
alter table public.vertice_module_activations
  drop constraint if exists vertice_module_activations_package_origin_check;
alter table public.vertice_module_activations
  add constraint vertice_module_activations_package_origin_check
  check (package_origin = any (array['essencial','regulacao','gestao360','completo','avulso','core',
    'pedagogico','captacao','acompanhamento','governanca','degustacao']));

CREATE OR REPLACE FUNCTION public.start_module_tasting(p_institution_id uuid, p_module_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_mod RECORD;
  v_existing RECORD;
BEGIN
  IF coalesce(vertice_private.member_role(p_institution_id), '') NOT IN ('master', 'gestor') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'gestor_or_master_required';
  END IF;

  SELECT * INTO v_mod FROM vertice_module_catalog WHERE code = p_module_code AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Módulo não encontrado'); END IF;

  -- Uma ativação por módulo e instituição (UNIQUE): degustação só uma vez por módulo.
  SELECT * INTO v_existing FROM vertice_module_activations
  WHERE institution_id = p_institution_id AND module_code = p_module_code;
  IF FOUND THEN
    IF v_existing.status = 'ativo' OR (v_existing.status = 'trial' AND v_existing.trial_ends_at > now()) THEN
      RETURN jsonb_build_object('error', 'Módulo já ativo ou em degustação');
    END IF;
    RETURN jsonb_build_object('error', 'A degustação deste módulo já foi utilizada. Para contratar, fale com a equipe Vértice.');
  END IF;

  -- Degustação de 15 dias: sem ativação automática, sem add-on e sem cobrança.
  INSERT INTO vertice_module_activations (
    institution_id, module_code, status, package_origin,
    trial_days, trial_started_at, trial_ends_at, auto_activate, addon_monthly_fee
  ) VALUES (
    p_institution_id, p_module_code, 'trial', 'degustacao',
    15, CURRENT_DATE, CURRENT_DATE + 15, false, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'module', v_mod.name,
    'tasting_ends', CURRENT_DATE + 15,
    'auto_activate', false,
    'message', 'Degustação ativada: você tem 15 dias para explorar o módulo ' || v_mod.name
      || '. Ao final, ela expira sem cobrança. Para contratar, a equipe Vértice apresenta a proposta.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_module_tasting(p_institution_id uuid, p_module_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(vertice_private.member_role(p_institution_id), '') NOT IN ('master', 'gestor') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'gestor_or_master_required';
  END IF;

  UPDATE vertice_module_activations SET status = 'cancelado'
  WHERE institution_id = p_institution_id AND module_code = p_module_code
    AND status = 'trial' AND package_origin = 'degustacao';

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Degustação não encontrada'); END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Degustação cancelada. Módulo desativado.');
END;
$function$;

revoke all on function public.start_module_tasting(uuid,text)  from public, anon, authenticated;
revoke all on function public.cancel_module_tasting(uuid,text) from public, anon, authenticated;
grant execute on function public.start_module_tasting(uuid,text)  to authenticated;
grant execute on function public.cancel_module_tasting(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
