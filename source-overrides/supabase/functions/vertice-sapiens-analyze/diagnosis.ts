// Diagnóstico por competência montado por algoritmo (auditoria de 20/11/2026).
// Substitui a geração por IA e a "revisão contraditória" por outra IA: o texto sai
// dos números da competência e as ações vêm de uma tabela severidade × módulo.
// As ressalvas de método (amostra, viés de seleção) são regras fixas, não opinião.

export type DiagnosisSeverity = "critical" | "warning" | "watch" | "adequate" | "strong";
export type InterventionType = "diagnostic_activity" | "remedial_practice" | "content_review" | "custom";
export type RecommendedAction = { type: InterventionType; title: string; description: string; priority: "alta" | "media" | "baixa" };
export type DiagnosisInput = {
  courseName: string; module: string; competency: string | null; semester: string;
  severity: DiagnosisSeverity; accuracy: number; graded: number; attempts: number; studentCount: number;
  previousAccuracy?: number | null; previousCycle?: number | null;
};

export const SMALL_SAMPLE = 30;
const MODULE_LABEL: Record<string, string> = {
  oab: "OAB", cfc: "CFC", enade: "ENADE", enamed: "ENAMED", residencia: "Residência", enem: "ENEM",
  delegado: "Delegado", pf: "Polícia Federal", estadual: "Concursos estaduais", federal: "Concursos federais",
  defensoria: "Defensoria", mp: "Ministério Público",
};
// Formato de prática coerente com a prova de cada módulo.
const PRACTICE: Record<string, string> = {
  oab: "questões objetivas no padrão da 1ª fase da OAB",
  cfc: "questões no padrão do Exame de Suficiência do CFC",
  enade: "itens no formato ENADE (objetivos e discursivos de formação específica)",
  enamed: "casos clínicos no formato ENAMED",
  residencia: "casos clínicos no padrão das provas de Residência",
  enem: "itens no padrão ENEM, com gradação de dificuldade",
};
const SEVERITY_LABEL: Record<DiagnosisSeverity, string> = {
  critical: "crítica", warning: "alerta", watch: "observação", adequate: "adequada", strong: "forte",
};
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function moduleLabel(module: string) { return MODULE_LABEL[module] || module.toUpperCase(); }

export function buildDiagnosis(d: DiagnosisInput) {
  const mod = moduleLabel(d.module);
  const target = d.competency ? `${mod} · ${d.competency}` : mod;
  const practice = PRACTICE[d.module] || `questões no padrão da prova de ${mod}`;
  const small = d.studentCount < SMALL_SAMPLE;

  let trend = "";
  if (typeof d.previousAccuracy === "number" && Number.isFinite(d.previousAccuracy)) {
    const delta = (d.accuracy - d.previousAccuracy) * 100;
    const dir = Math.abs(delta) < 1 ? "estável" : delta > 0 ? "melhora" : "piora";
    trend = ` No ciclo anterior${d.previousCycle ? ` (#${d.previousCycle})` : ""}: ${pct(d.previousAccuracy)} (${dir}, ${delta >= 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")} p.p.).`;
  } else if (d.previousCycle) {
    trend = ` Há diagnóstico anterior publicado (ciclo #${d.previousCycle}).`;
  } else {
    trend = " Primeiro diagnóstico desta competência.";
  }

  const summary = (`${d.courseName} — ${target}: ${pct(d.accuracy)} de acerto em ${d.graded} respostas corrigidas de ${d.studentCount} estudantes (${d.semester}). Classificação: ${SEVERITY_LABEL[d.severity]}.${trend}` +
    (small ? ` Amostra pequena (menos de ${SMALL_SAMPLE} estudantes): confirmar antes de agir.` : "")).slice(0, 2000);

  const mainFindings = [
    `Taxa de acerto de ${pct(d.accuracy)} em ${d.graded} respostas corrigidas (${d.attempts} tentativas).`,
    `${d.studentCount} estudantes com atividade registrada nesta competência.`,
  ];
  if (trend.includes("p.p.")) mainFindings.push(trend.trim());

  const methodology = [
    "Dados restritos aos estudantes que usam a plataforma Fato & Ordem; não representam necessariamente a turma inteira.",
    "Classificação por regra fixa: média entre taxa de acerto e domínio estimado; crítica abaixo de 30%, alerta abaixo de 50%.",
    "Desempenho baixo pode refletir dificuldade do instrumento, e não só lacuna de aprendizagem: comparar com o índice de dificuldade das questões.",
  ];
  if (small) methodology.unshift(`Amostra de ${d.studentCount} estudantes, abaixo de ${SMALL_SAMPLE}: resultado indicativo, não conclusivo.`);

  const actions: RecommendedAction[] = [];
  if (d.severity === "critical") {
    actions.push(
      { type: "diagnostic_activity", priority: "alta", title: `Atividade diagnóstica: ${target}`.slice(0, 200),
        description: `Aplicar atividade diagnóstica curta com ${practice} para localizar os subtemas com maior erro em ${target}, antes do reforço. Resultado atual: ${pct(d.accuracy)} de acerto (${d.studentCount} estudantes).` },
      { type: "remedial_practice", priority: "alta", title: `Trilha de reforço: ${target}`.slice(0, 200),
        description: `Trilha de prática dirigida com ${practice}, começando pelos subtemas de menor acerto, com correção comentada. Meta: elevar o domínio estimado a 50%.` },
      { type: "content_review", priority: "media", title: `Revisão do conteúdo em aula: ${target}`.slice(0, 200),
        description: `Encaminhar ao docente responsável a revisão do conteúdo de ${target} em sala, com base nos erros mais frequentes identificados pela atividade diagnóstica.` },
    );
  } else if (d.severity === "warning") {
    actions.push(
      { type: "remedial_practice", priority: "alta", title: `Prática dirigida: ${target}`.slice(0, 200),
        description: `Lista de prática com ${practice} nos subtemas de menor acerto de ${target}, com correção comentada. Resultado atual: ${pct(d.accuracy)}. Meta: domínio estimado de 70%.` },
      { type: "content_review", priority: "media", title: `Revisão pontual: ${target}`.slice(0, 200),
        description: `Sugerir ao docente uma revisão pontual de ${target} em aula, priorizando os itens com maior taxa de erro.` },
    );
  }

  return {
    summary,
    detailedAnalysis: {
      main_findings: mainFindings,
      possible_causes: d.severity === "critical" || d.severity === "warning"
        ? ["Hipótese: lacuna de conteúdo nos subtemas de menor acerto.", "Hipótese: pouca prática no formato da prova.", "Hipótese: questões de dificuldade acima da média no período."]
        : [],
      methodology_notes: methodology,
      requires_human_review: small && (d.severity === "critical" || d.severity === "warning"),
      generated_by: "algoritmo",
    },
    recommendedActions: actions,
  };
}
