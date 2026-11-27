import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const fx=vi.hoisted(()=>({from:vi.fn(),invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:fx.from,functions:{invoke:fx.invoke}}}));
vi.mock('@/lib/area',()=>({explain:(e:Error)=>e.message}));
import PreValidationPanel from './PreValidationPanel';
let root:Root|undefined,el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());el?.remove();fx.from.mockReset();fx.invoke.mockReset();});
async function renderPending(overrides:Record<string,unknown>={}){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const chain:any={};for(const name of ['select','eq','order'])chain[name]=vi.fn(()=>chain);
 chain.limit=vi.fn(async()=>({data:[{id:'pv-a',ai_status:'pending',extraction_status:'ready',extracted_at:'2026-11-17',source_sha256:'hash-a',extraction_metadata:{characters:100},keyword_suggestions:[],...overrides}],error:null}));
 const linkChain:any={};for(const name of ['select','eq','order'])linkChain[name]=vi.fn(()=>linkChain);
 linkChain.then=(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve);
 fx.from.mockImplementation((table:string)=>table==='vertice_doc_prevalidation'?chain:linkChain);
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
it('shows why ambiguous extraction withholds suggestions, without displaying a misleading no-indicator result',async()=>{
 await renderPending({ai_status:'completed',ai_analyzed_at:'2026-11-27',extraction_metadata:{characters:100,quality:{highest_severity:'critical',suggestions_withheld:true,issues:[{code:'tracked_changes',severity:'critical',message:'O arquivo contém alterações controladas.'}]}}});
 expect(el.textContent).toContain('O arquivo contém alterações controladas.');
 expect(el.textContent).toContain('Sugestões de indicadores suspensas');
 expect(el.textContent).toContain('Rasuras visuais e manuscritos não são detectados');
 expect(el.textContent).not.toContain('Nenhum indicador foi localizado');
 expect(fx.invoke).not.toHaveBeenCalled();
});
