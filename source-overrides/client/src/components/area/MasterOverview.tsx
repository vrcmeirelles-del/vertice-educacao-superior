import type { ReactNode } from 'react';
import { ArrowRight, Building2, GraduationCap, ChartColumn, Wallet, Settings, Brain } from 'lucide-react';
import './master-overview.css';

export type MasterDestination = 'universidades' | 'escolas' | 'financeiro' | 'bi-vertice' | 'configuracoes' | 'institution' | 'sapiens';
export interface MasterInstitution { id: string; name: string; acronym: string | null; city: string | null; state: string | null }
interface Props {
  ies: MasterInstitution[];
  schools: MasterInstitution[];
  revenue: number;
  contracts: number;
  trials: number;
  onNavigate: (destination: MasterDestination, institutionId?: string) => void;
  children?: ReactNode;
}

/** Presentation only: queries, authentication and invitation actions stay in MasterHub. */
export default function MasterOverview({ ies, schools, revenue, contracts, trials, onNavigate, children }: Props) {
  return <div className="master-overview">
    <header className="master-overview-heading">
      <div><p className="master-eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</p><h2>Gestão institucional e operação</h2><p>Selecione uma instituição para gerenciar cursos e módulos. A administração da plataforma fica reunida nesta visão.</p></div>
      <span className="master-scope">Área Master</span>
    </header>

    <section aria-label="Resumo da plataforma" className="master-summary">
      <div><span>Instituições ativas</span><strong>{ies.length + schools.length}</strong><small>Educação superior e escolas</small></div>
      <div><span>Contratos ativos</span><strong>{contracts.toLocaleString('pt-BR')}</strong><small>Operação contratual</small></div>
      <div><span>Receita mensal recorrente</span><strong>{revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong><small>MRR · fonte: visão financeira</small></div>
      <div><span>Contratos em teste</span><strong>{trials.toLocaleString('pt-BR')}</strong><small>Períodos de avaliação</small></div>
    </section>

    <section aria-labelledby="master-institutions-title">
      <div className="master-section-heading"><div><h3 id="master-institutions-title">Instituições</h3><p>Escolha o segmento ou entre diretamente em um ambiente.</p></div><span>01 · Gestão institucional</span></div>
      <div className="master-segment-grid">
        {([{title: 'Educação superior', destination: 'universidades', icon: Building2, items: ies, empty: 'Nenhuma IES ativa cadastrada.'}, {title: 'Escolas', destination: 'escolas', icon: GraduationCap, items: schools, empty: 'Nenhuma escola ativa cadastrada.'}] as const).map(segment => <article className="master-segment" key={segment.destination}>
          <header><span className="master-tool-icon"><segment.icon size={22} aria-hidden="true"/></span><h4>{segment.title}</h4><span className="master-count">{segment.items.length}</span></header>
          <div className="master-institution-list">
            {segment.items.slice(0, 4).map(inst => <button key={inst.id} type="button" onClick={() => onNavigate('institution', inst.id)}>
              <span><strong>{inst.acronym || inst.name}</strong><small>{[inst.city, inst.state].filter(Boolean).join(' / ') || inst.name}</small></span><ArrowRight size={17} aria-hidden="true"/>
            </button>)}
            {!segment.items.length && <p className="master-empty">{segment.empty}</p>}
          </div>
          <button className="master-segment-open" type="button" onClick={() => onNavigate(segment.destination)}>Gerenciar {segment.title.toLocaleLowerCase('pt-BR')} <ArrowRight size={17} aria-hidden="true"/></button>
        </article>)}
      </div>
      <p className="master-context-note">Cursos, indicadores acadêmicos, CPA, TCC, estágio e demais módulos ficam no ambiente de cada instituição.</p>
    </section>

    <section aria-labelledby="master-operation-title">
      <div className="master-section-heading"><div><h3 id="master-operation-title">Administração e inteligência</h3><p>Ferramentas da plataforma, separadas da gestão de cada instituição.</p></div><span>02 · Operação da Vértice</span></div>
      <div className="master-tools">
        {([{destination: 'bi-vertice', title: 'BI Vértice', text: 'Receita, crescimento e indicadores da plataforma.', icon: ChartColumn}, {destination: 'financeiro', title: 'Financeiro', text: 'Contratos, faturas e previsão de receita.', icon: Wallet}, {destination: 'sapiens', title: 'Sapiens', text: 'Diagnósticos, intervenções e metas.', icon: Brain}, {destination: 'configuracoes', title: 'Administração de acessos', text: 'Diretório e permissões de administradores Master.', icon: Settings}] as const).map(tool => <button type="button" className="master-tool" key={tool.destination} onClick={() => onNavigate(tool.destination)}>
          <span className="master-tool-icon"><tool.icon size={20} aria-hidden="true"/></span><span><strong>{tool.title}</strong><small>{tool.text}</small></span><ArrowRight size={17} aria-hidden="true"/>
        </button>)}
      </div>
    </section>
    {children}
  </div>;
}
