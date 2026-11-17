import {it,expect,vi,beforeEach,afterEach} from 'vitest';import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
const mock=vi.hoisted(()=>({calls:[] as Record<string,any>[],fail:false,approved:false}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc:vi.fn(async(_n:string,p:Record<string,any>)=>{mock.calls.push(p);if(mock.fail)return {error:{message:'Acesso ao curso ou MFA pendente'}};return{data:p.p_action==='list'?{questions:[{id:'q1',discipline:'Direito Civil',status:mock.approved?'approved':'draft',content:{case:'Caso de teste pedagógico.',command:'Analise o caso e fundamente.',expectedAnswer:'Resposta de referência.',rubric:[{criterion:'Análise',points:10}]}}],exams:[],submissions:[]}:p.p_action==='sources'?{sources:[]}:{id:'x'}};}),functions:{invoke:vi.fn()},storage:{from:vi.fn()}}}));
vi.mock('qrcode',()=>({default:{toDataURL:vi.fn()}}));
import Discursiva360 from './Discursiva360';
let el:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mock.calls=[];mock.fail=false;mock.approved=false;el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
async function render(){await act(async()=>root.render(<Discursiva360 institutionId="ies-a" courses={[{id:'c1',name:'Direito'},{id:'c2',name:'Pedagogia'}]}/>));}
async function selectCourse(id:string){await act(async()=>{const s=el.querySelector('select')!;s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));});}
async function click(name:string){const b=[...el.querySelectorAll('button')].find(b=>b.textContent===name)!;expect(b).toBeDefined();await act(async()=>b.click());}
it('requires course selection and scopes every request to the selected institution/course',async()=>{await render();expect(mock.calls).toHaveLength(0);await selectCourse('c1');expect(mock.calls[0]).toMatchObject({p_institution_id:'ies-a',p_course_id:'c1',p_action:'list'});await selectCourse('c2');expect(mock.calls.at(-1)).toMatchObject({p_course_id:'c2'});});
it('drafts cannot be selected for exams and manual identification is required',async()=>{await render();await selectCourse('c1');await click('Provas personalizadas');expect(el.querySelectorAll('input[type=checkbox]')).toHaveLength(0);const b=[...el.querySelectorAll('button')].find(b=>b.textContent==='Criar prova personalizada')!;expect(b.disabled).toBe(true);});
it('exposes authorization failure and does not present data as successfully loaded',async()=>{mock.fail=true;await render();await selectCourse('c1');expect(el.querySelector('[role=alert]')?.textContent).toContain('MFA pendente');expect(el.textContent).not.toContain('Caso de teste pedagógico.');});
it('initial cases load as editable drafts without saving or approving automatically',async()=>{await render();await selectCourse('c1');await click('Usar caso como rascunho');expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toContain('refrigerador');expect(mock.calls.map(c=>c.p_action)).toEqual(['list']);});

it('offers ENAMED and residency profiles with four clinical dimensions and authorial labels',async()=>{
 await render();await selectCourse('c1');const s=el.querySelector<HTMLSelectElement>('[aria-label="Modalidade de avaliação"]')!;
 for(const profile of ['enamed','residencia']){await act(async()=>{s.value=profile;s.dispatchEvent(new Event('change',{bubbles:true}));});await click('Usar caso como rascunho');expect(el.textContent).toContain('Preparação autoral');expect(el.textContent).toContain('Hipóteses diagnósticas');expect(el.textContent).toContain('Investigação');expect(el.textContent).toContain('Conduta e segurança');expect(el.textContent).toContain('7 casos clínicos autorais');}
 expect(el.textContent).toContain('Programa, edital ou preparação geral');expect(mock.calls.map(c=>c.p_action)).toEqual(['list']);
});
it('provides 14 medical authorial drafts with four case-specific rubric criteria',async()=>{
 const {clinicalTemplates}=await import('@/lib/discursiva/clinical-templates');const {validateClinicalContent}=await import('@shared/discursiva-clinical');
 for(const profile of ['enamed','residencia'] as const){const bank=clinicalTemplates(profile);expect(bank).toHaveLength(7);for(const item of bank){expect(validateClinicalContent(item.content).profile).toBe(profile);expect(item.content.origin).toBe('authorial_preparation');expect(item.content.rubric.reduce((n,r)=>n+r.points,0)).toBe(10);expect(item.content.sources).toEqual([]);}}
});
