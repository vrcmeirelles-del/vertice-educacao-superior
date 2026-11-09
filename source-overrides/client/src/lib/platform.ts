export type PlatformModule = {
  name: string;
  summary: string;
  features: string[];
};

export type PlatformGroup = {
  id: string;
  number: string;
  title: string;
  intro: string;
  modules: PlatformModule[];
};

export const platformIntro =
  "O painel da Vértice é a parte operacional da consultoria. Ele não substitui o sistema acadêmico da instituição: lê os relatórios que ela já produz, organiza evidências e devolve leitura pronta para decisão. Cada módulo abaixo está implantado e em uso.";

export const platformGroups: PlatformGroup[] = [
  {
    id: "regulacao",
    number: "01",
    title: "Regulação e avaliação",
    intro:
      "O instrumento de avaliação deixa de ser um PDF consultado às pressas e passa a ser um fluxo de trabalho com responsável, evidência e prazo.",
    modules: [
      {
        name: "Novo instrumento de avaliação",
        summary:
          "Checklist diagnóstico por objeto de avaliação, com evidência anexada e situação registrada.",
        features: [
          "Avaliação de curso e recredenciamento institucional no mesmo fluxo",
          "Objetos organizados por dimensão e por eixo, com temas transversais",
          "Cronograma do ciclo trienal e registro de CPA",
          "Repositório de evidências vinculado a cada objeto",
        ],
      },
      {
        name: "Instrumento anterior e espelhamento",
        summary:
          "O acervo já construído no instrumento anterior não é descartado: é mapeado para o novo.",
        features: [
          "Simulador de conceito por eixo, com leitura visual do resultado",
          "Correspondência entre os objetos dos dois instrumentos",
          "Reaproveitamento de evidências já catalogadas",
        ],
      },
      {
        name: "Reconhecimento de curso",
        summary:
          "Organização do dossiê por indicador, com rastreabilidade do que sustenta cada nota pretendida.",
        features: [
          "Indicadores com peso, situação e documento comprobatório",
          "Identificação de lacunas antes da visita",
          "Importação de pastas documentais já organizadas",
        ],
      },
      {
        name: "Biblioteca de documentos-modelo",
        summary:
          "Modelos regulatórios entregues já personalizados com a identidade da instituição.",
        features: [
          "Nome, logo e cor institucional aplicados no momento do download",
          "Acervo classificado por tema e por finalidade",
        ],
      },
    ],
  },
  {
    id: "captacao",
    number: "02",
    title: "Captação e permanência",
    intro:
      "Acompanhar o funil enquanto ele ainda pode ser corrigido, e não no relatório do mês seguinte.",
    modules: [
      {
        name: "Painel de captação",
        summary:
          "Leitura do funil de ingresso com origem, custo e conversão por curso.",
        features: [
          "Funil acumulado, origens de lead e evolução mensal",
          "Custo por canal e conversão por curso",
          "Entrada por importação de planilha ou integração a definir",
          "Modo TV com atualização automática, para tela de gabinete",
        ],
      },
      {
        name: "Leitura de evasão",
        summary:
          "Separação entre o vínculo que nunca existiu de fato e a evasão real.",
        features: [
          "Distinção entre trancamento, cancelamento e abandono",
          "Taxa de ocupação e de evasão por curso e por semestre",
          "Agregação por curso, sem exposição de dados pessoais",
        ],
      },
    ],
  },
  {
    id: "academico",
    number: "03",
    title: "Inteligência acadêmica",
    intro:
      "O que a coordenação leva semanas para montar à mão, lido a partir dos relatórios que o sistema acadêmico já emite.",
    modules: [
      {
        name: "Painel acadêmico",
        summary:
          "Visão histórica da instituição por curso, modalidade e semestre.",
        features: [
          "Indicadores gerais, cursos de maior volume e distribuição por modalidade",
          "Série histórica e tabela ordenável por curso",
          "Modo TV para acompanhamento contínuo",
        ],
      },
      {
        name: "Raio-X de curso",
        summary:
          "Leitura completa de um curso: vínculos, situação dos estudantes e corpo docente.",
        features: [
          "Matriculados, trancados e cancelados por semestre",
          "Evolução do corpo docente e composição por titulação",
          "Comparação entre semestres consecutivos",
        ],
      },
      {
        name: "Reprovação e ensalamento",
        summary:
          "Cruzamento entre professor, disciplina e curso, e entre turma e ocupação real.",
        features: [
          "Reprovação por disciplina, por professor e por semestre",
          "Ensalamento real por turma, comparado ao planejado",
          "Base para revisão de oferta e de alocação docente",
        ],
      },
    ],
  },
  {
    id: "economico",
    number: "04",
    title: "Sustentabilidade econômica",
    intro:
      "Leitura de resultado sem abrir o caixa nem a contabilidade: premissas explícitas, cenários auditáveis.",
    modules: [
      {
        name: "Resultado por curso",
        summary:
          "Coleta estruturada de receitas e custos por curso, com série histórica longa.",
        features: [
          "Abas de coleta espelhando a planilha financeira da instituição",
          "Série histórica plurianual por curso",
          "Simulador de resultado com recálculo em tempo real",
          "Importação e exportação dos dados coletados",
        ],
      },
      {
        name: "Simulador de custo por curso",
        summary:
          "Custo estimado a partir de matrícula real e de parâmetros pactuados com a gestão.",
        features: [
          "Hora-aula por titulação conforme a convenção coletiva aplicável",
          "Encargos, overhead e ticket médio como premissas declaradas",
          "Ensalamento ideal comparado ao ensalamento praticado",
        ],
      },
      {
        name: "Resultado operacional",
        summary:
          "Composição de receitas e custos e leitura de margem, em área reservada.",
        features: [
          "Detalhamento de receitas e de custos operacionais",
          "Registro do resultado por período",
        ],
      },
    ],
  },
  {
    id: "gestao",
    number: "05",
    title: "Metas, plano e acompanhamento",
    intro:
      "Plano de ação que sobrevive à reunião em que foi aprovado.",
    modules: [
      {
        name: "Metas e plano de ação",
        summary:
          "Objetivos com linha de base, meta, unidade e prazo, desdobrados em ações com responsável.",
        features: [
          "Plano 5W2H vinculado a cada meta",
          "Quadro de acompanhamento por situação da ação",
          "Memória das decisões tomadas em cada revisão",
        ],
      },
      {
        name: "Auditoria automática de metas",
        summary:
          "Varredura periódica das metas e ações, com aviso a cada responsável.",
        features: [
          "Relatório executivo enviado por e-mail em periodicidade definida",
          "Aviso individual para o responsável de cada pendência",
        ],
      },
      {
        name: "Painel executivo",
        summary:
          "Visão de topo com indicadores institucionais e sinalização de atraso.",
        features: [
          "Instituições, cursos, vínculos, metas ativas e ações atrasadas",
          "Sinalização por cor conforme a situação real do indicador",
        ],
      },
    ],
  },
  {
    id: "aquisicoes",
    number: "06",
    title: "Aquisições e incorporações",
    intro:
      "Due diligence de instituição de ensino com a mesma trilha de evidências do trabalho regulatório.",
    modules: [
      {
        name: "Due diligence institucional",
        summary:
          "Levantamento de evidências, riscos regulatórios e leitura econômico-financeira da operação.",
        features: [
          "Checklist documental por frente de risco",
          "Leitura regulatória da instituição avaliada",
          "Acompanhamento das etapas da operação",
        ],
      },
    ],
  },
  {
    id: "governanca",
    number: "07",
    title: "Governança de dados",
    intro:
      "O que entra no painel, quem vê e o que nunca é extraído — definido antes da primeira carga.",
    modules: [
      {
        name: "Camadas de acesso",
        summary:
          "Três camadas que separam o agregado, o nominal e o que não deve sair da instituição.",
        features: [
          "Agregados institucionais disponíveis à gestão",
          "Dados nominais de estudantes sob acesso restrito e autenticação reforçada",
          "Documentos pessoais e dados financeiros individuais não são extraídos",
        ],
      },
      {
        name: "Perfis e convites",
        summary:
          "Cada instituição controla quem entra e até onde vai.",
        features: [
          "Perfis distintos para gestão institucional e equipe",
          "Entrada por convite, com escopo definido por perfil",
          "Isolamento dos dados entre instituições",
        ],
      },
      {
        name: "Carga e conciliação",
        summary:
          "Os relatórios do sistema acadêmico entram sem redigitação e com conferência de origem.",
        features: [
          "Importação de relatórios e planilhas já emitidos pela instituição",
          "Sincronização agendada quando a instituição autoriza",
          "Conferência entre fontes antes de publicar indicador",
        ],
      },
    ],
  },
];
