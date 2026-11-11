// modules.ts — Feature flags baseados em vertice_module_activations
import { supabase } from './supabase';

export interface ActiveModule {
  module_code: string;
  module_name: string;
  tier: string;
  package: string;
  tabs: string[];
  status: 'ativo' | 'trial';
  effective_status: string;
  trial_ends_at?: string;
}

let _cache: { institutionId: string; tabs: Set<string>; modules: ActiveModule[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minuto

/** Retorna tabs ativas da IES (com cache de 1 min) */
export async function getActiveTabs(institutionId: string): Promise<Set<string>> {
  if (_cache && _cache.institutionId === institutionId && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.tabs;
  }
  const { data } = await supabase.rpc('get_active_tabs', { p_institution_id: institutionId });
  const tabs = new Set<string>(data ?? []);
  // Se não tem nenhum módulo ativado, libera tudo (retrocompatibilidade)
  if (tabs.size === 0) {
    return new Set<string>(); // vazio = sem restrição (tratado no Workspace)
  }
  _cache = { institutionId, tabs, modules: _cache?.modules ?? [], ts: Date.now() };
  return tabs;
}

/** Retorna módulos ativos com detalhes */
export async function getActiveModules(institutionId: string): Promise<ActiveModule[]> {
  const { data } = await supabase.from('v_active_modules').select('*').eq('institution_id', institutionId);
  const modules = (data ?? []) as ActiveModule[];
  if (_cache && _cache.institutionId === institutionId) {
    _cache.modules = modules;
  }
  return modules;
}

/** Checa se uma tab específica está ativa */
export function isTabActive(activeTabs: Set<string>, tab: string): boolean {
  // Se o set está vazio, significa sem restrição (IES sem módulos configurados = tudo liberado)
  if (activeTabs.size === 0) return true;
  return activeTabs.has(tab);
}

/** Invalida cache (após ativação/desativação) */
export function invalidateModuleCache() {
  _cache = null;
}

/** Info de módulo do catálogo para a tela de oferta */
export interface CatalogModule {
  code: string;
  name: string;
  description: string;
  tier: string;
  min_package: string;
  tabs: string[];
  display_order: number;
  activation_status: string;
  display_status: 'active' | 'tasting' | 'trial' | 'locked';
  tasting_ends?: string;
  estimated_monthly_fee: number;
  addon_monthly_fee?: number;
}

let _catalogCache: { institutionId: string; modules: CatalogModule[]; ts: number } | null = null;

/** Retorna catálogo completo com status por IES */
export async function getModuleCatalog(institutionId: string): Promise<CatalogModule[]> {
  if (_catalogCache && _catalogCache.institutionId === institutionId && Date.now() - _catalogCache.ts < CACHE_TTL) {
    return _catalogCache.modules;
  }
  const { data } = await supabase.rpc('get_module_catalog_for_ies', { p_institution_id: institutionId });
  const modules = (data ?? []) as CatalogModule[];
  _catalogCache = { institutionId, modules, ts: Date.now() };
  return modules;
}

/** Busca info de módulo pelo tab name */
export function findModuleByTab(catalog: CatalogModule[], tabKey: string): CatalogModule | undefined {
  return catalog.find(m => m.tabs?.includes(tabKey));
}
