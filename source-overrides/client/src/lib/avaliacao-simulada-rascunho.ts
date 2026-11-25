// Rascunho do parecer da avaliação simulada por algoritmo (regras avs-rascunho-v1), no lugar da antiga
// geração por IA. Usa só os dados do portal: conceitos registrados pela pessoa, cobertura documental do
// indicador e a equivalência 2017→2026. Não atribui conceito, não afirma atendimento a critério que os
// dados não mostram e não substitui o juízo do avaliador: o texto entra como rascunho a revisar.
export const RASCUNHO_VERSION = "avs-rascunho-v1";

export type DocInfo = { total: number; docs: number; validados: number; enviados: number; pendentes: number };
export type Equivalencia = { objetos: string[]; grau: string } | null;
export type Entrada = {
  code: string; name: string;
  conceitoAtual: number | null; conceitoViavel: number | null;
  docInfo: DocInfo; equivalencia: Equivalencia;
};
export type Campos = { parecer: string; lacunas: string; plano_nde: string; perguntas_comissao: string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function rascunhoIndicador(e: Entrada): Campos {
  const { code, name, conceitoAtual: atual, conceitoViavel: viavel, docInfo: d } = e;
  const semSolicitacao = d.total === 0;
  const parecer: string[] = [`Indicador ${code} — ${name}. Rascunho por algoritmo (${RASCUNHO_VERSION}); revisar antes de usar.`];
  parecer.push(semSolicitacao
    ? "Não há solicitação documental para este indicador no repositório do curso."
    : `Cobertura documental: ${plural(d.total, "solicitação", "solicitações")}, ${plural(d.docs, "arquivo", "arquivos")} (${d.validados} validado(s), ${d.enviados} em análise) e ${plural(d.pendentes, "exigência sem arquivo", "exigências sem arquivo")}.`);
  if (atual === null) parecer.push("Conceito atual ainda não registrado pelo avaliador.");
  else if (atual >= 3 && d.validados === 0) parecer.push(`O conceito atual registrado (${atual}) não tem, até agora, nenhuma evidência validada no repositório que o sustente.`);
  else parecer.push(`Conceito atual registrado: ${atual}${d.validados > 0 ? `, com ${plural(d.validados, "evidência validada", "evidências validadas")}` : ""}.`);
  if (atual !== null && viavel !== null && viavel > atual) parecer.push(`Conceito viável registrado: ${viavel} (diferença de ${viavel - atual} ponto(s) a construir).`);

  const lacunas: string[] = [];
  if (semSolicitacao) lacunas.push("• Cadastrar as solicitações documentais do indicador ou registrar \"não se aplica\" com justificativa.");
  if (d.pendentes > 0) lacunas.push(`• ${plural(d.pendentes, "exigência", "exigências")} sem arquivo enviado.`);
  if (d.enviados > 0) lacunas.push(`• ${plural(d.enviados, "arquivo enviado aguarda", "arquivos enviados aguardam")} validação.`);
  if (!semSolicitacao && d.validados === 0) lacunas.push("• Nenhuma evidência validada ainda.");
  if (atual === null) lacunas.push("• Registrar o conceito atual.");
  lacunas.push("• Conferir as evidências contra os critérios do conceito 5 no texto oficial do instrumento (os descritores não estão no sistema).");

  const plano: string[] = [];
  if (semSolicitacao) plano.push("• Definir responsável e prazo para as solicitações do indicador.");
  if (d.pendentes > 0) plano.push("• Reunir e enviar os documentos faltantes, com responsável e prazo.");
  if (d.enviados > 0) plano.push("• Validar os arquivos em análise.");
  if (atual !== null && viavel !== null && viavel > atual) plano.push(`• Planejar as ações para levar o indicador de ${atual} a ${viavel}.`);
  if (e.equivalencia?.objetos.length) plano.push(`• Aproveitar as evidências no Novo Instrumento 2026 (correspondência ${e.equivalencia.grau} com o(s) objeto(s) ${e.equivalencia.objetos.join(", ")}).`);
  if (!plano.length) plano.push("• Manter as evidências atualizadas e revisar o indicador no próximo ciclo do NDE.");

  const perguntas = [
    `• Quais evidências demonstram ${name.charAt(0).toLowerCase() + name.slice(1)}?`,
    "• Como o NDE acompanha e atualiza este indicador?",
  ];
  if (d.enviados > 0 || d.pendentes > 0) perguntas.push("• Os documentos pendentes estarão validados até a visita?");

  return { parecer: parecer.join("\n\n"), lacunas: lacunas.join("\n"), plano_nde: plano.join("\n"), perguntas_comissao: perguntas.join("\n") };
}

/** Só preenche campos vazios: texto escrito pelo avaliador nunca é sobrescrito. */
export function camposAPreencher(atuais: Campos, rascunho: Campos): Partial<Campos> {
  const out: Partial<Campos> = {};
  for (const k of Object.keys(rascunho) as (keyof Campos)[]) if (!String(atuais[k] ?? "").trim()) out[k] = rascunho[k];
  return out;
}
