/**
 * Avalia 360° — emissão de PDFs nominais na HOMOLOGAÇÃO VISUAL.
 * Tokens locais opacos sem identidade acadêmica verificável: QR não é corrigível
 * automaticamente nem consultável no Supabase. Não é prova oficial.
 */
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import QRCode from 'qrcode';
import type {QuestionDraft} from './question-draft';
import type {PendingQuestionImage} from './QuestionImageField';
import {createExamVariants,versioningNotice,type ShuffleMode} from './exam-variants';

export interface PrintStudent { id:string;name:string;registration?:string;selected:boolean; }
export interface PrintAssessment {
 institutionName:string;courseName:string;discipline:string;title:string;
 semester:string;classLabel:string;questions:QuestionDraft[];
 variantCount?:number;shuffleMode?:ShuffleMode;
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
  for(const [j,figure] of q.images.entries()){
   if(!figure.altText.trim())issues.push(prefix+'descrição acessível da imagem '+(j+1)+' ausente.');
   if(figure.rightsStatus==='nao_informado')issues.push(prefix+'direito de uso da imagem '+(j+1)+' não confirmado.');
   if(!['image/png','image/jpeg','image/webp'].includes(figure.file?.type||''))
    issues.push(prefix+'formato de imagem '+(j+1)+' não suportado.');
   if(figure.placement==='alternativa'&&(!figure.alternativeId||!q.options.some(o=>o.id===figure.alternativeId)))
    issues.push(prefix+'imagem vinculada a alternativa inexistente.');
  }
  if(q.kind==='objetiva'){
   if(!q.answerJustification?.trim())issues.push(prefix+'justificativa da resposta objetiva ausente.');
   if(q.options.length<2||q.options.some(o=>!o.text.trim()))issues.push(prefix+'alternativas incompletas.');
   if(!q.options.some(o=>o.id===q.correctOptionId))issues.push(prefix+'gabarito não selecionado.');
   if(new Set(q.options.map(o=>o.text.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'))).size!==q.options.length)
    issues.push(prefix+'alternativas duplicadas.');
  }else{
   if(!Number.isInteger(q.answerLines??8)||(q.answerLines??8)<3||(q.answerLines??8)>60)issues.push(prefix+'informe de 3 a 60 linhas na discursiva.');
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

/** Converte apenas WebP em PNG via canvas do navegador; PNG/JPEG permanecem intactos. */
async function embedFigure(pdf:PDFDocument,figure:PendingQuestionImage){
 const bytes=new Uint8Array(await figure.file.arrayBuffer());
 if(figure.file.type==='image/png')return pdf.embedPng(bytes);
 if(figure.file.type==='image/jpeg')return pdf.embedJpg(bytes);
 if(figure.file.type!=='image/webp')throw Error('Formato de imagem não suportado.');
 if(typeof createImageBitmap!=='function'||typeof document==='undefined')
  throw Error('Este navegador não suporta conversão de WebP para PDF. Use PNG ou JPEG.');
 const bitmap=await createImageBitmap(figure.file);
 try{
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Conversão da imagem indisponível neste navegador.');
  ctx.drawImage(bitmap,0,0);
  return pdf.embedPng(canvas.toDataURL('image/png'));
 }finally{bitmap.close();}
}
/** Protege o desenho e a proporção da figura, preservando o enunciado e as alternativas. */
function figureSize(width:number,height:number,maxWidth:number,maxHeight:number){
 const factor=Math.min(maxWidth/width,maxHeight/height,1);
 return {width:width*factor,height:height*factor};
}

/** Cada aluno recebe prova independente, identificada só por token aleatório no QR.
 * QR é 'VA360:' + token aleatório, não contém matrícula ou CPF.
 * O QR precisa ser registrado pelo backend autenticado antes de uso real.
 */
/** Prova A4 em duas colunas e cartão de respostas em página separada.
 * A mesma identificação opaca aparece no caderno e no cartão.
 * Nenhum gabarito/justificativa/padrão docente é impresso no material discente.
 */
export async function buildIndividualizedPdf(info:PrintAssessment,issues:PrintIssue[]):Promise<Uint8Array>{
 const invalid=validatePrintAssessment(info);
 if(invalid.length)throw Error(invalid.join(' '));
 if(!issues.length)throw Error('Lote vazio.');
 if(issues.length>120)throw Error('Limite demonstrativo de 120 provas por lote.');
 const variantCount=info.variantCount??1,mode=info.shuffleMode??'ambos';
 const impossible=versioningNotice(info.questions,variantCount,mode);
 if(impossible)throw Error(impossible);
 const variants=createExamVariants(info.questions,variantCount,mode);
 const doc=await PDFDocument.create();
 const regular=await doc.embedFont(StandardFonts.Helvetica);
 const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const W=595,H=842,margin=43,top=793,bottom=54;
 const gutter=18,colWidth=(W-margin*2-gutter)/2;
 const columns=[margin,margin+colWidth+gutter];
 const ink=rgb(.12,.19,.32),muted=rgb(.43,.50,.59),pale=rgb(.82,.86,.91);
 type PdfPage=ReturnType<typeof doc.addPage>;
 const lineText=(page:PdfPage,content:string,x:number,y:number,size=10,strong=false)=>{
  page.drawText(safePrint(content),{x,y,size,font:strong?bold:regular,color:ink});
 };
 const wrapMeasured=(content:string,size:number,maxWidth:number,strong=false)=>{
  const font=strong?bold:regular;
  const lines:string[]=[];
  for(const part of content.split(/\r?\n/)){
   let line='';
   for(const token of part.split(/\s+/)){
    if(!token)continue;
    const candidate=line?line+' '+token:token;
    if(font.widthOfTextAtSize(safePrint(candidate),size)<=maxWidth){line=candidate;continue;}
    if(line){lines.push(line);line='';}
    let piece='';
    for(const ch of token){
     if(font.widthOfTextAtSize(safePrint(piece+ch),size)>maxWidth&&piece){lines.push(piece);piece='';}
     piece+=ch;
    }
    line=piece;
   }
   lines.push(line);
  }
  return lines;
 };
 const images=new Map<string,Awaited<ReturnType<typeof embedFigure>>>();
 for(let studentIndex=0;studentIndex<issues.length;studentIndex++){
  const issue=issues[studentIndex],variant=variants[studentIndex%variants.length];
  let page=doc.addPage([W,H]),col=0,y=651;
  // Versionamento no QR sem expor nome, matrícula ou identificador acadêmico.
  // O token é demonstrativo: falta registro autenticado de emissão e conferência no backend.
  const qrPayload='VA360-DEMO:1:'+variant.code+':'+issue.token;
  const qrData=await QRCode.toDataURL(qrPayload,{errorCorrectionLevel:'M',margin:2,width:220});
  const qr=await doc.embedPng(qrData);
  const bookHeader=()=>{
   lineText(page,info.institutionName||'Instituição demonstrativa',margin,top,13,true);
   lineText(page,info.title||'Avaliação demonstrativa',margin,top-23,12,true);
   lineText(page,'Curso: '+info.courseName+'  |  Disciplina: '+info.discipline,margin,top-40,9);
   lineText(page,'Turma: '+info.classLabel+'  |  Semestre: '+info.semester,margin,top-55,9);
   lineText(page,'Estudante: '+issue.student.name,margin,top-76,10,true);
   lineText(page,'Identificação: '+(issue.student.registration||'demonstração'),margin,top-91,9);
   lineText(page,'Versão '+variant.code+'  |  Folha '+issue.paperId.slice(0,12),margin,top-106,9,true);
   page.drawImage(qr,{x:W-145,y:top-100,width:82,height:82});
   page.drawLine({start:{x:margin,y:top-118},end:{x:W-margin,y:top-118},thickness:.8,color:pale});
   lineText(page,'CADERNO EM DUAS COLUNAS · QR DEMONSTRATIVO SEM REGISTRO',margin,top-137,7);
  };
  bookHeader();
  const advance=()=>{
   if(col===0){col=1;y=651;}
   else{
    page=doc.addPage([W,H]);col=0;y=top;
    lineText(page,'Continuação · '+issue.student.name+' · Versão '+variant.code,margin,top+20,8,true);
   }
  };
  const space=(needed:number)=>{if(y-needed<bottom)advance();};
  const write=(text:string,size=9.5,leading=14,strong=false,indent=0)=>{
   for(const t of wrapMeasured(text,size,colWidth-indent,strong)){
    space(leading);
    lineText(page,t,columns[col]+indent,y,size,strong);
    y-=leading;
   }
  };
  const renderFigure=async(figure:PendingQuestionImage)=>{
   let fig=images.get(figure.localId);
   if(!fig){fig=await embedFigure(doc,figure);images.set(figure.localId,fig);}
   const dims=figureSize(fig.width,fig.height,colWidth-12,190);
   const captions=wrapMeasured(figure.caption.trim()||figure.altText.trim(),7.5,colWidth-10);
   space(dims.height+captions.length*11+21);
   page.drawImage(fig,{x:columns[col]+6,y:y-dims.height,width:dims.width,height:dims.height});
   y-=dims.height+12;
   for(const caption of captions){write(caption,7.5,11,false,6);}
   y-=7;
  };
  for(const item of variant.items){
   const q=item.question;
   space(60);
   write('QUESTÃO '+item.displayNumber+'  ·  '+q.points+' ponto(s)',9.5,16,true);
   write(q.statement,9,13,false);
   y-=8;
   for(const figure of q.images.filter(f=>f.placement!=='alternativa'))
    await renderFigure(figure);
   if(q.kind==='objetiva'){
    for(const option of item.options){
     write(option.label+') '+option.text,8.7,13,false,7);
     const original=q.options.find(o=>o.id===option.sourceOptionId);
     if(original)for(const figure of q.images.filter(f=>f.placement==='alternativa'&&f.alternativeId===original.id))
      await renderFigure(figure);
    }
    y-=13;
   }else{
    const lines=q.answerLines??8;
    write('Espaço para resposta ('+lines+' linhas)',8,12);
    // 12 pt de referência e 18 pt entre pautas: entrelinha 1,5.
    for(let j=0;j<lines;j++){
     space(18);
     page.drawLine({start:{x:columns[col]+3,y:y-3},end:{x:columns[col]+colWidth-4,y:y-3},
      thickness:.48,color:pale});
     y-=18;
    }
    y-=13;
   }
  }
  // Página própria: o cartão não usa a paginação em colunas do caderno.
  const objective=variant.items.filter(i=>i.question.kind==='objetiva');
  let card=doc.addPage([W,H]),cardY=top-130;
  const cardHead=(continuation=false)=>{
   lineText(card,'CARTÃO DE RESPOSTAS · '+(continuation?'CONTINUAÇÃO':'VERSÃO '+variant.code),margin,top,13,true);
   lineText(card,'Estudante: '+issue.student.name,margin,top-23,10,true);
   lineText(card,'Turma: '+info.classLabel+' · Disciplina: '+info.discipline,margin,top-41,9);
   lineText(card,'Versão '+variant.code+' · Folha '+issue.paperId.slice(0,12),margin,top-56,9,true);
   card.drawImage(qr,{x:W-145,y:top-99,width:84,height:84});
   card.drawLine({start:{x:margin,y:top-111},end:{x:W-margin,y:top-111},thickness:.8,color:pale});
   cardY=top-132;
  };
  cardHead();
  if(!objective.length){lineText(card,'Sem questões objetivas. Responda às discursivas no caderno.',margin,cardY,10);}
  for(const [rowIndex,item] of objective.entries()){
   if(rowIndex%2===0&&cardY<bottom+35){card=doc.addPage([W,H]);cardHead(true);}
   const x=margin+(rowIndex%2===1?260:0),rowY=cardY;
   lineText(card,'Q'+String(item.displayNumber).padStart(2,'0'),x,rowY,9,true);
   const gap=item.options.length>6?23:29;
   item.options.forEach((op,j)=>{
    const cx=x+50+j*gap;
    card.drawCircle({x:cx,y:rowY+4,size:9,borderWidth:1.1,borderColor:ink});
    lineText(card,op.label,cx-2.7,rowY+1,7);
   });
   if(rowIndex%2===1||rowIndex===objective.length-1)cardY-=29;
  }
  lineText(card,'Preencha apenas uma opção por questão. QR identifica a folha, NÃO lê respostas automaticamente.',margin,48,7);
  lineText(card,'PRÉVIA NÃO OFICIAL · QR SEM CADASTRO NO BANCO',margin,34,7);
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
