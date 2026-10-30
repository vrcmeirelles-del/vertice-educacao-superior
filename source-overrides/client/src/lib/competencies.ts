// Dados fictícios da tela "Competências e desenvolvimento" (demonstração).
// Nenhuma pessoa real é avaliada; iniciais, notas e planos são inventados.

export type ReadinessBand =
  | "Referência"
  | "Consolidado"
  | "Em desenvolvimento"
  | "Atenção"
  | "Apoio necessário";

export type Competency = {
  id: string;
  name: string;
  expectation: string;
  scale: string;
  critical: boolean;
};

export type AssessmentStatus = "Calibrado" | "Em calibragem" | "Fora da faixa" | "Aguardando pares";
export type ReviewStatus = "Concluída" | "Prioritária" | "Agendada" | "Não iniciada";
export type PlanState = "Em dia" | "Parado" | "Em execução";

export type PersonAssessment = {
  id: string;
  initials: string;
  label: string;
  role: string;
  unit: string;
  selfScore: number | null;
  peerScore: number | null;
  leaderScore: number | null;
  calibrated: number | null;
  criticalAdherence: number | null;
  completion: number;
  status: AssessmentStatus;
  review: ReviewStatus;
  relatedGoal: string;
};

export type DevelopmentPlan = {
  id: string;
  personId: string;
  competencyId: string;
  from: number;
  to: number;
  start: string;
  nextReview: string;
  owner: string;
  relatedGoal: string;
  state: PlanState;
  actions: { id: string; title: string; done: boolean }[];
};

export const readinessCuts = {
  "high": 4,
  "middle": 3
};

export const readinessMatrix: ReadinessBand[][] = [
  [
    "Apoio necessário",
    "Consolidado",
    "Referência"
  ],
  [
    "Apoio necessário",
    "Em desenvolvimento",
    "Consolidado"
  ],
  [
    "Apoio necessário",
    "Atenção",
    "Em desenvolvimento"
  ]
];

export const competencies: Competency[] = [
  {
    "id": "decisao_evidencia",
    "name": "Decisão com evidência",
    "expectation": "Sustenta uma escolha com dado, registro ou documento e sabe dizer o que ainda não sabe.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": true
  },
  {
    "id": "leitura_dados",
    "name": "Leitura de dados",
    "expectation": "Interpreta um indicador com sua unidade, período e limite, sem extrapolar o que ele mostra.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": true
  },
  {
    "id": "gestao_indicadores",
    "name": "Gestão de indicadores",
    "expectation": "Define fonte, regra de cálculo e responsável, e mantém a série atualizada no período previsto.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": true
  },
  {
    "id": "feedback",
    "name": "Feedback e desenvolvimento",
    "expectation": "Faz devolutiva estruturada sobre o observado e combina o próximo passo com a pessoa.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": true
  },
  {
    "id": "conducao_mudanca",
    "name": "Condução de mudança",
    "expectation": "Explica a razão da mudança, trata a resistência previsível e sustenta o combinado até o fim.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": false
  },
  {
    "id": "conformidade",
    "name": "Leitura regulatória",
    "expectation": "Lê requisito normativo, distingue o que é exigência do que é prática recomendada e organiza a evidência.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": false
  },
  {
    "id": "colaboracao",
    "name": "Trabalho entre áreas",
    "expectation": "Pactua escopo com outra área, cumpre o combinado e devolve o resultado para o processo.",
    "scale": "0 a 5, ancorado em exemplos observados",
    "critical": false
  }
];

export const assessments: PersonAssessment[] = [
  {
    "id": "p01",
    "initials": "MF",
    "label": "Coordenação acadêmica (exemplo)",
    "role": "Coordenação acadêmica",
    "unit": "Acadêmico",
    "selfScore": 4.5,
    "peerScore": 4.7,
    "leaderScore": 4.6,
    "calibrated": 4.6,
    "criticalAdherence": 4.7,
    "completion": 4,
    "status": "Calibrado",
    "review": "Concluída",
    "relatedGoal": "meta-desempenho-academico"
  },
  {
    "id": "p02",
    "initials": "AL",
    "label": "Gestão de curso (exemplo)",
    "role": "Gestão de curso",
    "unit": "Acadêmico",
    "selfScore": 4.2,
    "peerScore": 4.1,
    "leaderScore": 3.9,
    "calibrated": 4.1,
    "criticalAdherence": 4,
    "completion": 4,
    "status": "Calibrado",
    "review": "Agendada",
    "relatedGoal": "meta-permanencia-evasao"
  },
  {
    "id": "p03",
    "initials": "DO",
    "label": "Secretaria acadêmica (exemplo)",
    "role": "Secretaria acadêmica",
    "unit": "Acadêmico",
    "selfScore": 3,
    "peerScore": 3.4,
    "leaderScore": 3.4,
    "calibrated": null,
    "criticalAdherence": 3.2,
    "completion": 3,
    "status": "Aguardando pares",
    "review": "Não iniciada",
    "relatedGoal": "meta-permanencia-evasao"
  },
  {
    "id": "p04",
    "initials": "JP",
    "label": "Análise de dados (exemplo)",
    "role": "Análise de dados",
    "unit": "Tecnologia e dados",
    "selfScore": 2.6,
    "peerScore": 3.2,
    "leaderScore": 3.2,
    "calibrated": 3,
    "criticalAdherence": 2.4,
    "completion": 3,
    "status": "Em calibragem",
    "review": "Não iniciada",
    "relatedGoal": "meta-permanencia-evasao"
  },
  {
    "id": "p05",
    "initials": "BP",
    "label": "Captação (exemplo)",
    "role": "Captação",
    "unit": "Comercial",
    "selfScore": 2.9,
    "peerScore": 2.7,
    "leaderScore": 2.8,
    "calibrated": 2.8,
    "criticalAdherence": 3.6,
    "completion": 3,
    "status": "Fora da faixa",
    "review": "Prioritária",
    "relatedGoal": "meta-captacao-alunos"
  },
  {
    "id": "p06",
    "initials": "LS",
    "label": "Coordenação de curso (exemplo)",
    "role": "Coordenação de curso",
    "unit": "Acadêmico",
    "selfScore": 3.1,
    "peerScore": 3,
    "leaderScore": 3,
    "calibrated": 3,
    "criticalAdherence": 2.7,
    "completion": 4,
    "status": "Em calibragem",
    "review": "Agendada",
    "relatedGoal": "meta-captacao-alunos"
  },
  {
    "id": "p07",
    "initials": "RC",
    "label": "Regulação e evidências (exemplo)",
    "role": "Regulação e evidências",
    "unit": "Regulação",
    "selfScore": 3.6,
    "peerScore": 3.3,
    "leaderScore": 3.2,
    "calibrated": 3.3,
    "criticalAdherence": 3.9,
    "completion": 3,
    "status": "Em calibragem",
    "review": "Não iniciada",
    "relatedGoal": "meta-auditoria-evidencias"
  },
  {
    "id": "p08",
    "initials": "CS",
    "label": "Financeiro (exemplo)",
    "role": "Financeiro",
    "unit": "Administrativo",
    "selfScore": 3.4,
    "peerScore": 3.5,
    "leaderScore": 3.6,
    "calibrated": 3.5,
    "criticalAdherence": 4.3,
    "completion": 4,
    "status": "Calibrado",
    "review": "Concluída",
    "relatedGoal": "meta-margem-contribuicao"
  },
  {
    "id": "p09",
    "initials": "TM",
    "label": "Permanência (exemplo)",
    "role": "Núcleo de permanência",
    "unit": "Acadêmico",
    "selfScore": 3.8,
    "peerScore": 3.9,
    "leaderScore": 3.8,
    "calibrated": 3.8,
    "criticalAdherence": 3.1,
    "completion": 4,
    "status": "Calibrado",
    "review": "Agendada",
    "relatedGoal": "meta-permanencia-evasao"
  },
  {
    "id": "p10",
    "initials": "VZ",
    "label": "Avaliação institucional (exemplo)",
    "role": "Avaliação institucional",
    "unit": "Regulação",
    "selfScore": 3.9,
    "peerScore": 4,
    "leaderScore": 3.9,
    "calibrated": 3.9,
    "criticalAdherence": 4.5,
    "completion": 4,
    "status": "Calibrado",
    "review": "Concluída",
    "relatedGoal": "meta-avaliacao-institucional"
  },
  {
    "id": "p11",
    "initials": "HN",
    "label": "Planejamento (exemplo)",
    "role": "Planejamento",
    "unit": "Administrativo",
    "selfScore": 3.5,
    "peerScore": 3.6,
    "leaderScore": 3.7,
    "calibrated": 3.6,
    "criticalAdherence": 2.6,
    "completion": 4,
    "status": "Calibrado",
    "review": "Concluída",
    "relatedGoal": "meta-ocupacao-turma"
  },
  {
    "id": "p12",
    "initials": "FB",
    "label": "Atendimento ao estudante (exemplo)",
    "role": "Atendimento",
    "unit": "Acadêmico",
    "selfScore": 2.4,
    "peerScore": 2.2,
    "leaderScore": 2.3,
    "calibrated": 2.3,
    "criticalAdherence": 2.2,
    "completion": 2,
    "status": "Fora da faixa",
    "review": "Prioritária",
    "relatedGoal": "meta-permanencia-evasao"
  }
];

export const developmentPlans: DevelopmentPlan[] = [
  {
    "id": "pdi-p04-leitura",
    "personId": "p04",
    "competencyId": "leitura_dados",
    "from": 2,
    "to": 3.5,
    "start": "D-30",
    "nextReview": "D+15",
    "owner": "Coordenação (exemplo)",
    "relatedGoal": "meta-permanencia-evasao",
    "state": "Em execução",
    "actions": [
      {
        "id": "a1",
        "title": "Revisar três séries históricas com a gestão",
        "done": true
      },
      {
        "id": "a2",
        "title": "Escrever a nota técnica de uma leitura de indicador",
        "done": false
      },
      {
        "id": "a3",
        "title": "Apresentar uma leitura corrigida ao colegiado",
        "done": false
      }
    ]
  },
  {
    "id": "pdi-p06-decisao",
    "personId": "p06",
    "competencyId": "decisao_evidencia",
    "from": 3,
    "to": 4,
    "start": "D-72",
    "nextReview": "D+08",
    "owner": "Direção (exemplo)",
    "relatedGoal": "meta-captacao-alunos",
    "state": "Em dia",
    "actions": [
      {
        "id": "b1",
        "title": "Registrar a decisão e a evidência em ata",
        "done": true
      },
      {
        "id": "b2",
        "title": "Conduzir uma decisão de escopo com registro",
        "done": true
      },
      {
        "id": "b3",
        "title": "Revisar um caso em que a evidência era insuficiente",
        "done": true
      },
      {
        "id": "b4",
        "title": "Acompanhar a decisão até a execução",
        "done": false
      }
    ]
  },
  {
    "id": "pdi-p12-feedback",
    "personId": "p12",
    "competencyId": "feedback",
    "from": 1.8,
    "to": 3,
    "start": "D-12",
    "nextReview": "D+03",
    "owner": "Coordenação (exemplo)",
    "relatedGoal": "meta-permanencia-evasao",
    "state": "Parado",
    "actions": [
      {
        "id": "c1",
        "title": "Estruturar a devolutiva em observado, efeito e próximo passo",
        "done": true
      },
      {
        "id": "c2",
        "title": "Fazer três devolutivas acompanhadas",
        "done": false
      },
      {
        "id": "c3",
        "title": "Registrar o combinado de cada devolutiva",
        "done": false
      }
    ]
  }
];

export const bandOrder: ReadinessBand[] = [
  "Referência",
  "Consolidado",
  "Em desenvolvimento",
  "Atenção",
  "Apoio necessário",
];

export const bandColor: Record<ReadinessBand, string> = {
  Referência: "#3c6f92",
  Consolidado: "#4f7fa0",
  "Em desenvolvimento": "#7a94a9",
  Atenção: "#8c9baa",
  "Apoio necessário": "#c0a877",
};

export function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readinessFor(
  calibrated: number | null,
  criticalAdherence: number | null
) {
  if (!isScore(calibrated) || !isScore(criticalAdherence)) return null;
  const row =
    calibrated >= readinessCuts.high ? 0 : calibrated >= readinessCuts.middle ? 1 : 2;
  const column =
    criticalAdherence >= readinessCuts.high
      ? 2
      : criticalAdherence >= readinessCuts.middle
        ? 1
        : 0;
  const reasons = [
    "resultado acima da faixa de consolidação do ciclo",
    "resultado na faixa intermediária; depende do contexto da unidade",
    "resultado abaixo da faixa intermediária do ciclo",
  ];
  return {
    band: readinessMatrix[row][column],
    row,
    column,
    reason: reasons[row],
  };
}

// Variação ilustrativa por competência a partir do resultado calibrado.
function competencyScore(person: PersonAssessment, index: number) {
  if (!isScore(person.calibrated)) return null;
  const offsets = [0.4, -0.5, -0.3, 0.2, -0.1, 0.1, 0.3];
  const offset = offsets[index % offsets.length];
  return Math.max(0, Math.min(5, person.calibrated + offset));
}

export function personReadiness(person: PersonAssessment) {
  return readinessFor(person.calibrated, person.criticalAdherence);
}

export function findPerson(id: string) {
  return assessments.find(p => p.id === id);
}

export function findCompetency(id: string) {
  return competencies.find(c => c.id === id);
}

export function planProgress(plan: DevelopmentPlan) {
  const total = plan.actions.length;
  const done = plan.actions.filter(a => a.done).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((100 * done) / total),
  };
}

export function competencyGaps(people: PersonAssessment[] = assessments) {
  return competencies
    .map((competency, index) => {
      const scores = people
        .map(p => competencyScore(p, index))
        .filter(isScore);
      const mean =
        scores.length === 0
          ? 0
          : scores.reduce((sum, v) => sum + v, 0) / scores.length;
      return {
        competency,
        mean,
        gap: Math.max(0, 5 - mean),
        measured: scores.length,
      };
    })
    .sort((a, b) => b.gap - a.gap);
}

export function competencySummary(people: PersonAssessment[] = assessments) {
  const calibrated = people.filter(p => isScore(p.calibrated));
  const gaps = competencyGaps(people);
  const ids = new Set(people.map(p => p.id));
  const plans = developmentPlans.filter(p => ids.has(p.personId));
  return {
    peopleInCycle: calibrated.length,
    peopleExpected: people.length,
    calibrated: calibrated.length,
    calibratedPercent:
      people.length === 0
        ? 0
        : Math.round((100 * calibrated.length) / people.length),
    pendingReview: people.filter(p => p.review !== "Concluída").length,
    activePlans: plans.filter(p => p.state !== "Parado").length,
    plansAtRisk: plans.filter(p => p.state === "Parado").length,
    priorityGap:
      gaps.length === 0
        ? null
        : { name: gaps[0].competency.name, gap: gaps[0].gap },
  };
}

export function bandDistribution(people: PersonAssessment[] = assessments) {
  const counts: Record<ReadinessBand, number> = {
    Referência: 0,
    Consolidado: 0,
    "Em desenvolvimento": 0,
    Atenção: 0,
    "Apoio necessário": 0,
  };
  for (const person of people) {
    const r = personReadiness(person);
    if (r) counts[r.band] += 1;
  }
  return counts;
}

export function readinessGrid(people: PersonAssessment[] = assessments) {
  const cells: { row: number; column: number; people: PersonAssessment[] }[] =
    [];
  for (let row = 0; row < 3; row += 1)
    for (let column = 0; column < 3; column += 1)
      cells.push({ row, column, people: [] });
  for (const person of people) {
    const r = personReadiness(person);
    if (!r) continue;
    const row = Math.min(r.row, 2);
    cells
      .find(c => c.row === row && c.column === r.column)
      ?.people.push(person);
  }
  return cells;
}

export function formatScore(value: number | null | undefined) {
  return isScore(value)
    ? value.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "—";
}
