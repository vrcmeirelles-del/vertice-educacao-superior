/**
 * Avalia 360° — leitura do cartão a partir de uma foto, no navegador (sem envio da imagem e sem IA).
 * Fases: alinhar pelas marcas → ler o QR endireitado → (servidor identifica aluno e versão) → ler as bolinhas.
 */
import {alignCard,omrLayout,omrCapacity,OMR_MAX_OPTIONS,readMarks,rectifiedQr,toGray,type CardAlignment,type GrayImage,type OmrRead} from './omr';
import type {SnapshotQuestion,VariantMap} from './answer-entry';

export interface CardPhoto {gray:GrayImage;alignment:CardAlignment;qr:string|null}

export async function loadCardPhoto(file:File,maxSide=2000):Promise<CardPhoto|{error:string}>{
 const bmp=await createImageBitmap(file);
 try{
  const scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);
  const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return {error:'Leitura de imagem indisponível neste navegador.'};
  ctx.drawImage(bmp,0,0,c.width,c.height);
  const img=ctx.getImageData(0,0,c.width,c.height);
  const gray=toGray(img.data,c.width,c.height);
  const alignment=alignCard(gray);
  if(!alignment.ok)return {error:alignment.error};
  const jsQR=(await import('jsqr')).default;
  const q=rectifiedQr(gray,alignment.transform);
  const qr=jsQR(q.data,q.width,q.height)?.data??jsQR(img.data,c.width,c.height)?.data??null;
  return {gray,alignment,qr};
 }finally{bmp.close();}
}

/** Objetivas da versão, na ordem do cartão: número impresso e quantidade de alternativas. */
export function variantOmrItems(map:VariantMap,questions:SnapshotQuestion[],variant:string){
 const kind=new Map(questions.map(q=>[q.id,q.kind]));
 return (map[variant]||[]).flatMap((it,i)=>kind.get(it.q)==='objetiva'?[{displayNumber:i+1,options:it.o.length}]:[]);
}
export function omrSupported(items:Array<{options:number}>){
 return items.length>0&&items.length<=omrCapacity()&&items.every(i=>i.options>=2&&i.options<=OMR_MAX_OPTIONS);
}
export function readCardMarks(photo:CardPhoto,items:Array<{displayNumber:number;options:number}>):OmrRead{
 return readMarks(photo.gray,omrLayout(items),photo.alignment.transform,photo.alignment.threshold);
}
