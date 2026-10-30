export type TrajectoryEntry = {
  period: string;
  role: string;
  institution: string;
  summary?: string;
};

export type PublicationEntry = {
  year: string;
  title: string;
  venue: string;
  href?: string;
};

export type TypicalSituation = {
  number: string;
  situation: string;
  reading: string;
  delivery: string;
  serviceId: string;
};

export const founder = {
  name: "Virgílio Meirelles",
  shortName: "Virgílio Meirelles",
  role: "Advogado e Consultor Estratégico",
  headline: "Da clareza regulatória à solidez institucional.",
  intro:
    "A Vértice aplica a mesma lógica de leitura diagnóstica utilizada em contextos complexos, como o Centro Universitário UNITOP/Direito, generalizando-a para outras instituições. O foco é a sustentabilidade operacional, a auditoria acadêmica e a governança de dados.",
  formation: [] as string[],
  areas: [
    "Governança Acadêmica",
    "Processos Avaliativos e Regulação",
    "Sustentabilidade Operacional",
    "Gestão de Dados Institucionais",
  ],
  credentials: [
    {
      label: "Experiência Prática",
      detail:
        "Gestão de cursos de Direito e coordenação de processos de reconhecimento.",
    },
    {
      label: "Visão Sistêmica",
      detail: "Integração entre áreas acadêmicas, financeiras e regulatórias.",
    },
  ] as { label: string; detail: string }[],
  trajectory: [
    {
      period: "Atualmente",
      role: "Coordenador de Curso de Direito",
      institution: "Centro Universitário UNITOP",
      summary:
        "Liderança em processos de regulação, NDE e planejamento estratégico.",
    },
  ] as TrajectoryEntry[],
  publications: [] as PublicationEntry[],
  links: [
    { label: "Perfil Lattes", href: "http://lattes.cnpq.br/" },
  ] as { label: string; href: string }[],
};

export const typicalSituations: TypicalSituation[] = [
  {
    number: "01",
    situation: "O curso cresceu, mas a evasão também.",
    reading:
      "Antes de agir sobre a saída, é preciso distinguir trancamento, transferência e abandono, e identificar em que período e em que grupo o percurso perde força.",
    delivery:
      "Mapa da jornada por etapa, critérios de triagem e um plano de acolhimento pactuado com a coordenação.",
    serviceId: "permanencia",
  },
  {
    number: "02",
    situation:
      "A avaliação se aproxima e as evidências estão dispersas em pastas diferentes.",
    reading:
      "A questão raramente é a ausência de documentos, e sim a ausência de correspondência entre o que a instituição declara e o que consegue demonstrar.",
    delivery:
      "Matriz de requisitos, evidências e lacunas, com responsáveis e prazos de atualização documental.",
    serviceId: "academico",
  },
  {
    number: "03",
    situation: "Há oferta de turmas que não se sustenta.",
    reading:
      "Ocupação, carga horária e qualidade da formação precisam ser lidas juntas. Reduzir a decisão a uma razão numérica costuma transferir o problema adiante.",
    delivery:
      "Cenários operacionais com premissas explícitas, ligando demanda, ocupação, receita e custo.",
    serviceId: "sustentabilidade",
  },
  {
    number: "04",
    situation: "Todos medem, mas cada área apresenta um número diferente.",
    reading:
      "Indicadores divergentes geralmente vêm de definições divergentes: fonte, período, unidade e regra de cálculo não foram acordados antes da coleta.",
    delivery:
      "Dicionário de indicadores com regra de cálculo auditável e uma agenda de revisão com decisões registradas.",
    serviceId: "lideranca",
  },
];
