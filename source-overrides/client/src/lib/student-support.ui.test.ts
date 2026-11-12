import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createElement,act} from 'react';
import {createRoot,Root} from 'react-dom/client';
const api=vi.hoisted(()=>({from:vi.fn(),insert:vi.fn(),order:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{from:api.from}}));
import Inclusao360 from '../components/area/Inclusao360';
import AcompanhamentoEspecial360 from '../components/area/AcompanhamentoEspecial360';
let container:HTMLDivElement,root:Root;
const rows=[{id:'case-a',institution_id:'ies-a',student_name:'TESTE FICTÍCIO',status:'solicitacao_recebida',created_at:'2026-11-12',priority:'normal'}];
function button(text:string){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error(`Missing ${text}`);return b;}
async function click(text:string){await act(async()=>{button(text).click();});}
async function fill(placeholder:string,value:string){await act(async()=>{const field=container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
async function render(Component:any,ies='ies-a'){await act(async()=>root.render(createElement(Component,{institutionId:ies,role:'master'})));}
beforeEach(()=>{vi.resetAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);api.insert.mockResolvedValue({error:null});api.order.mockImplementation((table:string,_column:string,ies:string)=>Promise.resolve({data:table.endsWith('_cases')&&ies==='ies-a'?rows:[],error:null}));api.from.mockImplementation((table:string)=>({insert:api.insert,select:()=>({eq:(_key:string,ies:string)=>({order:(column:string)=>api.order(table,column,ies)})})}));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
describe.each([['Inclusão',Inclusao360],['Especial',AcompanhamentoEspecial360]] as const)('%s synthetic DOM',(_name,Component)=>{
 it('uses existing sort columns and reports loading failure without fake zero KPIs',async()=>{api.order.mockResolvedValue({data:null,error:{code:'42501'}});await render(Component);expect(container.querySelector('[role=alert]')).not.toBeNull();expect(container.textContent).not.toContain('Nenhum caso');expect(container.querySelector('[class$=kpis]')).toBeNull();expect(api.order.mock.calls.every(c=>['created_at','category','label'].includes(c[1]))).toBe(true);});
 it('retains draft on DB rejection and prevents duplicate in-flight writes',async()=>{let resolve!:(v:any)=>void;api.insert.mockReturnValue(new Promise(r=>resolve=r));await render(Component);await click('+ Novo caso');await fill('Nome do estudante','FICTÍCIO NOVO');await act(async()=>{button('Abrir caso').click();button('Abrir caso').click();});expect(api.insert).toHaveBeenCalledTimes(1);await act(async()=>resolve({error:{code:'42501'}}));expect(container.querySelector('[role=alert]')?.textContent).toContain('Não foi possível salvar');expect(container.querySelector<HTMLInputElement>('input[placeholder="Nome do estudante"]')?.value).toBe('FICTÍCIO NOVO');});
 it('closes form only after successful write and reloads',async()=>{await render(Component);await click('+ Novo caso');await fill('Nome do estudante','FICTÍCIO NOVO');await click('Abrir caso');expect(api.insert).toHaveBeenCalledTimes(1);expect(api.insert.mock.calls[0][0]).toMatchObject({institution_id:'ies-a',student_name:'FICTÍCIO NOVO',status:'solicitacao_recebida'});expect(container.querySelector('input[placeholder="Nome do estudante"]')).toBeNull();});
 it('clears tenant-specific state and forms on institution change',async()=>{await render(Component);expect(container.textContent).toContain('TESTE FICTÍCIO');await click('+ Novo caso');await fill('Nome do estudante','NÃO TRANSFERIR');await render(Component,'ies-b');expect(container.textContent).not.toContain('TESTE FICTÍCIO');expect(container.querySelector('input[placeholder="Nome do estudante"]')).toBeNull();expect(api.insert).not.toHaveBeenCalled();});
});
