export const STAGES = {rumor:'Rumor',negotiation:'Negociação',announced:'Anunciada',signed:'Contrato assinado',regulatory:'Aprovação regulatória',closed:'Concluída',integration:'Em integração',cancelled:'Cancelada',trend:'Tendência'};
export const KINDS = {acquisition:'Aquisição de controle',merger:'Fusão / incorporação societária',unification:'Unificação de mantidas',asset_sale:'Venda de ativos',minority:'Participação minoritária',trend:'Tendência setorial'};
export const CONFIDENCE = {unverified:'Não verificada',conflicting:'Fontes conflitantes',secondary:'Fonte secundária conferida',primary:'Fonte primária conferida'};
export type Source = {url:string;type:'primary'|'secondary';published_on:string;checked_on:string;evidence:string};
export type MarketBody = Record<string, unknown> & {title:string;kind:keyof typeof KINDS;stage:keyof typeof STAGES;confidence:keyof typeof CONFIDENCE;sources:Source[]};
export type MarketOperation = {id:string;course_id:string|null;perspective:'institution'|'commercial';operation_key:string;body:MarketBody;revision:number;updated_at:string;action_id?:string};
export function marketDate(){return new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});}
export function blankMarket():MarketBody{return {title:'',kind:'acquisition',stage:'announced',confidence:'unverified',fact_date:marketDate(),sources:[{url:'',type:'primary',published_on:marketDate(),checked_on:marketDate(),evidence:''}]};}
export function optionalNumber(value:string):number|null{if(!value.trim())return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('Informe número não negativo, sem separador de milhar.');return n;}
export function marketPriority(body:MarketBody):string {
 const n=(key:string)=>typeof body[key]==='number'?body[key] as number:null;
 const impact=n('opportunity'),risk=n('risk'),urgency=n('urgency'),effort=n('effort');
 if([impact,risk,urgency,effort].some(x=>x===null))return 'Não dimensionada';
 // Transparent triage, NOT a probability or financial return forecast.
 const score=Math.max(impact!,risk!)*urgency!/effort!;
 return score>=10?'Alta':score>=4?'Média':'Baixa';
}
export function revenueScenario(body:MarketBody):number|null {
 return typeof body.units==='number'&&typeof body.monthly_price==='number'&&String(body.scenario_basis??'').trim().length>=10?body.units*body.monthly_price:null;
}
export function sourceUrl(url:string):string|null{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}}
