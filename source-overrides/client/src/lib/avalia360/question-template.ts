/**
 * Avalia 360° — modelo de planilha (.xlsx) para os professores elaborarem questões.
 * Abas: "Instruções", "Cabeçalho" (dados da avaliação, já preenchidos com o que está na tela)
 * e "Questões" (colunas lidas por question-spreadsheet.ts, com listas de valores permitidos).
 * Gerado no navegador, sem servidor: XML do Office Open XML compactado com fflate.
 */
import {zipSync,strToU8} from 'fflate';

export const HEADER_FIELDS=[
 ['Curso','Nome do curso, como aparece no portal.'],
 ['Disciplina','Ex.: Direito Civil.'],
 ['Semestre','Formato AAAA/1 ou AAAA/2.'],
 ['Finalidade predominante','Diagnóstica, Formativa ou Somativa.'],
 ['Título da avaliação','Ex.: Avaliação de Direito Civil — AV1.'],
 ['Nome do professor','Nome que aparece na prova.'],
 ['Instruções da avaliação','Texto que aparece no início da prova.'],
] as const;
export type HeaderField=typeof HEADER_FIELDS[number][0];
export type HeaderValues=Partial<Record<HeaderField,string>>;

export const QUESTION_COLUMNS=[
 ['Tipo','Obrigatório. Objetiva ou Discursiva.'],
 ['Enunciado','Obrigatório. Pelo menos 10 caracteres.'],
 ['Pontuação','Obrigatório. Número positivo (ex.: 1 ou 1,5).'],
 ['Dificuldade','Obrigatório. Inteiro de 1 (fácil) a 5 (difícil).'],
 ['Finalidade','Obrigatório. Diagnóstica, Formativa ou Somativa.'],
 ['Alternativa A','Objetiva: preencha pelo menos duas alternativas.'],
 ['Alternativa B',''],['Alternativa C',''],['Alternativa D',''],['Alternativa E',''],
 ['Gabarito','Objetiva: letra de uma alternativa preenchida.'],
 ['Justificativa do gabarito','Objetiva: obrigatório.'],
 ['Resposta esperada','Discursiva: obrigatório.'],
 ['Rubrica de correção','Discursiva: obrigatório (critérios e pontos).'],
 ['Linhas de resposta','Discursiva: inteiro de 3 a 60 (padrão 8).'],
 ['Tema','Opcional. Deve coincidir com um tema do catálogo do curso.'],
 ['Subtema','Opcional.'],
 ['Competências','Opcional. Códigos ou títulos separados por vírgula (ex.: C1, C2).'],
 ['Exames','Opcional. Ex.: ENADE, OAB (separados por vírgula).'],
 ['Palavras-chave','Opcional.'],
 ['Arquivo de imagem','Opcional. Nome do arquivo; a imagem é anexada depois, na revisão da questão.'],
 ['Posição da imagem','Opcional. Ex.: antes do enunciado.'],
 ['Legenda','Opcional.'],
 ['Descrição acessível','Opcional. Descrição da imagem para leitores de tela.'],
] as const;

const EXAMPLES:string[][]=[
 ['Objetiva','Sobre a capacidade civil, assinale a alternativa correta de acordo com o Código Civil.','1','3','Formativa',
  'Os menores de 16 anos são absolutamente incapazes.','Os maiores de 16 anos são plenamente capazes.','Os pródigos são absolutamente incapazes.',
  'A incapacidade não admite cessação.','A emancipação depende sempre de sentença.','A','Art. 3º do Código Civil.','','','','Parte Geral','Capacidade civil','C1','OAB','capacidade; incapacidade','','','',''],
 ['Discursiva','Explique a diferença entre prescrição e decadência, com um exemplo de cada.','2','4','Somativa',
  '','','','','','','','Prescrição atinge a pretensão; decadência atinge o próprio direito potestativo. Exemplos coerentes.',
  'Conceito de prescrição (0,5); conceito de decadência (0,5); exemplos corretos (1,0).','10','Parte Geral','Prescrição e decadência','C1, C2','ENADE','','','','',''],
];

const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const col=(i:number)=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;};
const cell=(r:number,c:number,v:string,style=0)=>v===''&&!style?'':`<c r="${col(c)}${r}" t="inlineStr"${style?` s="${style}"`:''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
function sheet(rows:string[][],opts:{widths:number[];headerRow?:boolean;freeze?:boolean;validations?:string}){
 const cols=`<cols>${opts.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
 const pane=opts.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'';
 const body=rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cell(ri+1,ci,v,opts.headerRow&&ri===0?1:2)).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${body}</sheetData>${opts.validations??''}</worksheet>`;
}
const list=(range:string,values:string[])=>`<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${range}"><formula1>"${values.join(',')}"</formula1></dataValidation>`;

export interface TemplateInput {header:HeaderValues;competencyCodes?:string[];topics?:string[]}

export function buildQuestionTemplate(input:TemplateInput):Uint8Array{
 const instructions:string[][]=[
  ['Modelo de questões — Avalia 360°'],
  [''],
  ['1. Confira a aba Cabeçalho: ela traz os dados da avaliação. O que você preencher lá é aplicado ao importar.'],
  ['2. Escreva uma questão por linha na aba Questões, a partir da linha 2. As duas linhas de exemplo podem ser apagadas ou substituídas.'],
  ['3. Não altere os títulos da linha 1 da aba Questões.'],
  ['4. Linhas com erro são apontadas na importação; nada é salvo até você conferir e salvar o rascunho.'],
  ['5. Imagens: informe o nome do arquivo e anexe a imagem na revisão da questão, depois de importar.'],
  ...(input.competencyCodes?.length?[[''],['Competências do curso: '+input.competencyCodes.join(', ')]]:[]),
  ...(input.topics?.length?[['Temas do catálogo: '+input.topics.join(', ')]]:[]),
  [''],['Colunas da aba Questões'],
  ...QUESTION_COLUMNS.map(([name,help])=>[`• ${name}${help?': '+help:''}`]),
 ];
 const header:string[][]=[['Campo','Valor','Orientação'],...HEADER_FIELDS.map(([f,help])=>[f,input.header[f]??'',help])];
 const purpose=input.header['Finalidade predominante']||'Formativa';
 const examples=EXAMPLES.map(r=>{const x=[...r];x[4]=x[4]||purpose;return x;});
 const questions:string[][]=[QUESTION_COLUMNS.map(([n])=>n),...examples];
 const validations=`<dataValidations count="4">${list('A2:A500',['Objetiva','Discursiva'])}${list('D2:D500',['1','2','3','4','5'])}${list('E2:E500',['Diagnóstica','Formativa','Somativa'])}${list('K2:K500',['A','B','C','D','E'])}</dataValidations>`;
 const headerValidation=`<dataValidations count="1">${list('B5',['Diagnóstica','Formativa','Somativa'])}</dataValidations>`;
 const sheets=[
  ['Instruções',sheet(instructions,{widths:[120]})],
  ['Cabeçalho',sheet(header,{widths:[28,60,48],headerRow:true,validations:headerValidation})],
  ['Questões',sheet(questions,{widths:QUESTION_COLUMNS.map(([n])=>n==='Enunciado'?60:/Alternativa|Justificativa|Resposta|Rubrica/.test(n)?36:16),headerRow:true,freeze:true,validations})],
 ] as const;
 const files:Record<string,Uint8Array>={
  '[Content_Types].xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
  '_rels/.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
  'xl/workbook.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="2"/></bookViews><sheets>${sheets.map(([n],i)=>`<sheet name="${esc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`),
  'xl/_rels/workbook.xml.rels':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
  'xl/styles.xml':strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0A3775"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
 };
 sheets.forEach(([,xml],i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(xml);});
 return zipSync(files,{level:6});
}

/** Lê a aba Cabeçalho (Campo | Valor). Campos desconhecidos são ignorados. */
export function parseHeaderRows(rows:unknown[][]):HeaderValues{
 const norm=(v:string)=>v.trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const known=new Map(HEADER_FIELDS.map(([f])=>[norm(f),f]));
 const out:HeaderValues={};
 for(const r of rows.slice(1)){
  const field=known.get(norm(String(r?.[0]??'')));const value=String(r?.[1]??'').trim();
  if(field&&value)out[field]=value;
 }
 return out;
}

/** Questão recém-criada e ainda intocada (sem enunciado, alternativas, respostas nem imagens). */
export function isBlankQuestion(q:{statement:string;options:{text:string}[];answerJustification?:string;expectedAnswer?:string;rubric?:string;images?:unknown[];correctOptionId?:string}){
 const t=(v?:string)=>!(v??'').trim();
 return t(q.statement)&&q.options.every(o=>t(o.text))&&t(q.answerJustification)&&t(q.expectedAnswer)&&t(q.rubric)&&!(q.images?.length)&&t(q.correctOptionId);
}
