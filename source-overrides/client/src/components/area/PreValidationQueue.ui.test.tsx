import { it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const fx=vi.hoisted(()=>({tables:{} as Record<string,any[]>,fail:''}));
vi.mock('@/lib/supabase',()=>({supabase:{from:(table:string)=>{
 let ids:string[]|undefined,column='',scope='';
 const q:any={select:()=>q,eq:(_key:string,value:string)=>{scope=value;return q},order:()=>q,in:(key:string,values:string[])=>{column=key;ids=values;return q},range:async(start:number,end:number)=>({error:fx.fail===table?new Error('Source lookup unavailable'):null,data:(fx.tables[table]??[]).filter(r=>r.institution_id===scope&&(!ids||ids.includes(r[column]))).slice(start,end+1)})};return q;
}}}));
vi.mock('@/lib/area',()=>({explain:(e:Error)=>e.message}));
import PreValidationQueue from './PreValidationQueue';
let root:Root|undefined,el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());el?.remove();fx.fail='';fx.tables={};});
async function render(){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 fx.tables={vertice_doc_prevalidation:[{id:'pv1',institution_id:'A',repository_file_id:'file1',source_table:'vertice_repository_files',ai_status:'completed',created_at:'2026-11-27'},{id:'pv2',institution_id:'A',document_id:'doc2',source_table:'vertice_documents',ai_status:'pending',created_at:'2026-11-27'}],vertice_repository_files:[{id:'file1',institution_id:'A',file_name:'Horario.docx'}],vertice_documents:[{id:'doc2',institution_id:'A',title:'Plano institucional'}],vertice_doc_indicator_links:[{id:'link1',institution_id:'A',prevalidation_id:'pv1',instrument_code:'reconhecimento_curso',object_code:'1.6',status:'sugerido',compatibility:'alta',justification:'Synthetic excerpt'}]};
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 await act(async()=>root!.render(<PreValidationQueue institutionId="A" role="master"/>));
}
it('renders repository names, document titles, source IDs and pending review without approving evidence',async()=>{
 await render();expect(el.textContent).toContain('Horario.docx');expect(el.textContent).toContain('Plano institucional');expect(el.textContent).toContain('Arquivo: file1');expect(el.textContent).toContain('Arquivo: doc2');expect(el.textContent).toContain('1 vínculo(s) pendente(s)');expect(el.textContent).not.toContain('Documento desconhecido');expect(el.querySelector('input[aria-label="Buscar documento por nome ou ID"]')).not.toBeNull();expect(fx.tables.vertice_doc_indicator_links[0].status).toBe('sugerido');
});
it('exposes source lookup errors and clears the queue rather than presenting unknown documents',async()=>{
 fx.fail='vertice_repository_files';await render();expect(el.querySelector('[role="alert"]')?.textContent).toContain('Source lookup unavailable');expect(el.textContent).not.toContain('Documento desconhecido');expect(el.textContent).not.toContain('Arquivo: file1');
});
