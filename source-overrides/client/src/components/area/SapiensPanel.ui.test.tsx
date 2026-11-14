import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
const mock=vi.hoisted(()=>({calls:[] as unknown[],fail:false,queryError:false}));
vi.mock('@/lib/supabase',()=>({supabase:{
 from:(table:string)=>{const q={select:()=>q,eq:(...a:unknown[])=>{mock.calls.push([table,...a]);return q;},order:()=>q,limit:()=>q,then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data:table==='vertice_sapiens_interventions'?[{id:'synthetic-intervention',course_id:'synthetic-course',title:'Intervenção sintética',description:'Descrição pedagógica sintética',status:'proposed',delivery_status:'pending',created_at:'2026-11-14T12:00:00Z'}]:[],error:mock.queryError?new Error('synthetic query failure'):null}).then(resolve)};return q;},
 functions:{invoke:vi.fn(async(name:string,args:unknown)=>{mock.calls.push([name,args]);return mock.fail?{data:null,error:new Error('synthetic communication failure')}:{data:{status:'sent'},error:null};})}
}}));
import SapiensPanel from './SapiensPanel';
let el:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;mock.calls=[];mock.fail=false;mock.queryError=false;el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
async function click(label:string){const b=[...el.querySelectorAll('button')].find(b=>b.textContent?.includes(label));expect(b).toBeDefined();await act(async()=>b!.click());}
it('Master sends decision through Edge Function with explicit institution; does not write statuses from browser',async()=>{
 await act(async()=>root.render(<SapiensPanel institutionId="synthetic-ies" role="master"/>));await click('Intervenções');await click('Aprovar');
 expect(mock.calls).toContainEqual(['vertice-sapiens-bridge',{body:{institutionId:'synthetic-ies',interventionId:'synthetic-intervention',action:'approve'}}]);expect(el.textContent).toContain('Envio confirmado');
 for(const table of ['vertice_sapiens_diagnoses','vertice_sapiens_interventions','vertice_sapiens_effectiveness'])expect(mock.calls).toContainEqual([table,'institution_id','synthetic-ies']);
});
it('non-Master cannot approve/reject and query errors are visible',async()=>{
 await act(async()=>root.render(<SapiensPanel institutionId="synthetic-ies" role="gestor"/>));await click('Intervenções');expect(el.textContent).not.toContain('✓ Aprovar');expect(el.textContent).not.toContain('✗ Rejeitar');
 mock.queryError=true;await click('Atualizar');expect(el.querySelector('[role=alert]')?.textContent).toContain('synthetic query failure');
});
it('communication failure remains visible after reload, with no false sent message',async()=>{
 mock.fail=true;await act(async()=>root.render(<SapiensPanel institutionId="synthetic-ies" role="master"/>));await click('Intervenções');await click('Aprovar');expect(el.querySelector('[role=alert]')?.textContent).toContain('synthetic communication failure');expect(el.textContent).not.toContain('Envio confirmado');
});
