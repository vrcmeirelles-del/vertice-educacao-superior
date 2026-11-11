// ModuleManager.tsx — Painel master para ativar/desativar módulos por IES
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateModuleCache } from "@/lib/modules";
import "./module-manager.css";

interface Institution { id: string; name: string; }

interface CatalogModule {
  code: string; name: string; description: string; tier: string;
  min_package: string; tabs: string[]; display_order: number;
  activation_status: string; display_status: string;
  tasting_ends: string | null; estimated_monthly_fee: number;
  addon_monthly_fee: number | null; package_origin: string | null;
}

const TIER_LABEL: Record<string,string> = { core:'Core', regulacao:'Regulação', gestao:'Gestão', avancado:'Avançado', addon:'Add-on' };
const TIER_COLOR: Record<string,string> = { core:'#6b7280', regulacao:'#3b82f6', gestao:'#8b5cf6', avancado:'#f59e0b', addon:'#ef4444' };
const PKG_LABEL: Record<string,string> = { essencial:'Essencial', regulacao:'Regulação', gestao360:'Gestão 360°', completo:'Completo' };

const STATUS_ICON: Record<string,string> = {
  active: '✅', tasting: '🎯', trial: '🟣', locked: '🔒',
};

export default function ModuleManager() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedIes, setSelectedIes] = useState('');
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('vertice_institutions').select('id,name').order('name')
      .then(({ data }) => setInstitutions((data || []) as Institution[]));
  }, []);

  const loadModules = useCallback(async (iesId: string) => {
    if (!iesId) { setModules([]); return; }
    setLoading(true);
    const { data } = await supabase.rpc('get_module_catalog_for_ies', { p_institution_id: iesId });
    setModules((data || []) as CatalogModule[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedIes) loadModules(selectedIes); }, [selectedIes, loadModules]);

  async function toggleModule(mod: CatalogModule) {
    setBusy(mod.code);
    try {
      if (mod.display_status === 'locked') {
        // Ativar
        await supabase.from('vertice_module_activations').insert({
          institution_id: selectedIes,
          module_code: mod.code,
          status: 'ativo',
          package_origin: 'manual',
        });
      } else {
        // Desativar
        await supabase.from('vertice_module_activations')
          .update({ status: 'cancelado' })
          .eq('institution_id', selectedIes)
          .eq('module_code', mod.code)
          .in('status', ['ativo', 'trial']);
      }
      invalidateModuleCache();
      await loadModules(selectedIes);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function activatePackage(pkg: string) {
    setBusy('pkg_' + pkg);
    try {
      await supabase.rpc('activate_package', {
        p_institution_id: selectedIes,
        p_package_code: pkg,
        p_status: 'ativo',
        p_trial_days: null,
      });
      invalidateModuleCache();
      await loadModules(selectedIes);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  async function deactivateAll() {
    setBusy('deactivate_all');
    try {
      await supabase.from('vertice_module_activations')
        .update({ status: 'cancelado' })
        .eq('institution_id', selectedIes)
        .in('status', ['ativo', 'trial']);
      invalidateModuleCache();
      await loadModules(selectedIes);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  const activeCount = modules.filter(m => m.display_status !== 'locked').length;
  const totalCount = modules.length;

  // Agrupar por tier
  const tiers = ['core', 'regulacao', 'gestao', 'avancado', 'addon'];
  const grouped = tiers.map(t => ({
    tier: t,
    label: TIER_LABEL[t] || t,
    color: TIER_COLOR[t] || '#888',
    modules: modules.filter(m => m.tier === t).sort((a, b) => a.display_order - b.display_order),
  })).filter(g => g.modules.length > 0);

  return (
    <div className="mm-container">
      <div className="mm-header">
        <h2>⚙️ Gerenciar Módulos</h2>
        <p>Ative ou desative módulos por IES. Alterações são imediatas.</p>
      </div>

      <div className="mm-ies-select">
        <label>Instituição
          <select value={selectedIes} onChange={e => setSelectedIes(e.target.value)}>
            <option value="">Selecione uma IES...</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        {selectedIes && <span className="mm-counter">{activeCount}/{totalCount} módulos ativos</span>}
      </div>

      {selectedIes && (
        <>
          {/* Atalhos de pacote */}
          <div className="mm-packages">
            <span className="mm-packages-label">Ativar pacote completo:</span>
            {['essencial', 'regulacao', 'gestao360', 'completo'].map(pkg => (
              <button key={pkg} className="mm-pkg-btn" disabled={busy !== null}
                onClick={() => activatePackage(pkg)}>
                {busy === 'pkg_' + pkg ? '...' : PKG_LABEL[pkg]}
              </button>
            ))}
            <button className="mm-pkg-btn danger" disabled={busy !== null} onClick={deactivateAll}>
              {busy === 'deactivate_all' ? '...' : '🗑 Desativar tudo'}
            </button>
          </div>

          {loading ? <p className="mm-loading">Carregando catálogo...</p> : (
            <div className="mm-grid">
              {grouped.map(group => (
                <div className="mm-tier-group" key={group.tier}>
                  <div className="mm-tier-header">
                    <span className="mm-tier-dot" style={{ background: group.color }}></span>
                    <h3>{group.label}</h3>
                    <span className="mm-tier-count">
                      {group.modules.filter(m => m.display_status !== 'locked').length}/{group.modules.length}
                    </span>
                  </div>
                  <div className="mm-module-list">
                    {group.modules.map(mod => (
                      <div className={`mm-module ${mod.display_status}`} key={mod.code}>
                        <div className="mm-module-info">
                          <span className="mm-module-status">{STATUS_ICON[mod.display_status] || '❓'}</span>
                          <div>
                            <strong>{mod.name}</strong>
                            <small>{mod.description}</small>
                            {mod.display_status === 'tasting' && mod.tasting_ends && (
                              <small className="mm-tasting-note">Degustação até {new Date(mod.tasting_ends).toLocaleDateString('pt-BR')}</small>
                            )}
                            {mod.package_origin && mod.display_status !== 'locked' && (
                              <small className="mm-origin">Origem: {mod.package_origin}</small>
                            )}
                          </div>
                        </div>
                        <div className="mm-module-actions">
                          <span className="mm-pkg-min">Min: {PKG_LABEL[mod.min_package] || mod.min_package}</span>
                          <button
                            className={`mm-toggle ${mod.display_status === 'locked' ? 'activate' : 'deactivate'}`}
                            disabled={busy !== null}
                            onClick={() => toggleModule(mod)}
                          >
                            {busy === mod.code ? '...' :
                              mod.display_status === 'locked' ? 'Ativar' : 'Desativar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
