// ModulePreview.tsx — Wrapper que mostra dados reais borrados quando módulo bloqueado
import { useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateModuleCache, type CatalogModule } from "@/lib/modules";
import "./module-preview.css";

interface Props {
  locked: boolean;
  tasting?: boolean;
  tastingEnds?: string;
  moduleCode: string;
  moduleName: string;
  moduleDescription: string;
  institutionId: string;
  estimatedFee: number;
  tier: string;
  children: ReactNode;  // O componente real com dados reais
}

export default function ModulePreview({
  locked, tasting, tastingEnds, moduleCode, moduleName, moduleDescription,
  institutionId, estimatedFee, tier, children
}: Props) {
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  if (!locked && !tasting) return <>{children}</>;

  if (tasting) {
    const ends = tastingEnds ? new Date(tastingEnds) : null;
    const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000)) : 0;
    return (
      <div className="module-preview-tasting">
        <div className="module-preview-tasting-bar">
          <span className="module-preview-tasting-badge">🎯 Degustação</span>
          <span className="module-preview-tasting-info">
            {daysLeft > 0
              ? `${daysLeft} dia${daysLeft > 1 ? 's' : ''} restante${daysLeft > 1 ? 's' : ''}`
              : 'Último dia'}
            {' · '}Após a degustação: R$ {estimatedFee.toLocaleString('pt-BR')}/mês
          </span>
          <button className="module-preview-tasting-cancel" onClick={async () => {
            await supabase.rpc('cancel_module_tasting', { p_institution_id: institutionId, p_module_code: moduleCode });
            invalidateModuleCache();
            window.location.reload();
          }}>Cancelar degustação</button>
        </div>
        {children}
      </div>
    );
  }

  // LOCKED: mostra dados reais borrados + CTA de ativação
  async function activate() {
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc('start_module_tasting', {
        p_institution_id: institutionId,
        p_module_code: moduleCode,
      });
      if (error) throw error;
      if ((data as any)?.success) {
        setActivated(true);
        invalidateModuleCache();
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="module-preview-locked">
      {/* Dados reais renderizados mas borrados */}
      <div className="module-preview-blur" aria-hidden="true">
        {children}
      </div>

      {/* Overlay com CTA */}
      <div className="module-preview-cta">
        <div className="module-preview-cta-card">
          <div className="module-preview-cta-icon">🔒</div>
          <h3>{moduleName}</h3>
          <p className="module-preview-cta-desc">{moduleDescription}</p>

          <div className="module-preview-cta-data-note">
            <span className="module-preview-cta-pulse"></span>
            <strong>Seus dados já estão aqui.</strong> A integração é automática.
            Ao ativar, tudo que você vê borrado aparece imediatamente.
          </div>

          {activated ? (
            <div className="module-preview-cta-success">
              ✅ Degustação ativada! Carregando módulo...
            </div>
          ) : (
            <>
              <button className="module-preview-cta-btn" onClick={activate} disabled={activating}>
                {activating ? 'Ativando...' : 'Experimentar 15 dias grátis'}
              </button>
              <p className="module-preview-cta-price">
                Após degustação: R$ {estimatedFee.toLocaleString('pt-BR')}/mês · Cancele quando quiser
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
