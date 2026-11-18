import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),getUser:vi.fn(),invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:api.from,rpc:api.rpc,auth:{getUser:api.getUser},functions:{invoke:api.invoke}}}));
import ExtensaoAlunosConvites from './ExtensaoAlunosConvites';
import ExtensaoFormularios from './ExtensaoFormularios';
import ExtensaoEvidencias from './ExtensaoEvidencias';
let container:HTMLDivElement,root:Root;
const record={id:'form',institution_id:'ies',project_id:'project',course_id:'course',template:'extensao',answers:{title:'PROJETO FICTÍCIO'},attachments:[],revision:1,owner_id:'user',status:'rascunho',document_id:null};
function button(t:string){const b=Array.from(container.querySelectorAll('button')).find(b=>b.textContent===t||b.querySelector('span')?.textContent===t);if(!b)throw new Error(t);return b;}
async function click(t:string){await act(async()=>button(t).click());}
async function render(role='equipe'){await act(async()=>root.render(createElement(ExtensaoFormularios,{institutionId:'ies',role,courses:[{id:'course',name:'Direito'}],onChanged:vi.fn()})));}
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
 await render();await click('Abrir formulário');await click('Evidências e envio');await click('Enviar Relatório Final e gerar PDF');
 expect(api.rpc).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]')?.textContent).toContain('comprovante');
});
it('does not offer writing controls to readers or show fake empty state on load failure',async()=>{
 await render('leitor');expect(container.textContent).not.toContain('Novo projeto por modelo');await click('Abrir formulário');expect(container.textContent).not.toContain('Salvar rascunho');
});
it('accepts a single-row RPC array and confirms saved state only after persistence',async()=>{
 api.rpc.mockResolvedValue({data:[{...record,revision:2}],error:null});await render();await click('Abrir formulário');await click('Salvar rascunho');
 expect(container.querySelector('[role=status]')?.textContent).toContain('Rascunho salvo');expect(container.textContent).toContain('Revisão 2');
});

it('generates an individual WhatsApp link for a pending invitation without invoking email delivery',async()=>{
 const email='aluno@example.org',token='ab'.repeat(32);
 api.rpc.mockImplementation(async (name:string)=>({
  data:name==='vertice_extension_student_issue'?{token,email}:[{
   id:'invite',email,expires_at:'2099-01-01T00:00:00Z',updated_at:'2026-11-17T00:00:00Z',
   state:'rascunho',answers:{},
  }],error:null,
 }));
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 try{
  await act(async()=>root.render(createElement(ExtensaoAlunosConvites,{projectId:'project',onUse:vi.fn()})));
  await click('Gerar novo link');
  expect(api.rpc).toHaveBeenCalledWith('vertice_extension_student_issue',expect.objectContaining({p_project:'project',p_invite:'invite'}));
  expect(api.invoke).not.toHaveBeenCalled();
  const input=container.querySelector<HTMLInputElement>('section[aria-label="Link de convite para WhatsApp"] input');
  expect(input?.value).toBe(window.location.origin+'/extensao-convite?aluno=1#ativacao='+token);
  await click('Ocultar link');
  expect(container.querySelector('section[aria-label="Link de convite para WhatsApp"]')).toBeNull();
 }finally{confirm.mockRestore();}
});


it('links an existing evidence to the open project and refreshes the project list of evidence',async()=>{
 const document={
  id:'evidence',title:'Ata da reunião',file_name:'ata.pdf',file_size_bytes:1024,
  document_type:'ata',validation_status:'aprovada',version:1,
  uploaded_at:'2026-11-17T12:00:00Z',project_id:'original',
 };
 let linked=false;
 api.from.mockImplementation((table:string)=>({
  select:()=>{
   const query={
    eq:()=>query,is:()=>query,
    order:()=>query,
    then:(resolve:(result:{data:unknown[];error:null})=>void)=>{
     resolve({data:table==='vertice_extension_evidence_registry'||linked?[document]:[],error:null});
    },
   };
   return query;
  },
 }));
 api.rpc.mockImplementation(async()=>{linked=true;return {error:null};});
 const onLinked=vi.fn();
 await act(async()=>root.render(createElement(ExtensaoEvidencias,{
  institutionId:'ies',projectId:'destination',projectTitle:'Projeto destino',
  canEdit:false,linkableProjects:[{id:'destination',title:'Projeto destino'}],
  onLinked,onClose:vi.fn(),
 })));
 await click('Vincular evidência existente');
 const select=container.querySelector<HTMLSelectElement>('fieldset select')!;
 expect(select.options[1].textContent).toContain('Ata da reunião · ata.pdf');
 await act(async()=>{
  select.value='evidence';
  select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await click('Vincular');
 expect(api.rpc).toHaveBeenCalledTimes(1);
 expect(api.rpc).toHaveBeenCalledWith('vertice_extension_link_evidence',{
  p_project:'destination',p_evidence:'evidence',
 });
 expect(onLinked).toHaveBeenCalledOnce();
 expect(container.querySelector('tbody')?.textContent).toContain('Ata da reunião');
 expect(container.querySelector('[role=status]')?.textContent).toContain('Evidência vinculada');
});
