import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createElement, type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const h=vi.hoisted(()=>({
 states:[] as unknown[], index:0, setters:[] as ReturnType<typeof vi.fn>[],
 effects:[] as (()=>void|(()=>void))[], response:Promise.resolve({data:[],error:null}) as Promise<any>,
 rpc:vi.fn(async()=>({error:null})),
}));
vi.mock('react',async()=>{
 const actual=await vi.importActual<any>('react');
 return {...actual,useState:(initial:unknown)=>{
  const index=h.index++,setter=vi.fn();h.setters[index]=setter;
  return [index<h.states.length?h.states[index]:initial,setter];
 },useEffect:(effect:()=>void|(()=>void))=>h.effects.push(effect)};
});
vi.mock('../client/src/lib/supabase',()=>({supabase:{rpc:h.rpc,from:()=>{
 const query:any={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,single:()=>query,
  then:(resolve:any,reject:any)=>h.response.then(resolve,reject)};
 return query;
}}}));
import EmecPanel,{EmecSummary} from '../client/src/components/area/EmecPanel';

const institution={id:'fixture-institution',name:'IES de teste',emec_code:'1234',status:'ativa'};
const payload=()=>({version:1,emec_code:'1234',source_url:'https://emec.mec.gov.br/',consulted_on:'2026-01-01',coverage:'partial',gaps:['Consulta parcial de teste'],records:[
 {kind:'process',key:'p1',title:'Processo fictício',data:{status:'Em análise'}},
 {kind:'alert',key:'a1',title:'Alerta fictício',data:{status:'Pendente'}},
]});
const snapshot=(body:unknown=payload())=>({id:'fixture-version',revision:7,created_at:'2026-01-01T00:00:00Z',body});
const incompatible='Consulta e-MEC armazenada em formato incompatível';
function summary(raw:unknown=snapshot(),status=''){
 h.states=[raw,status];h.index=0;
 return renderToStaticMarkup(createElement(EmecSummary,{institutionId:institution.id,onOpen:vi.fn(),onReference:vi.fn()}));
}
let panelTree:ReactElement;
function panel(raw:unknown=snapshot(),role='master',pending:unknown=null,latest:unknown=raw){
 h.states=[[{id:'fixture-version',revision:7,created_at:'2026-01-01T00:00:00Z'}],raw,latest,pending,'all','','','',false,false];h.index=0;
 function Capture(){panelTree=EmecPanel({institution,role:role as any});return panelTree;}
 return renderToStaticMarkup(createElement(Capture));
}
function findButton(tree:any,label:string):any{
 if(!tree||typeof tree!=='object')return undefined;
 if(tree.type==='button'&&tree.props.children===label)return tree;
 return [tree.props?.children].flat(Infinity).map(child=>findButton(child,label)).find(Boolean);
}
beforeEach(()=>{h.states=[];h.index=0;h.setters=[];h.effects=[];h.response=Promise.resolve({data:[],error:null});h.rpc.mockClear();});

describe('e-MEC persisted snapshots are validated before rendering',()=>{
 it('handles a stored summary body that lacks records',()=>{
  const html=summary({...snapshot(),body:{...payload(),records:undefined}});
  expect(html).toContain(incompatible);
  expect(html).not.toContain('0 processos');
  expect(html).not.toContain('Referenciar esta consulta');
  expect(html).toContain('Consultar dados e histórico');
 });
 it.each([
  ['missing body',undefined],['null body',null],['empty body',{}],
  ['missing records',{...payload(),records:undefined}],
  ['null records',{...payload(),records:null}],
  ['object records',{...payload(),records:{}}],
  ['malformed record',{...payload(),records:[null]}],
  ['missing gaps',{...payload(),gaps:undefined}],
  ['invalid transcription',{...payload(),original_text:{text:'not a string'}}],
  ['invalid source',{...payload(),source_url:'https://example.test/'}],
 ])('isolates %s in both summary and full panel without inventing counts',(_name,body)=>{
  const raw={...snapshot(),body};
  for(const html of [summary(raw),panel(raw)]){
   expect(html).toContain(incompatible);
   expect(html).toContain('role="alert"');
   expect(html).not.toContain('0 processos');
   expect(html).not.toContain('0 registros encontrados');
   expect(html).not.toContain('Nenhuma consulta importada');
   expect(html).not.toContain('Exportar consulta JSON');
   expect(html).not.toContain('Referenciar esta consulta');
  }
 });
 it('keeps history navigation and authorized recovery available for an incompatible snapshot',()=>{
  const html=panel(snapshot({}));
  expect(html).toContain('Consulta preservada');
  expect(html).toContain('Versão 7');
  expect(html).toContain('Importar nova consulta');
 });
 it('keeps role restrictions when the stored snapshot is incompatible',()=>{
  for(const role of ['equipe','avaliador',''])expect(panel(snapshot({}),role)).not.toContain('Importar nova consulta');
  expect(panel(snapshot({}),'gestor')).toContain('Importar nova consulta');
 });
 it('rejects a valid payload for another institution in the full panel',()=>{
  expect(panel(snapshot({...payload(),emec_code:'other'}))).toContain(incompatible);
 });
 it('renders valid records, summary counts, and references unchanged',()=>{
  const html=summary();
  expect(html).toContain('1 processos · 1 alertas registrados · 1 lacunas');
  expect(html).toContain('Referenciar esta consulta');
  const detail=panel();
  expect(detail).toContain('2 registros encontrados');
  expect(detail).toContain('Processo fictício');
  expect(detail).toContain('Exportar consulta JSON');
  expect(detail).not.toContain(incompatible);
 });
 it('does not mislabel a loading or missing query as zero indicators',()=>{
  expect(summary(null,'Carregando base regulatória…')).not.toContain('0 processos');
  expect(summary(null,'Nenhuma consulta e-MEC importada para esta instituição.')).toContain('Nenhuma consulta e-MEC importada');
 });
 it('previews a replacement without fabricating a diff against an incompatible latest version',()=>{
  const html=panel(snapshot({}),'master',payload());
  expect(html).toContain('Comparação indisponível');
  expect(html).toContain('preservará o histórico');
  expect(html).not.toContain('2 novos');
  expect(html).toContain('Conferi a fonte · registrar consulta');
 });
 it('preserves the latest optimistic revision for replacement imports',async()=>{
  panel(snapshot({}),'master',payload());
  findButton(panelTree,'Conferi a fonte · registrar consulta').props.onClick();
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(h.rpc).toHaveBeenCalledTimes(1);
  expect(h.rpc).toHaveBeenCalledWith('vertice_emec_import',{
   target:institution.id,payload:payload(),expected_revision:7,
  });
 });
 it('cancels a replacement preview without an import',()=>{
  panel(snapshot({}),'master',payload());
  findButton(panelTree,'Cancelar prévia').props.onClick();
  expect(h.setters[3]).toHaveBeenCalledWith(null);
  expect(h.rpc).not.toHaveBeenCalled();
 });
 it.each([
  ['database error',()=>Promise.resolve({data:null,error:{code:'42501'}})],
  ['invalid response',()=>Promise.resolve({data:null,error:null})],
  ['network rejection',()=>Promise.reject(new Error('network'))],
 ])('reports %s without treating the base as empty',async(_name,response)=>{
  summary(null,'Carregando base regulatória…');h.response=response();h.effects[0]();
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(h.setters[0]).toHaveBeenLastCalledWith(null);
  expect(h.setters[1]).toHaveBeenLastCalledWith('Base regulatória indisponível. Tente novamente.');
 });
 it('ignores late summary responses after unmount or institution navigation',async()=>{
  let resolve!:(value:unknown)=>void;
  h.response=new Promise(done=>{resolve=done;});summary();
  const cleanup=h.effects[0]() as ()=>void;cleanup();
  resolve({data:[snapshot()],error:null});
  await new Promise(done=>setTimeout(done,0));
  expect(h.setters[0]).toHaveBeenCalledTimes(1);
  expect(h.setters[0]).toHaveBeenLastCalledWith(null);
  expect(h.setters[1]).toHaveBeenCalledTimes(1);
 });
});
