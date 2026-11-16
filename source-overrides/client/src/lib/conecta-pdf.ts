import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import type {Detail} from './conecta';
export async function exportConectaPassport(detail:Detail){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page=doc.addPage([595.28,841.89]),y=790;
 function draw(text:string,title=false){if(y<60){page=doc.addPage([595.28,841.89]);y=790;}page.drawText(text,{x:55,y,size:title?14:11,font:title?bold:font,color:rgb(.09,.2,.3),maxWidth:480});y-=title?24:17;}
 function write(text:string,title=false){for(const block of text.replace(/[^\u0020-\u007e\u00a0-\u00ff\n]/g,' ').split('\n')){let line='';for(const word of block.split(/\s+/)){if(font.widthOfTextAtSize(line+' '+word,title?14:11)>475&&line){draw(line,title);line=word;}else line+=(line?' ':'')+word;}draw(line,title);}}
 const p=detail.profile,d=p.data;write('VÉRTICE CONECTA 360°',true);write('Passaporte profissional - versão salva '+p.version);write(p.full_name||'Perfil profissional',true);write(d.headline||'');write('Fonte: '+p.source+' | Atualização: '+new Date(p.updated_at).toLocaleString('pt-BR'));
 for(const [label,key] of [['Interesses','interests'],['Competências registradas','skills'],['Objetivo profissional','objective'],['Prazo','deadline'],['LinkedIn','linkedin'],['Lattes','lattes']])if(d[key]){y-=10;write(label,true);write(d[key]);}
 y-=10;write('Evidências do portfólio',true);for(const e of detail.evidence)write(e.title+' | '+(e.verified?'Documento institucional aprovado':'Informação não verificada')+'\n'+e.description);
 y-=10;write('Informações profissionais registradas não constituem certificação de competências nem aprovação acadêmica. Emitido em '+new Date().toLocaleString('pt-BR'));
 const bytes=await doc.save(),href=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/pdf'})),a=document.createElement('a');a.href=href;a.download='Passaporte_Profissional_Conecta.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
