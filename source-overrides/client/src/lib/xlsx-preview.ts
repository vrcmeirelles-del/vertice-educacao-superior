/**
 * XLSX preview on the user's device. ZIP package is inspected in memory.
 * Caps protect against high expansion ratios and unexpected external references.
 * No upload, formulas are never executed, and the source remains immutable.
 */
export type WorkbookSheet={name:string;path:string};
const dec=new TextDecoder("utf-8",{fatal:true});
function xml(source:string):Document{
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error("XML de planilha com entidades externas não é permitido.");
 const doc=new DOMParser().parseFromString(source,"application/xml");
 if(doc.querySelector("parsererror"))throw new Error("XML interno da planilha inválido.");
 return doc;
}
function endOfZip(v:DataView):number{
 for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){
  if(v.getUint32(i,true)===0x06054b50)return i;
 }
 throw new Error("Arquivo XLSX não contém um ZIP válido.");
}
export class XlsxArchive{
 private view:DataView;
 private bytes:Uint8Array;
 private entries=new Map<string,{method:number;offset:number;packed:number;expanded:number}>();
 constructor(buffer:ArrayBuffer){
  this.view=new DataView(buffer);this.bytes=new Uint8Array(buffer);
  if(buffer.byteLength>5*1024*1024)throw new Error("XLSX acima de 5 MB: gere um recorte menor para a curadoria.");
  const at=endOfZip(this.view);
  const count=this.view.getUint16(at+10,true),start=this.view.getUint32(at+16,true);
  if(count>200)throw new Error("XLSX contém arquivos internos demais.");
  let cursor=start,total=0;
  for(let i=0;i<count;i++){
   if(this.view.getUint32(cursor,true)!==0x02014b50)throw new Error("Diretório ZIP inválido.");
   const method=this.view.getUint16(cursor+10,true),packed=this.view.getUint32(cursor+20,true);
   const expanded=this.view.getUint32(cursor+24,true),nameLen=this.view.getUint16(cursor+28,true);
   const extra=this.view.getUint16(cursor+30,true),comment=this.view.getUint16(cursor+32,true);
   const offset=this.view.getUint32(cursor+42,true);
   if(method!==0&&method!==8)throw new Error("Método ZIP não suportado.");
   const name=dec.decode(this.bytes.subarray(cursor+46,cursor+46+nameLen));
   if(name.includes("..")||name.startsWith("/"))throw new Error("Caminho ZIP inválido.");
   total+=expanded;
   if(expanded>8*1024*1024||total>16*1024*1024||expanded>packed*250+65536)throw new Error("Conteúdo compactado excede limite seguro.");
   this.entries.set(name,{method,offset,packed,expanded});
   cursor+=46+nameLen+extra+comment;
  }
 }
 async read(path:string):Promise<string>{
  const info=this.entries.get(path);
  if(!info)throw new Error("Parte XLSX ausente: "+path);
  const p=info.offset;
  if(this.view.getUint32(p,true)!==0x04034b50)throw new Error("Cabeçalho ZIP inválido.");
  const start=p+30+this.view.getUint16(p+26,true)+this.view.getUint16(p+28,true);
  const packed=this.bytes.slice(start,start+info.packed);
  let out:Uint8Array;
  if(info.method===0)out=packed;
  else {
   try{
    const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    out=new Uint8Array(await new Response(stream).arrayBuffer());
   }catch{throw new Error("Não foi possível descompactar a planilha neste navegador.");}
  }
  if(out.byteLength!==info.expanded)throw new Error("Integridade da parte ZIP divergente.");
  return dec.decode(out);
 }
}
export async function xlsxSheets(archive:XlsxArchive):Promise<WorkbookSheet[]>{
 const workbook=xml(await archive.read("xl/workbook.xml"));
 const rels=xml(await archive.read("xl/_rels/workbook.xml.rels"));
 const targets=new Map<string,string>();
 for(const r of Array.from(rels.getElementsByTagName("Relationship"))){
  const target=r.getAttribute("Target")??"";
  if(r.getAttribute("TargetMode")==="External"||target.includes(".."))continue;
  const path=target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^\/+/,"").replace(/^xl\//,"");
  targets.set(r.getAttribute("Id")??"",path);
 }
 const sheets=Array.from(workbook.getElementsByTagName("sheet")).filter(s=>s.getAttribute("state")!=="hidden"&&s.getAttribute("state")!=="veryHidden");
 return sheets.map(s=>({name:s.getAttribute("name")??"Planilha",path:targets.get(s.getAttribute("r:id")??"")??""})).filter(s=>s.path.startsWith("xl/worksheets/"));
}
function colIndex(label:string):number{
 let v=0;for(const c of label.toUpperCase()){v=v*26+c.charCodeAt(0)-64;}return v-1;
}
export async function readXlsxRows(archive:XlsxArchive,sheet:WorkbookSheet):Promise<Record<string,unknown>[]>{
 const shared:string[]=[];
 try {
  const doc=xml(await archive.read("xl/sharedStrings.xml"));
  for(const node of Array.from(doc.getElementsByTagName("si"))){
   const texts=Array.from(node.getElementsByTagName("t")).map(t=>t.textContent??"");
   shared.push(texts.join(""));
  }
 }catch(e){if(!(e instanceof Error)||!e.message.startsWith("Parte XLSX ausente"))throw e;}
 const doc=xml(await archive.read(sheet.path));
 const xmlRows=Array.from(doc.getElementsByTagName("row"));
 if(xmlRows.length>501)throw new Error("XLSX contém mais de 500 registros; gere um recorte.");
 const matrix=xmlRows.map(r=>{
  const row:string[]=[];
  for(const cell of Array.from(r.getElementsByTagName("c"))){
   const location=cell.getAttribute("r")??"";
   const column=/^[A-Z]+/.exec(location)?.[0]??"";
   const index=colIndex(column);
   if(index<0||index>100)throw new Error("Mais de 100 colunas na planilha.");
   const kind=cell.getAttribute("t")??"";
   const raw=cell.getElementsByTagName("v")[0]?.textContent??"";
   const inline=cell.getElementsByTagName("is")[0]?.textContent??"";
   if(cell.getElementsByTagName("f").length&&!raw)throw new Error("Fórmula sem valor gravado. Exporte valores para CSV.");
   row[index]=kind==="s"?shared[Number(raw)]??"":kind==="inlineStr"?inline:raw;
  }
  return row;
 }).filter(x=>x.some(v=>v!==undefined&&v!==""));
 if(matrix.length<2)throw new Error("Planilha vazia ou sem linhas de dados.");
 const header=matrix.shift()!.map(x=>String(x??"").trim());
 if(header.some(h=>!h)||new Set(header.map(h=>h.toLowerCase())).size!==header.length)throw new Error("Cabeçalhos vazios ou duplicados.");
 return matrix.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]??""])));
}
