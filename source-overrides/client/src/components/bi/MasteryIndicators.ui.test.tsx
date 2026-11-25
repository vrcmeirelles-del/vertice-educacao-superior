import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
import MasteryIndicators from './MasteryIndicators';
let host:HTMLDivElement,root:Root;
const group=(courseId:string,courseName:string,theme:string,meanPKnow:number)=>({courseId,courseName,discipline:'Direito Civil',theme,students:6,meanPKnow,studentsBelow:3,attempts:60,accuracy:0.5});
const snapshot=(institutionId='synthetic-a',extra:Record<string,unknown>={})=>({ok:true,institutionId,scope:'institution',educationTier:'superior',retrievedAt:'2026-11-25T09:00:00Z',
 rules:{version:'1',minAttempts:3,belowThreshold:0.6,minGroup:5,maxRecords:200000,maxGroups:300},
 groups:[group('c1','Direito','Contratos',0.41),group('c2','Administração','',0.55)],
 disciplines:[{discipline:'Direito Civil',students:12,meanPKnow:0.48,studentsBelow:6}],
 coverage:{records:30,matchedStudents:12,unmatchedStudents:2,insufficientEvidence:4,suppressedGroups:1,truncatedGroups:0},...extra});
const render=async(institutionId='synthetic-a',role:string|null='reitor')=>act(async()=>root.render(<MasteryIndicators institutionId={institutionId} role={role}/>));
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mocks.invoke.mockReset().mockResolvedValue({data:snapshot(),error:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('consulta a operação institucional e mostra síntese, cobertura e temas',async()=>{
 await render();
 expect(mocks.invoke).toHaveBeenCalledWith('vertice-learning-bridge',{body:{operation:'mastery_indicators',institutionId:'synthetic-a'}});
 expect(host.textContent).toContain('não é nota nem previsão');
 expect(host.textContent).toContain('2 sem matrícula ativa');
 const rows=[...host.querySelectorAll('table')[1].querySelectorAll('tbody th')].map(th=>th.textContent);
 expect(rows).toEqual(['Direito Civil · Contratos','Direito Civil (tema geral)']);
});
it('filtra por curso',async()=>{
 await render();
 const select=host.querySelector('select')!;
 await act(async()=>{select.value='c2';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.querySelectorAll('table')[1].querySelectorAll('tbody tr').length).toBe(1);
});
it('recusa resposta de outra instituição ou com grupo abaixo do mínimo, sem mostrar dado anterior',async()=>{
 mocks.invoke.mockResolvedValueOnce({data:snapshot('synthetic-b'),error:null});await render();
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();
 mocks.invoke.mockResolvedValueOnce({data:snapshot('synthetic-a',{groups:[{...group('c1','Direito','X',0.5),students:2}]}),error:null});
 await act(async()=>host.querySelector('button')!.click());
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();
});
it('papel sem autorização não consulta',async()=>{
 await render('synthetic-a','professor');
 expect(mocks.invoke).not.toHaveBeenCalled();
 expect(host.textContent).toContain('restritos à alta gestão');
});
