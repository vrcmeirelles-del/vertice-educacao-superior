// Relatório da CPA montado a partir dos dados (auditoria de 20/11/2026).
// Seções de dados (2 a 8 e 11) e a introdução regulatória saem por modelo de texto.
// Seções analíticas (9, 10 e 12) recebem um roteiro com os dados para a CPA redigir;
// a redação por IA nessas três é opcional e só ocorre com a IA religada.

export const SECTIONS = ["introducao", "dados_ies", "composicao_cpa", "planejamento", "metodologia", "resultados", "avaliacoes_externas", "participacao", "diagnostico", "sensibilizacao", "planos_melhoria", "consideracoes"] as const;
export const TITLES: Record<string, string> = {
  introducao: "1. Introdução e Contextualização Regulatória", dados_ies: "2. Dados da Instituição", composicao_cpa: "3. Composição e Funcionamento da CPA",
  planejamento: "4. Planejamento Estratégico", metodologia: "5. Metodologia", resultados: "6. Resultados por Segmento e Eixo",
  avaliacoes_externas: "7. Avaliações Externas", participacao: "8. Participação", diagnostico: "9. Análise Integrada e Diagnóstico",
  sensibilizacao: "10. Sensibilização e Devolutivas", planos_melhoria: "11. Ações e Plano de Melhoria", consideracoes: "12. Considerações Finais",
};
export const ANALYTIC = new Set(["diagnostico", "sensibilizacao", "consideracoes"]);
export const NOTE_DATA = "Montado a partir dos dados do sistema — conferir e aprovar pela CPA";
export const NOTE_GUIDE = "Roteiro com os dados — análise a redigir pela CPA";

type Any = Record<string, any>;
export type CpaData = {
  inst: Any; reportType: string; yearBase: string;
  members: Any[]; campaigns: Any[]; results: Any[]; findings: Any[]; actions: Any[];
};

const NI = "Não informado no cadastro.";
const num = (v: unknown, d = 2) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? "—" : Number(v).toFixed(d).replace(".", ",");
const date = (v: unknown) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : "sem data"; };
const AUD: Record<string, string> = { discentes: "Discentes", docentes: "Docentes", tecnicos: "Técnico-administrativos", egressos: "Egressos", comunidade: "Comunidade externa", gestores: "Gestores" };
const aud = (v: unknown) => AUD[String(v)] || String(v || "Público não informado");
const FT: Record<string, string> = { fragilidade: "Fragilidades", potencialidade: "Potencialidades", oportunidade: "Oportunidades", risco: "Riscos", neutro: "Outros achados" };
const AS: Record<string, string> = { planejada: "planejada", em_execucao: "em execução", executada: "executada", cancelada: "cancelada", avaliada: "avaliada" };
const totalResponses = (d: CpaData) => d.results.reduce((s, r) => s + Number(r.total_responses || 0), 0);
const items = (r: Any) => (Array.isArray(r.questions) ? r.questions : []).filter((q: Any) => q.avg_score !== null && q.avg_score !== undefined);

function sectionText(key: string, d: CpaData): string {
  const i = d.inst || {};
  const name = i.name || "a instituição";
  switch (key) {
    case "introducao":
      return [
        `Este relatório ${d.reportType === "integral" ? "integral" : "parcial"} de autoavaliação institucional, ano-base ${d.yearBase}, apresenta o trabalho da Comissão Própria de Avaliação (CPA) de ${name}.`,
        "A autoavaliação integra o Sistema Nacional de Avaliação da Educação Superior (SINAES), instituído pela Lei nº 10.861/2004, cujo art. 11 atribui à CPA a condução dos processos de avaliação interna da instituição.",
        "A estrutura segue o roteiro da Nota Técnica INEP/DAES/CONAES nº 65/2014, organizado nos cinco eixos do instrumento de avaliação institucional: Planejamento e Avaliação Institucional; Desenvolvimento Institucional; Políticas Acadêmicas; Políticas de Gestão; e Infraestrutura.",
      ].join("\n\n");
    case "dados_ies":
      return [
        `Instituição: ${i.name || NI}${i.acronym ? ` (${i.acronym})` : ""}`,
        `Código e-MEC: ${i.emec_code || NI}`,
        `CNPJ: ${i.cnpj || NI}`,
        `Mantenedora: ${i.maintainer || NI}`,
        `Município/UF: ${i.city ? `${i.city}${i.state ? `/${i.state}` : ""}` : NI}`,
        `Categoria administrativa: ${i.admin_dependency || NI}`,
      ].join("\n");
    case "composicao_cpa": {
      if (!d.members.length) return "Não há membros ativos da CPA cadastrados no sistema. Cadastrar a composição, com o ato de designação, antes de aprovar o relatório.";
      const bySeg = new Map<string, Any[]>();
      for (const m of d.members) { const k = String(m.segment || "Segmento não informado"); bySeg.set(k, [...(bySeg.get(k) || []), m]); }
      const lines = [`A CPA conta com ${d.members.length} membro(s) ativo(s), distribuídos em ${bySeg.size} segmento(s):`];
      for (const [seg, ms] of bySeg) {
        lines.push("", `${seg}:`);
        for (const m of ms) lines.push(`• ${m.full_name}${m.role ? ` — ${m.role}` : ""}${m.appointment_ref ? ` (ato: ${m.appointment_ref})` : ""}${m.start_date ? `, mandato desde ${date(m.start_date)}${m.end_date ? ` até ${date(m.end_date)}` : ""}` : ""}`);
      }
      return lines.join("\n");
    }
    case "planejamento": {
      if (!d.campaigns.length) return "Não há campanhas de avaliação ativas ou encerradas registradas no sistema para o período.";
      return [`No período foram conduzidas ${d.campaigns.length} campanha(s) de avaliação:`, "",
        ...d.campaigns.map((c) => `• ${c.title} — público: ${aud(c.target_audience)}; período: ${date(c.opens_at)} a ${date(c.closes_at)}; situação: ${c.status || "—"}${Array.isArray(c.channels) && c.channels.length ? `; canais: ${c.channels.join(", ")}` : ""}.`),
      ].join("\n");
    }
    case "metodologia":
      return [
        `A coleta foi feita por questionários eletrônicos aplicados em ${d.campaigns.length} campanha(s), com ${totalResponses(d)} resposta(s) concluída(s) no total.`,
        "Os itens usam escala de concordância de 1 a 5. Para cada item calcula-se a média e o percentual de respostas nas duas categorias mais altas (4 e 5, \"top-2\"). Respostas \"não se aplica\" e \"não sei\" são excluídas do cálculo.",
        "As médias por eixo e por dimensão do SINAES são a média simples das médias dos itens vinculados a cada eixo ou dimensão.",
        "Limitações: a participação é voluntária, o que pode gerar viés de autosseleção; a taxa de adesão depende do tamanho de cada público, que deve ser informado pela CPA.",
      ].join("\n\n");
    case "resultados": {
      if (!d.results.length) return "Não há resultados de campanhas com respostas concluídas.";
      const out: string[] = [];
      for (const r of d.results) {
        out.push(`${r.campaign_title || "Campanha"} — ${aud(r.target_audience)}: ${r.total_responses || 0} resposta(s); média geral ${num(r.institutional_avg)}; ${num(r.top2_pct, 1)}% das respostas nas categorias 4 e 5.`);
        const axes = Array.isArray(r.by_axis) ? r.by_axis : [];
        if (axes.length) { out.push("Médias por eixo:"); for (const a of axes) out.push(`• ${a.axis || "Eixo não informado"}: ${num(a.avg_score)}`); }
        const qs = items(r);
        if (qs.length >= 2) {
          const sorted = [...qs].sort((a: Any, b: Any) => Number(b.avg_score) - Number(a.avg_score));
          out.push("Itens com maior média:"); for (const q of sorted.slice(0, 3)) out.push(`• ${q.stable_code ? `${q.stable_code} — ` : ""}${q.question_text}: ${num(q.avg_score)}`);
          out.push("Itens com menor média:"); for (const q of sorted.slice(-3).reverse()) out.push(`• ${q.stable_code ? `${q.stable_code} — ` : ""}${q.question_text}: ${num(q.avg_score)}`);
        }
        out.push("");
      }
      return out.join("\n").trim();
    }
    case "avaliacoes_externas":
      return "Não há resultados de avaliações externas (ENADE, CPC, IGC, avaliações in loco) registrados no sistema. A CPA deve inserir os indicadores publicados pelo INEP e os relatórios de avaliação recebidos no período.";
    case "participacao": {
      if (!d.results.length) return "Não há respostas concluídas registradas.";
      return [`Total de respostas concluídas: ${totalResponses(d)}.`, "", ...d.results.map((r) => `• ${aud(r.target_audience)} (${r.campaign_title || "campanha"}): ${r.total_responses || 0} resposta(s).`),
        "", "A taxa de adesão por segmento exige o total de pessoas de cada público, que não está registrado no sistema: informar para completar esta seção."].join("\n");
    }
    case "planos_melhoria": {
      if (!d.actions.length) return "Não há ações de melhoria registradas no sistema.";
      return [`Estão registradas ${d.actions.length} ação(ões) de melhoria:`, "",
        ...d.actions.map((a) => `• ${a.title} — ${AS[String(a.status)] || a.status || "situação não informada"}${a.responsible ? `; responsável: ${a.responsible}` : ""}${a.due_date ? `; prazo: ${date(a.due_date)}` : ""}.`)].join("\n");
    }
    case "diagnostico": {
      const out = ["Roteiro para a análise da CPA, com os dados do sistema:"];
      const byType = new Map<string, Any[]>();
      for (const f of d.findings) { const k = String(f.finding_type || "neutro"); byType.set(k, [...(byType.get(k) || []), f]); }
      for (const k of ["potencialidade", "fragilidade", "risco", "oportunidade", "neutro"]) {
        const fs = byType.get(k); if (!fs?.length) continue;
        out.push("", `${FT[k]}:`); for (const f of fs) out.push(`• ${f.title}${f.dimension ? ` (dimensão: ${f.dimension})` : ""}${f.indicator_name ? ` — ${f.indicator_name}: ${f.indicator_value ?? "—"}` : ""}`);
      }
      const dims: Any[] = d.results.flatMap((r) => (Array.isArray(r.by_dimension) ? r.by_dimension : []).map((x: Any): Any => ({ ...x, aud: r.target_audience })));
      if (dims.length >= 2) {
        const s = [...dims].sort((a, b) => Number(a.avg_score) - Number(b.avg_score));
        out.push("", "Dimensões com menor média:", ...s.slice(0, 3).map((x) => `• ${x.dimension || "—"} (${aud(x.aud)}): ${num(x.avg_score)}`));
        out.push("", "Dimensões com maior média:", ...s.slice(-3).reverse().map((x) => `• ${x.dimension || "—"} (${aud(x.aud)}): ${num(x.avg_score)}`));
      }
      if (out.length === 1) out.push("", "Não há achados nem resultados por dimensão registrados.");
      out.push("", "A redigir: relacionar os achados ao PDI e aos eixos do SINAES, distinguindo potencialidades e fragilidades.");
      return out.join("\n");
    }
    case "sensibilizacao": {
      const channels = [...new Set(d.campaigns.flatMap((c) => Array.isArray(c.channels) ? c.channels : []))];
      return ["Roteiro para a CPA:", "",
        `• Canais usados nas campanhas: ${channels.length ? channels.join(", ") : "não registrados"}.`,
        "• A redigir: ações de sensibilização antes e durante a coleta (reuniões, comunicados, visitas às turmas).",
        "• A redigir: como os resultados foram devolvidos à comunidade acadêmica (relatórios por segmento, reuniões, publicação no site)."].join("\n");
    }
    case "consideracoes": {
      const frag = d.findings.filter((f) => f.finding_type === "fragilidade").length;
      const pot = d.findings.filter((f) => f.finding_type === "potencialidade").length;
      const done = d.actions.filter((a) => ["executada", "avaliada"].includes(String(a.status))).length;
      return ["Roteiro para a síntese da CPA, com os números do ciclo:", "",
        `• ${d.campaigns.length} campanha(s), ${totalResponses(d)} resposta(s) concluída(s).`,
        `• ${pot} potencialidade(s) e ${frag} fragilidade(s) registradas.`,
        `• ${d.actions.length} ação(ões) de melhoria, ${done} executada(s) ou avaliada(s).`,
        "", "A redigir: síntese do ciclo, limitações do processo e encaminhamentos para o próximo ano."].join("\n");
    }
  }
  return "";
}

export function buildCpaSections(d: CpaData, only?: string[]) {
  const out: Record<string, { title: string; content: string; ai_notes: string }> = {};
  for (const key of (only?.length ? only : [...SECTIONS])) {
    if (!TITLES[key]) continue;
    out[key] = { title: TITLES[key], content: sectionText(key, d), ai_notes: ANALYTIC.has(key) ? NOTE_GUIDE : NOTE_DATA };
  }
  return out;
}
