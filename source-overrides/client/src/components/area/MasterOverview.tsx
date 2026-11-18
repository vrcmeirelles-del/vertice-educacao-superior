import type { ReactNode } from 'react';
import PortalPageHeader from '../PortalPageHeader';
import { ArrowRight, Building2, GraduationCap, ChartColumn, Wallet, Settings, Brain, GitBranch } from 'lucide-react';
import './master-overview.css';
import '../homologacao/homologation.css';

export type MasterDestination = 'universidades' | 'escolas' | 'financeiro' | 'bi-vertice' | 'configuracoes' | 'institution' | 'sapiens' | 'integracao' | 'homologacao';
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
    <PortalPageHeader title="Gestão institucional e operação" eyebrow="Administração da plataforma" icon={Building2}
      description="Selecione uma instituição para gerenciar cursos e módulos. A administração da plataforma fica reunida nesta visão." />

    <section aria-label="Resumo da plataforma" className="master-summary">
      <div><span>Instituições ativas</span><strong>{ies.length + schools.length}</strong><small>Educação superior e escolas</small></div>
      <div><span>Contratos ativos</span><strong>{contracts.toLocaleString('pt-BR')}</strong><small>Operação contratual</small></div>
      <div><span>Receita mensal recorrente</span><strong>{revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong><small>MRR · fonte: visão financeira</small></div>
      <div><span>Contratos em teste</span><strong>{trials.toLocaleString('pt-BR')}</strong><small>Períodos de avaliação</small></div>
    </section>

    <section className="master-homologation-intro" aria-labelledby="master-homologation-title">
      <div><h3 id="master-homologation-title">Central de Homologação</h3><p>Acompanhe versões, testes, evidências, riscos e o funcionamento real dos módulos. Publicação, validação técnica e aceite institucional permanecem separados.</p><div className="master-homologation-modules">{['Conecta 360°','Planejamento','Sapiens','TCC','Atividades Complementares','Estágio 360°'].map(name=><span key={name}>{name}</span>)}</div></div>
      <button type="button" onClick={()=>onNavigate('homologacao')}>Abrir Central de Homologação <ArrowRight size={17} aria-hidden="true"/></button>
    </section>

    <section className="master-homologation-intro" aria-labelledby="master-enade-title">
      <div><h3 id="master-enade-title">ENADE 360° · Conclusão operacional</h3><p>Núcleo genérico, evidências, OCR, relatórios R2–R6 e validação científica. Acompanhe cada versão até o aceite humano e a publicação controlada.</p><div className="master-homologation-modules"><span>Rastreabilidade documental</span><span>Checklists por ambiente</span><span>Aprovações explícitas</span></div></div>
      <a className="corp-btn" href="/master#enade-operacao=1">Abrir acompanhamento ENADE 360° <ArrowRight size={17} aria-hidden="true"/></a>
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
        {([{destination: 'bi-vertice', title: 'BI Vértice', text: 'Receita, crescimento e indicadores da plataforma.', icon: ChartColumn}, {destination: 'financeiro', title: 'Financeiro', text: 'Contratos, faturas e previsão de receita.', icon: Wallet}, {destination: 'sapiens', title: 'Sapiens', text: 'Diagnósticos, intervenções e metas.', icon: Brain}, {destination: 'integracao', title: 'Integração Fato & Ordem', text: 'Acompanhamento, testes, evidências e homologação.', icon: GitBranch}, {destination: 'configuracoes', title: 'Administração de acessos', text: 'Diretório e permissões de administradores Master.', icon: Settings}] as const).map(tool => <button type="button" className="master-tool" key={tool.destination} onClick={() => onNavigate(tool.destination)}>
          <span className="master-tool-icon"><tool.icon size={20} aria-hidden="true"/></span><span><strong>{tool.title}</strong><small>{tool.text}</small></span><ArrowRight size={17} aria-hidden="true"/>
        </button>)}
      </div>
    </section>
    {children}
  </div>;
}
