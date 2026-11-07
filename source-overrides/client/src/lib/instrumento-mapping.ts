/**
 * Mapeamento 2017↔2026 — Governança 360
 *
 * Cada indicador do instrumento 2017 (Reconhecimento) é mapeado para os objetos
 * correspondentes do instrumento 2026 (Novo Instrumento INEP).
 * O mapeamento é bidirecional: dado um indicador 2017, descobre os objetos 2026,
 * e vice-versa.
 *
 * Lógica: as evidências e pareceres de um instrumento alimentam o outro.
 * "Isso conversa com o objeto X.Y do instrumento 2026 — deseja espelhar?"
 */

export type MappingEntry = {
  /** Indicador do instrumento 2017 (ex: "1.1", "2.3") */
  ind2017: string;
  /** Objeto(s) do instrumento 2026 (ex: ["1.1", "1.4"]) */
  obj2026: string[];
  /** Grau de correspondência */
  grau: "direto" | "parcial" | "complementar";
  /** Nota sobre a relação */
  nota: string;
};

/**
 * Mapeamento completo 2017→2026.
 *
 * Critérios:
 * - "direto": o indicador 2017 e o objeto 2026 tratam do mesmo tema central
 * - "parcial": há sobreposição, mas o escopo mudou
 * - "complementar": o indicador 2017 alimenta evidências que servem ao objeto 2026
 */
export const MAPPING_2017_2026: MappingEntry[] = [
  // ════════════════════════════════════════ DIMENSÃO 1
  { ind2017: "1.1", obj2026: ["1.1", "1.4"], grau: "direto",
    nota: "Políticas institucionais → PPC fundamentação I (coerência com DCN/missão) e IV (coerência objetivos/perfil)." },
  { ind2017: "1.2", obj2026: ["1.1", "1.4", "1.11"], grau: "direto",
    nota: "Objetivos do curso → PPC fundamentação I e IV + Perfil do egresso." },
  { ind2017: "1.3", obj2026: ["1.11", "1.14"], grau: "direto",
    nota: "Perfil do egresso → Perfil do egresso 2026 + Acompanhamento de egressos." },
  { ind2017: "1.4", obj2026: ["1.2", "1.4"], grau: "direto",
    nota: "Estrutura curricular → PPC fundamentação II (matriz/ementários) e IV (coerência)." },
  { ind2017: "1.5", obj2026: ["1.2", "1.4"], grau: "direto",
    nota: "Conteúdos curriculares → PPC fundamentação II e IV." },
  { ind2017: "1.6", obj2026: ["1.12", "1.7"], grau: "direto",
    nota: "Metodologia → Métodos de ensino 2026 + Ensino (integração ensino-pesquisa-extensão)." },
  { ind2017: "1.7", obj2026: ["4.2", "4.1"], grau: "direto",
    nota: "Estágio supervisionado → Estágio supervisionado 2026 (Dim 4) + Práticas laboratoriais/NPJ." },
  { ind2017: "1.10", obj2026: ["1.5", "1.9"], grau: "parcial",
    nota: "Atividades complementares → Extensão 2026 (creditação extensionista absorveu parte das AC) + Extensão na formação." },
  { ind2017: "1.11", obj2026: ["1.8"], grau: "parcial",
    nota: "TCC → Pesquisa 2026 (TCC como produto de iniciação científica)." },
  { ind2017: "1.12", obj2026: ["3.8", "2.2"], grau: "parcial",
    nota: "Apoio ao discente → Serviços de apoio 2026 (Dim 3) + Coordenação pedagógica (Dim 2)." },
  { ind2017: "1.13", obj2026: ["1.3", "1.10"], grau: "direto",
    nota: "Gestão do curso e avaliação → PPC fundamentação III (atas/registros NDE) + Avaliação da aprendizagem." },
  { ind2017: "1.16", obj2026: ["3.6", "3.4"], grau: "direto",
    nota: "TICs → Recursos tecnológicos 2026 + Ambientes de aprendizagem." },
  { ind2017: "1.19", obj2026: ["1.10"], grau: "direto",
    nota: "Procedimentos de avaliação → Avaliação da aprendizagem 2026." },
  { ind2017: "1.20", obj2026: ["1.4"], grau: "complementar",
    nota: "Número de vagas → PPC fundamentação IV (coerência com infraestrutura e demanda)." },

  // ════════════════════════════════════════ DIMENSÃO 2
  { ind2017: "2.1", obj2026: ["2.7"], grau: "direto",
    nota: "NDE 2017 → NDE 2026 (composição e atuação efetiva)." },
  { ind2017: "2.3", obj2026: ["2.1"], grau: "direto",
    nota: "Atuação do coordenador → Coordenador do curso 2026." },
  { ind2017: "2.4", obj2026: ["2.1"], grau: "direto",
    nota: "Regime de trabalho do coordenador → Coordenador do curso 2026 (regime e titulação)." },
  { ind2017: "2.5", obj2026: ["2.3"], grau: "direto",
    nota: "Titulação docente → Perfil docente 2026 (titulação e experiência)." },
  { ind2017: "2.6", obj2026: ["2.3", "2.4"], grau: "direto",
    nota: "Regime de trabalho docente → Perfil docente + Compatibilidade docente/matriz." },
  { ind2017: "2.7", obj2026: ["2.3"], grau: "direto",
    nota: "Experiência profissional do docente → Perfil docente 2026." },
  { ind2017: "2.9", obj2026: ["2.3"], grau: "direto",
    nota: "Experiência em docência superior → Perfil docente 2026." },
  { ind2017: "2.12", obj2026: ["2.7", "1.3"], grau: "parcial",
    nota: "Colegiado → NDE 2026 (atuação colegiada) + PPC fundamentação III (atas de atualização)." },
  { ind2017: "2.16", obj2026: ["2.6", "1.8"], grau: "direto",
    nota: "Produção científica → Desenvolvimento docente 2026 + Pesquisa." },

  // ════════════════════════════════════════ DIMENSÃO 3
  { ind2017: "3.1", obj2026: ["3.1"], grau: "direto",
    nota: "Espaço docentes TI → Espaços administrativos 2026." },
  { ind2017: "3.2", obj2026: ["3.1"], grau: "direto",
    nota: "Espaço do coordenador → Espaços administrativos 2026." },
  { ind2017: "3.3", obj2026: ["3.1"], grau: "direto",
    nota: "Sala de professores → Espaços administrativos 2026." },
  { ind2017: "3.4", obj2026: ["3.3"], grau: "direto",
    nota: "Salas de aula → Espaços de ensino e aprendizagem 2026 (salas flexíveis)." },
  { ind2017: "3.5", obj2026: ["3.6", "3.4"], grau: "direto",
    nota: "Acesso a informática → Recursos tecnológicos + Ambientes de aprendizagem." },
  { ind2017: "3.6", obj2026: ["3.9"], grau: "direto",
    nota: "Bibliografia básica → Biblioteca 2026 (acervo, acervo digital e acessibilidade)." },
  { ind2017: "3.7", obj2026: ["3.9"], grau: "direto",
    nota: "Bibliografia complementar → Biblioteca 2026." },
  { ind2017: "3.9", obj2026: ["3.5", "4.1"], grau: "direto",
    nota: "Labs de formação específica → Laboratórios 2026 + Práticas laboratoriais/NPJ (Dim 4)." },
  { ind2017: "3.15", obj2026: ["4.1", "4.2"], grau: "direto",
    nota: "NPJ → Práticas laboratoriais/NPJ 2026 (Dim 4) + Estágio supervisionado." },
  { ind2017: "3.16", obj2026: ["1.8"], grau: "complementar",
    nota: "CEP → Pesquisa 2026 (infraestrutura ética para pesquisa)." },
];

// ════════════════════════════════════════ helpers

/** Dado um indicador 2017, retorna os objetos 2026 correspondentes. */
export function objetosDoIndicador2017(ind: string): MappingEntry | undefined {
  return MAPPING_2017_2026.find(m => m.ind2017 === ind);
}

/** Dado um objeto 2026, retorna os indicadores 2017 que o alimentam. */
export function indicadoresDoObjeto2026(obj: string): MappingEntry[] {
  return MAPPING_2017_2026.filter(m => m.obj2026.includes(obj));
}

/** Mapa invertido: objeto 2026 → lista de indicadores 2017 com grau. */
export function mapaInvertido(): Map<string, { ind: string; grau: string; nota: string }[]> {
  const m = new Map<string, { ind: string; grau: string; nota: string }[]>();
  for (const entry of MAPPING_2017_2026) {
    for (const obj of entry.obj2026) {
      const arr = m.get(obj) ?? [];
      arr.push({ ind: entry.ind2017, grau: entry.grau, nota: entry.nota });
      m.set(obj, arr);
    }
  }
  return m;
}

/** Cores por grau de correspondência. */
export const GRAU_COR: Record<string, string> = {
  direto: "#4f9a76",
  parcial: "#d1a54a",
  complementar: "#6b7280",
};

export const GRAU_LABEL: Record<string, string> = {
  direto: "Correspondência direta",
  parcial: "Correspondência parcial",
  complementar: "Evidência complementar",
};
