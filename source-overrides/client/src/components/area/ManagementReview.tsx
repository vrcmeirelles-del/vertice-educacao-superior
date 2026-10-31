import { useMemo, useState } from 'react';
import type { Row } from '@/lib/area';
import { managementReview, type ReviewData } from '@/lib/management-review';
import { repositorySemester } from '@/lib/repository';
import ManagementCharts from './ManagementCharts';
const labels: Record<string,string> = { nsa:'NSA declarado — revisar aplicabilidade', pendente:'Não enviado', enviado:'Aguardando validação humana', validado:'Validado documentalmente', devolvido:'Devolvido', classificacao:'Classificação incompatível' };
export default function ManagementReview({ data, courses, institutionId }: { data: ReviewData; courses: Row[]; institutionId: string }) {
  const [courseId,setCourseId] = useState('');
  const [semester,setSemester] = useState('');
  const coursesHere = courses.filter(c => c.institution_id === institutionId);
  const periods = [...new Set(data.requests.filter(r => r.institution_id === institutionId && r.course_id === courseId).map(r => repositorySemester(r.semester)).filter(Boolean))].sort().reverse();
  const report = useMemo(() => managementReview(data,institutionId,courseId,semester), [data,institutionId,courseId,semester]);
  const validCourse = coursesHere.some(c => c.id === courseId);
  return <section className="area-panel mr-panel" aria-labelledby="review-title">
    <header className="mr-hero"><p className="mr-eyebrow">VÉRTICE · INTELIGÊNCIA GERENCIAL</p><h3 id="review-title">Conciliação de metas e evidências</h3>
    <p>Devolutiva automática baseada em regras e vínculos cadastrados. Não utiliza IA generativa, não lê o conteúdo dos arquivos e não envia dados a terceiros.</p>
    </header><div className="mr-body"><div className="area-form area-inline-form mr-filters"><label>Curso<select value={courseId} onChange={e => {setCourseId(e.target.value);setSemester('');}}><option value="">Selecione um curso</option>{coursesHere.map(c => <option value={c.id} key={c.id}>{String(c.name)}{c.code ? ` · ${c.code}` : ''}</option>)}</select></label><label>Semestre dos documentos<select value={semester} onChange={e=>setSemester(e.target.value)}><option value="">Todos os períodos cadastrados</option>{periods.map(p=><option key={p}>{p}</option>)}</select></label></div>
    {!validCourse && <div className="mr-start"><span aria-hidden="true">◉</span><b>Transforme os registros em uma visão de gestão</b><p>Selecione um curso para ver a composição documental, as metas com medição e as prioridades da próxima reunião. Os gráficos usam somente os dados cadastrados.</p></div>}
    {validCourse && <>
      <ManagementCharts report={report} />
      <p className="area-note"><strong>Conceito do curso: não estimado.</strong> Cobertura documental, cumprimento de metas e conceito INEP são medidas diferentes. É necessário validar instrumento e ato aplicável, critérios qualitativos, evidências, NSA e julgamento humano. Ausência de evidência não é nota zero.</p>
      <p>{report.goals.length} metas · {report.evidence.length} exigências no recorte · {report.unlinked.length} exigências sem vínculo com as metas listadas · {report.diagnosis.length} itens de diagnóstico cadastrados.</p>
      <p className="area-muted">O semestre filtra documentos. Medições e ações abaixo mantêm seu histórico completo; datas são mostradas. Validação documental não certifica atendimento a um indicador INEP.</p>
      <h4 className="mr-section-title">Detalhamento das metas</h4>
      {!report.goals.length && <p>Nenhuma meta cadastrada para este curso. Defina objetivos, responsáveis, linha de base e prazo antes de avaliar resultados.</p>}
      {report.goals.map(({goal,gaps,documents,actions,latestMeasurement}) => <details key={goal.id}><summary>{String(goal.title ?? goal.indicator ?? 'Meta')} · {gaps.length ? `${gaps.length} pontos de atenção` : 'Revisão qualitativa necessária'}</summary>
        <p>Indicador: {String(goal.indicator ?? 'não informado')} · Situação: {String(goal.status)} · Referência da meta: {goal.id}</p>
        <p>{latestMeasurement ? `Última medição: ${latestMeasurement.value} ${goal.unit ?? ''} em ${latestMeasurement.measured_on}. Referência: ${latestMeasurement.id}.` : 'Resultado ainda não comprovado por medição.'} {actions.length} ações vinculadas.</p>
        <ul>{gaps.map(g=><li key={g}>{g}</li>)}</ul>
        <ul>{documents.map(e=><li key={e.request.id}>{String(e.request.title)} — {labels[e.state] ?? e.state}; {e.file ? `arquivo ${e.file.file_name}, versão ${e.file.id}` : `exigência ${e.request.id}`}. Indicadores: {e.indicators.join(', ') || 'sem código identificado'}.</li>)}</ul>
      </details>)}
      <h4>Evidências por indicador cadastrado</h4><p>São exibidos apenas códigos vinculados às exigências; esta lista não representa todos os indicadores aplicáveis.</p>
      {!report.indicators.length && <p>Nenhum código de indicador identificado nas exigências deste recorte.</p>}
      {report.indicators.map(i=><details key={i.code}><summary>Indicador {i.code} · {i.evidence.length} exigências</summary><ul>{i.evidence.map(e=><li key={e.request.id}>{String(e.request.title)} — {labels[e.state] ?? e.state}. Referência: {e.request.id}{e.file ? `; arquivo: ${e.file.file_name} (${e.file.id})` : ''}.</li>)}</ul></details>)}
      <p>Próxima decisão do gestor: conferir o conteúdo e a atualidade das evidências, registrar medições, tratar devoluções e revisar o diagnóstico segundo o instrumento aplicável. Nenhuma meta ou validação foi alterada por esta análise.</p>
    </>}
  </div></section>;
}
