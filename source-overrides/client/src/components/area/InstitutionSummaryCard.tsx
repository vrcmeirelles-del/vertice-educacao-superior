import type { institutionEnrollmentSummary } from '@/lib/enrollment-summary';
import '@/pages/owner-dashboard-redesign.css';

interface Props {
  name: string;
  acronym?: string;
  tier?: string;
  roleLabel: string;
  archived: boolean;
  courseCount: number;
  goalCount: number;
  overdue: number;
  findings: number;
  stats: ReturnType<typeof institutionEnrollmentSummary>;
  onOpen: () => void;
  onRepository: () => void;
  onLibrary: () => void;
  onEbitda?: () => void;
  onInstrument: () => void;
}

/** Scoped institution summary. Data and authorized destinations come from OwnerDashboard. */
export default function InstitutionSummaryCard({name, acronym, tier, roleLabel, archived, courseCount, goalCount, overdue, findings, stats, onOpen, onRepository, onLibrary, onEbitda, onInstrument}: Props) {
  const coverage=stats&&stats.total>0?stats.covered/stats.total:null;
  const incomplete=coverage!==null&&coverage<1;
  return <article className="vx-inst-card">
       <div className="vx-inst-card-heading">
        <span className="vx-inst-building" aria-hidden="true">{tier==='escolas'?'🏫':'🏛️'}</span>
        <div className="vx-inst-identity"><h3>{name}</h3><p>{acronym || (tier==='escolas'?'Escola':'Instituição de ensino superior')} · <span style={{padding:'1px 6px',borderRadius:8,fontSize:10,fontWeight:700,background:'#e7effc',color:'#2457a4'}}>{tier==='escolas'?'Escola':'IES'}</span> · {roleLabel}</p></div>
        {archived&&<span className="vx-inst-archived">Arquivada</span>}
       </div>
       <div className="vx-inst-indicators">
        <div><small>Cursos cadastrados</small><strong>{courseCount.toLocaleString('pt-BR')}</strong></div>
        <div><small>Metas registradas</small><strong>{goalCount.toLocaleString('pt-BR')}</strong></div>
        <div className={overdue?'vx-inst-attention':''}><small>Ações atrasadas</small><strong>{overdue.toLocaleString('pt-BR')}</strong></div>
        <div className={findings?'vx-inst-attention':''}><small>Achados abertos</small><strong>{findings.toLocaleString('pt-BR')}</strong></div>
       </div>
       <section className="vx-inst-enrollment" aria-label={"Cobertura das matrículas de "+name}>
        <div className="vx-inst-enrollment-top"><div><small>Matrículas no recorte consultado</small><strong>{stats?stats.enrolled.toLocaleString('pt-BR'):'Sem dados'}</strong></div><span className={incomplete?'vx-inst-source-partial':'vx-inst-source-neutral'}>{!stats?'Sem fonte':incomplete?'Cobertura parcial':'Cobertura disponível'}</span></div>
        {stats?<><p>{stats.semester} · {stats.covered} de {stats.total} cursos com dados no recorte</p>
         <div className="vx-inst-coverage" role="progressbar" aria-label="Cobertura de cursos com matrícula" aria-valuenow={stats.covered} aria-valuemin={0} aria-valuemax={Math.max(1,stats.total)}><span style={{width:(coverage===null?0:Math.min(100,coverage*100))+'%'}}/></div>
         {incomplete&&<p className="vx-inst-caution">Atenção: total parcial da base; não representa necessariamente o total oficial de estudantes da IES. Reconciliar com a extração de origem.</p>}</>:<p>Nenhum registro de matrícula disponibilizado para esta instituição.</p>}
       </section>
       <div className="vx-inst-card-actions">
        <button type="button" className="vx-inst-primary" onClick={onOpen}>Abrir gestão da instituição <span aria-hidden="true">↗</span></button>
        <div className="vx-inst-shortcuts">
         <button type="button" onClick={onRepository}>Repositório</button>
         <button type="button" onClick={onLibrary}>Biblioteca INEP</button>
         {onEbitda&&<button type="button" onClick={onEbitda}>EBITDA</button>}
         <button type="button" onClick={onInstrument}>Novo Instrumento</button>
        </div>
       </div>
      </article>;
}
