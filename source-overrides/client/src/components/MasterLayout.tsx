import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { LayoutDashboard, Building2, GraduationCap, Wallet, Users, Mail, Brain, ClipboardCheck, GitBranch, ChartColumn, Smartphone, PanelLeftClose, PanelLeftOpen, Menu, X, Settings, FolderOpen } from 'lucide-react';
import { Brand } from './Brand';
import './master-layout.css';
import './command-workspace.css';

const groups = [
  { label: 'Plataforma', items: [
    { label: 'Visão geral', href: '/master', icon: LayoutDashboard },
    { label: 'ENADE 360° · Operação', href: '/master#enade-operacao=1', icon: ClipboardCheck },
    { label: 'Central de Homologação', href: '/master#homologacao=1', icon: ClipboardCheck },
    { label: 'Financeiro', href: '/master#financeiro=1', icon: Wallet },
    { label: 'Administração de acessos', href: '/master#masters=1', icon: Settings },
  ] },
  { label: 'Instituições', items: [
    { label: 'Educação superior', href: '/master#tier=superior', icon: Building2 },
    { label: 'Escolas', href: '/master#tier=escolas', icon: GraduationCap },
    { label: 'Repositórios', href: '/master#repositorios=1', icon: FolderOpen },
  ] },
  { label: 'Gestão de acessos', items: [
    { label: 'Cadastro e convites', href: '/master#ies=1', icon: Users },
    { label: 'Convites Experience', href: '/master/experience', icon: Mail },
  ] },
  { label: 'Inteligência e resultados', items: [
    { label: 'Integração F&O', href: '/integracao', icon: GitBranch },
    { label: 'Sapiens', href: '/master#sapiens=1', icon: Brain },
    { label: 'BI Vértice', href: '/master#bi-vertice=1', icon: ChartColumn },
    { label: 'BI Premium · demo', href: '/demonstracao?perfil=faculdade&bi=1', icon: ChartColumn },
  ] },
  { label: 'Ferramentas', items: [
    { label: 'Vértice Mobile', href: '/mobile', icon: Smartphone },
  ] },
];

export default function MasterLayout({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [hash, setHash] = useState(() => typeof window === 'undefined' ? '' : window.location.hash);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const sync = () => { setHash(window.location.hash); setOpen(false); };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nav.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (event.key === 'Tab') {
        const controls = Array.from(nav.current?.querySelectorAll<HTMLElement>('a,button') ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); };
  }, [open]);
  const active = groups.flatMap(group => group.items).find(item => item.href === `${path}${hash}`);
  const institutionalContext = new URLSearchParams(hash.slice(1)).has('instituicao');
  return <div className={`corporate-site master-layout command-workspace vertice-portal${collapsed ? ' is-collapsed' : ''}${open ? ' is-open' : ''}`}>
    <a className="skip-link" href="#master-content">Pular para o conteúdo</a>
    {open && <button className="master-overlay" aria-label="Fechar menu" onClick={() => { setOpen(false); menuButton.current?.focus(); }} />}
    <aside className="master-sidebar" id="master-navigation" aria-label="Menu administrativo">
      <a href="/master" className="master-brand" aria-label="Vértice, painel inicial"><Brand compact={collapsed} /></a>
      <nav ref={nav} aria-label="Navegação do painel">
        {groups.map(group => <div className="master-nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map(item => <a key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={active?.href === item.href ? 'page' : undefined} onClick={() => setOpen(false)}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span></a>)}
        </div>)}
        <button className="master-mobile-close" onClick={() => { setOpen(false); menuButton.current?.focus(); }}><X size={18}/> Fechar menu</button>
      </nav>
      <button className="master-collapse" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={20}/> : <><PanelLeftClose size={20}/><span>Recolher menu</span></>}</button>
    </aside>
    <div className="master-workspace">
      <header className="master-topbar">
        <button ref={menuButton} className="master-mobile-toggle" aria-label="Abrir menu" aria-expanded={open} aria-controls="master-navigation" onClick={() => setOpen(true)}><Menu size={22}/></button>
        <div><small>{institutionalContext ? 'MASTER / AMBIENTE INSTITUCIONAL' : 'VÉRTICE / ADMINISTRAÇÃO MASTER'}</small><strong>{institutionalContext ? 'Gestão da instituição' : active?.label ?? 'Painel Master'}</strong></div>
        <div className="master-command-links"><a className="master-command-bi" href="/master#bi-vertice=1">Visão executiva ↗</a><a className="master-command-public" href="/">Site institucional</a></div>
      </header>
      <div id="master-content" className="master-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
