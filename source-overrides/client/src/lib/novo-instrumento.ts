import { supabase } from "@/lib/supabase";
import { listByInstitution, type Row } from "@/lib/area";

// ================================================================ tabelas
export const NI_TABLES = {
  checklist: "vertice_instrumento_checklist",
  evidencias: "vertice_instrumento_evidencias",
  ciclo: "vertice_instrumento_ciclo",
  cpa: "vertice_instrumento_cpa",
} as const;

// ================================================================ rótulos
export type Conformidade = "conforme" | "parcial" | "nao_conforme" | "nao_avaliado";
export const CONFORMIDADE: [Conformidade, string][] = [
  ["conforme", "Conforme"],
  ["parcial", "Parcialmente conforme"],
  ["nao_conforme", "Não conforme"],
  ["nao_avaliado", "Não avaliado"],
];
export const CONFORMIDADE_COR: Record<Conformidade, string> = {
  conforme: "#4f9a76",
  parcial: "#d1a54a",
  nao_conforme: "#c0594f",
  nao_avaliado: "#a9b6c4",
};
export const CONFORMIDADE_BADGE: Record<Conformidade, string> = {
  conforme: "green",
  parcial: "amber",
  nao_conforme: "red",
  nao_avaliado: "gray",
};

export type AndamentoStatus = "pendente" | "em_andamento" | "concluido";
export const ANDAMENTO: [AndamentoStatus, string][] = [
  ["pendente", "Pendente"],
  ["em_andamento", "Em andamento"],
  ["concluido", "Concluído"],
];
export const ANDAMENTO_BADGE: Record<AndamentoStatus, string> = { pendente: "gray", em_andamento: "amber", concluido: "green" };
export const ANDAMENTO_COR: Record<AndamentoStatus, string> = { pendente: "#a9b6c4", em_andamento: "#d1a54a", concluido: "#4f9a76" };

export type Tema = "acessibilidade" | "interdisciplinaridade" | "inclusao" | "sustentabilidade" | "autoavaliacao" | "ia";
export const TEMAS: [Tema, string][] = [
  ["acessibilidade", "Acessibilidade"],
  ["interdisciplinaridade", "Interdisciplinaridade"],
  ["inclusao", "Inclusão"],
  ["sustentabilidade", "Sustentabilidade/ODS"],
  ["autoavaliacao", "Autoavaliação"],
  ["ia", "Inteligência Artificial"],
];

export const DIMENSOES_INSTRUMENTO: [1 | 2 | 3 | 4, string][] = [
  [1, "Organização didático-pedagógica"],
  [2, "Corpo docente e mediação pedagógica"],
  [3, "Infraestrutura"],
  [4, "Específica da área (Área 04)"],
];

// ================================================================ catálogo do instrumento
export type ObjetoInstrumento = {
  code: string;
  dimension: 1 | 2 | 3 | 4;
  group: string;
  title: string;
  /** Roteiro de verificação sugerido pelo Vértice; não é o texto oficial do instrumento. */
  hint: string;
  temas: Tema[];
  /** Título inferido a partir do agrupamento do levantamento; confirmar no instrumento publicado. */
  provisorio?: boolean;
  /** Pré-requisito destacado (ex.: sistemas tecnológicos). */
  requisito?: string;
};

const D1: ObjetoInstrumento[] = [
  { code: "1.1", dimension: 1, group: "PPC — fundamentação", title: "PPC — fundamentação I", provisorio: true, hint: "PPC vigente, coerente com as DCN, a missão da IES e a realidade regional.", temas: ["autoavaliacao"] },
  { code: "1.2", dimension: 1, group: "PPC — fundamentação", title: "PPC — fundamentação II", provisorio: true, hint: "Matriz curricular, ementários e carga horária conforme o PPC.", temas: ["interdisciplinaridade"] },
  { code: "1.3", dimension: 1, group: "PPC — fundamentação", title: "PPC — fundamentação III", provisorio: true, hint: "Atas e registros de atualização do PPC pelo colegiado e pelo NDE.", temas: ["autoavaliacao"] },
  { code: "1.4", dimension: 1, group: "PPC — fundamentação", title: "PPC — fundamentação IV", provisorio: true, hint: "Coerência entre objetivos, perfil, componentes curriculares e avaliação.", temas: ["inclusao", "sustentabilidade"] },
  { code: "1.5", dimension: 1, group: "Extensão e interdisciplinaridade", title: "Extensão", provisorio: true, hint: "Projetos e programas de extensão, registro de horas e vínculo com a matriz.", temas: ["sustentabilidade", "inclusao"] },
  { code: "1.6", dimension: 1, group: "Extensão e interdisciplinaridade", title: "Interdisciplinaridade", provisorio: true, hint: "Componentes, projetos e atividades integradoras entre áreas.", temas: ["interdisciplinaridade"] },
  { code: "1.7", dimension: 1, group: "Ensino, pesquisa, extensão e avaliação da aprendizagem", title: "Ensino", provisorio: true, hint: "Integração do ensino com a pesquisa e a extensão nas práticas do curso.", temas: ["interdisciplinaridade"] },
  { code: "1.8", dimension: 1, group: "Ensino, pesquisa, extensão e avaliação da aprendizagem", title: "Pesquisa", provisorio: true, hint: "Iniciação científica, grupos de pesquisa e produção vinculada ao curso.", temas: ["interdisciplinaridade"] },
  { code: "1.9", dimension: 1, group: "Ensino, pesquisa, extensão e avaliação da aprendizagem", title: "Extensão na formação", provisorio: true, hint: "Extensão como componente formativo, com participação discente comprovada.", temas: ["sustentabilidade"] },
  { code: "1.10", dimension: 1, group: "Ensino, pesquisa, extensão e avaliação da aprendizagem", title: "Avaliação da aprendizagem", provisorio: true, hint: "Critérios, instrumentos, devolutivas e uso dos resultados para melhoria.", temas: ["inclusao", "ia", "autoavaliacao"] },
  { code: "1.11", dimension: 1, group: "Perfil do egresso", title: "Perfil do egresso", hint: "Perfil definido no PPC, com competências observáveis e ligadas à matriz.", temas: ["autoavaliacao"] },
  { code: "1.12", dimension: 1, group: "Métodos de ensino", title: "Métodos de ensino", hint: "Metodologias ativas e uso de tecnologias descritos, aplicados e registrados.", temas: ["inclusao", "ia"] },
  { code: "1.13", dimension: 1, group: "Material didático", title: "Material didático (processo e produto)", hint: "Processo de produção e validação do material e o material efetivamente disponível.", temas: ["acessibilidade", "ia"] },
  { code: "1.14", dimension: 1, group: "Egressos", title: "Acompanhamento de egressos", requisito: "Exige sistema tecnológico de acompanhamento.", hint: "Sistema de registro e contato com egressos, indicadores e uso dos dados no curso.", temas: ["autoavaliacao", "ia"] },
];

const D2: ObjetoInstrumento[] = [
  { code: "2.1", dimension: 2, group: "Gestão do curso", title: "Coordenador do curso", hint: "Titulação, experiência, regime de trabalho e plano de atuação.", temas: ["autoavaliacao"] },
  { code: "2.2", dimension: 2, group: "Gestão do curso", title: "Coordenação pedagógica", hint: "Estrutura, rotinas e registros de acompanhamento pedagógico.", temas: ["inclusao"] },
  { code: "2.3", dimension: 2, group: "Corpo docente", title: "Perfil docente", hint: "Titulação, experiência profissional e docente do quadro.", temas: [] },
  { code: "2.4", dimension: 2, group: "Corpo docente", title: "Compatibilidade do corpo docente com a matriz", hint: "Aderência da formação dos docentes aos componentes que ministram.", temas: [] },
  { code: "2.5", dimension: 2, group: "Desenvolvimento docente", title: "Formação continuada", hint: "Programa, oferta, participação e efeitos da formação continuada.", temas: ["ia", "inclusao", "acessibilidade"] },
  { code: "2.6", dimension: 2, group: "Desenvolvimento docente", title: "Desenvolvimento docente", hint: "Plano de carreira, incentivos, produção e apoio à qualificação.", temas: ["autoavaliacao"] },
  { code: "2.7", dimension: 2, group: "NDE", title: "NDE (composição e atuação efetiva)", hint: "Portaria de composição, regime de trabalho, atas e decisões implementadas.", temas: ["interdisciplinaridade", "autoavaliacao"] },
  { code: "2.8", dimension: 2, group: "Mediação pedagógica", title: "Mediadores pedagógicos", hint: "Perfil, formação, carga e acompanhamento de tutores e mediadores.", temas: ["inclusao", "ia"] },
];

const D3: ObjetoInstrumento[] = [
  { code: "3.1", dimension: 3, group: "Espaços", title: "Espaços administrativos", hint: "Salas de coordenação, docentes e secretaria adequadas ao uso.", temas: ["acessibilidade"] },
  { code: "3.2", dimension: 3, group: "Espaços", title: "Espaços de convivência", hint: "Áreas de convivência, alimentação e descanso para a comunidade.", temas: ["acessibilidade", "inclusao", "sustentabilidade"] },
  { code: "3.3", dimension: 3, group: "Espaços", title: "Espaços de ensino e aprendizagem (salas flexíveis)", hint: "Salas flexíveis, lotação, mobiliário, climatização e manutenção.", temas: ["acessibilidade", "interdisciplinaridade"] },
  { code: "3.4", dimension: 3, group: "Espaços", title: "Ambientes de aprendizagem", hint: "Ambientes presenciais e virtuais de aprendizagem em operação.", temas: ["acessibilidade", "ia"] },
  { code: "3.5", dimension: 3, group: "Laboratórios e tecnologia", title: "Laboratórios", hint: "Laboratórios previstos no PPC, com regulamento, equipamentos e uso registrado.", temas: ["acessibilidade", "sustentabilidade"] },
  { code: "3.6", dimension: 3, group: "Laboratórios e tecnologia", title: "Recursos tecnológicos", hint: "Equipamentos, rede, plataformas e suporte técnico disponíveis.", temas: ["ia", "acessibilidade"] },
  { code: "3.7", dimension: 3, group: "Inclusão", title: "Acessibilidade", hint: "Acessibilidade arquitetônica, pedagógica, comunicacional e digital comprovada.", temas: ["acessibilidade", "inclusao"] },
  { code: "3.8", dimension: 3, group: "Inclusão", title: "Serviços de apoio", hint: "Núcleos e serviços de apoio psicopedagógico, social e de acessibilidade.", temas: ["inclusao", "acessibilidade"] },
  { code: "3.9", dimension: 3, group: "Biblioteca", title: "Biblioteca (acervo, acervo digital e acessibilidade)", hint: "Acervo físico e digital, plano de atualização, contratos e acessibilidade.", temas: ["acessibilidade", "inclusao", "ia"] },
];

type PerfilArea = "direito" | "negocios";

/** Perfil de Dimensão 4 conforme o nome do curso. Fora da Área 04 não há catálogo próprio. */
export function perfilArea(course?: Row | null): PerfilArea | null {
  const name = String(course?.name ?? "");
  if (/direito/i.test(name)) return "direito";
  if (/administra|contábe|contabe|gest[aã]o|neg[oó]cios|econom|log[ií]stic|marketing|com[eé]rcio|recursos humanos|finan[cç]/i.test(name)) return "negocios";
  return null;
}
export const PERFIL_ROTULO: Record<PerfilArea, string> = {
  direito: "Direito (Área 04)",
  negocios: "Negócios e Administração (Área 04)",
};

export function dimensao4(perfil: PerfilArea): ObjetoInstrumento[] {
  const d = perfil === "direito";
  const g = "Específica da área";
  return [
    { code: "4.1", dimension: 4, group: g, title: d ? "Práticas laboratoriais — Núcleo de Prática Jurídica (NPJ)" : "Práticas laboratoriais", hint: d ? "NPJ com regulamento, estrutura, atendimento real e simulado, e registros de atividades." : "Laboratórios e ambientes de simulação de negócios previstos no PPC, com uso registrado.", temas: ["inclusao", "acessibilidade"] },
    { code: "4.2", dimension: 4, group: g, title: d ? "Estágio supervisionado e prática jurídica" : "Estágio supervisionado", hint: "Regulamento, convênios, supervisão, relatórios e carga horária cumprida.", temas: ["inclusao"] },
    { code: "4.3", dimension: 4, group: g, title: "Integração com o mercado e a comunidade", hint: d ? "Convênios e atividades com órgãos, instituições e entidades da área jurídica." : "Convênios, parcerias e atividades com organizações e empresas da região.", temas: ["sustentabilidade", "inclusao"] },
    { code: "4.4", dimension: 4, group: g, title: "Inserção social do curso", hint: "Projetos e ações que atendem demandas sociais do território.", temas: ["inclusao", "sustentabilidade"] },
    { code: "4.5", dimension: 4, group: g, title: "Atualização tecnológica da área", hint: d ? "Uso de sistemas, processo eletrônico e inovação aplicados ao ensino do Direito." : "Ferramentas e tecnologias atuais da área incorporadas ao currículo.", temas: ["ia", "acessibilidade"] },
    { code: "4.6", dimension: 4, group: g, title: "Marco legal da área", hint: d ? "Atendimento às DCN do curso (Res. CNE/CES nº 5/2018) e às demais normas aplicáveis; conferir a versão vigente." : "Atendimento às DCN e às normas da área; conferir a versão vigente.", temas: ["autoavaliacao"] },
    { code: "4.7", dimension: 4, group: g, title: "Impacto social e profissional", hint: "Indicadores de empregabilidade, atuação dos egressos e efeitos na comunidade.", temas: ["inclusao", "sustentabilidade", "autoavaliacao"] },
  ];
}

export const OBJETOS_BASE: ObjetoInstrumento[] = [...D1, ...D2, ...D3];

/** Objetos esperados no escopo: institucional (null) traz as dimensões 1 a 3; curso da Área 04 traz também a 4. */
export function objetosDoEscopo(course?: Row | null): ObjetoInstrumento[] {
  const p = course ? perfilArea(course) : null;
  return p ? [...OBJETOS_BASE, ...dimensao4(p)] : OBJETOS_BASE;
}

// ================================================================ instrumento institucional (recredenciamento)
// 5 eixos da proposta de avaliação institucional externa em construção pelo INEP.
// [Não verificado] Baseado no parecer CONIF/FDE jul/2026 e na ata da 211ª reunião da CONAES.
// Os títulos e objetos serão atualizados quando a versão definitiva for publicada.

export type Dimensao = 1 | 2 | 3 | 4 | 5;
export type EixoInstitucional = { code: string; eixo: number; title: string; hint: string; temas: Tema[]; provisorio?: boolean };

export const EIXOS_INSTITUCIONAL: [number, string][] = [
  [1, "Planejamento e Avaliação Institucional"],
  [2, "Responsabilidade Social"],
  [3, "Desenvolvimento Institucional e Políticas Acadêmicas"],
  [4, "Políticas de Gestão"],
  [5, "Infraestrutura"],
];

const EI1: EixoInstitucional[] = [
  { code: "E1.1", eixo: 1, title: "Plano de Desenvolvimento Institucional (PDI)", hint: "PDI vigente, coerente com a missão, objetivos e metas da IES.", temas: ["autoavaliacao"], provisorio: true },
  { code: "E1.2", eixo: 1, title: "Comissão Própria de Avaliação (CPA)", hint: "Constituição, composição, plano de trabalho, instrumentos e resultados.", temas: ["autoavaliacao"], provisorio: true },
  { code: "E1.3", eixo: 1, title: "Autoavaliação institucional e meta-avaliação", hint: "Ciclos de autoavaliação, uso de indicadores, ciência de dados e devolutivas.", temas: ["autoavaliacao", "ia"], provisorio: true },
  { code: "E1.4", eixo: 1, title: "Monitoramento de indicadores de qualidade", hint: "Painel de indicadores (CC, CPC, IGC, ENADE) com série histórica e plano de melhoria.", temas: ["autoavaliacao"], provisorio: true },
  { code: "E1.5", eixo: 1, title: "Planejamento estratégico e orçamentário", hint: "Articulação entre PDI, PPI, orçamento e plano de ação.", temas: ["sustentabilidade", "autoavaliacao"], provisorio: true },
];
const EI2: EixoInstitucional[] = [
  { code: "E2.1", eixo: 2, title: "Responsabilidade social e compromisso com os ODS", hint: "Política de responsabilidade social vinculada à Agenda 2030.", temas: ["sustentabilidade", "inclusao"], provisorio: true },
  { code: "E2.2", eixo: 2, title: "Inclusão, diversidade e equidade", hint: "Políticas de inclusão, cotas, ações afirmativas e acessibilidade.", temas: ["inclusao", "acessibilidade"], provisorio: true },
  { code: "E2.3", eixo: 2, title: "Extensão e relação com a comunidade", hint: "Programas de extensão, impacto social e parcerias territoriais.", temas: ["sustentabilidade", "interdisciplinaridade"], provisorio: true },
  { code: "E2.4", eixo: 2, title: "Educação ambiental e sustentabilidade", hint: "Política ambiental, práticas sustentáveis e integração curricular.", temas: ["sustentabilidade"], provisorio: true },
];
const EI3: EixoInstitucional[] = [
  { code: "E3.1", eixo: 3, title: "Projeto Pedagógico Institucional (PPI)", hint: "Coerência do PPI com o PDI, as DCN e a identidade da IES.", temas: ["interdisciplinaridade"], provisorio: true },
  { code: "E3.2", eixo: 3, title: "Políticas de ensino", hint: "Inovação pedagógica, metodologias ativas, integração ensino-pesquisa-extensão.", temas: ["ia", "interdisciplinaridade"], provisorio: true },
  { code: "E3.3", eixo: 3, title: "Políticas de pesquisa e inovação", hint: "Programas de IC, grupos de pesquisa, produção e impacto.", temas: ["interdisciplinaridade"], provisorio: true },
  { code: "E3.4", eixo: 3, title: "Políticas de extensão", hint: "Curricularização, creditação, registro e impacto social.", temas: ["sustentabilidade", "inclusao"], provisorio: true },
  { code: "E3.5", eixo: 3, title: "Políticas de gestão de pessoas", hint: "Plano de carreira, formação continuada e avaliação docente.", temas: ["autoavaliacao"], provisorio: true },
  { code: "E3.6", eixo: 3, title: "Acompanhamento de egressos (institucional)", hint: "Sistema centralizado, indicadores de empregabilidade e retroalimentação dos PPCs.", temas: ["autoavaliacao", "ia"], provisorio: true },
  { code: "E3.7", eixo: 3, title: "Internacionalização", hint: "Acordos, mobilidade, dupla diplomação e cooperação internacional.", temas: ["interdisciplinaridade"], provisorio: true },
];
const EI4: EixoInstitucional[] = [
  { code: "E4.1", eixo: 4, title: "Governança e estrutura organizacional", hint: "Organograma, regimentos, colegiados e fluxos decisórios.", temas: ["autoavaliacao"], provisorio: true },
  { code: "E4.2", eixo: 4, title: "Transformação digital e sistemas de informação", hint: "ERP, BI, integração de dados, portais e automação de processos.", temas: ["ia"], provisorio: true },
  { code: "E4.3", eixo: 4, title: "LGPD e proteção de dados", hint: "Política de privacidade, encarregado (DPO), mapeamento de dados e consentimentos.", temas: ["ia"], provisorio: true },
  { code: "E4.4", eixo: 4, title: "Sustentabilidade financeira", hint: "Equilíbrio receita-despesa, reservas, investimento e projeção.", temas: ["sustentabilidade"], provisorio: true },
  { code: "E4.5", eixo: 4, title: "Comunicação institucional", hint: "Canais, ouvidoria, transparência e atendimento.", temas: ["acessibilidade"], provisorio: true },
];
const EI5: EixoInstitucional[] = [
  { code: "E5.1", eixo: 5, title: "Estruturas de aprendizagem", hint: "Salas, laboratórios e ambientes flexíveis; manutenção e adequação.", temas: ["acessibilidade"], provisorio: true },
  { code: "E5.2", eixo: 5, title: "Ambiente híbrido de aprendizagem (Biblioteca)", hint: "Acervo físico e digital, base de dados, acesso remoto e acessibilidade.", temas: ["acessibilidade", "ia"], provisorio: true },
  { code: "E5.3", eixo: 5, title: "Acessibilidade arquitetônica e digital", hint: "Design universal, rotas acessíveis, tecnologias assistivas e sinalização.", temas: ["acessibilidade", "inclusao"], provisorio: true },
  { code: "E5.4", eixo: 5, title: "Infraestrutura tecnológica", hint: "Rede, datacenter, nuvem, segurança e suporte técnico.", temas: ["ia"], provisorio: true },
  { code: "E5.5", eixo: 5, title: "Polos EaD (quando aplicável)", hint: "Polos com infraestrutura, tutoria e avaliação conforme Decreto nº 12.456/2025.", temas: ["acessibilidade"], provisorio: true },
];

export const OBJETOS_INSTITUCIONAL: EixoInstitucional[] = [...EI1, ...EI2, ...EI3, ...EI4, ...EI5];

export type TipoInstrumento = "curso" | "institucional";
export const TIPOS_INSTRUMENTO: [TipoInstrumento, string][] = [
  ["curso", "Avaliação de Curso (Dimensões 1–4)"],
  ["institucional", "Recredenciamento Institucional (5 Eixos)"],
];

// ================================================================ cálculo
export type Resumo = {
  total: number;
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_avaliado: number;
  /** % de objetos conformes sobre o total de objetos. */
  pctConforme: number;
  /** % de objetos já avaliados. */
  pctAvaliado: number;
};

export function resumir(statuses: Conformidade[]): Resumo {
  const r = { total: statuses.length, conforme: 0, parcial: 0, nao_conforme: 0, nao_avaliado: 0 };
  for (const s of statuses) r[s] += 1;
  const pct = (n: number) => (r.total ? Math.round((n / r.total) * 100) : 0);
  return { ...r, pctConforme: pct(r.conforme), pctAvaliado: pct(r.total - r.nao_avaliado) };
}

export function statusValido(v: unknown): Conformidade {
  return CONFORMIDADE.some(([k]) => k === v) ? (v as Conformidade) : "nao_avaliado";
}

/** Aceita só endereços https; devolve o endereço normalizado ou null. */
export function urlSegura(v: string): string | null {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ================================================================ ciclo trienal
export const CICLO_BASE: Record<number, number> = { 1: 2026, 2: 2029 };
export const cicloRotulo = (n: number) => {
  const ini = CICLO_BASE[n] ?? 2026 + (n - 1) * 3;
  return `Ciclo ${n} · ${ini}–${ini + 2}`;
};

export type FaseCiclo = "enade" | "cpa" | "inloco";
export type MarcoCiclo = { code: string; fase: FaseCiclo; offset: 0 | 1 | 2; title: string; principal?: boolean };
export const FASES: { fase: FaseCiclo; offset: 0 | 1 | 2; title: string; subtitle: string }[] = [
  { fase: "enade", offset: 0, title: "Ano 1 · ENADE", subtitle: "Exame e análise dos resultados" },
  { fase: "cpa", offset: 1, title: "Ano 2 · Autoavaliação (CPA)", subtitle: "Coleta, análise e devolutiva" },
  { fase: "inloco", offset: 2, title: "Ano 3 · Visita in loco", subtitle: "Dossiê, preparação e visita" },
];
export const MARCOS: MarcoCiclo[] = [
  { code: "enade_preparo", fase: "enade", offset: 0, title: "Preparação e mobilização dos estudantes" },
  { code: "enade_aplicacao", fase: "enade", offset: 0, title: "Aplicação do exame e conferência dos inscritos" },
  { code: "enade_resultados", fase: "enade", offset: 0, title: "Análise dos resultados e plano de melhoria" },
  { code: "enade", fase: "enade", offset: 0, title: "Marco principal: ENADE concluído", principal: true },
  { code: "cpa_planejamento", fase: "cpa", offset: 1, title: "Planejamento da autoavaliação" },
  { code: "cpa_coleta", fase: "cpa", offset: 1, title: "Coleta de dados com a comunidade acadêmica" },
  { code: "cpa_relatorio", fase: "cpa", offset: 1, title: "Relatório de autoavaliação e devolutiva" },
  { code: "autoavaliacao_cpa", fase: "cpa", offset: 1, title: "Marco principal: autoavaliação concluída", principal: true },
  { code: "inloco_dossie", fase: "inloco", offset: 2, title: "Dossiê de evidências organizado" },
  { code: "inloco_simulado", fase: "inloco", offset: 2, title: "Simulado de visita e correção de lacunas" },
  { code: "visita_inloco", fase: "inloco", offset: 2, title: "Marco principal: visita in loco realizada", principal: true },
];

// ================================================================ CPA
export const ITENS_CPA: { item: string; ref: string }[] = [
  { item: "Ato de constituição da CPA atualizado", ref: "Portaria ou ato da mantenedora/IES vigente." },
  { item: "Composição com representação de docentes, estudantes, técnico-administrativos e sociedade civil", ref: "Lei nº 10.861/2004: sem predomínio de um segmento." },
  { item: "Regimento interno e plano de trabalho da CPA", ref: "Rotinas, periodicidade das reuniões e atas." },
  { item: "Projeto de autoavaliação aprovado para o ciclo", ref: "Objetivos, metodologia, cronograma e dimensões." },
  { item: "Instrumentos de coleta alinhados às quatro dimensões do novo instrumento", ref: "Organização didático-pedagógica, docentes, infraestrutura e área." },
  { item: "Temas transversais incluídos na coleta", ref: "Acessibilidade, interdisciplinaridade, inclusão, sustentabilidade/ODS, autoavaliação e IA." },
  { item: "Autoavaliação por curso, incluindo a dimensão específica da área", ref: "Resultados desagregados por curso." },
  { item: "Estratégia de sensibilização e participação por segmento", ref: "Meta de taxa de resposta e acompanhamento." },
  { item: "Coleta realizada com registro de respondentes", ref: "Amostra, período e instrumentos aplicados." },
  { item: "Análise dos resultados cruzada com ENADE e demais indicadores", ref: "Triangulação entre percepção e desempenho." },
  { item: "Relatório de autoavaliação elaborado e enviado", ref: "Conferir o prazo e o canal de envio vigentes." },
  { item: "Devolutiva dos resultados à comunidade acadêmica", ref: "Evidência de divulgação e de reuniões de apresentação." },
  { item: "Plano de melhoria vinculado ao plano de ação 5W2H e ao PDI", ref: "Ações com responsável e prazo." },
  { item: "Evidências do uso dos resultados nas decisões da gestão", ref: "Atas e deliberações dos colegiados." },
  { item: "Autoavaliação do uso de Inteligência Artificial no ensino e na gestão", ref: "Política, riscos, transparência e formação." },
  { item: "Estrutura de apoio à CPA (sala, sistema e dotação)", ref: "Condições efetivas de trabalho da comissão." },
];

// ================================================================ dados
export async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export type DadosInstrumento = { checklist: Row[]; evidencias: Row[]; ciclo: Row[]; cpa: Row[] };
export const VAZIO: DadosInstrumento = { checklist: [], evidencias: [], ciclo: [], cpa: [] };

export async function carregarInstrumento(institutionId: string): Promise<DadosInstrumento> {
  const [checklist, evidencias, ciclo, cpa] = await Promise.all([
    listByInstitution(NI_TABLES.checklist, institutionId, "object_code"),
    listByInstitution(NI_TABLES.evidencias, institutionId, "uploaded_at"),
    listByInstitution(NI_TABLES.ciclo, institutionId, "target_year"),
    listByInstitution(NI_TABLES.cpa, institutionId, "item"),
  ]);
  return { checklist, evidencias, ciclo, cpa };
}

export const mesmoEscopo = (row: Row, courseId: string | null) => (row.course_id ?? null) === courseId;

/** Cria as linhas que faltam no escopo (curso ou institucional). Devolve quantas foram criadas. */
export async function semearChecklist(institutionId: string, courseId: string | null, objetos: ObjetoInstrumento[], existentes: Row[]) {
  const have = new Set(existentes.filter(r => mesmoEscopo(r, courseId)).map(r => String(r.object_code)));
  const novos = objetos.filter(o => !have.has(o.code));
  if (!novos.length) return 0;
  const by = await usuarioAtual();
  const { error } = await supabase.from(NI_TABLES.checklist).insert(
    novos.map(o => ({ institution_id: institutionId, course_id: courseId, dimension: o.dimension, object_code: o.code, status: "nao_avaliado", updated_by: by })),
  );
  // 23505: outra sessão semeou ao mesmo tempo; a recarga traz as linhas.
  if (error && error.code !== "23505") throw error;
  return novos.length;
}

export async function semearCiclo(institutionId: string, ciclo: number, existentes: Row[]) {
  const inicio = CICLO_BASE[ciclo] ?? 2026 + (ciclo - 1) * 3;
  const have = new Set(existentes.filter(r => Number(r.cycle_number) === ciclo).map(r => String(r.milestone)));
  const novos = MARCOS.filter(m => !have.has(m.code));
  if (!novos.length) return 0;
  const { error } = await supabase.from(NI_TABLES.ciclo).insert(
    novos.map(m => ({ institution_id: institutionId, cycle_number: ciclo, milestone: m.code, target_year: inicio + m.offset, status: "pendente" })),
  );
  if (error && error.code !== "23505") throw error;
  return novos.length;
}

export async function semearCpa(institutionId: string, existentes: Row[]) {
  const have = new Set(existentes.map(r => String(r.item)));
  const novos = ITENS_CPA.filter(i => !have.has(i.item));
  if (!novos.length) return 0;
  const { error } = await supabase.from(NI_TABLES.cpa).insert(novos.map(i => ({ institution_id: institutionId, item: i.item, status: "pendente" })));
  if (error && error.code !== "23505") throw error;
  return novos.length;
}

/** Garante a linha do objeto (cria se faltar) e devolve o id. */
export async function garantirLinhaChecklist(institutionId: string, courseId: string | null, objeto: ObjetoInstrumento, atual?: Row) {
  if (atual) return atual.id;
  const by = await usuarioAtual();
  const { data, error } = await supabase
    .from(NI_TABLES.checklist)
    .insert({ institution_id: institutionId, course_id: courseId, dimension: objeto.dimension, object_code: objeto.code, status: "nao_avaliado", updated_by: by })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
