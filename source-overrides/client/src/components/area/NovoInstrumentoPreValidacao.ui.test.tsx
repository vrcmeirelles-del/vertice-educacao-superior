// Botão de pré-validação no acervo do Novo Instrumento 2026: só para gestão, só com arquivo enviado,
// e abre o painel existente com a tabela do acervo (o banco escolhe acervo e catálogo pela seção).
import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const fx=vi.hoisted(()=>({panel:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:vi.fn(),rpc:vi.fn(),storage:{from:vi.fn()}}}));
vi.mock('@/lib/area',()=>({can:{manageGoals:(r:string|null)=>r==='gestor'}}));
vi.mock('@/lib/repository',()=>({documentFile:()=>({ext:'pdf',mime:'application/pdf'})}));
vi.mock('./PreValidationPanel',()=>({default:(p:any)=>{fx.panel(p);return <div data-testid="painel">Painel {p.file.file_name}</div>;}}));
import {NovoObjetoDocumentos2026} from './NovoInstrumentoDocumental2026';
let root:Root|undefined,el:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());el?.remove();fx.panel.mockReset();});
const object={code:'E1.1',title:'PDI',hint:'PDI vigente'};
const state=(withFile:boolean):any=>({institutionId:'ies-a',scope:'institucional',courseId:null,busy:false,error:'',members:[],reload:vi.fn(),
 requests:[{id:'req-1',course_id:null,document_code:'NI26I:E1.1:2026-2',title:'PDI',semester:'2026-2',not_applicable:false,nsa_reason:null,assignee_email:null,assigned_to:null,due_date:null,active:true}],
 files:withFile?[{id:'file-1',request_id:'req-1',file_name:'pdi.pdf',storage_path:'x',status:'enviado',reference:null,upload_note:null,review_note:null,created_at:'2026-11-25T10:00:00Z'}]:[]});
async function render(role:string,withFile=true){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 await act(async()=>root!.render(<NovoObjetoDocumentos2026 state={state(withFile)} role={role as any} object={object} initialPeriod="2026-2"/>));
}
const button=()=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='Pré-validar');

it('gestão vê o botão e abre o painel com o arquivo e a tabela do acervo',async()=>{
 await render('gestor');
 expect(button()).toBeDefined();
 await act(async()=>button()!.click());
 await act(async()=>{await new Promise(r=>setTimeout(r,0));});
 expect(fx.panel).toHaveBeenCalled();
 const props=fx.panel.mock.calls.at(-1)![0];
 expect(props.file.id).toBe('file-1');
 expect(props.institutionId).toBe('ies-a');
 expect(props.sourceTable).toBe('vertice_repository_files');
});

it('sem papel de gestão ou sem arquivo, não há botão',async()=>{
 await render('leitor');
 expect(button()).toBeUndefined();
 await act(async()=>root!.unmount());root=undefined;el.remove();
 await render('gestor',false);
 expect(button()).toBeUndefined();
});
