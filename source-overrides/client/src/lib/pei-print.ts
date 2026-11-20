export const planSections: [string, string][] = [
  ['strengths', 'Potencialidades e interesses'],
  ['educational_needs', 'Necessidades educacionais'],
  ['participation_barriers', 'Barreiras à participação'],
  ['strategies_used', 'Estratégias já utilizadas'],
  ['previous_results', 'Resultados anteriores'],
  ['recommended_support', 'Apoios recomendados'],
  ['student_preferences', 'Preferências do estudante'],
];
type PrintPlan = { student_name: string; student_matricula?: string; version_number?: number; status: string; period?: string; effective_from?: string; effective_until?: string; next_review_date?: string; objectives?: unknown } & Record<string, unknown>;
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const br = (v: unknown) => escapeHtml(v).replace(/\n/g, '<br>');
const day = (d?: string) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '—';
export function buildPeiHtml(plan: PrintPlan, accommodations: { category: string; description: string; responsible?: string }[], institutionName = ''): string {
  const goals = Array.isArray(plan.objectives) ? plan.objectives.map(String) : plan.objectives ? [String(plan.objectives)] : [];
  const sections = planSections.map(([k, l]) => plan[k] ? `<h2>${escapeHtml(l)}</h2><p>${br(plan[k])}</p>` : '').join('');
  const goalHtml = goals.length ? `<h2>Objetivos</h2><ol>${goals.map(g => `<li>${escapeHtml(g)}</li>`).join('')}</ol>` : '';
  const accHtml = accommodations.length ? `<h2>Adaptações e apoios</h2><table><tr><th>Categoria</th><th>Descrição</th><th>Responsável</th></tr>${accommodations.map(a => `<tr><td>${escapeHtml(a.category)}</td><td>${br(a.description)}</td><td>${escapeHtml(a.responsible || '—')}</td></tr>`).join('')}</table>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>PEI — ${escapeHtml(plan.student_name)}</title><style>
body{font:13px/1.5 Georgia,serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 4px;border-bottom:1px solid #999}
.meta{color:#444;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
.sign{margin-top:48px;display:flex;gap:32px}.sign div{flex:1;border-top:1px solid #000;padding-top:4px;text-align:center}
.note{margin-top:24px;font-size:11px;color:#555}</style></head><body>
<h1>Plano Educacional Individualizado (PEI) — versão ${plan.version_number || 1}</h1>
<div class="meta">${institutionName ? escapeHtml(institutionName) + ' · ' : ''}Estudante: <strong>${escapeHtml(plan.student_name)}</strong>${plan.student_matricula ? ' · Matrícula ' + escapeHtml(plan.student_matricula) : ''}<br>
Situação: ${escapeHtml(plan.status)}${plan.period ? ' · Período: ' + escapeHtml(plan.period) : ''}<br>Vigência: ${day(plan.effective_from)} a ${day(plan.effective_until)} · Próxima revisão: ${day(plan.next_review_date)}</div>
${sections}${goalHtml}${accHtml}
<div class="sign"><div>Coordenação</div><div>Equipe de apoio</div><div>Estudante / responsável</div></div>
<p class="note">Documento gerado em ${new Date().toLocaleDateString('pt-BR')}. Contém dados pessoais de estudante: uso restrito à equipe autorizada.</p>
</body></html>`;
}
export function printPei(plan: PrintPlan, accommodations: { category: string; description: string; responsible?: string }[], institutionName?: string) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('O navegador bloqueou a janela de impressão. Libere pop-ups e tente de novo.');
  w.document.open(); w.document.write(buildPeiHtml(plan, accommodations, institutionName)); w.document.close();
  w.focus(); setTimeout(() => w.print(), 300);
}
