// ModuleOffer.tsx — Tela de oferta quando IES clica em módulo bloqueado
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateModuleCache } from "@/lib/modules";
import "./module-offer.css";

interface ModuleInfo {
  code: string;
  name: string;
  description: string;
  tier: string;
  min_package: string;
  estimated_fee: number;
  tabs: string[];
}

const PACKAGE_LABELS: Record<string, string> = {
  essencial: "Essencial",
  regulacao: "Regulação",
  gestao360: "Gestão 360°",
  completo: "Completo",
};

const TIER_LABELS: Record<string, string> = {
  core: "Módulo Core",
  regulacao: "Regulação",
  gestao: "Gestão",
  avancado: "Avançado",
  addon: "Add-on",
};

const MODULE_HIGHLIGHTS: Record<string, string[]> = {
  GEST_GOVERNANCA: [
    "Registro de órgãos colegiados (NDE, Colegiado, CPA)",
    "Atas e deliberações com rastreabilidade",
    "Integração direta com o Plano de Ação 5W2H",
    "Timeline regulatória para avaliações MEC",
  ],
  GEST_INCLUSAO: [
    "Gestão de casos de inclusão e acessibilidade",
    "Planos Educacionais Individualizados (PEI)",
    "Painel de evidências para o INEP",
    "Acompanhamento de adaptações e acomodações",
  ],
  GEST_ACOMPANHAMENTO: [
    "Regimes especiais (gestação, lactação, doenças)",
    "Exercícios domiciliares com base legal",
    "Categorias configuráveis por IES",
    "Planos acadêmicos e decisões fundamentadas",
  ],
  GEST_EGRESSOS: [
    "Acompanhamento longitudinal de egressos",
    "Indicadores de empregabilidade",
    "Dados derivados de qualquer sistema acadêmico",
    "Evidências regulatórias para reconhecimento",
  ],
  GEST_AQUISICOES: [
    "Cadastro de fornecedores com avaliação",
    "Requisições de compra com aprovação",
    "Cotações comparativas e ordem de compra",
    "Rastreamento de entregas e pagamentos",
  ],
  ADDON_FATO_ORDEM: [
    "Publicação institucional integrada",
    "Biblioteca de atos normativos",
    "Diário oficial da IES",
    "Rastreabilidade documental",
  ],
  AVANCADO_SYNC: [
    "Central de sincronização de dados",
    "Monitoramento de 12 módulos em tempo real",
    "Diagnóstico de integridade dos dados",
    "Proveniência e auditoria de importações",
  ],
};

export default function ModuleOffer({
  module,
  institutionId,
  currentPackage,
  onClose,
  onActivated,
}: {
  module: ModuleInfo;
  institutionId: string;
  currentPackage: string;
  onClose: () => void;
  onActivated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  const highlights = MODULE_HIGHLIGHTS[module.code] || [
    "Funcionalidade especializada para sua IES",
    "Integrado ao painel de gestão",
    "Dados seguros com LGPD",
    "Suporte técnico incluído",
  ];

  const canUpgrade = PACKAGE_LABELS[module.min_package] && module.min_package !== currentPackage;
  const pkgOrder = ["essencial", "regulacao", "gestao360", "completo"];
  const currentIdx = pkgOrder.indexOf(currentPackage);
  const requiredIdx = pkgOrder.indexOf(module.min_package);
  const needsUpgrade = requiredIdx > currentIdx;

  async function startTasting() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("start_module_tasting", {
        p_institution_id: institutionId,
        p_module_code: module.code,
      });
      if (error) throw error;
      setResult(data as any);
      if ((data as any)?.success) {
        invalidateModuleCache();
        setTimeout(() => onActivated(), 2000);
      }
    } catch (e: any) {
      setResult({ error: e.message || "Erro ao ativar degustação" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="module-offer-overlay">
      <div className="module-offer-card">
        <button className="module-offer-close" onClick={onClose} title="Fechar">×</button>

        <div className="module-offer-badge">{TIER_LABELS[module.tier] || module.tier}</div>
        <h2 className="module-offer-title">{module.name}</h2>
        <p className="module-offer-desc">{module.description}</p>

        <div className="module-offer-highlights">
          <h3>O que este módulo faz:</h3>
          <ul>
            {highlights.map((h, i) => (
              <li key={i}><span className="module-offer-check">✓</span> {h}</li>
            ))}
          </ul>
        </div>

        {needsUpgrade && (
          <div className="module-offer-upgrade-note">
            <strong>💡 Incluído no pacote {PACKAGE_LABELS[module.min_package]}</strong>
            <p>
              Faça upgrade do seu pacote {PACKAGE_LABELS[currentPackage]} para{" "}
              {PACKAGE_LABELS[module.min_package]} e tenha este módulo incluso sem custo adicional,
              além de outros módulos do pacote.
            </p>
          </div>
        )}

        <div className="module-offer-tasting">
          <div className="module-offer-tasting-header">
            <span className="module-offer-tasting-icon">🎯</span>
            <div>
              <strong>Degustação gratuita — 15 dias</strong>
              <p>Explore o módulo completo sem compromisso. Após 15 dias, ativa automaticamente
                por <strong>R$ {module.estimated_fee.toLocaleString("pt-BR")}/mês</strong>.
                Cancele a qualquer momento durante a degustação.</p>
            </div>
          </div>
        </div>

        {result ? (
          <div className={`module-offer-result ${result.success ? "success" : "error"}`}>
            {result.success ? "✅ " : "⚠ "}
            {result.message || result.error}
          </div>
        ) : (
          <div className="module-offer-actions">
            <button
              className="module-offer-btn primary"
              onClick={startTasting}
              disabled={loading}
            >
              {loading ? "Ativando..." : "Experimentar 15 dias grátis"}
            </button>
            {needsUpgrade && (
              <button className="module-offer-btn secondary" onClick={onClose}>
                Quero fazer upgrade do pacote
              </button>
            )}
            <button className="module-offer-btn ghost" onClick={onClose}>
              Agora não
            </button>
          </div>
        )}

        <p className="module-offer-legal">
          Ao ativar a degustação, você concorda com os termos de uso da Plataforma Vértice.
          Faturamento automático após o período de 15 dias. Cancelamento livre durante a degustação.
        </p>
      </div>
    </div>
  );
}
