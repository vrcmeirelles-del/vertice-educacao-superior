/**
 * Avalia 360° — Bloco 4: classificação de Bloom por verbo de comando (dicionário fixo, sem IA).
 * Só formas verbais de comando (imperativo e infinitivo) contam, para não confundir com
 * substantivos frequentes em textos jurídicos ("julgamento", "aplicação da lei", "análise").
 * Nível da questão = o mais alto entre os verbos encontrados. O professor pode corrigir
 * (QuestionDraft.bloomLevel), e a correção prevalece.
 * Ambiguidade conhecida: "analise" também é a grafia sem acento de "análise".
 */
export const BLOOM_RULES = {version:'2026.11-1',lowShare:0.6,lowFromPeriod:5} as const;
export type BloomLevel = 1|2|3|4|5|6;
export const BLOOM_LABELS:Record<BloomLevel,string>={1:'Lembrar',2:'Compreender',3:'Aplicar',4:'Analisar',5:'Avaliar',6:'Criar'};
const VERBS:Record<BloomLevel,string[]>={
 1:['identifique','identificar','defina','definir','liste','listar','cite','citar','indique','indicar','nomeie','nomear','enumere','enumerar','reconheca','reconhecer','mencione','mencionar'],
 2:['explique','explicar','descreva','descrever','resuma','resumir','interprete','interpretar','classifique','classificar','exemplifique','exemplificar','conceitue','conceituar','esclareca','esclarecer'],
 3:['aplique','aplicar','calcule','calcular','resolva','resolver','utilize','utilizar','demonstre','demonstrar','solucione','solucionar','empregue','empregar','enquadre','enquadrar'],
 4:['analise','analisar','compare','comparar','diferencie','diferenciar','distinga','distinguir','examine','examinar','relacione','relacionar','contraste','contrastar','confronte','confrontar'],
 5:['avalie','avaliar','julgue','julgar','justifique','justificar','critique','criticar','argumente','argumentar','fundamente','fundamentar','defenda','defender','posicione','posicionar','decida','decidir','pondere','ponderar'],
 6:['elabore','elaborar','proponha','propor','formule','formular','redija','redigir','planeje','planejar','construa','construir','desenvolva','desenvolver','crie','criar','produza','produzir'],
};
const INDEX=new Map<string,BloomLevel>(Object.entries(VERBS).flatMap(([l,ws])=>ws.map(w=>[w,Number(l) as BloomLevel])));
const tokens=(t:string)=>t.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().split(/[^a-z]+/).filter(Boolean);

export function classifyBloom(statement:string):{level:BloomLevel|null;verbs:string[]}{
 const found=new Map<string,BloomLevel>();
 for(const w of tokens(statement)){const l=INDEX.get(w);if(l)found.set(w,l);}
 const verbs=[...found.keys()].sort((a,b)=>found.get(b)!-found.get(a)!||a.localeCompare(b));
 return {level:verbs.length?found.get(verbs[0])!:null,verbs};
}
export function effectiveBloom(q:{statement:string;bloomLevel?:number}):{level:BloomLevel|null;source:'professor'|'verbo'|'nenhum'}{
 if(q.bloomLevel&&q.bloomLevel>=1&&q.bloomLevel<=6)return {level:q.bloomLevel as BloomLevel,source:'professor'};
 const c=classifyBloom(q.statement);
 return {level:c.level,source:c.level?'verbo':'nenhum'};
}
export interface BloomProfile {distribution:Record<BloomLevel,number>;unclassified:number;lowShare:number|null;misaligned:boolean}
/** Desalinhamento: avaliação somativa a partir do 5º período com 60% ou mais das questões classificadas em Lembrar/Compreender. */
export function bloomProfile(questions:Array<{statement:string;bloomLevel?:number}>,ctx:{purpose?:string;period?:number}):BloomProfile{
 const distribution={1:0,2:0,3:0,4:0,5:0,6:0} as Record<BloomLevel,number>;let unclassified=0;
 for(const q of questions){const e=effectiveBloom(q);if(e.level)distribution[e.level]++;else unclassified++;}
 const classified=questions.length-unclassified;
 const lowShare=classified?(distribution[1]+distribution[2])/classified:null;
 const misaligned=ctx.purpose==='somativa'&&(ctx.period??0)>=BLOOM_RULES.lowFromPeriod&&lowShare!==null&&lowShare>=BLOOM_RULES.lowShare;
 return {distribution,unclassified,lowShare,misaligned};
}
