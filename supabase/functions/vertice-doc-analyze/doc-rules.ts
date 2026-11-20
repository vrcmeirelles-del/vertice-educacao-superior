// Análise de documentos por regras (21/11/2026), usada com a IA suspensa.
// Só afirma o que o texto mostra: presença ou ausência de elementos esperados para a categoria,
// citação de normas revogadas, citação do fundamento da categoria e validade pela data mais
// recente do texto. O índice é de completude, não parecer de conformidade; tudo exige validação humana.

export type DocCategory = { code: string; label: string; regulatory_basis: string | null; renewal_months: number | null };
export type Finding = { type: string; severity: string; title: string; message: string; regulatory_reference?: string; suggestion?: string };
export type AnalysisResult = { summary: string; compliance_score: number; findings: Finding[] };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Item = [label: string, re: RegExp, severity: "high" | "medium" | "low"];

const GENERIC: Item[] = [
  ["Identificação da instituição", /instituicao|faculdade|universidade|centro universitario|escola|colegio|mantenedora|mantida/, "medium"],
  ["Data do documento", /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b/, "high"],
  ["Assinatura, aprovação ou autenticação", /assinad|assinatura|aprovad|homologad|codigo de (?:verificacao|autenticacao)/, "medium"],
];

const ATA: Item[] = [
  ["Participantes ou presentes", /presentes|participantes|membros|compareceram|lista de presenca/, "high"],
  ["Pauta ou ordem do dia", /pauta|ordem do dia|assuntos tratados/, "medium"],
  ["Deliberações ou encaminhamentos", /delibera|aprovad|decidi|encaminhament/, "high"],
];
const LAUDO: Item[] = [
  ["Responsável técnico", /responsavel tecnico|engenheir|arquitet|crea|cau\b|fiscal|vistoriador/, "high"],
  ["Prazo de validade", /validade|valido ate|vencimento|vigencia/, "high"],
  ["Número ou registro do ato", /n[ºo°.]\s*\d|numero|registro|protocolo|processo/, "medium"],
  ["Endereço do imóvel", /endereco|rua|avenida|\bav\.|logradouro/, "medium"],
];
const ACADEMICO: Item[] = [
  ["Período ou datas", /periodo|semestre|cronograma|\d{1,2}\/\d{1,2}\/\d{2,4}/, "medium"],
  ["Carga horária", /carga horaria|\d+\s*(?:h|horas)\b/, "high"],
  ["Responsável, orientador ou supervisor", /orientador|supervisor|coordenador|responsavel|professor/, "high"],
];

// Elementos esperados por família de categoria (códigos de vertice_doc_categories).
const BY_CATEGORY: [RegExp, Item[]][] = [
  [/^PPC$/, [
    ["Perfil do egresso", /perfil (?:do )?egress/, "high"], ["Objetivos do curso", /objetivo/, "high"],
    ["Estrutura ou matriz curricular", /matriz curricular|estrutura curricular/, "high"], ["Ementas e bibliografia", /ementa|bibliografia/, "medium"],
    ["Carga horária total", /carga horaria/, "high"], ["Estágio", /estagio/, "medium"], ["Atividades complementares", /atividades complementares/, "medium"],
    ["Trabalho de conclusão", /trabalho de conclusao|\btcc\b/, "medium"], ["Curricularização da extensão", /extensao|curriculariza/, "high"],
    ["Avaliação da aprendizagem", /avaliacao (?:da|do processo de) (?:ensino[- ])?aprendizagem|sistema de avaliacao/, "medium"],
    ["Núcleo Docente Estruturante", /nucleo docente estruturante|\bnde\b/, "medium"], ["Libras", /libras/, "low"],
  ]],
  [/^PDI$/, [
    ["Missão e objetivos", /missao/, "high"], ["Metas e cronograma", /meta|cronograma/, "high"],
    ["Projeto pedagógico institucional", /projeto pedagogico institucional|\bppi\b/, "medium"], ["Corpo docente", /corpo docente/, "medium"],
    ["Infraestrutura", /infraestrutura|instalacoes/, "medium"], ["Avaliação e acompanhamento", /autoavaliacao|avaliacao institucional|\bcpa\b/, "medium"],
    ["Sustentabilidade financeira", /financeir|orcament/, "medium"],
  ]],
  [/PPP|PROPOSTA_PEDAG/, [
    ["Diagnóstico da realidade escolar", /diagnostico|realidade|contexto/, "medium"], ["Objetivos", /objetivo/, "high"],
    ["Proposta curricular", /curricul|bncc/, "high"], ["Avaliação", /avaliacao/, "medium"], ["Gestão democrática", /gestao democratica|conselho escolar|participacao da comunidade/, "medium"],
  ]],
  [/REG/, [
    ["Organização administrativa", /organizacao administrativa|estrutura organizacional|direcao|orgaos/, "high"], ["Direitos e deveres", /direitos|deveres/, "high"],
    ["Regime disciplinar", /disciplinar|sancoes|penalidades/, "medium"], ["Avaliação e frequência", /avaliacao|frequencia/, "medium"],
    ["Matrícula e transferência", /matricula|transferencia/, "medium"],
  ]],
  [/ATA/, ATA],
  [/^CPA_RELAT$/, [
    ["Eixo 1: Planejamento e Avaliação Institucional", /planejamento e avaliacao institucional/, "high"], ["Eixo 2: Desenvolvimento Institucional", /desenvolvimento institucional/, "high"],
    ["Eixo 3: Políticas Acadêmicas", /politicas academicas/, "high"], ["Eixo 4: Políticas de Gestão", /politicas de gestao/, "high"], ["Eixo 5: Infraestrutura", /infraestrutura/, "high"],
  ]],
  [/^PEI$/, [
    ["Identificação do estudante", /estudante|aluno/, "high"], ["Necessidades ou barreiras", /necessidade|barreira|dificuldade/, "high"],
    ["Objetivos", /objetivo|meta/, "high"], ["Recursos e adaptações", /recurso|adapta|acessibilidade|tecnologia assistiva/, "medium"],
    ["Acompanhamento e avaliação", /acompanhamento|avaliacao|revisao/, "medium"],
  ]],
  [/LGPD/, [
    ["Controlador", /controlador/, "high"], ["Encarregado (DPO)", /encarregad|\bdpo\b/, "high"], ["Finalidade do tratamento", /finalidade/, "high"],
    ["Base legal", /base legal|hipotese legal|art\.?\s*7/, "medium"], ["Direitos do titular", /direitos do titular|titular/, "high"],
    ["Compartilhamento", /compartilhament/, "medium"], ["Segurança e retenção", /seguranca|retencao|armazenament/, "medium"],
  ]],
  [/LAUDO|ALVARA|CORPO_BOMB|VIGILANCIA|ACESSIB/, LAUDO],
  [/^(EXT|ESTAGIO|TCC)_/, ACADEMICO],
];

// Normas revogadas ou substituídas com frequência citadas em documentos educacionais.
const OUTDATED: [RegExp, string, string][] = [
  [/decreto\s*(?:n[ºo°.]?\s*)?5\.?773/, "Decreto 5.773/2006", "Revogado pelo Decreto 9.235/2017 (regulação, supervisão e avaliação da educação superior)."],
  [/lei\s*(?:n[ºo°.]?\s*)?5\.?692/, "Lei 5.692/1971", "Revogada pela Lei 9.394/1996 (LDB)."],
  [/lei\s*(?:n[ºo°.]?\s*)?6\.?494/, "Lei 6.494/1977", "Revogada pela Lei 11.788/2008 (Lei do Estágio)."],
  [/portaria normativa\s*(?:mec\s*)?(?:n[ºo°.]?\s*)?40\s*(?:\/|,?\s*de\s*\d{1,2}\s*de\s*dezembro\s*de\s*)\s*2007/, "Portaria Normativa MEC 40/2007", "Revogada pela Portaria Normativa MEC 23/2017."],
  [/resolucao\s*cne\s*\/\s*ces\s*(?:n[ºo°.]?\s*)?9\s*(?:\/|,?\s*de\s*\d{1,2}\s*de\s*[a-z]+\s*de\s*)\s*2004/, "Resolução CNE/CES 9/2004", "DCN do curso de Direito substituídas pela Resolução CNE/CES 5/2018."],
  [/resolucao\s*cne\s*\/\s*cp\s*(?:n[ºo°.]?\s*)?1\s*(?:\/|,?\s*de\s*\d{1,2}\s*de\s*[a-z]+\s*de\s*)\s*2002/, "Resolução CNE/CP 1/2002", "Revogada; a formação de professores passou a ser regida por resoluções posteriores do CNE/CP."],
];

const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Data mais recente escrita no texto (não posterior a hoje), em dd/mm/aaaa ou "d de mês de aaaa". */
export function latestDate(text: string, now = new Date()): Date | null {
  const f = fold(text); const out: Date[] = [];
  for (const m of f.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) out.push(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])));
  for (const m of f.matchAll(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/g)) { const i = MONTHS.indexOf(m[2]); if (i >= 0) out.push(new Date(Date.UTC(+m[3], i, +m[1]))); }
  const valid = out.filter((d) => !isNaN(+d) && d.getUTCFullYear() >= 1950 && d <= now);
  return valid.length ? valid.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Números das normas do fundamento da categoria (ex.: "10.861", "13.709", "9050"). */
function basisNumbers(basis: string | null) {
  return [...new Set((basis || "").match(/\d{1,2}\.\d{3}|\b\d{4,5}\b(?!\s*\/)/g) || [])].filter((n) => !/^(19|20)\d{2}$/.test(n));
}

export function ruleAnalysis(text: string, category: DocCategory, now = new Date()): AnalysisResult {
  const f = fold(text);
  const findings: Finding[] = [];
  const specific = BY_CATEGORY.filter(([re]) => re.test(category.code)).flatMap(([, items]) => items);
  const items = [...GENERIC, ...specific];
  const present: string[] = []; let missingWeight = 0, totalWeight = 0;
  const weight = { high: 3, medium: 2, low: 1 } as const;
  for (const [label, re, sev] of items) {
    totalWeight += weight[sev];
    if (re.test(f)) { present.push(label); continue; }
    missingWeight += weight[sev];
    findings.push({ type: "gap", severity: sev, title: `${label}: não localizado`, message: `O texto não apresenta ${label.charAt(0).toLowerCase() + label.slice(1)} de forma identificável para um documento do tipo ${category.label}.`, suggestion: `Confira se o elemento existe no documento; se existir, ele pode estar em imagem ou com redação diferente.` });
  }

  let outdated = 0;
  for (const [re, norm, note] of OUTDATED) {
    if (!re.test(f)) continue; outdated++;
    findings.push({ type: "outdated", severity: "high", title: `Referência a norma revogada: ${norm}`, message: `O documento cita ${norm}. ${note}`, regulatory_reference: norm, suggestion: "Atualize a referência e confira se o conteúdo que dela depende continua válido." });
  }

  const nums = basisNumbers(category.regulatory_basis);
  if (nums.length) {
    const cited = nums.filter((n) => f.includes(n) || f.includes(n.replace(".", "")));
    if (!cited.length) findings.push({ type: "suggestion", severity: "low", title: "Fundamento normativo da categoria não citado", message: `O texto não cita ${category.regulatory_basis}, fundamento cadastrado para ${category.label}.`, regulatory_reference: category.regulatory_basis || undefined, suggestion: "Avalie citar o fundamento normativo no corpo do documento." });
    else present.push(`Fundamento normativo citado (${cited.join(", ")})`);
  }

  let validity = "sem prazo de renovação cadastrado";
  let expired = false;
  if (category.renewal_months && category.renewal_months > 0) {
    const d = latestDate(text, now);
    if (!d) validity = "não verificável (nenhuma data localizada)";
    else {
      const due = new Date(d); due.setUTCMonth(due.getUTCMonth() + category.renewal_months);
      const iso = (x: Date) => x.toISOString().slice(0, 10).split("-").reverse().join("/");
      const days = Math.floor((+due - +now) / 86400000);
      if (days < 0) {
        expired = true; validity = `possivelmente vencido desde ${iso(due)}`;
        findings.push({ type: "risk", severity: "high", title: "Documento possivelmente vencido", message: `A data mais recente no texto é ${iso(d)}; com renovação a cada ${category.renewal_months} meses, o prazo terminaria em ${iso(due)}.`, suggestion: "Confirme a vigência; se vencido, providencie a renovação." });
      } else if (days <= 60) {
        validity = `vence em ${iso(due)}`;
        findings.push({ type: "risk", severity: "medium", title: "Renovação próxima", message: `Pela data mais recente no texto (${iso(d)}) e renovação a cada ${category.renewal_months} meses, o prazo termina em ${iso(due)}.`, suggestion: "Inicie a renovação." });
      } else validity = `vigente até ${iso(due)} (estimado)`;
    }
  }

  if (present.length) findings.push({ type: "strength", severity: "info", title: "Elementos localizados", message: present.join("; ") + "." });
  findings.push({ type: "suggestion", severity: "info", title: "Validação humana", message: "Análise por regras (IA suspensa): verifica a presença de elementos, normas citadas e datas, não a qualidade nem a veracidade do conteúdo. Valide cada achado antes de usá-lo." });

  const coverage = totalWeight ? 1 - missingWeight / totalWeight : 1;
  const score = Math.max(0, Math.min(100, Math.round(coverage * 100) - outdated * 10 - (expired ? 20 : 0)));
  const words = (text.match(/\S+/g) || []).length;
  const summary = [
    `Análise por regras do documento (${category.label}, ${words} palavras). Elementos esperados localizados: ${items.length - (findings.filter((x) => x.type === "gap").length)} de ${items.length}.`,
    `Normas revogadas citadas: ${outdated}. Validade: ${validity}.`,
    `Índice de completude por regras: ${score}/100. Não é parecer de conformidade; depende de validação humana.`,
  ].join(" ");
  return { summary, compliance_score: score, findings };
}
