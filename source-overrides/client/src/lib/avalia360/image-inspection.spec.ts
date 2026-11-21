import {describe,expect,it} from 'vitest';
import {inspectLocalImage,sniffImageMime} from './image-inspection';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,1,2]);
const fake=(bytes:Uint8Array,type:string)=>({size:bytes.length,type,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}) as File;
describe('inspeção de imagem',()=>{
 it('confere assinatura PNG e calcula hash real',async()=>{
   const r=await inspectLocalImage(fake(png,'image/png'));
   expect(r.mime).toBe('image/png');
   expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
   expect(r.sizeBytes).toBe(png.length);
 });
 it('rejeita MIME informado diferente dos bytes',async()=>{
   await expect(inspectLocalImage(fake(png,'image/jpeg'))).rejects.toThrow('IMAGE_SIGNATURE_MISMATCH');
 });
 it('rejeita arquivo sem assinatura conhecida',()=>{
   expect(sniffImageMime(new Uint8Array([1,2,3,4,5]))).toBeNull();
 });
 it('rejeita arquivo vazio',async()=>{
   await expect(inspectLocalImage(fake(new Uint8Array(),'image/png'))).rejects.toThrow('IMAGE_SIZE_INVALID');
 });
 it('reconhece JPEG e WebP',()=>{
   expect(sniffImageMime(new Uint8Array([255,216,255,0]))).toBe('image/jpeg');
   expect(sniffImageMime(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))).toBe('image/webp');
 });
});
