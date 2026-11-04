import {describe,it,expect,vi,beforeEach} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const h=vi.hoisted(()=>({states:[] as unknown[],index:0,setters:[] as ReturnType<typeof vi.fn>[],effects:[] as (()=>void|(()=>void))[],response:Promise.resolve({data:[],error:null}) as Promise<any>}));
vi.mock('react',async()=>{const actual=await vi.importActual<any>('react');return {...actual,useState:(initial:unknown)=>{const index=h.index++;const setter=vi.fn();h.setters[index]=setter;return [index<h.states.length?h.states[index]:initial,setter];},useEffect:(fn:()=>void)=>h.effects.push(fn)};});
vi.mock('../client/src/lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>h.response})})})})}}));
import InepLibrary from '../client/src/components/area/InepLibrary';
const failure='Não foi possível consultar a biblioteca. Os documentos não foram verificados.';
function render({loading=false,error='',downloadError='',documents=[] as any[]}={}){h.states=[documents,loading,error,downloadError,0,'','','','',false,''];h.index=0;return renderToStaticMarkup(createElement(InepLibrary,{institutionId:'institution-one'}));}
async function runEffect(){h.effects[0]();await new Promise(resolve=>setTimeout(resolve,0));}
beforeEach(()=>{h.states=[];h.index=0;h.setters=[];h.effects=[];h.response=Promise.resolve({data:[],error:null});});
describe('Biblioteca: leitura não é ausência',()=>{
 it('erro de consulta não anuncia zero nem ausência de documentos',()=>{const html=render({error:failure});expect(html).toContain(failure);expect(html).toContain('Tentar novamente');expect(html).toContain('Consulta indisponível');expect(html).not.toContain('0 arquivos');expect(html).not.toContain('Não há documentos');});
 it('lista vazia confirmada mostra ausência sem alerta de falha',()=>{const html=render();expect(html).toContain('0 arquivos');expect(html).toContain('Não há documentos da biblioteca disponibilizados');expect(html).not.toContain('role="alert"');expect(html).not.toContain('Tentar novamente');});
 it('carregamento não apresenta zero ou conclusão de ausência',()=>{const html=render({loading:true});expect(html).toContain('Carregando a biblioteca');expect(html).not.toContain('0 arquivos');expect(html).not.toContain('Não há documentos');});
 it('falha de download mantém catálogo carregado',()=>{const html=render({downloadError:'Download indisponível',documents:[{id:'d',code:'1.1',dimension:'1',indicator:'1.1',file_name:'Modelo.docx',format:'docx',size_bytes:100,is_placeholder:false,title:'Modelo',original_path:'Modelo.docx'}]});expect(html).toContain('1 arquivos');expect(html).toContain('Modelo.docx');expect(html).toContain('Download indisponível');expect(html).not.toContain('Consulta indisponível');});
 it('erro retornado pela consulta termina loading com erro, não lista vazia',async()=>{h.response=Promise.resolve({data:null,error:{code:'42501'}});render();await runEffect();expect(h.setters[2]).toHaveBeenLastCalledWith(failure);expect(h.setters[1]).toHaveBeenLastCalledWith(false);expect(h.setters[0]).toHaveBeenCalledTimes(1);});
 it('rejeição de rede termina loading com erro',async()=>{render();h.response=Promise.reject(new Error('network'));await runEffect();expect(h.setters[2]).toHaveBeenLastCalledWith(failure);expect(h.setters[1]).toHaveBeenLastCalledWith(false);});
 it('resposta null sem erro não é interpretada como lista vazia confirmada',async()=>{h.response=Promise.resolve({data:null,error:null});render();await runEffect();expect(h.setters[2]).toHaveBeenLastCalledWith(failure);});
 it('array vazio bem-sucedido confirma catálogo vazio sem erro',async()=>{render();await runEffect();expect(h.setters[0]).toHaveBeenLastCalledWith([]);expect(h.setters[2]).toHaveBeenCalledTimes(1);expect(h.setters[2]).toHaveBeenCalledWith('');expect(h.setters[1]).toHaveBeenLastCalledWith(false);});
 it('resposta tardia após troca de instituição/desmontagem é ignorada',async()=>{let resolve!:(v:any)=>void;h.response=new Promise(r=>resolve=r);render();const cleanup=h.effects[0]() as ()=>void;cleanup();resolve({data:[{id:'old'}],error:null});await new Promise(r=>setTimeout(r,0));expect(h.setters[0]).toHaveBeenCalledTimes(1);expect(h.setters[1]).toHaveBeenCalledTimes(1);});
});
