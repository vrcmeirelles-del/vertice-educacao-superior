// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import InepLibrary from '../client/src/components/area/InepLibrary';
const mocks=vi.hoisted(()=>({reads:[] as Array<(v:any)=>void>,downloads:[] as Array<(v:any)=>void>}));
vi.mock('../client/src/lib/supabase',()=>({supabase:{from:()=>{const q:any={select:()=>q,eq:()=>q,order:()=>new Promise(resolve=>mocks.reads.push(resolve))};return q;},functions:{invoke:()=>new Promise(resolve=>mocks.downloads.push(resolve))}}}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('never starts a browser download from an obsolete institution response',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const create=vi.fn();URL.createObjectURL=create;
 try {
  await act(async()=>root.render(React.createElement(InepLibrary,{institutionId:'A'})));
  await act(async()=>mocks.reads[0]({data:[{id:'one',institution_id:'A',library_key:'a',version:'1',code:null,dimension:1,indicator:'1.1',file_name:'IES-A.docx',title:'A',original_path:'A',format:'docx',size_bytes:10,is_placeholder:false}],error:null}));
  await act(async()=>(host.querySelector('.inep-library-results button') as HTMLButtonElement).click());
  await act(async()=>root.render(React.createElement(InepLibrary,{institutionId:'B'})));
  expect(host.textContent).not.toContain('IES-A.docx');
  await act(async()=>mocks.downloads[0]({data:new Blob(['old bytes']),error:null}));
  expect(create).not.toHaveBeenCalled();
  await act(async()=>mocks.reads[1]({data:[],error:null}));
  expect(host.textContent).not.toContain('IES-A.docx');
 } finally { await act(async()=>root.unmount());host.remove(); }
});
