import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createElement,act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const api=vi.hoisted(()=>({invoke:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{functions:{invoke:api.invoke},from:api.from}}));
import PreValidationPanel from '../components/area/PreValidationPanel';
import PreValidationQueue from '../components/area/PreValidationQueue';
import sourceCoverage from './preanalysis-sources.json';
const textA='Texto literal público sintético: plano institucional aprovado para revisão humana.';
function preview(source='source-a',status='ready_with_gaps') {return {
 preview_digest:`digest-${source}`,source_version:`version-${source}`,extraction_status:status,document_coverage:'partial',
 page_coverage:[{page:1,status:'text',characters:textA.length},{page:2,status:'no_text_requires_review',characters:0},{page:3,status:'confirmed_blank',characters:0}],
 chunks:[{id:'chunk-1',text:textA,page:1,section:null,sensitive_flags:[]},{id:'chunk-2',text:'Segundo trecho sintético de ações e resultados institucionais.',page:1,section:null,sensitive_flags:[]}],
 limitations:['Páginas pendentes de revisão visual.'],provider:'provedor-sintético',model:'modelo-sintético',enabled:true,
 coverage:{catalogs:[{key:'synthetic',label:'Catálogo sintético',version:'2026',regulatoryStatus:'proposal'}],notes:['Sem dados reais.']},
}}
function run(source='source-a',correlation='none',prior=false):any {return {
 id:`run-${source}`,state:'completed',source_version:prior?'old-version':`version-${source}`,created_at:'2026-11-12T09:00:00Z',provider:'sintético',model:'local',error_code:null,decisions:[],
 result:{summary:`Resultado sintético ${source}`,correlation,links:correlation==='potential'?[{objectKey:'object-1',instrumentCode:'SYN',version:'2026',regulatoryStatus:'proposal',objectCode:'1.1',title:'Objeto sintético',compatibility:'parcial',justification:'Correlação sintética.',quotes:[{chunkId:'chunk-1',text:textA,page:1}],limitations:['Revisão humana necessária.']}]:[],gaps:['Sem conclusão regulatória.'],limitations:['Sem garantia de conformidade.'],disclaimer:'Pré-análise apenas.'},
}}
let container:HTMLDivElement,root:Root,runs:Record<string,any[]>,queries:any[],failTable:string,queueDeferred:ReturnType<typeof deferred>|null;
const closed=vi.fn(),linksUpdated=vi.fn();
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(yes=>{resolve=yes});return {promise,resolve};}
const reply=(data:any)=>({data,error:null});
function history(source='source-a'){return {runs:runs[source]??[],source_version:`version-${source}`};}
async function defaultInvoke(_name:string,{body}:any){
 if(body.action==='history')return reply(history(body.source_id));
 if(body.action==='preview')return reply(preview(body.source_id));
 if(body.action==='analyze'){runs[body.source_id]=[run(body.source_id)];return reply({run_id:`run-${body.source_id}`});}
 if(body.action==='review'){
  const source=body.run_id.replace('run-','');runs[source][0].decisions.push({object_key:body.object_key,decision:body.decision,reason:body.reason,validation_status:'pending'});return reply({ok:true});
 }
 throw Error(`Unexpected action ${body.action}`);
}
function button(name:string){const b=[...container.querySelectorAll('button')].find(b=>b.textContent===name);if(!b)throw Error(`Missing button: ${name}`);return b;}
function checkbox(fragment:string){const label=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes(fragment));const input=label?.querySelector<HTMLInputElement>('input[type=checkbox]');if(!input)throw Error(`Missing checkbox: ${fragment}`);return input;}
async function click(name:string){await act(async()=>button(name).click());}
async function check(fragment:string){await act(async()=>checkbox(fragment).click());}
async function fill(field:HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
const reasonField=()=>[...container.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Fundamento da próxima decisão'))!.querySelector('textarea')!;
const calls=(action:string)=>api.invoke.mock.calls.filter(([,args])=>args.body.action===action).map(([,args])=>args.body);
async function render(source='source-a',institutionId='ies-a'){await act(async()=>root.render(createElement(PreValidationPanel,{file:{id:source,file_name:`PDF ${source}.pdf`},institutionId,onClose:closed,onLinksUpdated:linksUpdated})));}
async function queue(institutionId='ies-a',role='gestor'){await act(async()=>root.render(createElement(PreValidationQueue,{institutionId,role})));}
async function prepare(){await click('Preparar leitura e revisar trechos');}
async function ready(){await prepare();await check('Incluir trecho chunk-1');await check('Entendo que esta análise é parcial');await check('Revisei os trechos selecionados');}
async function settle(d:ReturnType<typeof deferred>,data:any){await act(async()=>d.resolve(reply(data)));}
beforeEach(()=>{
 vi.resetAllMocks();vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Network forbidden in synthetic test');}));
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);runs={};queries=[];failTable='';queueDeferred=null;
 api.invoke.mockImplementation(defaultInvoke);
 api.from.mockImplementation(table=>{const q:any={table};const chain={select(fields:string){q.fields=fields;return chain},eq(field:string,value:string){q[field]=value;return chain},order(field:string,options:any){q.order={field,...options};return chain},limit(limit:number){q.limit=limit;return chain},returns(){queries.push(q);const data=[{id:`${table}-${q.institution_id}`,file_name:`Registro ${table} ${q.institution_id}`,title:`Registro ${table} ${q.institution_id}`,what:`Registro ${table} ${q.institution_id}`}];return queueDeferred?queueDeferred.promise:Promise.resolve(table===failTable?{data:null,error:{message:'Synthetic source unavailable'}}:{data,error:null})}};return chain;});
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals();});
describe('real preanalysis panel: synthetic DOM interactions, no provider',()=>{
 it('starts partial coverage unchecked and blocks until distinct coverage and privacy acknowledgements plus selection',async()=>{
  await render();await prepare();expect(checkbox('Entendo que esta análise é parcial').checked).toBe(false);expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);
  expect(container.textContent).toContain('Página 2: sem texto extraível, revisão visual ou OCR pendentes');expect(container.textContent).toContain('Página 3: vazia confirmada');expect(container.textContent).toContain('não estou confirmando que sejam vazias');
  await check('Incluir trecho chunk-1');await check('Revisei os trechos selecionados');expect(button('Analisar trechos selecionados').disabled).toBe(true);
  await check('Entendo que esta análise é parcial');expect(button('Analisar trechos selecionados').disabled).toBe(false);expect(calls('analyze')).toHaveLength(0);
 });
 it('transmits only checked literal trimmed text with exact preview digest and both consent flags',async()=>{
  await render();await prepare();await check('Incluir trecho chunk-1');await fill(container.querySelector<HTMLTextAreaElement>('[aria-label="Trecho chunk-1"]')!,'plano institucional aprovado para revisão humana.');await check('Entendo que esta análise é parcial');await check('Revisei os trechos selecionados');await click('Analisar trechos selecionados');
  expect(calls('analyze')).toEqual([{institution_id:'ies-a',source_table:'vertice_repository_files',source_id:'source-a',action:'analyze',preview_digest:'digest-source-a',privacy_confirmed:true,coverage_acknowledged:true,selections:[{id:'chunk-1',text:'plano institucional aprovado para revisão humana.'}]}]);expect(container.textContent).toContain('Sem correlação identificada');
 });
 it('keeps unchecked chunk read-only and resets privacy consent on inclusion, exclusion and text edits',async()=>{
  await render();await ready();expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Trecho chunk-2"]')!.readOnly).toBe(true);
  await check('Incluir trecho chunk-2');expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);
  await check('Revisei os trechos selecionados');await check('Incluir trecho chunk-2');expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);
  await check('Revisei os trechos selecionados');await fill(container.querySelector<HTMLTextAreaElement>('[aria-label="Trecho chunk-1"]')!,'plano institucional aprovado para revisão humana.');expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);expect(button('Analisar trechos selecionados').disabled).toBe(true);
 });
 it('new preview resets both consents and selection',async()=>{await render();await ready();await prepare();expect(checkbox('Incluir trecho chunk-1').checked).toBe(false);expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);expect(checkbox('Entendo que esta análise é parcial').checked).toBe(false);});
 it('source change resets preview, selected text, both consents and history',async()=>{runs['source-a']=[run()];await render();await ready();await render('source-b');expect(container.textContent).not.toContain('Resultado sintético source-a');expect(container.querySelector('[aria-label="Trecho chunk-1"]')).toBeNull();await prepare();expect(checkbox('Incluir trecho chunk-1').checked).toBe(false);expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);expect(checkbox('Entendo que esta análise é parcial').checked).toBe(false);});
 it('complete extraction has no partial checkbox and can analyze with ordinary privacy consent',async()=>{api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?Promise.resolve(reply(preview('source-a','ready'))):defaultInvoke(name,args));await render();await prepare();expect(container.textContent).not.toContain('Entendo que esta análise é parcial');await check('Incluir trecho chunk-1');await check('Revisei os trechos selecionados');expect(button('Analisar trechos selecionados').disabled).toBe(false);});
 it('disabled provider and unreadable extraction cannot be submitted',async()=>{api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?Promise.resolve(reply({...preview(),'enabled':false,extraction_status:'manual_review'})):defaultInvoke(name,args));await render();await prepare();expect(checkbox('Revisei os trechos selecionados').disabled).toBe(true);expect(button('Analisar trechos selecionados').disabled).toBe(true);expect(container.textContent).toContain('Envio à IA desativado');});
 it('suppresses same-turn double preview clicks',async()=>{const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?d.promise:defaultInvoke(name,args));await render();await act(async()=>{const b=button('Preparar leitura e revisar trechos');b.click();b.click();});expect(calls('preview')).toHaveLength(1);await settle(d,preview());});
 it('suppresses same-turn double analysis clicks',async()=>{const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='analyze'?d.promise:defaultInvoke(name,args));await render();await ready();await act(async()=>{const b=button('Analisar trechos selecionados');b.click();b.click();});expect(calls('analyze')).toHaveLength(1);expect(checkbox('Incluir trecho chunk-1').closest('fieldset')!.disabled).toBe(true);await settle(d,{run_id:'synthetic'});});
 it('ignores stale preview after changing source even while new preview is pending',async()=>{const old=deferred(),next=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?(args.body.source_id==='source-a'?old.promise:next.promise):defaultInvoke(name,args));await render();await prepare();await render('source-b');await prepare();await settle(old,preview());expect(container.querySelector('[aria-label="Trecho chunk-1"]')).toBeNull();expect(button('Aguarde…').disabled).toBe(true);await settle(next,preview('source-b'));expect(container.textContent).toContain('Prévia local');expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);});
 it('ignores stale history after source changes',async()=>{const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='history'&&args.body.source_id==='source-a'?d.promise:defaultInvoke(name,args));await render();await render('source-b');await settle(d,{source_version:'version-source-a',runs:[run()]});expect(container.textContent).not.toContain('Resultado sintético source-a');expect(container.textContent).toContain('Nenhuma pré-análise');});
 it('ignores old analysis completion after source switch and does not reload the old history',async()=>{const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='analyze'?d.promise:defaultInvoke(name,args));await render();await ready();await click('Analisar trechos selecionados');await render('source-b');await settle(d,{run_id:'run-source-a'});expect(calls('history').map(c=>c.source_id)).toEqual(['source-a','source-b']);expect(container.textContent).not.toContain('Resultado sintético source-a');});
 it('closing unmounts and ignores stale preview after reopening',async()=>{const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?d.promise:defaultInvoke(name,args));function Host(){const [open,setOpen]=useState(true);return createElement('div',null,createElement('button',{onClick:()=>setOpen(true)},'Reabrir'),open&&createElement(PreValidationPanel,{file:{id:'source-a'},institutionId:'ies-a',onClose:()=>setOpen(false)}));}await act(async()=>root.render(createElement(Host)));await prepare();await click('Fechar');expect(container.querySelector('section')).toBeNull();await click('Reabrir');await settle(d,preview());expect(container.querySelector('[aria-label="Trecho chunk-1"]')).toBeNull();});
 it('displays no correlation and records explicit reasoned discard while preserving result and audit',async()=>{runs['source-a']=[run()];await render();expect(container.textContent).toContain('Sem correlação identificada');expect(button('Descartar este resultado, mantendo auditoria').disabled).toBe(true);await fill(reasonField(),'   Sem relação com o objeto deste instrumento.   ');await click('Descartar este resultado, mantendo auditoria');expect(calls('review')).toEqual([{action:'review',run_id:'run-source-a',object_key:null,decision:'rejected',reason:'Sem relação com o objeto deste instrumento.'}]);expect(container.textContent).toContain('Resultado descartado pelo gestor: Sem relação com o objeto deste instrumento.');expect(container.textContent).toContain('Resultado sintético source-a');expect(linksUpdated).toHaveBeenCalledTimes(1);expect(reasonField().value).toBe('');});
 it('displays insufficient information without suggesting validated compliance',async()=>{runs['source-a']=[run('source-a','insufficient')];await render();expect(container.textContent).toContain('Informação insuficiente');expect(container.textContent).toContain('sem garantia de conformidade ou nota');});
 it('blocks every review action on prior source versions despite a filled reason',async()=>{runs['source-a']=[run('source-a','potential',true)];await render();await fill(reasonField(),'Fundamento de teste.');for(const name of ['Vincular como potencial evidência','Descartar sugestão','Descartar este resultado, mantendo auditoria'])expect(button(name).disabled).toBe(true);expect(container.textContent).toContain('Versão anterior da fonte');expect(calls('review')).toHaveLength(0);});
 it('accepts only one selected suggestion and retains pending destination validation',async()=>{runs['source-a']=[run('source-a','potential')];await render();await fill(reasonField(),'Trecho pertinente, sujeito a validação independente.');await click('Vincular como potencial evidência');expect(calls('review')[0]).toMatchObject({run_id:'run-source-a',object_key:'object-1',decision:'accepted'});expect(container.textContent).toContain('vínculo lógico aceito, validação no destino pendente');});
 it('suppresses same-turn double review clicks',async()=>{runs['source-a']=[run()];const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='review'?d.promise:defaultInvoke(name,args));await render();await fill(reasonField(),'Sem relação com o instrumento.');await act(async()=>{const b=button('Descartar este resultado, mantendo auditoria');b.click();b.click();});expect(calls('review')).toHaveLength(1);await settle(d,{ok:true});});
 it('does not notify link updates when review history completes after changing source',async()=>{
  runs['source-a']=[run()];await render();await fill(reasonField(),'Fundamento da fonte A.');const d=deferred();
  api.invoke.mockImplementation((name,args)=>args.body.action==='history'&&args.body.source_id==='source-a'?d.promise:defaultInvoke(name,args));
  await click('Descartar este resultado, mantendo auditoria');await render('source-b');await settle(d,history());expect(linksUpdated).not.toHaveBeenCalled();
 });
 it('ignores review response after source change without loading obsolete history or firing callback',async()=>{
  runs['source-a']=[run()];const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='review'?d.promise:defaultInvoke(name,args));
  await render();await fill(reasonField(),'Fundamento de A.');await click('Descartar este resultado, mantendo auditoria');await render('source-b');await settle(d,{ok:true});
  expect(calls('history').map(c=>c.source_id)).toEqual(['source-a','source-b']);expect(linksUpdated).not.toHaveBeenCalled();expect(reasonField().value).toBe('');
 });
 it('ignores analysis completion after closing without issuing history reload',async()=>{
  const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='analyze'?d.promise:defaultInvoke(name,args));
  function Host(){const [open,setOpen]=useState(true);return open?createElement(PreValidationPanel,{file:{id:'source-a'},institutionId:'ies-a',onClose:()=>setOpen(false)}):createElement('p',null,'Painel fechado');}
  await act(async()=>root.render(createElement(Host)));await ready();await click('Analisar trechos selecionados');await click('Fechar');await settle(d,{run_id:'run-source-a'});
  expect(container.textContent).toBe('Painel fechado');expect(calls('history')).toHaveLength(1);
 });
 it('ignores review-history completion after closing without firing callback',async()=>{
  runs['source-a']=[run()];function Host(){const [open,setOpen]=useState(true);return open?createElement(PreValidationPanel,{file:{id:'source-a'},institutionId:'ies-a',onClose:()=>setOpen(false),onLinksUpdated:linksUpdated}):createElement('p',null,'Painel fechado');}
  await act(async()=>root.render(createElement(Host)));await fill(reasonField(),'Fundamento da fonte A.');const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='history'?d.promise:defaultInvoke(name,args));
  await click('Descartar este resultado, mantendo auditoria');await click('Fechar');await settle(d,history());expect(linksUpdated).not.toHaveBeenCalled();expect(container.textContent).toBe('Painel fechado');
 });
 it('ignores a stale preview failure after the user prepares another source',async()=>{
  const d=deferred();api.invoke.mockImplementation((name,args)=>args.body.action==='preview'&&args.body.source_id==='source-a'?d.promise:defaultInvoke(name,args));
  await render();await prepare();await render('source-b');await ready();await settle(d,{error:'source_changed'});expect(container.querySelector('[role=alert]')).toBeNull();expect(button('Analisar trechos selecionados').disabled).toBe(false);
 });
 it('resets consent and source-specific reason on institution changes',async()=>{await render();await ready();await fill(reasonField(),'Fundamento de IES A.');await render('source-a','ies-b');expect(reasonField().value).toBe('');await prepare();expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);expect(checkbox('Entendo que esta análise é parcial').checked).toBe(false);expect(calls('preview').at(-1)?.institution_id).toBe('ies-b');});
 it('does not carry human decision reason across changed sources',async()=>{await render();await fill(reasonField(),'Fundamento específico do documento A.');await render('source-b');expect(reasonField().value).toBe('');});
 it('shows the specific uncertain-provider warning rather than inviting an automatic retry',async()=>{api.invoke.mockImplementation((name,args)=>args.body.action==='analyze'?Promise.resolve(reply({error:'provider_outcome_uncertain'})):defaultInvoke(name,args));await render();await ready();await click('Analisar trechos selecionados');expect(container.querySelector('[role=alert]')?.textContent).toContain('O resultado no provedor é incerto. Não repita automaticamente.');expect(calls('analyze')).toHaveLength(1);});
 it('preserves trusted uncertain-provider warning from Supabase error context too',async()=>{
  api.invoke.mockImplementation((name,args)=>args.body.action==='analyze'?Promise.resolve({data:null,error:{message:'untrusted transport details',context:{json:async()=>({error:'provider_outcome_uncertain'})}}}):defaultInvoke(name,args));
  await render();await ready();await click('Analisar trechos selecionados');expect(container.querySelector('[role=alert]')?.textContent).toBe('O resultado no provedor é incerto. Não repita automaticamente.');expect(container.textContent).not.toContain('untrusted transport details');
 });
 it.each(['unknown_code_with_private_details','transport'])('does not surface arbitrary raw error text: %s',async kind=>{
  api.invoke.mockImplementation((name,args)=>args.body.action==='preview'?(kind==='transport'?Promise.reject(Error('private_raw_transport_secret')):Promise.resolve(reply({error:kind}))):defaultInvoke(name,args));
  await render();await prepare();expect(container.querySelector('[role=alert]')).not.toBeNull();expect(container.textContent).not.toContain('private_raw_transport_secret');expect(container.textContent).not.toContain('unknown_code_with_private_details');
 });
 it('an ordinary failed operation releases the current lock for a deliberate new request',async()=>{
  let first=true;api.invoke.mockImplementation((name,args)=>{if(args.body.action==='preview'&&first){first=false;return Promise.resolve(reply({error:'source_unavailable'}));}return defaultInvoke(name,args)});
  await render();await prepare();expect(container.querySelector('[role=alert]')?.textContent).toContain('Fonte indisponível');await prepare();expect(calls('preview')).toHaveLength(2);expect(container.querySelector('[role=alert]')).toBeNull();expect(checkbox('Revisei os trechos selecionados').checked).toBe(false);
 });

});
describe('real queue: synthetic data and partial source failures',()=>{
 it('queries seven adapters with institution filtering and per-source limit, and can open/close a real panel',async()=>{await queue();expect(queries).toHaveLength(7);expect(queries.map(q=>q.table)).toEqual(sourceCoverage.adapters.map(a=>a.table));expect(queries.every(q=>q.institution_id==='ies-a'&&q.limit===100)).toBe(true);expect(container.querySelectorAll('li')).toHaveLength(7);await click('Registro vertice_repository_files ies-a');await vi.dynamicImportSettled();await act(async()=>{});expect(calls('history')[0]).toMatchObject({source_table:'vertice_repository_files',source_id:'vertice_repository_files-ies-a'});await click('Fechar');expect(container.querySelector('[aria-label="Pré-análise de possíveis evidências"]')).toBeNull();});
 it('a partial source error stays an error, never silently masquerades as successful empty coverage',async()=>{failTable='vertice_goals';await queue();expect(queries).toHaveLength(7);expect(container.querySelector('[role=alert]')).not.toBeNull();expect(container.querySelectorAll('li')).toHaveLength(0);expect(container.textContent).toContain('Demais módulos');expect(container.textContent).toContain('100 registros');});
 it('a non-management profile does not query any source',async()=>{await queue('ies-a','leitor');expect(api.from).not.toHaveBeenCalled();expect(container.textContent).toContain('não amplia as permissões');});
 it('late queue response cannot expose prior institution rows after institution or role switch',async()=>{const d=deferred();queueDeferred=d;await queue();queueDeferred=null;await queue('ies-b');await act(async()=>d.resolve({data:[{id:'old',title:'Old institution row'}],error:null}));expect(container.textContent).not.toContain('Old institution row');expect(container.querySelectorAll('li')).toHaveLength(7);await queue('ies-b','leitor');expect(container.querySelectorAll('li')).toHaveLength(0);});
});
