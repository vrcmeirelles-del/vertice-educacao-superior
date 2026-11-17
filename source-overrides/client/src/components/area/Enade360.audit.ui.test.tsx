import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const fixture=vi.hoisted(()=>({status:'pendente',rpc:vi.fn(),updates:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{
 auth:{getUser:async()=>({data:{user:{id:'master-fixture'}},error:null})},
 rpc:fixture.rpc,
 from:()=>{
  let update:Record<string,unknown>|null=null;
  const query:any={
   select(){return query;},eq(){return query;},
   update(value:Record<string,unknown>){update=value;return query;},
   range:async()=>({data:[{id:'record-1',institution_id:'ies-1',course_id:'course-1',kind:'evidencia',title:'Evidência de teste',source_kind:'institucional',validation_status:fixture.status,created_at:'2026-11-17T00:00:00Z',sample_size:null,performance_percent:null}],error:null}),
   then(resolve:(x:unknown)=>unknown){if(update){fixture.updates(update);fixture.status=String(update.validation_status);}return Promise.resolve(resolve({error:null}));},
  };return query;
 }
}}));
vi.mock('./enade-mirror',()=>({loadEnadeMirror:async()=>({rows:[],notice:'Fixture; sem espelho oficial'})}));
vi.mock('./EnadeCross',()=>({default:()=>null}));
vi.mock('@/components/ContextHelp',()=>({HelpLabel:({children,...props}:any)=><label {...props}>{children}</label>,ContextHelp:()=>null}));
import Enade360 from './Enade360';
let el:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;fixture.status='pendente';fixture.rpc.mockReset();fixture.updates.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.restoreAllMocks();});
async function click(text:string){const button=[...el.querySelectorAll('button')].find(b=>b.textContent===text);expect(button).toBeTruthy();await act(async()=>button!.click());}
it('discards opened history after rejection and obtains the new event on reopening',async()=>{
 fixture.rpc.mockResolvedValueOnce({data:[{event_id:1,event_type:'INSERT',validation_status:'pendente',event_sha256:'a'.repeat(64),recorded_at:'2026-11-17T00:00:00Z'}],error:null});
 await act(async()=>root.render(<Enade360 institutionId="ies-1" courses={[{id:'course-1',name:'Direito'}]} actions={[]} goals={[]} role="master" onPlan={()=>{}}/>));
 await click('Examinar curso');await click('Consultar auditoria');
 expect(el.textContent).toContain('Trilha técnica de auditoria');expect(el.textContent).toContain('INSERT');
 await click('Rejeitar');
 expect(fixture.updates).toHaveBeenCalledWith(expect.objectContaining({validation_status:'rejeitado'}));
 expect(el.textContent).toContain('rejeitado');expect(el.textContent).not.toContain('Trilha técnica de auditoria');
 fixture.rpc.mockResolvedValueOnce({data:[{event_id:1,event_type:'INSERT',validation_status:'pendente',event_sha256:'a'.repeat(64),recorded_at:'2026-11-17T00:00:00Z'},{event_id:2,event_type:'UPDATE',validation_status:'rejeitado',event_sha256:'b'.repeat(64),recorded_at:'2026-11-17T00:01:00Z'}],error:null});
 await click('Consultar auditoria');expect(fixture.rpc).toHaveBeenCalledTimes(2);expect(el.textContent).toContain('UPDATE');
});
