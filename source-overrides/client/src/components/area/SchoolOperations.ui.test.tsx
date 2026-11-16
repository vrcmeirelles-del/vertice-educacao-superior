import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
import SchoolOperations from './SchoolOperations';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>|null=null;let el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());el?.remove();rpc.mockReset();root=null;});
const snapshot={institution_id:'school-a',fetched_at:'2026-11-15',classes:[{id:'c1',name:'Turma A',grade:'1º',year:2026,enrolled:20,capacity:30,failed:null,dropped:null}],segments:[],records:[],indicators:[]};
async function mount(view:any='bi'){el=document.createElement('div');document.body.append(el);root=createRoot(el);await act(async()=>root!.render(<SchoolOperations institutionId="school-a" view={view}/>));}
it('queries institutional school data and preserves missing counts',async()=>{rpc.mockResolvedValue({data:snapshot,error:null});await mount();expect(rpc).toHaveBeenCalledWith('vertice_school_operations',{p_institution_id:'school-a',p_action:'overview',p_payload:{}});expect(el.textContent).toContain('66.7%');expect(el.textContent).toContain('Sem dado');expect(el.textContent).toContain('Fonte pendente');});
it('does not mix unit and class closures or include drafts in totals',async()=>{const data={...snapshot,records:[{id:'f1',kind:'finance',year:2026,class_id:null,title:'Unidade',status:'completed',source:'Extrato',data:{month:11,revenue_received:1000,personnel:100,direct_cost:100,allocated_cost:100}},{id:'f2',kind:'finance',year:2026,class_id:'c1',title:'Turma',status:'completed',data:{month:11,revenue_received:9000,personnel:0,direct_cost:0,allocated_cost:0}},{id:'f3',kind:'finance',year:2026,class_id:null,title:'Rascunho',status:'draft',data:{month:10,revenue_received:8000,personnel:0,direct_cost:0,allocated_cost:0}}]};rpc.mockResolvedValue({data,error:null});await mount('financeiro');const text=el.querySelector('.so-kpis')!.textContent!;expect(text).toContain('1.000,00');expect(text).toContain('700,00');expect(text).not.toContain('9.000');expect(text).not.toContain('8.000');});
it('removes previous school data after a scope change and denial',async()=>{
 // The source-status child makes its own RPC; it must not consume the overview response.
 rpc.mockImplementation(async(name:string,args:any)=>name==='vertice_school_operations'
  ? args.p_institution_id==='school-a'?{data:snapshot,error:null}:{data:null,error:{message:'Acesso negado'}}
  : {data:[],error:null});
 await mount();expect(el.textContent).toContain('Turma A');
 await act(async()=>root!.render(<SchoolOperations institutionId="school-b" view="bi"/>));
 expect([...el.querySelectorAll('[role=alert]')].map(a=>a.textContent)).toContain('Acesso negado');expect(el.textContent).not.toContain('Turma A');
});
