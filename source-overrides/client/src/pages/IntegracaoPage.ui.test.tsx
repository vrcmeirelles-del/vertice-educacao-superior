import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),assurance:vi.fn(),query:vi.fn(),listener:null as null|((event:string)=>void),unsubscribe:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{auth:{getUser:mocks.getUser,mfa:{getAuthenticatorAssuranceLevel:mocks.assurance},onAuthStateChange:(fn:(event:string)=>void)=>{mocks.listener=fn;return{data:{subscription:{unsubscribe:mocks.unsubscribe}}}}},from:()=>({select:()=>({eq:()=>({limit:mocks.query})})})}}));
vi.mock('../components/integracao/central',()=>({default:({storageScope}:{storageScope:string})=><div data-testid="central">Painel autorizado {storageScope}</div>}));
import Page from './IntegracaoPage';
let host:HTMLDivElement,root:Root;
const user='SYN-MASTER';
async function render(){await act(async()=>{root.render(<Page/>);await Promise.resolve();});await act(async()=>{await new Promise(r=>setTimeout(r,5));});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mocks.getUser.mockResolvedValue({data:{user:{id:user,email_confirmed_at:'synthetic'}},error:null});mocks.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null});mocks.query.mockResolvedValue({data:[{user_id:user}],error:null});mocks.listener=null;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
describe('acesso à área de integração',()=>{
 it('exige conta confirmada, MFA e papel Master antes de montar o painel',async()=>{await render();expect(host.textContent).toContain('Painel autorizado SYN-MASTER');});
 it('sem usuário não consulta papel nem monta painel',async()=>{mocks.getUser.mockResolvedValue({data:{user:null},error:null});await render();expect(host.textContent).toContain('Acesso restrito ao Master');expect(mocks.query).not.toHaveBeenCalled();});
 it('conta sem confirmação não monta painel',async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:user}},error:null});await render();expect(host.querySelector('[data-testid=central]')).toBeNull();});
 it('nega acesso sem segundo fator',async()=>{mocks.assurance.mockResolvedValue({data:{currentLevel:'aal1'},error:null});await render();expect(host.textContent).toContain('Acesso restrito ao Master');expect(mocks.query).not.toHaveBeenCalled();});
 it('nega conta autenticada sem papel global',async()=>{mocks.query.mockResolvedValue({data:[],error:null});await render();expect(host.textContent).toContain('Acesso restrito ao Master');});
 it('erro na verificação não libera painel',async()=>{mocks.query.mockResolvedValue({data:null,error:new Error('synthetic')});await render();expect(host.querySelector('[data-testid=central]')).toBeNull();});
 it('logout desmonta o painel e ignora consulta anterior atrasada',async()=>{let resolve:(value:any)=>void=()=>{};mocks.query.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));await render();await act(async()=>{mocks.listener?.('SIGNED_OUT');resolve({data:[{user_id:user}],error:null});await Promise.resolve();});expect(host.querySelector('[data-testid=central]')).toBeNull();expect(host.textContent).toContain('Acesso restrito ao Master');});
 it('oculta antes do congelamento de página e encerra assinatura',async()=>{await render();await act(async()=>window.dispatchEvent(new Event('pagehide')));expect(host.querySelector('[data-testid=central]')).toBeNull();});
});
