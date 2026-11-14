import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),getUser:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:api.from,rpc:api.rpc,auth:{getUser:api.getUser}}}));
import EstagioFormularios from './EstagioFormularios';
let container:HTMLDivElement,root:Root;
const record={id:'form',institution_id:'ies',placement_id:'work',course_id:'course',template:'plano',answers:{title:'PROJETO FICTÍCIO'},attachments:[],revision:1,owner_id:'user',status:'rascunho',document_id:null};
function button(t:string){const b=Array.from(container.querySelectorAll('button')).find(b=>b.textContent===t);if(!b)throw new Error(t);return b;}
async function click(t:string){await act(async()=>button(t).click());}
async function render(role='equipe'){await act(async()=>root.render(createElement(EstagioFormularios,{institutionId:'ies',role,students:[],rules:[],placements:[{id:'work',course_id:'course',title:'PROJETO FICTÍCIO',academic_term:'2026/2'}] as any,courses:[{id:'course',name:'Direito'}],onChanged:vi.fn()})));}
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.resetAllMocks();container=document.createElement('div');document.body.append(container);root=createRoot(container);
 api.getUser.mockResolvedValue({data:{user:{id:'user',email:'teste@example.org'}},error:null});
 api.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({order:async()=>({data:[record],error:null}),single:async()=>({data:{name:'IES FICTÍCIA'},error:null})})})}));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
it('keeps the draft and reports a failed save without success confirmation',async()=>{
 api.rpc.mockResolvedValue({data:null,error:{message:'Sessão expirada'}});await render();await click('Abrir formulário');await click('Salvar rascunho');
 expect(container.querySelector('[role=alert]')?.textContent).toContain('Sessão expirada');expect(container.textContent).not.toContain('Rascunho salvo');expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('PROJETO FICTÍCIO');
});
it('blocks incomplete completion before any PDF or RPC call',async()=>{
 await render();await click('Abrir formulário');await click('Anexos e emissão');await click('Emitir PDF na Mesa Digital');
 expect(api.rpc).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]')?.textContent).toContain('Professor orientador');
});
it('does not offer writing controls to readers or show fake empty state on load failure',async()=>{
 await render('leitor');expect(container.textContent).not.toContain('Novo documento por modelo');await click('Abrir formulário');expect(container.textContent).not.toContain('Salvar rascunho');
});
it('accepts a single-row RPC array and confirms saved state only after persistence',async()=>{
 api.rpc.mockResolvedValue({data:[{...record,revision:2}],error:null});await render();await click('Abrir formulário');await click('Salvar rascunho');
 expect(container.querySelector('[role=status]')?.textContent).toContain('Rascunho salvo');expect(container.textContent).toContain('Revisão 2');
});
