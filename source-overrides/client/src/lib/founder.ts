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
  role: "Mestre, advogado e consultor em gestão e regulação do ensino superior",
  headline: "Da clareza regulatória à solidez institucional.",
  intro:
    "A Vértice nasce da experiência acadêmica de 20 anos do professor Virgílio Meirelles — sala de aula, coordenação de curso de Direito, formação em avaliação institucional e atuação jurídica junto a instituições de ensino. O método vem daí: ler o documento como quem já precisou escrevê-lo, e olhar o indicador como quem já teve de responder por ele diante de um avaliador.",
  formation: [] as string[],
  areas: [
    "Governança Acadêmica",
    "Processos Avaliativos e Regulação",
    "Sustentabilidade Operacional",
    "Gestão de Dados Institucionais",
  ],
  credentials: [
    {
      label: "Da sala de aula à regulação",
      detail:
        "Vinte anos de magistério superior e coordenação de curso. O diagnóstico parte de quem já ocupou o lugar de quem executa.",
    },
    {
      label: "Formação em avaliação institucional",
      detail:
        "Domínio dos instrumentos de avaliação de cursos e de recredenciamento, e da lógica com que são aplicados.",
    },
    {
      label: "Dupla formação: Direito e Pedagogia",
      detail:
        "O requisito regulatório lido junto com o projeto pedagógico, não contra ele.",
    },
    {
      label: "Visão sistêmica",
      detail:
        "Integração entre o acadêmico, o regulatório e o financeiro. Indicador isolado não sustenta decisão.",
    },
  ] as { label: string; detail: string }[],
  trajectory: [
    {
      period: "Desde 2008",
      role: "Magistério superior",
      institution: "Cursos de Direito e de formação pedagógica",
      summary:
        "Docência, atuação em NDE e colegiado e participação na construção de projetos pedagógicos de curso.",
    },
    {
      period: "Atualmente",
      role: "Coordenação de curso de Direito",
      institution: "Centro universitário privado",
      summary:
        "Condução de processos de reconhecimento e renovação, planejamento estratégico de curso e gestão de corpo docente.",
    },
    {
      period: "Formação",
      role: "Formação jurídica e acadêmica",
      institution: "Direito (2003) e Pedagogia",
      summary:
        "Especializações em Direito Civil e Processual Civil e em Psicopedagogia. Mestre em Planejamento e Desenvolvimento Regional. Advogado inscrito na OAB/TO 4017-B.",
    },
    {
      period: "Produção",
      role: "Produção autoral e técnica",
      institution: "Direito, educação e gestão acadêmica",
      summary:
        "Obras publicadas e produção técnica voltada à gestão e à regulação do ensino superior.",
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
