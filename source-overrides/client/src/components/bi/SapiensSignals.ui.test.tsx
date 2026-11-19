import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
import SapiensSignals from './SapiensSignals';
let host:HTMLDivElement,root:Root;
const st=(enrollmentRef:string,status:string,diagnostics:unknown[]=[])=>({enrollmentRef,courseId:'c1',courseName:'Direito',
 engagement:{status,lastActivityAt:'2026-11-10T10:00:00Z',answersLast7Days:2,answersPrevious7Days:9,activeDaysLast14:3,pausesAcceptedLast14Days:0},diagnostics,prescriptions:[]});
const snapshot=(institutionId='synthetic-a',extra:Record<string,unknown>={})=>({ok:true,institutionId,scope:'institution',educationTier:'superior',retrievedAt:'2026-11-19T09:00:00Z',unmatched:0,
 summary:{ativo:1,em_queda:0,sem_atividade:1,nunca_iniciou:0,comDiagnostico:1,comPrescricao:0},
 patterns:[{label:'Lacuna de base',discipline:'Direito Civil',theme:'Contratos',students:1}],
 students:[st('2024002','sem_atividade',[{code:'E-CONT-01',label:'Lacuna de base',family:'Conteúdo',competency:{kcId:'DC-05',discipline:'Direito Civil',theme:'Contratos'},since:'2026-11-18T00:00:00Z',sampleSize:12}]),st('2024001','ativo')],...extra});
const render=async(institutionId='synthetic-a',role:string|null='reitor')=>act(async()=>root.render(<SapiensSignals institutionId={institutionId} role={role}/>));
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mocks.invoke.mockReset().mockResolvedValue({data:snapshot(),error:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('mostra resumo, padrões mais frequentes e alunos por matrícula, com aviso de natureza descritiva',async()=>{
 await render();
 expect(mocks.invoke).toHaveBeenCalledWith('vertice-learning-bridge',{body:{operation:'sapiens_signals',institutionId:'synthetic-a'}});
 expect(host.textContent).toContain('não nota nem previsão');
 expect(host.textContent).toContain('Direito Civil · Contratos — Lacuna de base: 1 aluno(s)');
 const rows=[...host.querySelectorAll('table')[1].querySelectorAll('tbody tr')].map(r=>r.querySelector('th')?.textContent);
 expect(rows).toEqual(['2024002','2024001']);
});
it('filtra por situação e por padrão de erro',async()=>{
 await render();
 const select=host.querySelector('select')!;
 await act(async()=>{select.value='ativo';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect([...host.querySelectorAll('table')[1].querySelectorAll('tbody tr')].length).toBe(1);
 await act(async()=>{select.value='diagnostico';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.querySelectorAll('table')[1].querySelector('tbody th')?.textContent).toBe('2024002');
});
it('falha não mostra dado anterior; resposta de outra instituição é recusada',async()=>{
 mocks.invoke.mockResolvedValueOnce({data:null,error:new Error('x')});await render();
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();
 mocks.invoke.mockResolvedValueOnce({data:snapshot('synthetic-b'),error:null});
 await act(async()=>host.querySelector('button')!.click());
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();
});
it('papel sem autorização não consulta',async()=>{
 await render('synthetic-a','coordenador');expect(mocks.invoke).not.toHaveBeenCalled();expect(host.textContent).toContain('restritos à alta gestão');
});
