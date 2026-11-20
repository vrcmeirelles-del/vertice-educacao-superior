/**
 * Avalia 360° — emissão de PDFs nominais na HOMOLOGAÇÃO VISUAL.
 * Tokens locais opacos sem identidade acadêmica verificável: QR não é corrigível
 * automaticamente nem consultável no Supabase. Não é prova oficial.
 */
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import QRCode from 'qrcode';
import type {QuestionDraft} from './question-draft';

export interface PrintStudent { id:string;name:string;registration?:string;selected:boolean; }
export interface PrintAssessment {
 institutionName:string;courseName:string;discipline:string;title:string;
 semester:string;classLabel:string;questions:QuestionDraft[];
}
export interface PrintIssue { student:PrintStudent;token:string;paperId:string; }
/** Bloqueios de emissão — nenhuma prova incompleta é considerada pronta. */
export function validatePrintAssessment(info:PrintAssessment):string[]{
 const issues:string[]=[];
 if(!info.courseName.trim()||!info.discipline.trim()||!info.title.trim()||!info.classLabel.trim())
  issues.push('Curso, disciplina, título e turma são obrigatórios.');
 if(!info.questions.length)issues.push('A avaliação precisa conter questões.');
 info.questions.forEach((q,i)=>{
  const prefix='Questão '+(i+1)+': ';
  if(q.statement.trim().length<10)issues.push(prefix+'enunciado incompleto.');
  if(!Number.isFinite(q.points)||q.points<=0)issues.push(prefix+'pontuação inválida.');
  if(q.images.length)issues.push(prefix+'a emissão PDF ainda não incorpora imagens.');
  if(q.kind==='objetiva'){
   if(q.options.length<2||q.options.some(o=>!o.text.trim()))issues.push(prefix+'alternativas incompletas.');
   if(!q.options.some(o=>o.id===q.correctOptionId))issues.push(prefix+'gabarito não selecionado.');
   if(new Set(q.options.map(o=>o.text.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'))).size!==q.options.length)
    issues.push(prefix+'alternativas duplicadas.');
  }else{
   if(!q.rubric.trim())issues.push(prefix+'rubrica da discursiva ausente.');
   if(!q.expectedAnswer?.trim())issues.push(prefix+'padrão de resposta esperado ausente.');
  }
 });
 return issues;
}

export function prepareIssues(students:PrintStudent[],batchId:string):PrintIssue[]{
 const selected=students.filter(s=>s.selected);
 if(!batchId||selected.length===0)throw new Error('Selecione ao menos um estudante.');
 const seen=new Set<string>();
 return selected.map(student=>{
  if(!student.id.trim()||!student.name.trim())throw new Error('Estudante sem identificação.');
  if(seen.has(student.id))throw new Error('Identificador duplicado de estudante.');
  seen.add(student.id);
  return {student,paperId:crypto.randomUUID(),
    token:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};
 });
}
function wrap(text:string,max=91):string[]{
 const words=text.replace(/\s+/g,' ').trim().split(' ');
 const lines:string[]=[];let line='';
 for(const word of words){
  if(line.length+word.length+1>max&&line){lines.push(line);line='';}
  line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 return lines.length?lines:[''];
}
function safeName(name:string){return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 -]/g,'').slice(0,140);}
function safePrint(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');}

/** Cada aluno recebe prova independente, identificada só por token aleatório no QR.
 * QR é 'VA360:' + token aleatório, não contém matrícula ou CPF.
 * O QR precisa ser registrado pelo backend autenticado antes de uso real.
 */
export async function buildIndividualizedPdf(info:PrintAssessment,issues:PrintIssue[]):Promise<Uint8Array>{
 const invalid=validatePrintAssessment(info);
 if(invalid.length)throw new Error(invalid.join(' '));
 if(!issues.length)throw new Error('Lote vazio.');
 if(issues.length>120)throw new Error('Limite demonstrativo de 120 provas por lote.');
 const doc=await PDFDocument.create();
 const regular=await doc.embedFont(StandardFonts.Helvetica);
 const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const width=595,height=842,left=45,right=550;
 const text=(page:ReturnType<typeof doc.addPage>,s:string,x:number,y:number,size=10,strong=false)=>
  page.drawText(safePrint(s).slice(0,250),{x,y,size,font:strong?bold:regular,color:rgb(.13,.21,.33)});
 for(const issue of issues){
  let page=doc.addPage([width,height]);let y=793;
  const newline=(min=30)=>{if(y<min){page=doc.addPage([width,height]);y=793;}};
  text(page,info.institutionName||'Instituição de ensino — demonstração',left,y,13,true);y-=24;
  text(page,info.title||'Avaliação demonstrativa',left,y,14,true);y-=22;
  text(page,'Curso: '+info.courseName+' | Disciplina: '+info.discipline,left,y,10);y-=17;
  text(page,'Turma: '+info.classLabel+' | Semestre: '+info.semester,left,y,10);y-=22;
  text(page,'Estudante: '+issue.student.name,left,y,12,true);y-=18;
  text(page,'Identificação informada: '+(issue.student.registration||'sem matrícula conferida'),left,y,10);y-=27;
  page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.75,color:rgb(.70,.75,.82)});y-=23;
  const png=await QRCode.toDataURL('VA360:'+issue.token,{errorCorrectionLevel:'M',margin:2,width:180});
  const img=await doc.embedPng(png);
  page.drawImage(img,{x:438,y:height-170,width:92,height:92});
  text(page,'QR de identificação local',436,height-176,6);
  text(page,'ID da folha: '+issue.paperId.slice(0,13),left,y,9);y-=24;
  for(const [i,q] of info.questions.entries()){
   newline(150);
   const lines=wrap((i+1)+'. '+q.statement,94);
   for(const ln of lines){newline(60);text(page,ln,left,y,10,true);y-=15;}
   text(page,'Valor: '+q.points+' ponto(s)',left,y,8);y-=17;
   if(q.kind==='objetiva'){
    for(const option of q.options){
     for(const ln of wrap(option.id+') '+option.text,95)){
      newline(52);text(page,ln,left+14,y,9);y-=13;
     }
    }
    y-=15;
   }else{
    y-=12;for(let j=0;j<5;j++){
     newline(40);
     page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.45,color:rgb(.7,.75,.8)});
     y-=29;
    }y-=10;
   }
  }
  newline(85);text(page,'Prévia não oficial • QR sem cadastro no banco • não usar para correção automática',left,40,8);
 }
 return doc.save();
}

export function downloadPdf(bytes:Uint8Array,name:string):void{
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=safeName(name)+'.pdf';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
