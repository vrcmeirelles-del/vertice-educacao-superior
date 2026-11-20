// Análise de impacto por regras (auditoria de 20/11/2026, V7), usada com a IA suspensa.
// Só afirma o que o texto mostra: presença/ausência de elementos e cálculo de carga horária.
// Todo achado fica sujeito à validação humana; nada aqui é parecer de conformidade definitivo.

type Doc = { name: string; text: string };
export type RuleFinding = {
  type: "informacao_comprovada" | "informacao_parcial" | "informacao_nao_localizada" | "lacuna" | "recomendacao" | "inconsistencia";
  title: string; description: string; confidence: number;
  severity: "critico" | "alto" | "medio" | "baixo" | "informativo";
  conformity?: "conforme" | "parcialmente_conforme" | "nao_conforme" | "nao_identificado";
  section?: string; excerpt?: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Trecho literal ao redor da primeira ocorrência (para a referência da fonte). */
function excerpt(text: string, re: RegExp) {
  const f = fold(text); const m = re.exec(f);
  if (!m) return undefined;
  const start = Math.max(0, m.index - 80);
  return text.slice(start, Math.min(text.length, m.index + m[0].length + 120)).replace(/\s+/g, " ").trim();
}

/** Carga horária total do curso e carga de extensão declaradas no texto. */
export function extensionHours(text: string) {
  const f = fold(text);
  const total = f.match(/carga\s+horaria\s+(?:total|minima)?\s*(?:do\s+curso)?\s*(?:de|:|=)?\s*(\d{1,2}\.?\d{3}(?:,\d+)?)\s*(?:h|horas)/);
  const ext = f.match(/(?:extensao|curriculariza\w*)[^.\n]{0,80}?(\d{2,4}(?:\.\d{3})?(?:,\d+)?)\s*(?:h|horas)/) || f.match(/(\d{2,4}(?:\.\d{3})?(?:,\d+)?)\s*(?:h|horas)[^.\n]{0,60}?(?:de\s+)?(?:atividades\s+de\s+)?extensao/);
  return { total: total ? num(total[1]) : null, extension: ext ? num(ext[1]) : null };
}

const DIRETRIZES: [string, RegExp][] = [
  ["Interação dialógica com a comunidade", /intera\w*\s+dialogic|dialogo com a comunidade|comunidade externa/],
  ["Interdisciplinaridade", /interdisciplin|interprofission/],
  ["Impacto social", /impacto social|transforma\w* social|impacto na comunidade/],
  ["Formação cidadã do estudante", /formacao cidada|cidadania|protagonismo estudantil/],
];
const EVIDENCE_FIELDS: [string, RegExp, RuleFinding["severity"]][] = [
  ["Data ou período da atividade", /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}|periodo de/, "alto"],
  ["Responsável ou coordenação", /coordenador|coordenacao|responsavel|professor(?:a)? orientador/, "alto"],
  ["Assinatura ou validação", /assinad|assinatura|validad|codigo de (?:verificacao|autenticacao)/, "medio"],
  ["Carga horária", /\d+\s*(?:h|horas)\b/, "alto"],
  ["Participantes ou público atendido", /participantes|publico|beneficiad|atendid|estudantes envolvidos|discentes/, "medio"],
  ["Local de realização", /\blocal\b|realizad[oa] (?:na|no|em)|endereco|comunidade de/, "baixo"],
];
const PROJECT_FIELDS: [string, RegExp][] = [
  ["Objetivos", /objetivo/], ["Público-alvo", /publico[- ]alvo|publico atendido|comunidade/],
  ["Metodologia", /metodologia|procedimentos|etapas/], ["Carga horária", /carga horaria|\d+\s*horas/],
  ["Período de execução", /periodo|cronograma|semestre/], ["Resultados ou indicadores", /resultado|indicador|avaliacao/],
];

export function ruleFindings(type: string, docs: Doc[]): RuleFinding[] {
  const all = docs.map((d) => d.text).join("\n\n");
  const f = fold(all);
  const out: RuleFinding[] = [];
  if (!all.trim() || docs.every((d) => d.text.trim().startsWith("["))) {
    return [{ type: "informacao_nao_localizada", title: "Texto do documento não disponível", description: "Não foi possível ler o texto dos documentos enviados (arquivo ausente, imagem ou PDF digitalizado). A análise por regras depende do texto.", confidence: 1, severity: "alto" }];
  }
  if (type === "estrutural" || type === "curricularizacao" || type === "conformidade") {
    const h = extensionHours(all);
    if (h.total && h.extension) {
      const pct = (h.extension / h.total) * 100;
      const ok = pct >= 10;
      out.push({ type: "informacao_comprovada", title: `Curricularização: ${pct.toFixed(1).replace(".", ",")}% da carga horária`,
        description: `Carga de extensão declarada: ${h.extension} h de ${h.total} h totais. O art. 4º da Resolução CNE/CES 7/2018 exige no mínimo 10%${ok ? "; o valor declarado atende ao mínimo." : "; o valor declarado fica abaixo do mínimo."}`,
        confidence: 0.8, severity: ok ? "informativo" : "critico", conformity: ok ? "conforme" : "nao_conforme", excerpt: excerpt(all, /extensao|curriculariza/) });
    } else {
      out.push({ type: "informacao_nao_localizada", title: "Percentual de curricularização não calculável", description: `Não foram encontradas, juntas, a carga horária total (${h.total ?? "não localizada"}) e a carga de extensão (${h.extension ?? "não localizada"}). Sem as duas, não é possível verificar o mínimo de 10% (Res. CNE/CES 7/2018, art. 4º).`, confidence: 0.7, severity: "alto", conformity: "nao_identificado" });
    }
    for (const [label, re] of DIRETRIZES) {
      const hit = re.test(f);
      out.push({ type: hit ? "informacao_parcial" : "lacuna", title: `Diretriz: ${label}`, description: hit ? "O texto menciona a diretriz; a efetividade depende de evidência da execução." : "O texto não menciona esta diretriz da extensão (Res. CNE/CES 7/2018, art. 5º).", confidence: 0.6, severity: hit ? "informativo" : "medio", conformity: hit ? "parcialmente_conforme" : "nao_identificado", excerpt: hit ? excerpt(all, re) : undefined });
    }
    if (!/politica (?:institucional )?de extensao|regulamento (?:da|de) extensao|resolucao .{0,40}extensao/.test(f)) out.push({ type: "lacuna", title: "Política institucional de extensão não citada", description: "O documento não cita a política ou o regulamento institucional de extensão que deve reger a curricularização.", confidence: 0.6, severity: "medio", conformity: "nao_identificado" });
  }
  if (type === "evidencia") {
    for (const [label, re, sev] of EVIDENCE_FIELDS) {
      const hit = re.test(f);
      out.push({ type: hit ? "informacao_comprovada" : "informacao_nao_localizada", title: `${label}${hit ? "" : " não localizado"}`, description: hit ? `O documento traz ${label.toLowerCase()}.` : `Não foi localizado ${label.toLowerCase()} no texto; a evidência pode ficar incompleta.`, confidence: 0.7, severity: hit ? "informativo" : sev, excerpt: hit ? excerpt(all, re) : undefined });
    }
  }
  if (type === "documental" || type === "projeto" || type === "cruzamento" || !out.length) {
    for (const [label, re] of PROJECT_FIELDS) {
      const hit = re.test(f);
      if (!hit) out.push({ type: "lacuna", title: `${label}: não localizado`, description: `O documento não apresenta ${label.toLowerCase()} de forma identificável.`, confidence: 0.6, severity: label === "Objetivos" || label === "Metodologia" ? "alto" : "medio" });
    }
    if (!out.length) out.push({ type: "informacao_comprovada", title: "Elementos básicos presentes", description: "Objetivos, público, metodologia, carga horária, período e resultados aparecem no documento. A qualidade de cada elemento depende de leitura humana.", confidence: 0.6, severity: "informativo" });
  }
  out.push({ type: "recomendacao", title: "Validação humana", description: "Análise por regras (IA suspensa): verifica presença de elementos e cálculos declarados, não a qualidade nem a veracidade do conteúdo. Valide cada achado antes de usá-lo.", confidence: 1, severity: "informativo" });
  return out;
}
