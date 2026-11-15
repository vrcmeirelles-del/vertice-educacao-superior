import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
const rpc=vi.hoisted(()=>vi.fn());
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabase:{rpc,functions:{invoke}}}));
import SchoolIndividual from './SchoolIndividual';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>|null=null;let el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());el?.remove();root=null;rpc.mockReset();invoke.mockReset();});
const data={institution_id:'a',students:[],events:[],templates:[],documents:[],classes:[]};
async function mount(view:'students'|'documents'){el=document.createElement('div');document.body.append(el);root=createRoot(el);await act(async()=>root!.render(<SchoolIndividual institutionId="a" view={view}/>));}
it('does not pretend an empty registry is a risk assessment',async()=>{rpc.mockResolvedValue({data,error:null});await mount('students');expect(el.textContent).toContain('Nenhum estudante escolar cadastrado');expect(el.textContent).toContain('não probabilidade de abandono');});
it('keeps issuance unavailable without an approved template and student',async()=>{rpc.mockResolvedValue({data,error:null});invoke.mockResolvedValue({data:{autentique_configured:false},error:null});await mount('documents');expect(el.textContent).toContain('credencial institucional ainda não configurada');const button=[...el.querySelectorAll('button')].find(b=>b.textContent==='Emitir PDF com dados conferidos');expect(button?.disabled).toBe(true);expect(el.textContent).toContain('não é um validador criptográfico público');});
it('clears preceding institution data after an access denial',async()=>{rpc.mockResolvedValueOnce({data:{...data,students:[{id:'s',full_name:'Estudante A',enrollment_code:'A1',status:'active'}]},error:null});await mount('students');expect(el.textContent).toContain('Estudante A');rpc.mockResolvedValueOnce({data:null,error:{message:'Acesso negado'}});await act(async()=>root!.render(<SchoolIndividual institutionId="b" view="students"/>));expect(el.querySelector('[role=alert]')?.textContent).toBe('Acesso negado');expect(el.textContent).not.toContain('Estudante A');});
