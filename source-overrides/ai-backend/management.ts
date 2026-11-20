import {inspectSensitiveText} from './core.ts';
type Entry={id:string;name:string;data:unknown};
const metrics=['exigencias','validados','sem_envio','em_revisao','devolvidos','reclassificar','nsa','documentos_atrasados','documentos_sem_meta','metas','metas_sem_medicao','metas_sem_acao','acoes','acoes_atrasadas','achados_abertos','achados_prioritarios'];
export function managementOverview(chunks:{id:string;text:string}[]){
 const summary=chunks.find(c=>c.id==='gestao_panorama');if(!summary)return null;
 return {...JSON.parse(summary.text),dimensoes:chunks.filter(c=>c.id.startsWith('gestao_dim_')).map(c=>JSON.parse(c.text))};
}
export function managementChunks(snapshot:any, labels:Record<string,string>){
 const dimensions=(snapshot.dimensoes??[]).filter((d:any)=>['Organização didático-pedagógica','Corpo docente e tutorial','Infraestrutura'].includes(d.dimensao)||metrics.some(k=>Number(d[k])>0));
 const totals=Object.fromEntries(metrics.map(k=>[k,dimensions.reduce((n:number,d:any)=>n+(Number(d[k])||0),0)]));
 const entries:Entry[]=[{id:'gestao_panorama',name:'Panorama integrado do curso',data:{data_referencia:snapshot.data_referencia,periodo:snapshot.periodo_documental,...(snapshot.dimensoes?totals:{}),total_metas:snapshot.total_metas,metas_incluidas:snapshot.metas?.length??0,total_grupos_indicadores:snapshot.total_grupos_indicadores,grupos_incluidos:snapshot.indicadores?.length??0,apoio_e_diversos:snapshot.apoio_e_diversos,achados_institucionais:snapshot.achados_institucionais,limites:snapshot.limites}}];
 dimensions.forEach((d:any,i:number)=>entries.push({id:`gestao_dim_${i+1}`,name:d.dimensao,data:d}));
 const goals:Entry[]=(snapshot.metas??[]).map((g:any,i:number)=>({id:`gestao_meta_${i+1}`,name:`${g.dimensao??'Gestão'} · Meta ${i+1}`,data:g}));
 // Round robin keeps the first dimension from consuming every detailed source.
 const groups=new Map<string,Entry[]>();for(const g of goals){const key=String((g.data as any).dimensao??'');groups.set(key,[...(groups.get(key)??[]),g]);}
 const ordered:Entry[]=[];while([...groups.values()].some(g=>g.length))for(const group of groups.values()){const next=group.shift();if(next)ordered.push(next);}
 const grouped=new Map<string,unknown[]>();
 for(const r of snapshot.indicadores??[]){const codes=String(r.indicador??'').match(/\b[123]\.\d{1,2}\b/g)??[];const key=codes.filter((c:string)=>c in labels).join(', ')||'Sem código INEP identificado';const list=grouped.get(key)??[];list.push({semestre:r.semester,situacao_documental:r.state,quantidade:r.quantidade});grouped.set(key,list);}
 const indicators:Entry[]=[];
 for(const [code,rows]of grouped){for(let i=0;i<rows.length;i+=12)indicators.push({id:`gestao_ind_${indicators.length+1}`,name:`Indicadores ${code} · documentos por semestre`,data:{codigos:code,rotulos:code.split(', ').filter(c=>c in labels).map(c=>labels[c]),referencia:'Rótulos INEP IACG 2017 não substituem descritores nem confirmam aplicabilidade.',situacao_por_semestre:rows.slice(i,i+12)}});}
 for(let i=0;i<Math.max(ordered.length,indicators.length);i++){if(ordered[i])entries.push(ordered[i]);if(indicators[i])entries.push(indicators[i]);}
 let total=0;const chunks=[];let omitted=0;
 for(const e of entries){const text=JSON.stringify(e.data,null,2);if(text.length>4000||total+text.length>28000){omitted++;continue;}total+=text.length;chunks.push({id:e.id,file_id:'',file_name:e.name,page:null,text,sha256:'',sensitive_findings:inspectSensitiveText(text)});}
 if(omitted)chunks.push({id:'gestao_limites',file_id:'',file_name:'Limites do detalhamento',page:null,text:`Foram omitidos ${omitted} blocos detalhados por limite de tamanho. O panorama mantém os totais do cadastro, mas os trechos detalhados não representam todo o curso.`,sha256:'',sensitive_findings:[]});
 return chunks;
}
// Revisão integrada por regras (auditoria de 20/11/2026, V8), usada com a IA suspensa: lacunas e
// prioridades a partir das métricas do panorama por dimensão; "fatos" são os trechos que o próprio
// usuário selecionou, citados literalmente. Sem interpretação, sem cota de IA.
const GAP_LABELS:[string,string][]=[['achados_prioritarios','achado(s) prioritário(s) em aberto'],['sem_envio','exigência(s) sem envio de documento'],['documentos_atrasados','documento(s) com prazo vencido'],['devolvidos','documento(s) devolvido(s) para ajuste'],['metas_sem_acao','meta(s) sem ação 5W2H'],['metas_sem_medicao','meta(s) sem medição'],['acoes_atrasadas','ação(ões) atrasada(s)'],['documentos_sem_meta','documento(s) sem vínculo a meta']];
const NEXT:Record<string,string>={achados_prioritarios:'Tratar primeiro os achados prioritários abertos, com responsável e prazo.',sem_envio:'Designar responsável e prazo para cada exigência sem envio.',documentos_atrasados:'Cobrar os documentos com prazo vencido e registrar nova data.',devolvidos:'Ajustar e reenviar os documentos devolvidos.',metas_sem_acao:'Vincular ao menos uma ação 5W2H a cada meta sem ação.',metas_sem_medicao:'Registrar a medição das metas para que o semáforo avalie a trajetória.',acoes_atrasadas:'Rever as ações atrasadas: replanejar prazo ou justificar.',documentos_sem_meta:'Relacionar os documentos às metas que eles comprovam.'};
export function ruleReview(chunks:{id:string;text:string;file_name?:string}[],snippets:{id:string;text:string}[]){
 const overview=managementOverview(chunks);
 const dims:any[]=overview?.dimensoes??[];
 const dimIds=chunks.filter(c=>c.id.startsWith('gestao_dim_')).map(c=>c.id);
 const gaps=dims.map((d,i)=>{const parts=GAP_LABELS.filter(([k])=>Number(d[k])>0).map(([k,l])=>`${Number(d[k])} ${l}`);return parts.length?{text:`${d.dimensao}: ${parts.join('; ')}.`,source_ids:[dimIds[i]].filter(Boolean)}:null;}).filter(Boolean).slice(0,8) as {text:string;source_ids:string[]}[];
 const recommendations=GAP_LABELS.filter(([k])=>dims.some(d=>Number(d[k])>0)).slice(0,8).map(([k])=>({text:`${NEXT[k]} Dimensões: ${dims.filter(d=>Number(d[k])>0).map(d=>d.dimensao).join(', ')}.`,source_ids:dims.map((d,i)=>Number(d[k])>0?dimIds[i]:null).filter(Boolean) as string[]}));
 const facts=snippets.filter(s=>s.text.trim().length>=8).slice(0,8).map(s=>({text:`Trecho selecionado de ${chunks.find(c=>c.id===s.id)?.file_name||'documento'}.`,source_ids:[s.id],quotes:[{source_id:s.id,excerpt:s.text.trim().slice(0,300)}]}));
 const t=overview??{};
 const summary=overview?`Panorama do curso${t.data_referencia?` em ${t.data_referencia}`:''}: ${Number(t.exigencias)||0} exigência(s), ${Number(t.validados)||0} validada(s), ${Number(t.sem_envio)||0} sem envio; ${Number(t.metas)||0} meta(s), ${Number(t.metas_sem_medicao)||0} sem medição e ${Number(t.metas_sem_acao)||0} sem ação; ${Number(t.achados_prioritarios)||0} achado(s) prioritário(s). Revisão por regras, sem IA.`:'Panorama de gestão indisponível para este curso; a revisão por regras lista apenas os trechos selecionados.';
 return {summary,facts,gaps,recommendations,limitations:['Revisão por regras (IA suspensa): lacunas e prioridades vêm das contagens do cadastro, sem leitura interpretativa dos documentos.','Contagens não comprovam qualidade nem conformidade; ausência de registro não equivale a zero.'],disclaimer:'Proposta para revisão humana. Não substitui a análise da coordenação nem a avaliação oficial.'};
}
