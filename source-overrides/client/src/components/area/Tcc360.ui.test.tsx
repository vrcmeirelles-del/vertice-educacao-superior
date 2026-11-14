import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
const f=vi.hoisted(()=>({works:[] as any[],summary:[] as any[],create:vi.fn(),transition:vi.fn(),summaryFetch:vi.fn()}));
vi.mock('@/lib/tcc',async()=>{
  const actual=await vi.importActual<typeof import('@/lib/tcc')>('@/lib/tcc');
  return {...actual,fetchWorks:async()=>f.works,fetchWorkTypes:async()=>[{id:'type',label:'Artigo'}],fetchCourseSummary:f.summaryFetch,createWork:f.create,transitionWork:f.transition};
});
import Tcc360 from './Tcc360';
let container:HTMLDivElement,root:Root;
const work={id:'work',title:'Trabalho sintético',course_id:'course',academic_term:'2026.2',stage:'draft',version:1};
beforeEach(()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  vi.clearAllMocks();f.works=[work];f.summary=[{course_id:'course',course_name:'Direito',works_active:1,authors_distinct:0,works_deposited:0,works_overdue:0,hours_validated_minutes:0,advisors_active:0,alignments_validated:0}];
  f.summaryFetch.mockImplementation(async()=>f.summary);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function click(text:string){const button=[...container.querySelectorAll('button')].find(b=>b.textContent?.includes(text));expect(button).toBeDefined();await act(async()=>button!.dispatchEvent(new MouseEvent('click',{bubbles:true})));}
async function render(){await act(async()=>root.render(<Tcc360 institutionId="ies" courses={[{id:'course',name:'Direito'}]} role="master"/>));}
function activeKpi(){return [...container.querySelectorAll('.alumni-kpi')].find(k=>k.textContent?.includes('Trabalhos Ativos'))?.textContent;}
it('refreshes the summary together with the portfolio after creating a work',async()=>{
  f.create.mockImplementation(async()=>{f.works=[work,{...work,id:'new'}];f.summary=[{...f.summary[0],works_active:2}];});
  await render();await click('Carteira');await click('Novo trabalho');
  for(const [labelText,value] of [['Curso *','course'],['Tipo *','type']]) {
    const label=[...container.querySelectorAll('label')].find(l=>l.textContent?.startsWith(labelText))!;
    const select=label.querySelector('select')!;
    await act(async()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  }
  const title=container.querySelector('input[placeholder="Título do trabalho"]') as HTMLInputElement;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(title,'Novo trabalho sintético');title.dispatchEvent(new Event('input',{bubbles:true}));});
  await click('Criar trabalho');
  expect(f.create).toHaveBeenCalledTimes(1);expect(f.summaryFetch).toHaveBeenCalledTimes(2);
  await click('BI 360');expect(activeKpi()).toContain('2');
});
it('refreshes the BI after a stage transition and keeps optimistic version checks',async()=>{
  f.transition.mockImplementation(async()=>{f.works=[{...work,stage:'deposited',version:2}];f.summary=[{...f.summary[0],works_deposited:1}];});
  await render();await click('Carteira');await click('→ Submetido');
  expect(f.transition).toHaveBeenCalledWith('work','ies','submitted',expect.any(String),expect.any(String),'coordinator',1);
  expect(f.summaryFetch).toHaveBeenCalledTimes(2);
  await click('BI 360');expect(container.textContent).toContain('Depositados');
  const kpi=[...container.querySelectorAll('.alumni-kpi')].find(k=>k.textContent?.includes('Depositados'));expect(kpi?.textContent).toContain('1');
});
