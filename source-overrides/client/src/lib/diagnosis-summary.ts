import type { Row } from './area';

// Faixas gerenciais internas. Não representam conceito oficial do INEP.
export function diagnosisScore(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const score = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(score) && score >= 1 && score <= 5 ? score : null;
}

export function summarizeDiagnosis(rows: Row[], dimensions: readonly string[]) {
  const groups = new Map<string, Row[]>(dimensions.map(d => [d, []]));
  for (const row of rows) {
    const dimension = String(row.dimension ?? '').trim() || 'Dimensão não informada';
    if (!groups.has(dimension)) groups.set(dimension, []);
    groups.get(dimension)!.push(row);
  }
  return [...groups].map(([dimension, items]) => {
    const assessed = items.filter(r => diagnosisScore(r.score) !== null);
    const low = assessed.filter(r => diagnosisScore(r.score)! < 3)
      .sort((a, b) => diagnosisScore(a.score)! - diagnosisScore(b.score)!);
    const improvement = assessed.filter(r => diagnosisScore(r.score)! >= 3 && diagnosisScore(r.score)! < 4);
    const missing = items.length - assessed.length;
    const average = assessed.length ? assessed.reduce((sum, r) => sum + diagnosisScore(r.score)!, 0) / assessed.length : null;
    const tone = average === null ? 'gray' : low.length ? 'red' : average < 4 ? 'amber' : 'green';
    const status = average === null ? 'Sem avaliação' : low.length ? 'Requer atenção' : average < 4 ? 'Em desenvolvimento' : 'Bom desempenho';
    const conclusion = !items.length
      ? 'Ainda não há indicadores registrados. Cadastre as avaliações para compor o fechamento desta dimensão.'
      : average === null
        ? 'Os indicadores registrados ainda não têm notas válidas. Complete a avaliação para consolidar esta dimensão.'
        : `${low.length ? `${low.length} indicador(es) com nota baixa exigem atenção, mesmo quando a média é favorável.` : 'Nenhum indicador avaliado está abaixo de 3.'} ${improvement.length ? `${improvement.length} indicador(es) entre 3 e 4 podem evoluir.` : ''} ${missing ? `${missing} indicador(es) sem nota válida: fechamento parcial.` : 'Síntese das avaliações registradas.'}`.trim();
    return { dimension, items, assessed, low, improvement, missing, average, tone, status, conclusion };
  });
}

const IMPROVEMENTS: Record<string, string> = {
  'Organização didático-pedagógica': 'Revisar os documentos e as práticas pedagógicas relacionados ao indicador; pactuar os ajustes com a coordenação e o NDE e registrar sua execução.',
  'Corpo docente e tutorial': 'Conferir os registros e a atuação de docentes e tutores relacionados ao indicador; definir formação ou adequações e documentar os resultados.',
  'Infraestrutura': 'Verificar os espaços, equipamentos ou recursos citados no achado; priorizar adequações de disponibilidade, acessibilidade e manutenção e registrar a verificação.',
  'Gestão e governança': 'Revisar o processo e as responsabilidades relacionados ao indicador; formalizar decisões, responsáveis e acompanhamento periódico.',
  'Captação e ingresso': 'Revisar as etapas de captação e ingresso relacionadas ao indicador; identificar perdas no percurso e acompanhar as medidas com dados do período.',
  'Permanência e êxito': 'Identificar as dificuldades apontadas no indicador; organizar apoio acadêmico e acompanhar permanência, aprendizagem e conclusão.',
  'Sustentabilidade financeira': 'Conferir receitas, custos e premissas relacionados ao indicador; definir medidas de ajuste e acompanhar seus resultados.',
  'Avaliação e regulação': 'Conferir o requisito e as evidências relacionados ao indicador; organizar as pendências e acompanhar sua regularização.',
};

export function diagnosisRecommendation(row: Row): string {
  const guidance = IMPROVEMENTS[String(row.dimension)] ?? 'Revisar o requisito do indicador e o achado registrado; definir as adequações e documentar os resultados.';
  return `${guidance} ${String(row.evidence ?? '').trim() ? 'Atualizar a evidência após a execução e reavaliar a nota.' : 'Reunir evidências da situação e da melhoria antes de reavaliar a nota.'}`;
}
