/**
 * Gerador mínimo de .xlsx (Office Open XML) no navegador, com fflate. Sem servidor e sem dependência pesada.
 * Células: texto, número, número em percentual ou vazio. Linha 1 opcionalmente como cabeçalho (fundo azul).
 */
import {zipSync,strToU8} from 'fflate';

export type XlsxCell=string|number|null|{percent:number};
export interface XlsxSheet {name:string;rows:XlsxCell[][];widths?:number[];headerRow?:boolean;freeze?:boolean;validations?:string}

const esc=(v:string)=>v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const colName=(i:number)=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;};
/** Fórmulas não são geradas: texto iniciado por = + - @ vira texto literal (sem risco de injeção). */
function cell(r:number,c:number,v:XlsxCell,header:boolean):string{
 const ref=colName(c)+r;
 if(v===null||v==='')return header?`<c r="${ref}" s="1"/>`:'';
 if(typeof v==='number')return Number.isFinite(v)?`<c r="${ref}" s="${header?1:3}"><v>${v}</v></c>`:'';
 if(typeof v==='object')return Number.isFinite(v.percent)?`<c r="${ref}" s="4"><v>${v.percent}</v></c>`:'';
 return `<c r="${ref}" t="inlineStr" s="${header?1:2}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}
function sheetXml(s:XlsxSheet){
 const cols=s.widths?.length?`<cols>${s.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:'';
 const pane=s.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'';
 const body=s.rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cell(ri+1,ci,v,Boolean(s.headerRow&&ri===0))).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${body}</sheetData>${s.validations??''}</worksheet>`;
}
export const listValidation=(range:string,values:string[])=>`<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${range}"><formula1>"${values.join(',')}"</formula1></dataValidation>`;

export function buildXlsx(sheets:XlsxSheet[],activeTab=0):Uint8Array{
 const names=new Set<string>();
 for(const s of sheets){if(!s.name||s.name.length>31||/[\\/?*[\]:]/.test(s.name)||names.has(s.name))throw Error('Nome de aba inválido: '+s.name);names.add(s.name);}
 const files:Record<string,Uint8Array>={
  '[Content_Types].xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
  '_rels/.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
  'xl/workbook.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${activeTab}"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`),
  'xl/_rels/workbook.xml.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
  'xl/styles.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0A3775"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
 };
 sheets.forEach((s,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(sheetXml(s));});
 return zipSync(files,{level:6});
}
export function downloadXlsx(bytes:Uint8Array,filename:string){
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=filename.replace(/[^\p{L}\p{N} ._-]/gu,'_');
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
