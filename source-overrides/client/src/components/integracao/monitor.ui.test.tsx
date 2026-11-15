import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {fixture} from './monitor-fixture';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),institutions:vi.fn(),versions:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({order:mocks.institutions})})})}),rpc:mocks.rpc}}));
vi.mock('./fontes',()=>({consultarVersoes:mocks.versions}));
import Monitor from './monitor';
let host:HTMLDivElement,root:Root;
async function select(value:string){await act(async()=>{const e=host.querySelector('select')!;e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));await Promise.resolve();});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-15T01:00:00Z'));Object.defineProperty(document,'hidden',{configurable:true,value:false});mocks.institutions.mockResolvedValue({data:[{id:a,name:'Campus Alpha',status:'ativa',tier:'superior'},{id:b,name:'Campus Beta',status:'ativa',tier:'superior'},{id:'SYN-DEMO',name:'Vértice Demonstração',status:'ativa',tier:'superior'}],error:null});mocks.rpc.mockImplementation(()=>({abortSignal:()=>Promise.resolve({data:fixture(),error:null})}));mocks.versions.mockResolvedValue({consultadoEm:'2026-11-15T01:00:00Z',resultados:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.resetAllMocks();});
async function render(){await act(async()=>{root.render(<Monitor/>);await Promise.resolve();});}
describe('coleta no painel',()=>{
 it('aguarda seleção explícita e exclui demonstrações',async()=>{await render();expect(mocks.rpc).not.toHaveBeenCalled();expect(host.textContent).not.toContain('Vértice Demonstração');await select(a);expect(mocks.rpc).toHaveBeenCalledWith('vertice_integration_monitor_read',{p_institution:a});expect(host.textContent).toContain('Não habilitado na fonte consultada');});
 it('consulta periodicamente quando visível e pausa com página oculta',async()=>{await render();await select(a);expect(mocks.rpc).toHaveBeenCalledTimes(1);await act(async()=>{await vi.advanceTimersByTimeAsync(5*60000)});expect(mocks.rpc).toHaveBeenCalledTimes(2);Object.defineProperty(document,'hidden',{configurable:true,value:true});await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(5*60000)});expect(mocks.rpc).toHaveBeenCalledTimes(2);Object.defineProperty(document,'hidden',{configurable:true,value:false});await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(mocks.rpc).toHaveBeenCalledTimes(3);});
 it('não usa falha de leitura como prova de zeros ou de funcionamento',async()=>{mocks.rpc.mockImplementation(()=>({abortSignal:()=>Promise.resolve({data:null,error:{code:'PGRST202'}})}));await render();await select(a);expect(host.textContent).toContain('Leitura não confirmada');expect(host.textContent).not.toContain('Estado observado');});
 it('descarta resposta atrasada de outra instituição',async()=>{let finish:(v:any)=>void=()=>{};mocks.rpc.mockImplementationOnce(()=>({abortSignal:()=>new Promise(r=>{finish=r;})}));await render();await select(a);await select(b);const old=fixture();old.live.recent_events='999';await act(async()=>{finish({data:old,error:null});await Promise.resolve()});expect(host.textContent).not.toContain('999');expect(mocks.rpc.mock.calls.at(-1)?.[1]).toEqual({p_institution:b});});
 it('agendamento sem histórico não é tratado como execução comprovada',async()=>{const f=fixture();f.scheduler_enabled=true;mocks.rpc.mockImplementation(()=>({abortSignal:()=>Promise.resolve({data:f,error:null})}));await render();await select(a);expect(host.textContent).toContain('Agendamento habilitado sem coleta recente confirmada');expect(host.textContent).toContain('Homologação humana pendente');});
});
