import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
import PlanningManagement from './PlanningManagement';
it('loads scoped data and exposes errors instead of stale institutional data',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 rpc.mockResolvedValueOnce({data:{institution_id:'ies-a',semester:'2026/2',semesters:['2026/2'],fetched_at:'2026-11-15T12:00:00Z',courses:[]},error:null});
 await act(async()=>root.render(<PlanningManagement institutionId="ies-a"/>));
 expect(rpc).toHaveBeenCalledWith('vertice_planning_management',{p_institution_id:'ies-a',p_semester:null});expect(el.textContent).toContain('2026/2');
 rpc.mockResolvedValueOnce({data:null,error:{message:'Acesso restrito'}});
 await act(async()=>root.render(<PlanningManagement institutionId="ies-b"/>));
 expect(el.querySelector('[role=alert]')?.textContent).toBe('Acesso restrito');expect(el.textContent).not.toContain('2026/2');
 await act(async()=>root.unmount());el.remove();
});
