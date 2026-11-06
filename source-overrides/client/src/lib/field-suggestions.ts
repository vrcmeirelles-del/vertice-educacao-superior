/** Vocabulário transversal de apoio ao preenchimento.
 * Textos são rascunhos opt-in: não são evidência, declaração verificada ou dado institucional.
 * Nunca gerar número, CPF, CNPJ, nome real, prazo ou validação automática.
 */
export const FIELD_SUGGESTIONS:Record<string,string[]>={
 title:["Plano de melhoria acadêmica","Revisão dos indicadores de desempenho","Atualização documental e regulatória","Acompanhamento da permanência estudantil"],
 indicator:["Taxa de evasão no período","Percentual de reprovação por falta","Percentual de reprovação por nota","Percentual de evidências validadas"],
 source:["Sistema acadêmico e-ORBIT — conferir data de extração","Repositório institucional — indicar versão do documento","Relatório da CPA — identificar edição e período","Cadastro e-MEC — registrar data da consulta"],
 formula:["(Reprovações por falta / matrículas em disciplinas avaliadas) × 100 — validar unidade","(Alunos não rematriculados / alunos elegíveis à rematrícula) × 100 — validar coorte","(Evidências validadas / exigências aplicáveis) × 100 — excluir NSA quando aplicável"],
 notes:["Informação pendente de conferência pela área responsável.","Verificar fonte, período, método de cálculo e evidência antes da validação.","Registrar responsável, ação prevista e prazo após pactuação institucional."],
 what:["Revisar documentação e registrar evidências vinculadas à meta.","Conferir indicadores acadêmicos e reconciliar a fonte oficial.","Investigar fatores de reprovação e elaborar intervenção pedagógica.","Preparar plano de ação e submeter à instância superior."],
 why:["Acompanhamento de indicador que requer validação dos dados.","Necessidade de atualização documental antes da análise gerencial.","Identificação de oportunidade de melhoria no processo acadêmico."],
 how:["Levantar dados, conferir a fonte, registrar achados, executar a providência e anexar evidências.","Confrontar o indicador com o período anterior equivalente, documentando eventuais diferenças.","Submeter o resultado à validação superior após a conferência documental."],
 evidence:["Documento: [nome e versão]. Fonte: [repositório]. Data: [informar].","Registro da ação: [descrever]. Evidência: [identificar arquivo ou link interno]."],
 finding:["Achado sujeito à revisão: descrever a evidência e a divergência identificada.","Registrar critério, fonte consultada, impacto potencial e providência sugerida."],
 criterion:["Aderência do PPC às diretrizes curriculares aplicáveis.","Atualização das evidências institucionais por indicador.","Conformidade dos processos de acompanhamento e avaliação."],
 reference:["Instrumento de avaliação INEP — informar indicador e versão.","PPC vigente — indicar versão e ato de aprovação.","Relatório institucional — informar data e fonte."],
 scope:["Revisão documental e regulatória, limitada às informações disponíveis no mandato.","Análise acadêmica e financeira com segregação de dados pessoais e validação das fontes."],
 conclusion:["Conclusão preliminar sujeita a validação das evidências e premissas.","Não foi possível concluir sem documentação adicional: [listar pendências]."]
};
const aliases:Record<string,string>={
 "meta":"title","titulo":"title","título":"title","objetivo":"title","descrição":"notes","descricao":"notes",
 "observação":"notes","observacoes":"notes","justificativa":"why","por quê":"why",
 "indicador":"indicator","fórmula":"formula","fonte":"source","o quê":"what",
 "como":"how","evidência":"evidence","achado":"finding","critério":"criterion",
 "referência":"reference","escopo":"scope","conclusão":"conclusion"
};
export function suggestionOptions(key:string,label:string):string[]{
 const exact=FIELD_SUGGESTIONS[key.toLocaleLowerCase("pt-BR")];
 if(exact)return exact;
 const normalized=label.toLocaleLowerCase("pt-BR");
 const match=Object.entries(aliases).find(([term])=>normalized.includes(term));
 return match?FIELD_SUGGESTIONS[match[1]]??[]:[];
}
