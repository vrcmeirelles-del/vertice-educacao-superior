import { REPORT_FIELDS, type TeachingReportDraft } from '@/lib/teaching-execution-report';

export default function TeachingExecutionReport({ value, onChange }: { value: TeachingReportDraft; onChange: (value: TeachingReportDraft) => void }) {
  return <section className="teaching-form-step" aria-label="Relato da execução">
    <h4><span aria-hidden="true">2</span> Relato da execução</h4>
    <p>Preencha os itens abaixo para a validação. Você pode salvar um rascunho incompleto. Quando um item não se aplicar, registre isso com a justificativa. Nos campos da equipe, informe somente nomes e funções necessários, sem CPF, contatos ou dados sensíveis.</p>
    {REPORT_FIELDS.map(field => <label className="planning-field" key={field.key}>
      <span>{field.label}</span>
      {['event_name', 'coordinator'].includes(field.key)
        ? <input maxLength={field.limit} value={value[field.key]} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />
        : <textarea rows={field.key === 'presentation' ? 12 : field.key === 'results' ? 7 : 3} maxLength={field.limit} value={value[field.key]} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />}
      {'help' in field && <small>{field.help}</small>}
    </label>)}
    <label className="planning-field"><span>Valor investido (R$)</span>
      <input type="number" min="0" max="1000000000" step="0.01" value={value.investment_amount} onChange={e => onChange({ ...value, investment_amount: e.target.value })} />
      <small>Informe o total efetivamente investido. Use 0 quando não houve investimento; vazio significa não informado. Não há soma ou lançamento financeiro automático.</small>
    </label>
  </section>;
}
