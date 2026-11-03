import { describe, it, expect, vi } from 'vitest';
import { EMPTY_BRANDING, contrast, imageDimensions, normalizeLogo, responseGate, suggestColor, textColor, validateBranding } from '../client/src/lib/institution-branding';
describe('institution branding',()=>{
 it('validates HEX, text length, absence and unsupported logos',()=>{
  expect(validateBranding(EMPTY_BRANDING)).toEqual(EMPTY_BRANDING);
  expect(validateBranding({...EMPTY_BRANDING,theme_color:'#aabbcc'}).theme_color).toBe('#AABBCC');
  for(const v of [{...EMPTY_BRANDING,header_text:'a'.repeat(601)},{...EMPTY_BRANDING,theme_color:'#abc'},{...EMPTY_BRANDING,logo_data:'data:image/svg+xml,<svg/>'}]) expect(()=>validateBranding(v)).toThrow();
 });
 it('keeps text contrast at least 4.5:1 including light themes',()=>{
  for(const c of ['#FFFFFF','#FF8800','#FFFF00','#000000','#00FF00','#123456',null]) expect(contrast(textColor(c))).toBeGreaterThanOrEqual(4.5);
 });
 it('suggests the dominant visible nonwhite color without applying it',()=>{
  expect(suggestColor(new Uint8ClampedArray([255,255,255,255,255,128,0,255,255,128,0,255,0,0,255,0]))).toBe('#FF8000');
  expect(suggestColor(new Uint8ClampedArray([255,255,255,255]))).toBeNull();
 });
 it('discards delayed loads/downloads when tenant or operation changes',()=>{
  const gate=responseGate(), first=gate.ticket(), next=gate.ticket();expect(first()).toBe(false);expect(next()).toBe(true);gate.invalidate();expect(next()).toBe(false);
 });
 it('rejects oversize and invalid signatures before decoding',async()=>{
  const decoder=vi.fn();vi.stubGlobal('createImageBitmap',decoder);
  const file=(type:string,size:number,bytes:number[])=>({type,size,arrayBuffer:async()=>new Uint8Array(bytes).buffer}) as File;
  await expect(normalizeLogo(file('image/svg+xml',1,[1]))).rejects.toThrow();
  await expect(normalizeLogo(file('image/png',2097153,[1]))).rejects.toThrow();
  await expect(normalizeLogo(file('image/png',4,[1,2,3,4]))).rejects.toThrow();expect(decoder).not.toHaveBeenCalled();vi.unstubAllGlobals();
 });
 it('extracts dimensions before decoding and rejects malformed JPEG',()=>{
  const b=new Uint8Array(33),v=new DataView(b.buffer);v.setUint32(16,300);v.setUint32(20,120);expect(imageDimensions(b,true)).toEqual([300,120]);
  expect(()=>imageDimensions(new Uint8Array([255,216,255]),false)).toThrow();
 });
 it('normalizes to 300x120, preserves aspect ratio and closes the decoded bitmap',async()=>{
  const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const view=new DataView(b.buffer);view.setUint32(16,600);view.setUint32(20,600);
  const close=vi.fn(),drawImage=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:600,height:600,close})));
  const canvas={width:0,height:0,getContext:()=>({drawImage,getImageData:()=>({data:new Uint8ClampedArray([255,128,0,255])})}),toDataURL:()=> 'data:image/png;base64,normalized'};
  vi.stubGlobal('document',{createElement:()=>canvas});
  const result=await normalizeLogo({type:'image/png',size:33,arrayBuffer:async()=>b.buffer} as File);
  expect(canvas.width).toBe(300);expect(canvas.height).toBe(120);expect(drawImage.mock.calls[0].slice(1)).toEqual([90,0,120,120]);expect(close).toHaveBeenCalled();expect(result.suggested).toBe('#FF8000');vi.unstubAllGlobals();
 });
});
