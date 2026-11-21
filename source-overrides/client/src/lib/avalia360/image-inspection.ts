/**
 * Avalia 360° — preparação segura do anexo, sem acesso a banco.
 * Checagem por assinatura de bytes e hash criptográfico real.
 * O backend DEVE repetir validação em conteúdo armazenado e autorizar escopo.
 */
import {IMAGE_MAX_BYTES,type ImageMime} from './question-media';
export interface VerifiedLocalImage {
 bytes: Uint8Array;sha256:string;mime:ImageMime;sizeBytes:number;
}
function starts(bytes:Uint8Array,magic:number[]):boolean{
 return bytes.length>=magic.length && magic.every((v,i)=>bytes[i]===v);
}
export function sniffImageMime(bytes:Uint8Array):ImageMime|null{
 if(starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return 'image/png';
 if(starts(bytes,[0xff,0xd8,0xff]))return 'image/jpeg';
 const ascii=(offset:number,length:number)=>String.fromCharCode(...bytes.slice(offset,offset+length));
 if(bytes.length>=12 && ascii(0,4)==='RIFF' && ascii(8,4)==='WEBP')return 'image/webp';
 return null;
}
export async function inspectLocalImage(file:File):Promise<VerifiedLocalImage>{
 if(!file || file.size<=0 || file.size>IMAGE_MAX_BYTES)throw new Error('IMAGE_SIZE_INVALID');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.byteLength!==file.size)throw new Error('IMAGE_CONTENT_LENGTH_MISMATCH');
 const mime=sniffImageMime(bytes);
 if(!mime || mime!==file.type)throw new Error('IMAGE_SIGNATURE_MISMATCH');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return {bytes,sha256,mime,sizeBytes:bytes.byteLength};
}
