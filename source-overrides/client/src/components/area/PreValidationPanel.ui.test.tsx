import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const fx=vi.hoisted(()=>({from:vi.fn(),invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:fx.from,functions:{invoke:fx.invoke}}}));
vi.mock('@/lib/area',()=>({explain:(e:Error)=>e.message}));
import PreValidationPanel from './PreValidationPanel';
let root:Root|undefined,el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());el?.remove();fx.from.mockReset();fx.invoke.mockReset();});
async function renderPending(){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const chain:any={};for(const name of ['select','eq','order'])chain[name]=vi.fn(()=>chain);
 chain.limit=vi.fn(async()=>({data:[{id:'pv-a',ai_status:'pending',extraction_status:'ready',extracted_at:'2026-11-17',source_sha256:'hash-a',extraction_metadata:{characters:100},keyword_suggestions:[]}],error:null}));
 fx.from.mockImplementation((table:string)=>{if(table==='vertice_doc_prevalidation')return chain;return {select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})};});
 fx.invoke.mockResolvedValue({data:{status:'completed'},error:null});
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 await act(async()=>root!.render(<PreValidationPanel file={{id:'file-a',file_name:'Horario.docx'}} institutionId="ies-a" onClose={()=>{}}/>));
}
it('offers classification for already indexed pending AI without starting or approving automatically',async()=>{
 await renderPending();
 const button=Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='Gerar sugestões de classificação');
 expect(button).toBeDefined();expect(fx.invoke).not.toHaveBeenCalled();
 await act(async()=>button!.click());
 expect(fx.invoke).toHaveBeenCalledTimes(1);
 expect(fx.invoke).toHaveBeenCalledWith('vertice-doc-prevalidate',{body:{institution_id:'ies-a',source_table:'vertice_repository_files',file_id:'file-a',action:'analyze'}});
});
