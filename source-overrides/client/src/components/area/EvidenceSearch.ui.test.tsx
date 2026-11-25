import {it,expect,vi,afterEach} from 'vitest';import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
const fixture=vi.hoisted(()=>({rpc:vi.fn(),invoke:vi.fn()}));vi.mock('@/lib/supabase',()=>({supabase:{rpc:fixture.rpc,functions:{invoke:fixture.invoke}}}));
import EvidenceSearch from './EvidenceSearch';let root:Root|undefined,el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());el?.remove();fixture.rpc.mockReset();fixture.invoke.mockReset();});
async function start(){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;el=document.createElement('div');document.body.append(el);root=createRoot(el);await act(async()=>root!.render(<EvidenceSearch institutionId="ies-a" courseId="course-a"/>));await act(async()=>el.querySelector('button')!.click());}
async function submit(){await act(async()=>el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('queries only selected scope and labels metadata without inventing content',async()=>{fixture.rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:[{source_table:'vertice_repository_files',source_id:'file-a',course_id:'course-a',title:'Ata NDE',category:'instrumento',indicators:['1.2'],text_status:'pending',excerpt:'Somente metadados; conteúdo ainda não indexado.',keyword_suggestions:[],approved_links:[]}],error:null});await start();await submit();expect(fixture.rpc).toHaveBeenLastCalledWith('vertice_evidence_search',expect.objectContaining({p_institution_id:'ies-a',p_course_id:'course-a',p_include_institution:false}));expect(el.textContent).toContain('extração pendente');expect(el.textContent).toContain('Somente metadados');expect(fixture.invoke).not.toHaveBeenCalled();});
it('denied MFA or management scope never starts search or indexing',async()=>{fixture.rpc.mockResolvedValueOnce({data:false,error:null});await start();await submit();expect(fixture.rpc).toHaveBeenCalledTimes(1);expect(el.querySelector('[role="alert"]')?.textContent).toContain('MFA');expect(fixture.invoke).not.toHaveBeenCalled();});
it('walks the authorized repository queue by cursor and indexes without AI',async()=>{
 let queues=0;fixture.rpc.mockImplementation(async(name:string)=>name==='vertice_evidence_can_manage'?{data:true,error:null}:{data:queues++===0?[{source_table:'vertice_repository_files',source_id:'file-z'}]:[],error:null});fixture.invoke.mockResolvedValue({data:{status:'indexed'},error:null});
 await start();await act(async()=>{Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='Extrair acervo pendente, sem enviar à IA')!.click();});
 expect(fixture.invoke).toHaveBeenCalledWith('vertice-doc-prevalidate',{body:{institution_id:'ies-a',source_table:'vertice_repository_files',file_id:'file-z',action:'index'}});
 expect(fixture.rpc).toHaveBeenLastCalledWith('vertice_evidence_index_queue',expect.objectContaining({p_institution_id:'ies-a',p_course_id:'course-a',p_after_id:'file-z',p_retry_failed:false}));expect(el.textContent).toContain('Varredura concluída: 1');
});
it('sem seção, a chamada não leva p_section (compatível com a função vigente)',async()=>{fixture.rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:[],error:null});await start();await submit();expect(Object.keys(fixture.rpc.mock.calls.at(-1)![1])).not.toContain('p_section');});
it('com seção, busca só o acervo do instrumento e não oferece varredura do repositório inteiro',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;el=document.createElement('div');document.body.append(el);root=createRoot(el);
 fixture.rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:[],error:null});
 await act(async()=>root!.render(<EvidenceSearch institutionId="ies-a" section="recredenciamento_2017" label="Buscar no acervo do Recredenciamento"/>));
 expect(el.querySelector('button')!.textContent).toBe('Buscar no acervo do Recredenciamento');await act(async()=>el.querySelector('button')!.click());
 expect(el.textContent).toContain('Busca restrita ao acervo deste instrumento');expect(el.textContent).not.toContain('Extrair acervo pendente');
 await submit();expect(fixture.rpc).toHaveBeenLastCalledWith('vertice_evidence_search',expect.objectContaining({p_institution_id:'ies-a',p_course_id:null,p_section:'recredenciamento_2017'}));
});
