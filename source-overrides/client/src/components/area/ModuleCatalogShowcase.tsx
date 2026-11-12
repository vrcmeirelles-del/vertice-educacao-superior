// ModuleCatalogShowcase.tsx — Vitrine comercial de módulos com cores por pacote
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateModuleCache } from "@/lib/modules";
import "./module-catalog-showcase.css";

/* ─── Cores por pacote ─── */
const PKG_THEME: Record<string, { bg: string; accent: string; icon: string; label: string }> = {
  // Superior
  essencial:  { bg: "#eff6ff", accent: "#2563eb", icon: "🏗️", label: "Core" },
  regulacao:  { bg: "#ecfdf5", accent: "#059669", icon: "📋", label: "Regulação" },
  gestao360:  { bg: "#faf5ff", accent: "#7c3aed", icon: "📊", label: "Gestão 360°" },
  completo:   { bg: "#fffbeb", accent: "#d97706", icon: "🚀", label: "Completo" },
  addon:      { bg: "#fef2f2", accent: "#dc2626", icon: "🔌", label: "Add-on" },
  // Escolas
  core:        { bg: "#eff6ff", accent: "#2563eb", icon: "🏗️", label: "Essencial" },
  pedagogico:  { bg: "#f0fdf4", accent: "#16a34a", icon: "📚", label: "Pedagógico" },
  captacao:    { bg: "#fef9c3", accent: "#ca8a04", icon: "📣", label: "Captação" },
  acompanhamento: { bg: "#fdf2f8", accent: "#db2777", icon: "🤝", label: "Acompanhamento" },
  governanca:  { bg: "#f5f3ff", accent: "#6d28d9", icon: "⚖️", label: "Governança 360" },
};

function pkgTheme(pkg: string) {
  return PKG_THEME[pkg] ?? { bg: "#f9fafb", accent: "#6b7280", icon: "📦", label: pkg };
}

/* ─── Ícones por módulo ─── */
const MOD_ICONS: Record<string, string> = {
  CORE_CADASTRO: "🏢", CORE_SYNC: "🔄", CORE_CENTRAL: "🔗",
  INTEL_BI_COORD: "📊", INTEL_BI_REITOR: "📈", INTEL_ANALYTICS: "🔬", INTEL_CAPTACAO: "📣",
  REG_COMPLY: "✅", REG_INEP2017: "📝", REG_INEP2026: "🆕", REG_BIBLIOTECA: "📚", REG_REPOSITORIO: "🗂️",
  GEST_METAS: "🎯", GEST_GOVERNANCA: "⚖️", GEST_RESULTADO: "💰", GEST_SIMULADOR: "🧮", GEST_AQUISICOES: "🏦", ACAD_EXTENSAO: "🤝", ESC_EXTENSAO: "🤝",
  ACOMP_INCLUSAO: "♿", ACOMP_ESPECIAL: "🩺", ACOMP_EGRESSOS: "🎓", ACOMP_ENADE: "📋",
  ADDON_FATO_ORDEM: "📖", DOCS_GESTAO: "📄", DOCS_IA: "🤖", INFRA_FONTES: "💾", INFRA_DEMO: "🎪",
  ESC_CADASTRO: "🏫", ESC_SYNC: "🔄", ESC_USUARIOS: "👥",
  ESC_5W2H: "🎯", ESC_AQUISICOES: "🏦", ESC_FINANCEIRO_ESCOLAR: "💰", ESC_RESULTADO_SEGMENTO: "📊",
  ESC_BI_DIRECAO: "📈", ESC_INDICADORES: "📉", ESC_COORDENACAO: "📋", ESC_ENEM: "🎓",
  ESC_CAPTACAO: "📣", ESC_REMATRICULA: "🔁", ESC_COMUNICACAO: "💬",
  ESC_INCLUSAO: "♿", ESC_ORIENTACAO: "🧭", ESC_EGRESSOS: "🎓",
  ESC_GOVERNANCA: "⚖️", ESC_CENSO: "📝",
  ESC_DOCS_GESTAO: "📄", ESC_DOCS_IA: "🤖",
};

interface CatalogItem {
  code: string;
  name: string;
  description: string;
  tier: string;
  pkg: string;
  display_order: number;
  tabs: string[];
  activation_status?: string;
  tasting_ends_at?: string;
}

interface PkgPricing {
  package: string;
  package_label: string;
  monthly_floor: string;
  setup_fee: string;
  addon_activation: string;
  addon_monthly: string;
}

export default function ModuleCatalogShowcase({
  institutionId,
  institutionTier,
  isMaster,
  onActivated,
}: {
  institutionId: string;
  institutionTier: string;
  isMaster: boolean;
  onActivated?: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pricing, setPricing] = useState<PkgPricing[]>([]);
  const [activations, setActivations] = useState<Record<string, { status: string; tasting_ends_at?: string }>>({});
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "packages">("packages");
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    load();
  }, [institutionId]);

  async function load() {
    const tier = institutionTier === "escolas" ? "escolas" : "superior";
    // Catalog
    const { data: cat } = await supabase
      .from("vertice_module_catalog")
      .select("code, name, description, tier, package, display_order, tabs")
      .order("display_order");
    // Filter by tier
    const validTiers = tier === "escolas" ? ["escolas", "core"] : ["core", "regulacao", "gestao", "inteligencia", "acompanhamento", "infra", "addon"];
    const filtered = (cat ?? [])
      .filter((m: any) => tier === "escolas" ? m.tier === "escolas" || m.code.startsWith("ESC_") : !m.code.startsWith("ESC_"))
      .map((m: any) => ({ ...m, pkg: m.package }));
    setCatalog(filtered);

    // Pricing
    const { data: pr } = await supabase
      .from("vertice_package_pricing")
      .select("package, package_label, monthly_floor, setup_fee, addon_activation, addon_monthly")
      .eq("tier", tier)
      .order("sort_order");
    setPricing(pr ?? []);

    // Activations
    const { data: acts } = await supabase
      .from("vertice_module_activations")
      .select("module_code, status, tasting_ends_at")
      .eq("institution_id", institutionId);
    const map: Record<string, { status: string; tasting_ends_at?: string }> = {};
    for (const a of acts ?? []) map[a.module_code] = { status: a.status, tasting_ends_at: a.tasting_ends_at };
    setActivations(map);
  }

  async function startTasting(code: string) {
    setActivating(code);
    try {
      const { data, error } = await supabase.rpc("start_module_tasting", {
        p_institution_id: institutionId,
        p_module_code: code,
      });
      if (error) throw error;
      const r = data as any;
      setResult({ code, ok: !!r?.success, msg: r?.message || r?.error || "Erro" });
      if (r?.success) {
        invalidateModuleCache();
        setTimeout(() => { load(); onActivated?.(); }, 1500);
      }
    } catch (e: any) {
      setResult({ code, ok: false, msg: e.message });
    } finally {
      setActivating(null);
    }
  }

  // Group by package
  const packages = [...new Set(catalog.map(m => m.pkg))];
  const byPkg = new Map<string, CatalogItem[]>();
  for (const p of packages) byPkg.set(p, catalog.filter(m => m.pkg === p));

  const q = search.trim().toLowerCase();
  const matchesSearch = (m: CatalogItem) =>
    !q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);

  function statusBadge(code: string) {
    const a = activations[code];
    if (!a) return <span className="mcs-badge mcs-badge-locked">🔒 Bloqueado</span>;
    if (a.status === "ativo") return <span className="mcs-badge mcs-badge-active">✓ Ativo</span>;
    if (a.status === "trial") return <span className="mcs-badge mcs-badge-trial">⏳ Trial</span>;
    if (a.status === "tasting") {
      const ends = a.tasting_ends_at ? new Date(a.tasting_ends_at).toLocaleDateString("pt-BR") : "";
      return <span className="mcs-badge mcs-badge-tasting">🎯 Degustação{ends ? ` até ${ends}` : ""}</span>;
    }
    return <span className="mcs-badge mcs-badge-locked">🔒 {a.status}</span>;
  }

  function actionButton(m: CatalogItem) {
    const a = activations[m.code];
    if (a?.status === "ativo" || a?.status === "trial") return null;
    if (a?.status === "tasting") return <span className="mcs-tasting-note">Degustando — cancele a qualquer momento</span>;
    if (activating === m.code) return <button className="mcs-btn mcs-btn-activating" disabled>Ativando…</button>;
    if (result?.code === m.code) return <span className={result.ok ? "mcs-result-ok" : "mcs-result-err"}>{result.ok ? "✅" : "⚠"} {result.msg}</span>;
    return (
      <button className="mcs-btn mcs-btn-tasting" onClick={() => startTasting(m.code)}>
        Experimentar 15 dias grátis
      </button>
    );
  }

  const tierLabel = institutionTier === "escolas" ? "Escolas" : "Educação Superior";

  return (
    <div className="mcs-showcase">
      <div className="mcs-header">
        <div>
          <p className="mcs-eyebrow">VÉRTICE · CATÁLOGO DE MÓDULOS</p>
          <h2>Módulos Disponíveis — {tierLabel}</h2>
          <p className="mcs-subtitle">Explore os módulos, ative degustações gratuitas de 15 dias ou contrate pacotes completos.</p>
        </div>
        <div className="mcs-controls">
          <input
            type="search"
            placeholder="Buscar módulo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mcs-search"
          />
          <div className="mcs-view-toggle">
            <button className={view === "packages" ? "active" : ""} onClick={() => setView("packages")}>Por pacote</button>
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Todos</button>
          </div>
        </div>
      </div>

      {/* Pricing summary cards */}
      {pricing.length > 0 && (
        <div className="mcs-pricing-row">
          {pricing.map(p => {
            const t = pkgTheme(p.package);
            const count = byPkg.get(p.package)?.length ?? 0;
            return (
              <button
                key={p.package}
                className={`mcs-pricing-card${expandedPkg === p.package ? " mcs-pricing-expanded" : ""}`}
                style={{ borderColor: t.accent, background: expandedPkg === p.package ? t.bg : undefined }}
                onClick={() => setExpandedPkg(expandedPkg === p.package ? null : p.package)}
              >
                <span className="mcs-pricing-icon" style={{ background: t.bg, color: t.accent }}>{t.icon}</span>
                <strong style={{ color: t.accent }}>{p.package_label}</strong>
                <span className="mcs-pricing-count">{count} módulo{count !== 1 ? "s" : ""}</span>
                <span className="mcs-pricing-value">a partir de <strong>R$ {Number(p.monthly_floor).toLocaleString("pt-BR")}</strong>/mês</span>
                <span className="mcs-pricing-setup">Implantação: R$ {Number(p.setup_fee).toLocaleString("pt-BR")}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modules grouped by package */}
      {view === "packages" ? (
        <div className="mcs-packages">
          {packages.map(pkg => {
            const t = pkgTheme(pkg);
            const modules = (byPkg.get(pkg) ?? []).filter(matchesSearch);
            if (modules.length === 0 && q) return null;
            const isOpen = expandedPkg === null || expandedPkg === pkg;
            return (
              <section key={pkg} className="mcs-pkg-section" style={{ "--pkg-accent": t.accent, "--pkg-bg": t.bg } as React.CSSProperties}>
                <button className="mcs-pkg-header" onClick={() => setExpandedPkg(expandedPkg === pkg ? null : pkg)}>
                  <span className="mcs-pkg-icon" style={{ background: t.bg, color: t.accent }}>{t.icon}</span>
                  <div className="mcs-pkg-info">
                    <strong>{t.label}</strong>
                    <span>{modules.length} módulo{modules.length !== 1 ? "s" : ""}</span>
                  </div>
                  <span className={`mcs-pkg-arrow ${isOpen ? "open" : ""}`}>▸</span>
                </button>
                {isOpen && (
                  <div className="mcs-pkg-grid">
                    {modules.map(m => (
                      <div key={m.code} className="mcs-module-card" style={{ borderLeftColor: t.accent }}>
                        <div className="mcs-module-top">
                          <span className="mcs-module-icon">{MOD_ICONS[m.code] ?? "📦"}</span>
                          <div className="mcs-module-meta">
                            <strong>{m.name}</strong>
                            {statusBadge(m.code)}
                          </div>
                        </div>
                        <p className="mcs-module-desc">{m.description}</p>
                        <div className="mcs-module-actions">
                          {actionButton(m)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mcs-all-grid">
          {catalog.filter(matchesSearch).map(m => {
            const t = pkgTheme(m.pkg);
            return (
              <div key={m.code} className="mcs-module-card" style={{ borderLeftColor: t.accent }}>
                <div className="mcs-module-top">
                  <span className="mcs-module-icon">{MOD_ICONS[m.code] ?? "📦"}</span>
                  <div className="mcs-module-meta">
                    <strong>{m.name}</strong>
                    <span className="mcs-module-pkg-tag" style={{ background: t.bg, color: t.accent }}>{t.label}</span>
                    {statusBadge(m.code)}
                  </div>
                </div>
                <p className="mcs-module-desc">{m.description}</p>
                <div className="mcs-module-actions">
                  {actionButton(m)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
