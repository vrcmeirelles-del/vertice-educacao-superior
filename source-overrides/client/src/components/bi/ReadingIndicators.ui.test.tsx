import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
import ReadingIndicators from './ReadingIndicators';
let host:HTMLDivElement,root:Root;
const snapshot=(institutionId='synthetic-a',extra:Record<string,unknown>={})=>({ok:true,institutionId,scope:'institution',educationTier:'superior',periodDays:90,retrievedAt:'2026-11-15T08:00:00Z',indicators:[{module:'oab2',action:'displayed',total:10},{module:'oab2',action:'opened',total:4},{module:'oab2',action:'declared_read',total:2}],...extra});
const render=async(institutionId='synthetic-a',role:string|null='reitor',extra:Record<string,unknown>={})=>act(async()=>root.render(<ReadingIndicators institutionId={institutionId} role={role} {...extra}/>));
const refresh=async()=>act(async()=>host.querySelector('button')!.click());
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mocks.invoke.mockReset().mockResolvedValue({data:snapshot(),error:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('renders event counts with source, fixed window and self-declaration warning, with no rates or academic scores',async()=>{
 await render();expect(mocks.invoke).toHaveBeenCalledWith('vertice-learning-bridge',{body:{operation:'reading_indicators',institutionId:'synthetic-a'}});
 expect(host.textContent).toContain('Leitura autodeclarada não comprova aprendizagem');expect(host.textContent).toContain('90 dias');expect(host.textContent).toContain('não se aplicam');
 expect(host.querySelector('tbody tr')?.textContent).toBe('OAB 2ª fase1042');expect(host.querySelector('time')?.dateTime).toBe('2026-11-15T08:00:00Z');
 expect(host.textContent).toContain('sem total de estudantes únicos');expect(host.textContent).not.toContain('%');
});
it('renders empty authorized data separately from failure and fetches changed totals on refresh',async()=>{
 mocks.invoke.mockResolvedValueOnce({data:snapshot('synthetic-a',{indicators:[]}),error:null});await render();expect(host.textContent).toContain('Nenhum evento');expect(host.querySelector('table')).toBeNull();
 await refresh();expect(host.querySelector('tbody tr')?.textContent).toBe('OAB 2ª fase1042');
 mocks.invoke.mockResolvedValueOnce({data:null,error:new Error('upstream failure')});await refresh();expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();expect(host.textContent).not.toContain('Nenhum evento');
 await refresh();expect(host.querySelector('table')).not.toBeNull();expect(host.querySelector('[role=alert]')).toBeNull();
});
it('ignores an earlier tenant response and clears scope before new data arrives',async()=>{
 let resolveOld!:(value:any)=>void,resolveNew!:(value:any)=>void;
 mocks.invoke.mockImplementationOnce(()=>new Promise(r=>resolveOld=r)).mockImplementationOnce(()=>new Promise(r=>resolveNew=r));
 await render();await render('synthetic-b');await act(async()=>resolveOld({data:snapshot('synthetic-a'),error:null}));expect(host.querySelector('table')).toBeNull();
 await act(async()=>resolveNew({data:snapshot('synthetic-b',{indicators:[{module:'enade',action:'opened',total:8}]}),error:null}));
 expect(host.querySelector('tbody')?.textContent).toBe('ENADE080');expect(host.textContent).not.toContain('OAB 2ª fase');
});
it('removes data when role becomes course scoped and never queries for that role',async()=>{
 await render();mocks.invoke.mockClear();await render('synthetic-a','coordenador');expect(host.querySelector('table')).toBeNull();expect(host.textContent).toContain('restritos à alta gestão');expect(mocks.invoke).not.toHaveBeenCalled();
 await render('synthetic-a',null);expect(mocks.invoke).not.toHaveBeenCalled();
});
it('uses school snapshot only in matching context, without client-selected upstream endpoint',async()=>{
 mocks.invoke.mockResolvedValue({data:snapshot('synthetic-a',{educationTier:'escolas',indicators:[{module:'enem',action:'declared_read',total:3}]}),error:null});
 await render('synthetic-a','reitor',{expectedTier:'escolas'});expect(host.querySelector('tbody')?.textContent).toBe('ENEM003');expect(host.textContent).toContain('VÉRTICE ESCOLAS');
 await render('synthetic-a','reitor',{expectedTier:'superior'});expect(host.querySelector('table')).toBeNull();expect(host.querySelector('[role=alert]')).not.toBeNull();
});
it.each([
 {institutionId:'synthetic-other'},{scope:'course'},{educationTier:'unknown'},{periodDays:30},{retrievedAt:'invalid'},
 {indicators:[{module:'enem',action:'opened',total:1}]},{indicators:[{module:'oab',action:'mastered',total:1}]},
 {indicators:[{module:'oab',action:'opened',total:-1}]},{indicators:null}
])('rejects mismatched or malformed responses: %j',async extra=>{
 mocks.invoke.mockResolvedValue({data:snapshot('synthetic-a',extra),error:null});await render();expect(host.querySelector('table')).toBeNull();expect(host.querySelector('[role=alert]')).not.toBeNull();
});
it('requeries after parent synchronization revision and treats function error body as failure',async()=>{
 await render();await render('synthetic-a','reitor',{revision:1});expect(mocks.invoke).toHaveBeenCalledTimes(2);
 mocks.invoke.mockResolvedValue({data:{error:'not authorized'},error:null});await refresh();expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('table')).toBeNull();
});
