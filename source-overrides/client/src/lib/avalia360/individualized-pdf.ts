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
 institutionName:string;institutionLogo?:ArrayBuffer;courseName:string;discipline:string;title:string;instructions?:string;
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
function safePrint(value:string){return value.normalize('NFC').replace(/[^\x20-\x7e\xa0-\xff–—‘’“”]/gu,'?');}

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
/** Prova A4 com largura variável por questão e cartão de respostas em página separada.
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
 const institutionLogo=info.institutionLogo ? await doc.embedPng(info.institutionLogo) : undefined;
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
  let page=doc.addPage([W,H]),col=0,y=top;
  // Versionamento no QR sem expor nome, matrícula ou identificador acadêmico.
  // O token é demonstrativo: falta registro autenticado de emissão e conferência no backend.
  const qrPayload='VA360-DEMO:1:'+variant.code+':'+issue.token;
  const qrData=await QRCode.toDataURL(qrPayload,{errorCorrectionLevel:'M',margin:2,width:220});
  const qr=await doc.embedPng(qrData);
  const drawHeader=(target:PdfPage,heading:string,showGrade:boolean)=>{
   const right=W-margin;
   const qrWidth=88;
   const middleRight=right-qrWidth;
   const border=(x:number,y:number,width:number,height:number)=>{
    target.drawRectangle({x,y,width,height,borderWidth:.7,borderColor:muted});
   };
   const cell=(label:string,value:string,x:number,rowTop:number,width:number)=>{
    const lines=wrapMeasured(value,9,width-16,true);
    const height=20+lines.length*11;
    border(x,rowTop-height,width,height);
    lineText(target,label,x+8,rowTop-11,7);
    lines.forEach((line,i)=>lineText(target,line,x+8,rowTop-23-i*11,9,true));
    return height;
   };
   const logoSize=46;
   const nameX=margin+(institutionLogo?logoSize+18:8);
   const nameLines=wrapMeasured(info.institutionName||'Instituição demonstrativa',14,right-nameX-8,true);
   const nameHeight=Math.max(60,16+nameLines.length*16);
   border(margin,top-nameHeight,right-margin,nameHeight);
   if(institutionLogo){
    const dims=figureSize(institutionLogo.width,institutionLogo.height,logoSize,logoSize);
    target.drawImage(institutionLogo,{x:margin+8+(logoSize-dims.width)/2,
     y:top-(nameHeight+dims.height)/2,...dims});
   }
   nameLines.forEach((line,i)=>lineText(target,line,nameX,top-(nameHeight-nameLines.length*16)/2-12-i*16,14,true));

   const detailsTop=top-nameHeight;
   const detailsWidth=middleRight-margin;
   let rowTop=detailsTop;
   rowTop-=cell('Avaliação',heading,margin,rowTop,detailsWidth);
   rowTop-=cell('Curso / Disciplina',info.courseName+' / '+info.discipline,margin,rowTop,detailsWidth);
   rowTop-=cell('Estudante / Identificação',issue.student.name+' / '+(issue.student.registration||'demonstração'),
    margin,rowTop,detailsWidth);
   const gradeWidth=showGrade?92:0;
   const lastHeight=cell('Turma / Semestre / Versão / Folha',
    [info.classLabel,info.semester,variant.code,issue.paperId.slice(0,12)].join(' / '),
    margin,rowTop,detailsWidth-gradeWidth);
   if(showGrade){
    border(middleRight-gradeWidth,rowTop-lastHeight,gradeWidth,lastHeight);
    lineText(target,'Nota do professor',middleRight-gradeWidth+8,rowTop-11,7);
   }
   rowTop-=lastHeight;
   border(middleRight,rowTop,qrWidth,detailsTop-rowTop);
   const qrSize=72;
   target.drawImage(qr,{x:middleRight+(qrWidth-qrSize)/2,y:(detailsTop+rowTop-qrSize)/2,width:qrSize,height:qrSize});
   return rowTop-19;
  };
  const captionY=drawHeader(page,info.title,true);
  lineText(page,'CADERNO DE QUESTÕES - QR DEMONSTRATIVO SEM REGISTRO',margin,captionY,7);
  y=captionY-20;
  let fullWidth=true;
  let bandTop=y;
  const nextPage=()=>{
   page=doc.addPage([W,H]);col=0;y=top;bandTop=top;
   lineText(page,'Continuação · '+issue.student.name+' · Versão '+variant.code,margin,top+20,8,true);
  };
  const space=(needed:number)=>{
   if(y-needed>=bottom)return;
   if(!fullWidth&&col===0&&bandTop-needed>=bottom){col=1;y=bandTop;}
   else nextPage();
  };
  const width=()=>fullWidth?W-margin*2:colWidth;
  const write=(text:string,size=9.5,leading=14,strong=false,indent=0)=>{
   for(const t of wrapMeasured(text,size,width()-indent,strong)){
    space(leading);
    lineText(page,t,columns[col]+indent,y,size,strong);
    y-=leading;
   }
  };
  const instructions=info.instructions?.trim();
  if(instructions){
   space(30);
   write('Instruções da avaliação',10,16,true);
   write(instructions,9.5,14);
   y-=12;
  }
  const renderFigure=async(figure:PendingQuestionImage)=>{
   let fig=images.get(figure.localId);
   if(!fig){fig=await embedFigure(doc,figure);images.set(figure.localId,fig);}
   const dims=figureSize(fig.width,fig.height,width()-12,190);
   const captions=wrapMeasured(figure.caption.trim()||figure.altText.trim(),7.5,width()-10);
   space(dims.height+23);
   page.drawImage(fig,{x:columns[col]+6,y:y-dims.height,width:dims.width,height:dims.height});
   y-=dims.height+12;
   for(const caption of captions){write(caption,7.5,11,false,6);}
   y-=7;
  };
  for(const item of variant.items){
   const q=item.question;
   const needsFullWidth=q.kind==='discursiva';
   if(needsFullWidth!==fullWidth){
    // A segunda coluna só é usada depois de esgotar a primeira.
    // Se já a usamos, começamos a discursiva em uma nova página.
    if(needsFullWidth&&col===1)nextPage();
    fullWidth=needsFullWidth;
    bandTop=y;
   }
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
     page.drawLine({start:{x:columns[col]+3,y:y-3},end:{x:columns[col]+width()-4,y:y-3},
      thickness:.48,color:pale});
     y-=18;
    }
    y-=13;
   }
  }
  // Página própria: o cartão não usa a paginação em colunas do caderno.
  const objective=variant.items.filter(i=>i.question.kind==='objetiva');
  let card=doc.addPage([W,H]),cardY=0;
  const cardHead=(continuation=false)=>{
   cardY=drawHeader(card,'CARTÃO DE RESPOSTAS'+(continuation?' - CONTINUAÇÃO':''),false);
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
