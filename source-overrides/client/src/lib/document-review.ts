import type {Row} from './area';
import {latestDocuments} from './repository';
export type ReviewChunk={id:string;file_id:string;file_name:string;text:string;sensitive_findings:string[]};
export type DimensionOverview={dimensao:string;exigencias:number;validados:number;sem_envio:number;em_revisao:number;devolvidos:number;reclassificar:number;nsa:number;documentos_atrasados:number;documentos_sem_meta:number;metas:number;metas_sem_medicao:number;metas_sem_acao:number;acoes:number;acoes_atrasadas:number;achados_abertos:number;achados_prioritarios:number};
export type CourseOverview=DimensionOverview & {data_referencia:string;periodo:string;total_metas:number;apoio_e_diversos:number;achados_institucionais:number;dimensoes:DimensionOverview[]};
export function dimensionAttention(d:DimensionOverview){
 const reasons=[
  d.documentos_atrasados>0&&`${d.documentos_atrasados} entrega(s) em atraso: pactuar regularização.`,
  d.devolvidos>0&&`${d.devolvidos} documento(s) devolvido(s): corrigir e reenviar.`,
  d.acoes_atrasadas>0&&`${d.acoes_atrasadas} ação(ões) em atraso: revisar execução e prazo.`,
  d.achados_prioritarios>0&&`${d.achados_prioritarios} achado(s) de alta prioridade: tratar no plano de ação.`,
  d.sem_envio>0&&`${d.sem_envio} exigência(s) sem envio: reunir evidências.`,
  d.em_revisao>0&&`${d.em_revisao} envio(s) aguardando revisão humana.`,
  d.reclassificar>0&&`${d.reclassificar} documento(s) precisam de reclassificação.`,
  d.metas_sem_medicao>0&&`${d.metas_sem_medicao} meta(s) sem medição: registrar o resultado atual.`,
  d.metas_sem_acao>0&&`${d.metas_sem_acao} meta(s) sem ação vinculada: conferir o plano 5W2H.`,
  d.documentos_sem_meta>0&&`${d.documentos_sem_meta} exigência(s) sem meta vinculada: revisar a relação no cadastro.`,
  d.nsa>0&&`${d.nsa} NSA declarado(s): conferir justificativa e aplicabilidade.`,
  d.achados_abertos>0&&`${d.achados_abertos} achado(s) abertos no diagnóstico.`
 ].filter(Boolean) as string[];
 const hasData=d.exigencias+d.nsa+d.metas+d.acoes+d.achados_abertos>0;
 const tone=!hasData?'gray':d.documentos_atrasados+d.devolvidos+d.acoes_atrasadas+d.achados_prioritarios>0?'red':reasons.length?'amber':'green';
 return {tone,label:({gray:'Sem dados',red:'Prioridade de gestão',amber:'Atenção',green:'Sem alerta cadastral'})[tone],reasons};
}
/** Latest active, applicable, validated versions only; server rechecks authorization. */
export function reviewDocuments(institutionId:string,courseId:string,requests:Row[],files:Row[]){
 const ids=new Set(requests.filter(r=>r.institution_id===institutionId&&r.course_id===courseId&&r.active!==false&&!r.not_applicable).map(r=>r.id));
 const latest=[...latestDocuments(files.filter(f=>f.institution_id===institutionId&&ids.has(String(f.request_id)))).values()];
 return {all:latest,compatible:latest.filter(f=>f.status==='validado'&&/\.(txt|csv)$/i.test(String(f.file_name))&&Number(f.size_bytes)>0&&Number(f.size_bytes)<=5*1024*1024)};
}
/** Suggested selection is local only; transmitting always needs a separate confirmation. */
export function recommendSources(chunks:ReviewChunk[]){
 const priority=(c:ReviewChunk)=>c.id==='gestao_panorama'?0:c.id.startsWith('gestao_dim_')?1:c.id==='gestao_limites'?2:c.file_id?3:4;
 const ordered=[...chunks].sort((a,b)=>priority(a)-priority(b));
 const selected:Record<string,string>={};let chars=0;
 for(const c of ordered){if(c.sensitive_findings.length||c.text.trim().length<10||c.text.length>4000||chars+c.text.length>24000||Object.keys(selected).length>=12)continue;selected[c.id]=c.text;chars+=c.text.length;}
 return selected;
}
