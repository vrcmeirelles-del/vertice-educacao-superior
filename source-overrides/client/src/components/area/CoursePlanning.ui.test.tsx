import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mock=vi.hoisted(()=>({calls:[] as Record<string,unknown>[],fail:false}));
const mockChain={select:()=>mockChain,eq:()=>mockChain,in:()=>mockChain,maybeSingle:()=>Promise.resolve({data:null,error:null,count:0}),limit:()=>Promise.resolve({data:[],error:null}),then:(fn:Function)=>Promise.resolve({data:[],error:null,count:0}).then(fn as any)};
vi.mock('@/lib/supabase',()=>({supabase:{rpc:vi.fn(async(_name:string,args:Record<string,unknown>)=>{
  mock.calls.push(args);
  if(mock.fail)return {data:null,error:{message:'Falha de autorização de teste'}};
  const row={id:`${args.p_kind}-${args.p_course_id}`,course_id:args.p_course_id,version:2,status:'draft',created_at:'2026-11-15T10:00:00Z',updated_at:'2026-11-15T10:01:00Z',semester:'2026/2',activities:[],context:{},calendar:[],course_offerings:[],faculty:{assignments:[],trainings:[],meetings:[]},semester_goals:[],extension_ac:{extension_projects:[],ac_activities:[],partnerships:[]},internship_tcc:{internship:{student_count:null,supervisors:null,conventions_to_renew:null},tcc:{defense_count:null,defense_dates:null,advisors:null},conventions:[]},infrastructure:[],student_support:{entries:[],leveling_actions:[]},engagement:{actions:[]},swot:{},alignment:{},vision_text:`Visão de ${args.p_course_id}`};
  return {data:args.p_action==='list'?{plans:[row]}:{plan:row},error:null};
}),from:vi.fn(()=>mockChain)}}));
vi.mock('@/lib/area',()=>({isFullAccess:(role:string)=>['master','gestor','reitor'].includes(role)}));
import CoursePlanning from './CoursePlanning';
let el:HTMLDivElement,root:Root;
const courses=[{id:'curso-a',name:'Direito'},{id:'curso-b',name:'Pedagogia'}];
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;mock.calls=[];mock.fail=false;el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
async function click(text:string){const b=[...el.querySelectorAll('button')].find(b=>b.textContent===text);expect(b).toBeDefined();await act(async()=>b!.click());}
async function selectSection(value:string){const select=el.querySelector<HTMLSelectElement>('[aria-label="Seção do planejamento"]')!;await act(async()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});}
it('requires an explicit course and uses the native portal session instead of embedding another login',async()=>{
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="master"/>));
 expect(mock.calls).toHaveLength(0);expect(el.textContent).toContain('Selecione o curso');expect(el.querySelector('iframe')).toBeNull();
 const select=el.querySelector('select')!;await act(async()=>{select.value='curso-a';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(mock.calls).toHaveLength(2);for(const call of mock.calls){expect(call.p_institution_id).toBe('ies-a');expect(call.p_course_id).toBe('curso-a');}
});
it('loads semester history and sends saved identity plus revision on updates',async()=>{
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="master" initialCourseId="curso-a"/>));
 await selectSection('semestre');expect(el.textContent).toContain('2026/2');
 expect(el.textContent).not.toContain(['CCG','FOR','36'].join('-'));expect(el.textContent).not.toContain('Código do formulário');
 await click('Salvar planejamento semestral');
 const call=mock.calls.find(c=>c.p_action==='save')!;
 expect(call.p_kind).toBe('semester');expect(call.p_payload).toMatchObject({id:'semester-curso-a',semester:'2026/2',expected_updated_at:'2026-11-15T10:01:00Z'});
 expect(el.textContent).toContain('Planejamento salvo.');
});
it('clears the previous course editor when selecting another course',async()=>{
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="master" initialCourseId="curso-a"/>));
 await selectSection('visao');expect(el.querySelector('textarea')?.value).toBe('Visão de curso-a');
 const select=el.querySelector('select')!;await act(async()=>{select.value='curso-b';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await selectSection('visao');expect(el.querySelector('textarea')?.value).toBe('Visão de curso-b');
});
it('disables editing for readers and exposes failures without a false success',async()=>{
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="leitor" initialCourseId="curso-a"/>));
 expect(el.querySelector('fieldset')?.disabled).toBe(true);expect(el.textContent).not.toContain('Salvar planejamento estratégico');
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="master" initialCourseId="curso-a"/>));
 mock.fail=true;await click('Salvar planejamento estratégico');
 expect(el.querySelector('[role=alert]')?.textContent).toContain('Falha de autorização');expect(el.textContent).not.toContain('Planejamento salvo.');
});

it('opens legacy empty SWOT and normalizes empty alignment before saving',async()=>{
 await act(async()=>root.render(<CoursePlanning institutionId="ies-a" courses={courses} role="master" initialCourseId="curso-a"/>));
 await selectSection('swot');
 expect(el.textContent).toContain('Análise SWOT');
 expect(el.querySelectorAll('fieldset button')).toHaveLength(4);
 await click('Salvar planejamento estratégico');
 const call=mock.calls.find(c=>c.p_action==='save')!;
 expect(call.p_payload).toMatchObject({swot:{strengths:[],weaknesses:[],opportunities:[],threats:[]},alignment:[]});
});
