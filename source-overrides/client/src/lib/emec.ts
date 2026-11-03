export const EMEC_KINDS = {institution:'Instituição e mantenedora',course:'Cursos',indicator:'Indicadores e histórico',act:'Atos autorizativos',process:'Processos',occurrence:'Ocorrências',address:'Endereços e polos',attachment:'Anexos',alert:'Alertas'} as const;
export type EmecRecord={kind:keyof typeof EMEC_KINDS;key:string;title:string;data:Record<string,unknown>};
export type EmecPayload={version:1;original_text?:string;emec_code:string;source_url:string;consulted_on:string;coverage:'partial'|'complete';gaps:string[];records:EmecRecord[]};
export type EmecSnapshot={id:string;revision:number;created_at:string;body:EmecPayload};
export function parseEmec(value:unknown,code:string):EmecPayload{
 const p=value as EmecPayload;
 if(!p||typeof p!=='object'||JSON.stringify(p).length>2000000)throw Error('Arquivo inválido ou maior que 2 MB.');
 if(p.version!==1||!code||p.emec_code!==code)throw Error('O código e-MEC do arquivo deve coincidir com o cadastro desta instituição.');
 let u:URL;try{u=new URL(p.source_url);}catch{throw Error('Informe a URL da consulta oficial.');}
 if(u.protocol!=='https:'||u.hostname!=='emec.mec.gov.br'||u.username||u.password)throw Error('A origem deve ser uma página HTTPS do e-MEC.');
 if(!/^20\d\d-\d\d-\d\d$/.test(p.consulted_on)||!Number.isFinite(Date.parse(p.consulted_on))||new Date(p.consulted_on).toISOString().slice(0,10)!==p.consulted_on||p.consulted_on>new Date().toISOString().slice(0,10))throw Error('Data da consulta inválida ou futura.');
 if(!['partial','complete'].includes(p.coverage)||!Array.isArray(p.gaps)||p.gaps.some(g=>typeof g!=='string')||(p.coverage==='complete'&&p.gaps.length)||(p.coverage==='partial'&&!p.gaps.length))throw Error('Informe as lacunas da consulta parcial; cobertura completa não pode conter lacunas.');
 if(!Array.isArray(p.records)||p.records.length<1||p.records.length>5000)throw Error('Importe entre 1 e 5.000 registros.');
 const keys=new Set<string>();
 for(const r of p.records){
  if(!r||!Object.hasOwn(EMEC_KINDS,r.kind)||typeof r.key!=='string'||!r.key.length||r.key.length>200||typeof r.title!=='string'||!r.title.length||r.title.length>500||!r.data||typeof r.data!=='object'||Array.isArray(r.data))throw Error('Registro inválido: confira tipo, chave, título e dados.');
  const k=JSON.stringify([r.kind,r.key]);if(keys.has(k))throw Error('Chave duplicada no mesmo tipo de registro.');keys.add(k);
 }
 return p;
}
const canonical=(v:unknown):string=>v&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as any)[k])).join(',')+'}'):JSON.stringify(v);
export function emecDiff(previous:EmecPayload|undefined,next:EmecPayload){
 const key=(r:EmecRecord)=>JSON.stringify([r.kind,r.key]);
 const old=new Map((previous?.records||[]).map(r=>[key(r),r])),fresh=new Map(next.records.map(r=>[key(r),r]));
 return {added:next.records.filter(r=>!old.has(key(r))),changed:next.records.filter(r=>old.has(key(r))&&canonical(old.get(key(r)))!==canonical(r)),absent:(previous?.records||[]).filter(r=>!fresh.has(key(r)))};
}
export function emecReference(s:EmecSnapshot){return `e-MEC IES ${s.body.emec_code} · versão ${s.revision} (${s.id}) · consulta ${s.body.consulted_on} · cobertura ${s.body.coverage==='partial'?'parcial':'completa'}. Fonte: ${s.body.source_url}. Lacunas: ${s.body.gaps.join('; ')||'nenhuma declarada'}.`;}
export function downloadEmec(payload:EmecPayload){const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`emec-${payload.emec_code}-${payload.consulted_on}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
