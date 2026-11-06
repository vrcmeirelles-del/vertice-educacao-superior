import {UNI_GIZ_EXPECTED_TABLES,UNI_GIZ_CATALOG_SHA256,UNI_GIZ_QUERY_SHA256} from "./uni-giz-expected";

/** Estrutura somente: nunca importa linhas, nomes, CPFs ou matrículas. */
export type UniGizTableCheck={
 schema:string;name:string;area:string;priority:number;
 status:"LOCALIZADA"|"AUSENTE";estimatedRows:number;
};
export type UniGizCheckResult={
 institution:string;database:string;readonly:true;
 expected:number;found:number;missing:number;extraDeclared:number;
 priorityMissing:string[];missingNames:string[];
 manifestSha:string;tablesSha:string;catalogSha:string;querySha:string;
 reportedAt:string;rows:UniGizTableCheck[];
 warning:string;
};
const EXPECTED_CI=new Set([...UNI_GIZ_EXPECTED_TABLES].map(v=>v.toUpperCase()));
const EXPECTED_COUNT=642;
const safeInteger=(value:unknown,max:number)=>Number.isSafeInteger(value)&&
 Number(value)>=0&&Number(value)<=max;
function parseSemicolonCsv(input:string):string[][]{
 const rows:string[][]=[],line:string[]=[];
 let cell="",inside=false;
 const text=input.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(inside&&text[i+1]==='"'){cell+='"';i++;}
   else if(!inside&&cell!=="")throw new Error("Aspas inesperadas no CSV de conferência.");
   else inside=!inside;
  }else if(ch===';'&&!inside){line.push(cell);cell="";}
  else if((ch==="\n"||ch==="\r")&&!inside){
   if(ch==="\r"&&text[i+1]==="\n")i++;
   line.push(cell);cell="";
   if(line.some(v=>v.trim()))rows.push([...line]);
   line.length=0;
   if(rows.length>5000)throw new Error("CSV estrutural acima do limite de linhas.");
  }else cell+=ch;
 }
 if(inside)throw new Error("Aspas não encerradas no CSV.");
 line.push(cell);if(line.some(v=>v.trim()))rows.push([...line]);
 return rows;
}
const readStrict=async(file:File,maxBytes:number)=>{
 if(file.size<30||file.size>maxBytes)throw new Error("Arquivo de conferência vazio ou acima do limite de leitura.");
 return new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());
};
export async function uniGizSha256(file:Blob):Promise<string>{
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()));
 return [...digest].map(v=>v.toString(16).padStart(2,"0")).join("");
}
/** Rejeita qualquer dataset que não seja o relatório de metadados esperado. */
export async function validateUniGizStructuralFiles(manifestFile:File,tablesFile:File):Promise<UniGizCheckResult>{
 if(manifestFile.name!=="00_manifesto_conciliacao.json"||tablesFile.name!=="02_642_tabelas.csv")
  throw new Error("Selecione os arquivos 00_manifesto_conciliacao.json e 02_642_tabelas.csv gerados pelo script da UNICALDAS.");
 const manifestText=await readStrict(manifestFile,131072);
 const tableText=await readStrict(tablesFile,4194304);
 let manifest:Record<string,unknown>;
 try{
  const v=JSON.parse(manifestText) as unknown;
  if(!v||typeof v!=="object"||Array.isArray(v))throw Error();
  manifest=v as Record<string,unknown>;
 }catch{throw new Error("Manifesto JSON inválido. Não altere os relatórios produzidos pelo SQL Server.");}
 if(manifest.instituicao!=="FACULDADE DE CALDAS NOVAS"
   ||manifest.banco!=="UNI_GIZ_HOMOLOGACAO"||manifest.estado!=="READ_ONLY")
  throw new Error("O manifesto não comprova origem UNICALDAS / UNI_GIZ_HOMOLOGACAO em modo somente leitura.");
 if(manifest.arquivo_sql_sha256!==UNI_GIZ_QUERY_SHA256)
  throw new Error("O script SQL da conferência não corresponde à versão homologável da Vértice.");
 if(manifest.tabelas_esperadas!==EXPECTED_COUNT||
   !safeInteger(manifest.tabelas_localizadas,642)||!safeInteger(manifest.tabelas_ausentes,642)||
   !safeInteger(manifest.tabelas_adicionais,100000)||
   Number(manifest.tabelas_localizadas)+Number(manifest.tabelas_ausentes)!==EXPECTED_COUNT)
  throw new Error("A relação de totais de tabelas do manifesto é inconsistente.");
 const reportList=manifest.arquivos;
 if(!Array.isArray(reportList)||reportList.length!==5)throw new Error("Manifesto incompleto: esperados cinco arquivos de resultados.");
 const tableDescriptor=reportList.find(x=>x&&typeof x==="object"&&(x as Record<string,unknown>).arquivo==="02_642_tabelas.csv");
 if(!tableDescriptor)throw new Error("O manifesto não menciona o relatório de 642 tabelas.");
 const declaredSha=(tableDescriptor as Record<string,unknown>).sha256;
 if(typeof declaredSha!=="string"||!/^[a-fA-F0-9]{64}$/.test(declaredSha))
  throw new Error("SHA-256 do relatório ausente ou inválido.");
 const tablesSha=await uniGizSha256(tablesFile);
 if(tablesSha!==declaredSha.toLowerCase())throw new Error("O CSV enviado difere do hash registrado pelo script. Conferência interrompida.");
 const records=parseSemicolonCsv(tableText);
 if(records.length!==EXPECTED_COUNT+1)throw new Error("Relatório de tabelas incompleto: esperadas 642 linhas e um cabeçalho.");
 const header=records[0].map(h=>h.trim().toLowerCase());
 const fields=["esquema","tabela","area","prioridade","situacao","linhas_tabela_estimadas"];
 const pos=fields.map(k=>header.indexOf(k));
 if(pos.some(i=>i<0)||new Set(header).size!==header.length||
   records.some(row=>row.length!==header.length))
  throw new Error("Cabeçalho ou número de colunas do relatório não corresponde ao modelo oficial.");
 const seen=new Set<string>(),rows:UniGizTableCheck[]=[];
 for(const [i,values] of records.slice(1).entries()){
  const [schema,name,area,priorityText,status,rowsText]=pos.map(j=>values[j].trim());
  const key=(schema+"."+name).toUpperCase();
  if(!EXPECTED_CI.has(key))throw new Error("Linha "+(i+2)+": tabela não pertence ao inventário original de 642 nomes.");
  if(seen.has(key))throw new Error("Linha "+(i+2)+": tabela duplicada no relatório.");
  if(!/^[1-3]$/.test(priorityText)||!["LOCALIZADA","AUSENTE"].includes(status)
    ||!/^\d+$/.test(rowsText)||!Number.isSafeInteger(Number(rowsText)))
   throw new Error("Linha "+(i+2)+": prioridade, situação ou estimativa inválida.");
  if(status==="AUSENTE"&&Number(rowsText)!==0)
   throw new Error("Linha "+(i+2)+": tabela ausente não pode apresentar linhas estimadas.");
  seen.add(key);rows.push({schema,name,area:area.slice(0,100),priority:Number(priorityText),
    status:status as "LOCALIZADA"|"AUSENTE",estimatedRows:Number(rowsText)});
 }
 if(seen.size!==EXPECTED_CI.size)throw new Error("O relatório não cobre exatamente os 642 nomes do inventário.");
 const found=rows.filter(x=>x.status==="LOCALIZADA").length,missing=EXPECTED_COUNT-found;
 if(found!==manifest.tabelas_localizadas||missing!==manifest.tabelas_ausentes)
  throw new Error("As situações das 642 tabelas divergem dos totais do manifesto.");
 const missingNames=rows.filter(x=>x.status==="AUSENTE").map(x=>x.schema+"."+x.name);
 const priorityMissing=rows.filter(x=>x.status==="AUSENTE"&&x.priority===1).map(x=>x.schema+"."+x.name);
 const date=typeof manifest.data_utc==="string"&&Number.isFinite(Date.parse(manifest.data_utc))
  ?manifest.data_utc:"";
 return{
  institution:String(manifest.instituicao),database:"UNI_GIZ_HOMOLOGACAO",readonly:true,
  expected:EXPECTED_COUNT,found,missing,extraDeclared:Number(manifest.tabelas_adicionais),
  missingNames,priorityMissing,
  manifestSha:await uniGizSha256(manifestFile),tablesSha,
  catalogSha:UNI_GIZ_CATALOG_SHA256,querySha:UNI_GIZ_QUERY_SHA256,
  reportedAt:date,rows,
  warning:"Conferência de formato, hashes e nomes no navegador; o servidor ainda precisa auditar as evidências. Linhas estimadas não são alunos nem matrículas. Nenhuma importação ao BI foi realizada."
 };
}
