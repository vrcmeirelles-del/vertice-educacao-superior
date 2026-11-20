/** Registro de decisão docente na curadoria do Avalia 360°.
 * É um histórico declarado pelo cliente, versionado junto ao rascunho.
 * Não comprova a identidade real do ator nem equivale a um log imutável no servidor.
 */
export interface CurationDecision {
 questionId:string;
 action:'accepted'|'rejected'|'acknowledged';
 at:string;
 ruleVersion:'rules-curation-1.0';
 originalStatement:string;
 proposedStatement:string|null;
 findings:string[];
}
export function createCurationDecision(input:{
 questionId:string;action:CurationDecision['action'];original:string;
 proposal:string|null;findings:string[];timestamp:string;
}):CurationDecision {
 if(!input.questionId.trim()||!Number.isFinite(Date.parse(input.timestamp)))
  throw new Error('Registro de curadoria inválido.');
 if(input.action!=='acknowledged'&&!input.proposal)
  throw new Error('Aceite/rejeição exige proposta existente.');
 if(input.action==='acknowledged'&&input.proposal)
  throw new Error('Ciência deve ser registrada sem substituir sugestão de redação.');
 return {questionId:input.questionId,action:input.action,at:input.timestamp,
  ruleVersion:'rules-curation-1.0',originalStatement:input.original,
  proposedStatement:input.proposal,findings:[...new Set(input.findings)].slice(0,40)};
}
