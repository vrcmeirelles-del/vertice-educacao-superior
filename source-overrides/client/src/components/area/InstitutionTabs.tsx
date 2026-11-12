/**
 * InstitutionTabs — menu lateral direito com 7 abas macro para a página Master → Instituição.
 *
 * Substitui o grid de módulos do Workspace mantendo toda a funcionalidade existente.
 * As tabs internas de cada aba macro continuam controladas pelo Workspace via `choose()`.
 */
import { useState, useEffect, useRef, type ReactNode } from "react";
import type { Tab } from "@/lib/area";
import "./institution-tabs.css";

export type MacroTab = 'visao-geral' | 'dados' | 'cursos' | 'gestores' | 'integracoes' | 'licenciamento' | 'historico';

export interface MacroTabDef {
  key: MacroTab;
  label: string;
  icon: string;
  description: string;
  /** Workspace tabs that belong to this macro tab */
  tabs: Tab[];
}

export const MACRO_TABS: MacroTabDef[] = [
  {
    key: 'visao-geral',
    label: 'Visão Geral',
    icon: '⌂',
    description: 'Painel executivo da instituição',
    tabs: ['base', 'geral', 'analise'],
  },
  {
    key: 'dados',
    label: 'Dados da Instituição',
    icon: '▣',
    description: 'Cadastro, endereço e identificação',
    tabs: ['cadastro', 'emec'],
  },
  {
    key: 'cursos',
    label: 'Cursos e Ofertas',
    icon: '▤',
    description: 'Cursos, matrículas e desempenho',
    tabs: ['visao', 'eorbit', 'auditoria', 'backups', 'raio-x-direito', 'resultado-curso', 'simulador', 'escola-enem', 'escola-egressos'],
  },
  {
    key: 'gestores',
    label: 'Gestores e Acessos',
    icon: '♙',
    description: 'Equipe, convites e permissões',
    tabs: ['equipe', 'metas', 'plano', 'diagnostico', 'governanca', 'inclusao', 'acompanhamento-especial', 'extensao', 'aquisicoes', 'egressos', 'cpa-autoavaliacao'],
  },
  {
    key: 'integracoes',
    label: 'Integrações',
    icon: '⇄',
    description: 'Conectores, sync e importações',
    tabs: ['sync', 'integracao-ies', 'fontes', 'conexoes', 'aprendizagem'],
  },
  {
    key: 'licenciamento',
    label: 'Licenciamento',
    icon: '📜',
    description: 'Contrato, módulos e faturamento',
    tabs: ['conta', 'contrato', 'billing', 'modulos', 'catalogo'],
  },
  {
    key: 'historico',
    label: 'Histórico e Auditoria',
    icon: '◇',
    description: 'Registros, regulação e evidências',
    tabs: ['repositorio', 'validacao', 'biblioteca', 'avaliacao', 'novo_instrumento', 'enade', 'documentos', 'ia', 'reitor'],
  },
];

/** Find which macro tab a workspace tab belongs to */
export function macroTabFor(wsTab: Tab): MacroTab {
  for (const mt of MACRO_TABS) {
    if (mt.tabs.includes(wsTab)) return mt.key;
  }
  return 'visao-geral';
}

/** Pick only a permitted, active destination; a blocked group stays in the activation picker. */
export function macroDestination(macro: MacroTab, visible: Tab[], locked: (tab: Tab) => boolean): Tab | undefined {
  return MACRO_TABS.find(m => m.key === macro)?.tabs.find(tab => visible.includes(tab) && !locked(tab));
}

interface Props {
  enabled?: boolean;
  availableMacros?: MacroTab[];
  activeTab: Tab;
  onSelectMacro: (macro: MacroTab) => void;
  activeMacro: MacroTab;
  children: ReactNode;
  institutionName: string;
  kpis?: ReactNode;
}

export default function InstitutionTabs({ activeTab, onSelectMacro, activeMacro, children, institutionName, kpis, enabled = true, availableMacros }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close mobile nav when macro changes
  useEffect(() => {
    if (mobileOpen) { setMobileOpen(false); toggleRef.current?.focus(); }
  }, [activeMacro]);

  if (!enabled) return <>{children}</>;

  return (
    <div className="inst-tabs-layout">
      {/* Mobile: tab bar at top */}
      <div className="inst-tabs-mobile-bar">
        <button
          ref={toggleRef}
          type="button"
          className="inst-tabs-mobile-toggle"
          aria-expanded={mobileOpen}
          aria-controls="inst-tabs-nav"
          onClick={() => setMobileOpen(v => !v)}
        >
          <span aria-hidden="true">{MACRO_TABS.find(m => m.key === activeMacro)?.icon}</span>
          {' '}{MACRO_TABS.find(m => m.key === activeMacro)?.label ?? 'Menu'}
          <span className="inst-tabs-chevron" aria-hidden="true">{mobileOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Content area */}
      <div className="inst-tabs-content">
        {kpis}
        {children}
      </div>

      {/* Right sidebar nav */}
      <nav
        id="inst-tabs-nav"
        className={`inst-tabs-nav${mobileOpen ? ' inst-tabs-nav--open' : ''}`}
        aria-label="Navegação da instituição"
        role="navigation"
      >
        <div className="inst-tabs-nav-header">
          <span className="inst-tabs-nav-icon" aria-hidden="true">🏛️</span>
          <div>
            <strong className="inst-tabs-nav-title">{institutionName}</strong>
            <small className="inst-tabs-nav-sub">Painel institucional</small>
          </div>
        </div>
        <ul className="inst-tabs-nav-list">
          {MACRO_TABS.filter(mt => !availableMacros || availableMacros.includes(mt.key)).map(mt => (
            <li key={mt.key}>
              <button
                type="button"
                aria-current={activeMacro === mt.key ? "page" : undefined}
                className={`inst-tabs-nav-item${activeMacro === mt.key ? ' inst-tabs-nav-item--active' : ''}`}
                onClick={() => onSelectMacro(mt.key)}
              >
                <span className="inst-tabs-nav-item-icon" aria-hidden="true">{mt.icon}</span>
                <span className="inst-tabs-nav-item-text">
                  <strong>{mt.label}</strong>
                  <small>{mt.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="inst-tabs-nav-footer">
          Vértice · Educação Superior
        </div>
      </nav>
    </div>
  );
}
