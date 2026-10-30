import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileCheck2,
  Flag,
  LayoutDashboard,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { downloadFile, usePilot } from "@/contexts/PilotContext";
import { toast } from "sonner";

import { Brand } from "./Brand";
export { Brand } from "./Brand";

const navigation = [
  { path: "/demonstracao", label: "Visão geral", icon: LayoutDashboard },
  { path: "/painel", label: "Painel executivo", icon: BarChart3 },
  { path: "/admin-ies", label: "Cadastro IES", icon: UsersRound },
  { path: "/gestor", label: "Acesso gestor", icon: ShieldCheck },
  { path: "/master", label: "Proprietário", icon: ShieldCheck },
  { path: "/diagnostico", label: "Diagnóstico", icon: ClipboardCheck },
  { path: "/regulador", label: "Regulação", icon: ShieldCheck },
  { path: "/matriz", label: "Matriz de achados", icon: FileCheck2 },
  { path: "/metas", label: "Metas e indicadores", icon: Flag },
  { path: "/plano", label: "Plano de ação 5W2H", icon: Flag },
  {
    path: "/competencias",
    label: "Competências e desenvolvimento",
    icon: Sparkles,
  },
  { path: "/metodologia", label: "Metodologia", icon: BookOpen },
];
export function PilotLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { state, storageAvailable } = usePilot();
  const title =
    [
      ...navigation,
      { path: "/premissas", label: "Premissas e pendências" },
    ].find(n => n.path === location)?.label ?? "Vértice";
  const matches =
    search.trim().length > 1
      ? state.criteria
          .filter(c =>
            c.question
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR"))
          )
          .slice(0, 5)
      : [];
  const exportPilot = () => {
    downloadFile(
      JSON.stringify(
        {
          ...state,
          metadata: {
            version: 2,
            type: "SIMULAÇÃO — SEM DADOS INSTITUCIONAIS",
            exportedAt: new Date().toISOString(),
          },
        },
        null,
        2
      ),
      "vertice-piloto-demonstrativo.json"
    );
    toast.success("Cópia da demonstração exportada.");
  };
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link
          href="/"
          className="brand-link"
          onClick={() => setMobileOpen(false)}
          aria-label="Voltar ao site da Vértice"
        >
          <Brand />
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Compass size={19} />
          </span>
          <div>
            <strong>Vértice Educação Superior</strong>
            <small>Ambiente de demonstração</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <div className="nav-caption">ESPAÇO ESTRATÉGICO</div>
        <nav aria-label="Navegação principal">
          {navigation.map(item => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className={`nav-item ${location === item.path ? "active" : ""}`}
              aria-current={location === item.path ? "page" : undefined}
            >
              <item.icon size={18} strokeWidth={1.7} />
              {item.label}
              {location === item.path && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/apresentacao" className="tour-link">
            <span className="tour-icon">
              <Play size={15} fill="currentColor" />
            </span>
            <div>
              <strong>Percurso de gestão</strong>
              <small>Conheça a proposta em 5 etapas</small>
            </div>
            <ArrowUpRight size={16} />
          </Link>
          <Link
            href="/premissas"
            className={`nav-item ${location === "/premissas" ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <ShieldCheck size={18} />
            Premissas e pendências
            <span className="pending-count">
              {state.pending.filter(p => !p.done).length}
            </span>
          </Link>
          <Link href="/" className="nav-item">
            <ArrowUpRight size={18} />
            Voltar ao site
          </Link>
          <div className="profile">
            <span className="avatar">VC</span>
            <div>
              <strong>Visão de consultoria</strong>
              <small>Demonstração • versão 1.0</small>
            </div>
            <span className="profile-check">
              <Check size={13} />
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <span>Espaço estratégico</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <div className="search-wrap">
              <Search size={16} />
              <input
                aria-label="Pesquisar critérios do diagnóstico"
                placeholder="Buscar no diagnóstico"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
              {search.trim().length > 1 && (
                <div className="search-results">
                  {matches.length ? (
                    matches.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          navigate(
                            `/diagnostico?criterio=${encodeURIComponent(c.id)}`
                          );
                          setSearch("");
                        }}
                      >
                        <ClipboardCheck size={15} />
                        <span>{c.question}</span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>Nenhum critério encontrado.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <span className="topbar-avatar">VC</span>
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-badge">
            <span />
            PILOTO DEMONSTRATIVO
          </span>
          <p>
            Dados ilustrativos. Instrumento em validação. Nenhuma avaliação
            oficial da instituição.
          </p>
          <Link href="/premissas">
            Ver premissas <ArrowUpRight size={13} />
          </Link>
        </div>
        {!storageAvailable && (
          <div className="storage-warning" role="alert">
            O navegador não permite salvar alterações. Exporte o piloto antes de
            sair.
          </div>
        )}
        <main className="page-content" key={location}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Vértice <span>•</span> Site empresarial independente
          </span>
          <span>
            <ShieldCheck size={13} /> Alterações somente neste navegador{" "}
            <button onClick={exportPilot}>
              Exportar cópia <ArrowDownToLine size={13} />
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </div>
  );
}
export function Filter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="select-wrap">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filtrar dimensão"
      >
        <option value="all">Todas as dimensões</option>
        {options.map(o => (
          <option value={o.id} key={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </div>
  );
}
