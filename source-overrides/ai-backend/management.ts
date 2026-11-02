import {inspectSensitiveText} from './core.ts';
export function managementChunks(snapshot:any, labels:Record<string,string>){
 const entries:{name:string;data:unknown}[]=[{name:'Resumo gerencial do curso',data:{data_referencia:snapshot.data_referencia,periodo:snapshot.periodo_documental,total_metas:snapshot.total_metas,metas_incluidas:snapshot.metas?.length??0,limite_metas:snapshot.limite_metas,limite_grupos_indicadores:snapshot.limite_grupos_indicadores,limites:snapshot.limites}}];
 for(const [i,g] of (snapshot.metas??[]).entries())entries.push({name:`Meta ${i+1} — registro administrativo`,data:g});
 const grouped=new Map<string,unknown[]>();
 for(const r of snapshot.indicadores??[]){const codes=String(r.indicador??'').match(/\b[123]\.\d{1,2}\b/g)??[];const key=codes.filter((c:string)=>c in labels).join(', ')||'Sem código INEP identificado';const list=grouped.get(key)??[];list.push({semestre:r.semester,situacao_documental:r.state,quantidade:r.quantidade});grouped.set(key,list);}
 for(const [code,rows]of grouped){for(let i=0;i<rows.length;i+=12)entries.push({name:`Indicadores ${code} — situação cadastral`,data:{codigos:code,rotulos:code.split(', ').filter(c=>c in labels).map(c=>labels[c]),referencia:'Catálogo INEP IACG 2017. Rótulos não substituem descritores nem confirmam aplicabilidade ao ato/curso.',situacao_por_semestre:rows.slice(i,i+12)}});}
 let total=0;const chunks=[];let omitted=0;
 for(const [i,e] of entries.entries()){const text=JSON.stringify(e.data,null,2);if(text.length>4000||total+text.length>28000){omitted++;continue;}total+=text.length;chunks.push({id:`gestao_${i+1}`,file_id:'',file_name:e.name,page:null,text,sha256:'',sensitive_findings:inspectSensitiveText(text)});}
 if(omitted)chunks.push({id:'gestao_limites',file_id:'',file_name:'Limite do recorte',page:null,text:`Foram omitidos ${omitted} blocos por limite de tamanho. Este recorte não representa todo o curso.`,sha256:'',sensitive_findings:[]});
 return chunks;
}
