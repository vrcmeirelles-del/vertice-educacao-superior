/** Importação conservadora: apenas CSV e JSON tabular; nenhum dado individual é enviado ao BI.
 * Leitura local no navegador, sem parser OCR ou equivalência automática de colunas.
 */
export type InputRow=Record<string,unknown>;
export type Mapping={indicator:string;period:string;value:string;unit:string};
export type Indicator={indicador:string;periodo:string;valor:number;unidade:string};
export function parseCsv(input:string):InputRow[]{
 const first=(input.replace(/^\uFEFF/,"").split(/\r?\n/)[0]??"");
 const separator=[";","\t",","].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const records:string[][]=[];let line:string[]=[],cell="",quoted=false;
 const text=input.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
  }else if(ch===separator&&!quoted){line.push(cell.trim());cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&text[i+1]==="\n")i++;
   line.push(cell.trim());cell="";if(line.some(Boolean))records.push(line);line=[];
  }else cell+=ch;
 }
 if(quoted)throw new Error("CSV possui aspas sem fechamento.");
 line.push(cell.trim());if(line.some(Boolean))records.push(line);
 if(records.length<2)throw new Error("A planilha não contém cabeçalho e registros.");
 if(records.length>501)throw new Error("Mais de 500 registros: envie um recorte para análise individual.");
 const header=records.shift()!.map(v=>v.trim());
 if(header.some(h=>!h)||new Set(header.map(h=>h.toLowerCase())).size!==header.length)throw new Error("Cabeçalhos vazios ou repetidos.");
 return records.map(row=>{
  if(row.length!==header.length)throw new Error("Linha CSV com número de colunas divergente.");
  return Object.fromEntries(header.map((key,i)=>[key,row[i]]));
 });
}
export function parseTabular(text:string,ext:string):InputRow[]{
 let rows:unknown;
 if(ext==="csv"||ext==="txt")rows=parseCsv(text);
 else if(ext==="json"){
  const object=JSON.parse(text);
  rows=Array.isArray(object)?object:Array.isArray(object?.registros)?object.registros:Array.isArray(object?.dados)?object.dados:null;
 }else throw new Error("A curadoria estruturada aceita CSV ou JSON. Para XLSX, exporte CSV; PDF/HTML/XML permanecem como fontes documentais.");
 if(!Array.isArray(rows)||!rows.length||rows.length>500||rows.some(x=>!x||typeof x!=="object"||Array.isArray(x)))
  throw new Error("A fonte deve conter de 1 a 500 registros tabulares.");
 return rows as InputRow[];
}
export function guessMapping(headers:string[]):Mapping{
 const resolve=(terms:string[])=>headers.find(h=>terms.some(t=>h.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]/gu,"").includes(t)))??"";
 return {indicator:resolve(["indicador","indicadoracademico","metrica","metric","titulo","nome"]),
 period:resolve(["semestre","competencia","periodo","term","semester"]),
 value:resolve(["valor","quantidade","total","value","matriculados"]),
 unit:resolve(["unidade","unit","tipo"])};
}
export function normalizeInput(rows:InputRow[],mapping:Mapping,defaultUnit:string):Indicator[]{
 if(!mapping.indicator||!mapping.period||!mapping.value)throw new Error("Associe as colunas de indicador, período e valor.");
 const seen=new Set<string>();
 return rows.map((row,i)=>{
  const indicador=String(row[mapping.indicator]??"").trim();
  const rawPeriod=String(row[mapping.period]??"").trim();
  const parts=/^(20\d\d)[-/](0?[12])$/.exec(rawPeriod);
  const periodo=parts?parts[1]+"/"+String(Number(parts[2])).padStart(2,"0"):rawPeriod;
  const text=String(row[mapping.value]??"").trim();
  // Not accept ambiguous thousand separators such as "1.987" without an explicit decision.
  if(!/^-?\d+(?:[.,]\d{1,2})?$/.test(text))throw new Error("Linha "+(i+1)+": valor inválido/ambíguo ("+text.slice(0,30)+"). Revise o separador e a unidade.");
  const valor=Number(text.replace(",","."));
  const unidade=(mapping.unit?String(row[mapping.unit]??""):defaultUnit).trim();
  if(indicador.length<3||indicador.length>150||!/^20\d\d\/0?[12]$/.test(periodo)
   ||!Number.isFinite(valor)||Math.abs(valor)>1e12||unidade.length>30)
   throw new Error("Linha "+(i+1)+": indicador, competência, valor ou unidade inválidos.");
  const key=indicador.toLocaleLowerCase("pt-BR")+"|"+periodo;
  if(seen.has(key))throw new Error("Duplicidade de indicador/competência no arquivo: "+indicador+" · "+periodo);
  seen.add(key);
  return {indicador,periodo,valor,unidade};
 });
}
