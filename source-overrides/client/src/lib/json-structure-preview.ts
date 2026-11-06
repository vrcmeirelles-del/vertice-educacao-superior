/**
 * Browser-only inspection of large institutional JSON exports.
 *
 * Inspects paths and column names, not personal data values.
 * A preview of 500 records is explicitly NON-PUBLISHABLE if the selected dataset
 * contains more than 500 records. The original source remains immutable.
 */
export type JsonDataset={
 path:string;
 count:number;
 columns:string[];
 previewEligible:boolean;
};
export type JsonStructure={
 rootType:string;
 topLevelKeys:string[];
 datasets:JsonDataset[];
 notes:string[];
};
export function inspectInstitutionalJson(value:unknown):JsonStructure{
 const datasets:JsonDataset[]=[];
 const notes:string[]=[];
 const rootType=Array.isArray(value)?"array":value===null?"null":typeof value;
 const topLevelKeys=value!==null&&!Array.isArray(value)&&typeof value==="object"
  ?Object.keys(value as Record<string,unknown>).slice(0,80):[];
 const visited=new WeakSet<object>();
 let visitedCount=0;
 function walk(node:unknown,path:string,depth:number){
  if(node===null||typeof node!=="object"||depth>6)return;
  if(visited.has(node))return;
  visited.add(node);
  if(++visitedCount>1500){if(!notes.includes("A exploração de caminhos foi limitada a 1.500 nós."))notes.push("A exploração de caminhos foi limitada a 1.500 nós.");return;}
  if(Array.isArray(node)){
   const first=node.find(x=>x!==null&&typeof x==="object"&&!Array.isArray(x));
   if(node.length&&first&&typeof first==="object"){
    const columns=[...new Set(node.slice(0,Math.min(node.length,5))
     .filter(x=>x!==null&&typeof x==="object"&&!Array.isArray(x))
     .flatMap(x=>Object.keys(x as Record<string,unknown>)))].slice(0,100);
    datasets.push({path,count:node.length,columns,previewEligible:node.length<=500});
   }
   // An array of objects is a dataset, not a traversal of potentially thousands of personal records.
   // Allow one nested sample to locate e.g. rows inside wrapper objects.
   if(node.length&&depth<4&&typeof node[0]==="object"&&node[0]!==null&&!Array.isArray(node[0])){
    for(const [key,child] of Object.entries(node[0] as Record<string,unknown>).slice(0,35)){
     if(child&&typeof child==="object")walk(child,path+"[0]."+key,depth+1);
    }
   }
   return;
  }
  for(const [key,child] of Object.entries(node as Record<string,unknown>).slice(0,100)){
   if(child&&typeof child==="object")walk(child,path==="(raiz)"?key:path+"."+key,depth+1);
  }
 }
 walk(value,"(raiz)",0);
 datasets.sort((a,b)=>b.count-a.count||a.path.localeCompare(b.path));
 if(datasets.length===0)notes.push("Nenhuma lista tabular de objetos foi identificada. O arquivo continua disponível como fonte documental.");
 if(datasets.some(x=>x.count>500))notes.push("Conjuntos com mais de 500 registros exigem processamento completo em lotes. Sua prévia não poderá ser homologada como se fosse a base inteira.");
 return {rootType,topLevelKeys,datasets:datasets.slice(0,80),notes};
}
export function getInstitutionalJsonDataset(value:unknown,path:string):Record<string,unknown>[]{
 let node:unknown=value;
 if(path!=="(raiz)"){
  for(const token of path.split(".")){
   if(!token||token==="__proto__"||token==="constructor"||token==="prototype")throw new Error("Caminho de dados inválido.");
   const sample=token.endsWith("[0]");
   const key=sample?token.slice(0,-3):token;
   if(node===null||typeof node!=="object"||Array.isArray(node)||!Object.hasOwn(node,key))
    throw new Error("Caminho de dados não encontrado na fonte.");
   node=(node as Record<string,unknown>)[key];
   if(sample)node=Array.isArray(node)?node[0]:undefined;
  }
 }
 if(!Array.isArray(node))throw new Error("O caminho não contém uma lista de registros.");
 if(node.length>500)throw new Error("Esta lista possui "+node.length+" registros. Não é permitido homologar somente os primeiros 500 como se fossem a carga completa. Selecione uma lista menor ou utilize processamento em lotes.");
 if(!node.length||node.some(x=>x===null||typeof x!=="object"||Array.isArray(x)))
  throw new Error("Os registros não formam uma tabela de objetos.");
 return node as Record<string,unknown>[];
}
export function jsonStructureSummary(structure:JsonStructure):string{
 const items=structure.datasets.slice(0,15).map(x=>x.path+": "+x.count+" registros").join("; ");
 return "Raiz "+structure.rootType+". "+structure.datasets.length+
  " conjunto(s) tabular(es) identificado(s). "+(items||"Sem conjuntos tabulares.")+
  " Nenhum dado foi incorporado automaticamente.";
}
