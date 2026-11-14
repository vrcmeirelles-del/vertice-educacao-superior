import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SECTIONS, TEMPLATES, fieldsForTemplate, type Answers, type Template } from './schema';
export interface Attachment { id: string; name: string; kind: string; path: string; size: number; mime: string; sha256: string; }
export interface Dossier { id: string; template: string; answers: Answers; courseName: string; institutionName: string; revision: number; author: string; generatedAt: string; attachments: Attachment[]; }
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export interface PdfOptions {brand:string;heading:string;templateLabel:string;notice:string;sections:{title:string;fields:{key:string;label:string}[]}[];subject:string;}
export async function buildDossier(d: Dossier, read: (a: Attachment)=>Promise<Uint8Array>, custom?:PdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // Keep Portuguese accents; replace only characters unsupported by the embedded font.
  const safe = (s: string)=>Array.from(s.normalize('NFC')).map(c=>{try {font.encodeText(c); return c;} catch {return '?';}}).join('');
  let page = pdf.addPage([595.28,841.89]), y = 790;
  const newPage = ()=>{page=pdf.addPage([595.28,841.89]); y=790;};
  const line = (s: string, heading = false)=>{
    const face=heading?bold:font, size=heading?12:10;
    const paragraphs=safe(s).split(/\r?\n/);
    for(const p of paragraphs){
      let current='';
      const emit=()=>{if(y<65)newPage();page.drawText(current,{x:52,y,size,font:face,color:rgb(.10,.16,.24)});y-=15;current='';};
      for(const word of p.split(/\s+/)){
        const candidate=current?current+' '+word:word;
        if(face.widthOfTextAtSize(candidate,size)<=490){current=candidate;continue;}
        if(current)emit();
        if(face.widthOfTextAtSize(word,size)<=490){current=word;continue;}
        for(const char of word){if(face.widthOfTextAtSize(current+char,size)>490)emit();current+=char;}
      }
      emit();
    }
    y-=5;
  };
  line(custom?.brand || 'VÉRTICE | EXTENSÃO 360°',true);
  line(custom?.heading || 'PROJETO E RELATÓRIO FINAL',true);
  line(d.answers.title,true);
  line(`${d.institutionName} | ${d.courseName}`);
  line(`Modelo: ${custom?.templateLabel || TEMPLATES[d.template as Template].label} | versão do formulário: 1`);
  line(`Protocolo: ${d.id} | revisão: ${d.revision}`);
  line(`Responsável pelo envio: ${d.author}`);
  line(`Emissão: ${new Date(d.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`);
  line(custom?.notice || 'Registro de execução declarado pelo responsável. Validação institucional pendente.');
  for(const section of custom?.sections || SECTIONS){
    if(y<130)newPage(); line(section.title.toUpperCase(),true);
    for(const f of (custom ? section.fields : fieldsForTemplate(section.fields,d.template as Template))){if(y<105)newPage();line(f.label,true);line(d.answers[f.key]?.trim()||'Não informado / não se aplica.');}
  }
  line('ANEXOS E RASTREABILIDADE',true);
  line('Os arquivos originais permanecem na Mesa Digital. As páginas abaixo são cópias para consulta; assinaturas digitais devem ser verificadas nos originais.');
  for(const [i,a] of d.attachments.entries()){
    line(`${i+1}. ${a.kind} | ${a.name}`);
    line(`SHA-256 do original: ${a.sha256}`);
  }
  for(const [i,a] of d.attachments.entries()){
    const bytes=await read(a);
    if(await sha256(bytes)!==a.sha256)throw new Error(`Integridade divergente no anexo: ${a.name}`);
    newPage();line(`ANEXO ${i+1} - ${a.kind}`,true);line(a.name);
    if(a.mime==='application/pdf'){
      const annex=await PDFDocument.load(bytes);
      if(!annex.getPageCount())throw new Error(`PDF sem páginas: ${a.name}`);
      for(const p of await pdf.copyPages(annex,annex.getPageIndices()))pdf.addPage(p);
    } else {
      const img=a.mime==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
      const scale=Math.min(490/img.width,650/img.height);
      page.drawImage(img,{x:52,y:y-20-img.height*scale,width:img.width*scale,height:img.height*scale});
    }
  }
  const pages=pdf.getPages();
  pages.forEach((p,i)=>{const {width}=p.getSize();p.drawText(`Vértice | ${i+1}/${pages.length}`,{x:Math.max(10,width-115),y:18,size:8,font,color:rgb(.35,.4,.45)});});
  pdf.setTitle(d.answers.title);pdf.setAuthor(d.author);pdf.setSubject(custom?.subject || 'Projeto, relatório de execução e evidências - Extensão 360');pdf.setLanguage('pt-BR');
  return pdf.save();
}
