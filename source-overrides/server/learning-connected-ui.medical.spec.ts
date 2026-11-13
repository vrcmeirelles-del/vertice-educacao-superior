// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
const h=vi.hoisted(()=>({invoke:vi.fn(),metrics:[] as any[]}));
vi.mock('../client/src/lib/supabase',()=>({supabase:{functions:{invoke:h.invoke},from:()=>{
 const q:any={select:()=>q,eq:()=>q,order:()=>q,limit:()=>Promise.resolve({data:h.metrics,error:null})};return q;
}}}));
vi.mock('../client/src/components/area/RosterUpload',()=>({default:()=>null}));
vi.mock('../client/src/components/area/ApiConnectorSetup',()=>({default:()=>null}));
vi.mock('../client/src/components/area/StudentNotifications',()=>({default:()=>null}));
vi.mock('../client/src/components/ContextHelp',()=>({HelpLabel:({children,...props}:any)=>createElement('label',props,children),ContextHelp:()=>null}));
import LearningConnected from '../client/src/components/area/LearningConnected';
let root:Root,node:HTMLDivElement;
const course='00000000-0000-4000-8000-000000000003';
const courses=[{id:course,name:'Curso sintético',code:'FIXTURE'}];
const button=(text:string)=>[...node.querySelectorAll('button')].find(b=>b.textContent===text)!;
async function render(schoolMode=false,institutionId='fixture-one'){
 await act(async()=>root.render(createElement(LearningConnected,{institutionId,courses,role:'master',schoolMode})));
}
async function change(el:HTMLInputElement|HTMLSelectElement,value:string){
 await act(async()=>{
  Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);
  el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
 });
}
const review=()=>node.querySelector('input[type=checkbox]') as HTMLInputElement;
const form=()=>node.querySelector('form')!;
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);
 h.metrics=[];h.invoke.mockReset();h.invoke.mockImplementation(async(_name,{body})=>({data:body.operation==='status'?{configured:true,tenantEnabled:true,tenantStatus:'ativo',courseCount:0,ok:true,metrics:[]}:{ok:true,newEvents:1,publishedGroups:0},error:null}));
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.restoreAllMocks();});
describe('learning medical/school management flows',()=>{
 it('separates module choices and visible metric rows by segment',async()=>{
  h.metrics=['enem','enamed','residencia'].map(module=>({course_id:course,semester:'2026/2',subject_code:module,module,competency:'synthetic',participants:5,attempts:5,graded:5,correct:3,paired_students:0,comparison_gap:null,curricular_average:null,external_accuracy:null}));
  await render();expect(node.textContent).toContain('ENAMED');expect(node.querySelector('tbody')?.textContent).not.toContain('enem');
  expect([...form().querySelectorAll('option')].some(o=>o.value==='enem')).toBe(false);
  await render(true);expect([...form().querySelectorAll('option')].filter(o=>['enem','enamed','residencia'].includes(o.value)).map(o=>o.value)).toEqual(['enem']);
  expect(node.querySelector('tbody')?.textContent).not.toContain('enamed');expect(node.querySelector('tbody')?.textContent).toContain('ENEM');
 });
 it('cancels replay without an action request',async()=>{
  await render();vi.mocked(window.confirm).mockReturnValue(false);
  await act(async()=>button('Reprocessar histórico revisado').click());
  expect(h.invoke.mock.calls.filter(([,o])=>o.body.replay)).toHaveLength(0);
 });
 it('sends reviewed replay once despite repeated clicks while pending',async()=>{
  await render();let finish:any;
  h.invoke.mockImplementation((_name,{body})=>body.replay?new Promise(resolve=>finish=resolve):Promise.resolve({data:{},error:null}));
  await act(async()=>{button('Reprocessar histórico revisado').click();button('Reprocessar histórico revisado').click();});
  const calls=h.invoke.mock.calls.filter(([,o])=>o.body.replay);expect(calls).toHaveLength(1);expect(calls[0][1].body).toMatchObject({operation:'sync',replay:true,reviewed:true,institutionId:'fixture-one'});
  expect(button('Reprocessar histórico revisado').disabled).toBe(true);
  await act(async()=>finish({data:{newEvents:1,remainingPages:true},error:null}));expect(button('Reprocessar histórico revisado').disabled).toBe(false);
  expect(node.textContent).toContain('Continue em Sincronizar desempenho, sem reprocessar novamente');
 });
 it('uses sync_enem when replaying a school',async()=>{
  await render(true);await act(async()=>button('Reprocessar histórico revisado').click());
  expect(h.invoke.mock.calls.find(([,o])=>o.body.replay)?.[1].body.operation).toBe('sync_enem');
 });
 it('invalidates curricular review after every mapping change',async()=>{
  await render();const f=form();
  const changes:[HTMLInputElement|HTMLSelectElement,string][]=[
   [f.querySelectorAll('select')[0],course],[f.querySelectorAll('input')[0],'SYNTHETIC'],[f.querySelectorAll('select')[1],'residencia'],[f.querySelectorAll('input')[1],'*'],[f.querySelectorAll('input')[2],'Synthetic evidence']
  ];
  for(const [el,value] of changes){await act(async()=>review().click());expect(review().checked).toBe(true);await change(el,value);expect(review().checked).toBe(false);}
  expect((f.querySelectorAll('input')[1] as HTMLInputElement).minLength).toBe(1);
  expect(node.textContent).toContain('TODOS os cadernos e provas');
  await act(async()=>review().click());await act(async()=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('TODO o módulo'));
  expect(h.invoke.mock.calls.find(([,o])=>o.body.operation==='map_subject')?.[1].body).toMatchObject({competency:'*',reviewed:true,module:'residencia'});
 });
 it('clears reviewed mapping when institutional context changes',async()=>{
  await render();await act(async()=>review().click());expect(review().checked).toBe(true);
  await render(false,'fixture-two');expect(review().checked).toBe(false);
 });
 it('does not apply an old institution result after navigation',async()=>{
  await render();let finish:any;
  h.invoke.mockImplementation((_name,{body})=>body.operation==='sync'?new Promise(resolve=>finish=resolve):Promise.resolve({data:{configured:true,tenantEnabled:true},error:null}));
  await act(async()=>button('Sincronizar desempenho').click());await render(false,'fixture-two');
  await act(async()=>finish({data:{newEvents:999,publishedGroups:999},error:null}));
  expect(node.textContent).not.toContain('999');
 });
});
