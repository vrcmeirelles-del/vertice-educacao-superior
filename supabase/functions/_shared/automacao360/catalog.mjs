// Proposed rules, not production thresholds. All are opt-in after homologation.
export const VERSION = '2026.11-proposal.1';
export const RULES = Object.freeze([
 ['repo.overdue','Repositório','daily','P0','open','daysToDue','lt',0],
 ['repo.due','Repositório','daily','P0','open','daysToDue','between',[0,7]],
 ['sapiens.low','Sapiens 360°','daily','P0','validated','accuracy','lt',0.5,'graded',30],
 ['curriculum.gap','Construção Curricular','weekly','P0','validated','uncoveredCompetencies','gt',0],
 ['avalia.recovery','Avalia 360°','weekly','P0','validated','pendingRecovery','gt',0],
 ['enade.gap','ENADE 360°','weekly','P0','validated','uncoveredCompetencies','gt',0],
 ['enamed.gap','ENAMED 360°','weekly','P0','validated','uncoveredCompetencies','gt',0],
 ['cpa.pending','CPA','monthly','P1','open','missingEvidence','gt',0],
 ['retention.alert','Permanência','weekly','P1','validated','confirmedAlerts','gt',0],
 ['pei.overdue','Planejamento Estratégico','daily','P1','open','overdueActions','gt',0],
 ['extension.pending','Extensão 360°','weekly','P1','open','missingEvidence','gt',0],
 ['teaching.pending','Atividades de Ensino','weekly','P1','open','pendingCertificates','gt',0],
 ['internship.due','Estágio 360°','weekly','P1','open','daysToDue','between',[0,7]],
 ['tcc.overdue','TCC 360°','weekly','P1','open','daysToDue','lt',0],
 ['ac.duplicate','AC 360°','weekly','P1','open','duplicateCandidates','gt',0],
 ['alumni.pending','Conecta 360°','monthly','P2','open','pendingSurveys','gt',0],
 ['capture.stale','Captação','daily','P1','open','unattendedLeads','gt',0],
 ['market.new','Inteligência de Mercado','daily','P1','open','unreviewedPublications','gt',0],
 ['due.pending','Due Diligence','weekly','P2','open','missingEvidence','gt',0],
 ['school.attendance','Vértice Escolas','weekly','P1','validated','confirmedAlerts','gt',0],
 ['finance.overdue','Financeiro','daily','P2','open','overdueInvoices','gt',0]
].map(([id,module,cadence,priority,state,metric,op,threshold,minMetric,min])=>Object.freeze({id,module,cadence,priority,state,metric,op,threshold:Array.isArray(threshold)?Object.freeze(threshold):threshold,minMetric,min,version:VERSION})));
