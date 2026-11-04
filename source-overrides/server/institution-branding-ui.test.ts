// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import InstitutionBranding from '../client/src/components/area/InstitutionBranding';
const mocks=vi.hoisted(()=>({reads:[] as Array<{id:string,resolve:(v:any)=>void}>,saves:[] as Array<(v:any)=>void>}));
vi.mock('../client/src/lib/supabase',()=>({supabase:{from:()=>{let id='';const q:any={select:()=>q,eq:(_:string,v:string)=>{id=v;return q;},single:()=>new Promise(resolve=>mocks.reads.push({id,resolve}))};return q;},rpc:()=>new Promise(resolve=>mocks.saves.push(resolve))}}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const roots:Array<ReturnType<typeof createRoot>>=[];
afterEach(async()=>{await act(async()=>roots.splice(0).forEach(r=>r.unmount()));document.body.innerHTML='';mocks.reads.length=0;mocks.saves.length=0;});
const data=(name:string)=>({data:{document_branding:{header_text:name,theme_color:null,logo_data:null},updated_at:'2026-11-03T00:00:00Z'},error:null});
it('clears tenant data immediately and ignores a late read',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 await act(async()=>root.render(React.createElement(InstitutionBranding,{institutionId:'A',editable:true})));
 await act(async()=>root.render(React.createElement(InstitutionBranding,{institutionId:'B',editable:true})));
 expect(host.textContent).not.toContain('IES A');
 await act(async()=>mocks.reads[1].resolve(data('IES B')));
 await act(async()=>mocks.reads[0].resolve(data('IES A')));
 expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('IES B');
});
it('discards late saves on unmount and exposes read-only preview to reader',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 await act(async()=>root.render(React.createElement(InstitutionBranding,{institutionId:'A',editable:true})));
 await act(async()=>mocks.reads[0].resolve(data('IES A')));
 const save=[...host.querySelectorAll('button')].find(b=>b.textContent==='Salvar identidade')!;
 await act(async()=>save.click());
 await act(async()=>root.render(React.createElement(InstitutionBranding,{institutionId:'B',editable:false})));
 await act(async()=>mocks.reads[1].resolve(data('IES B')));
 await act(async()=>mocks.saves[0]({data:data('IES A').data,error:null}));
 expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('IES B');expect(host.textContent).not.toContain('Identidade salva.');
 expect(host.querySelector('fieldset')!.disabled).toBe(true);expect([...host.querySelectorAll('button')].some(b=>b.textContent==='Salvar identidade')).toBe(false);
});
