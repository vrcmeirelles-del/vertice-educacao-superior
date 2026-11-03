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
