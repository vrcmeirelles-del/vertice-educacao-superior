import {createHash,randomUUID} from 'node:crypto';
import {normalizeValuation,calculateValuation,valuationText} from './valuation.ts';
import {normalizeEbitda,calculateEbitda,ebitdaText} from './ebitda.ts';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const norm=x=>x instanceof Date?x.toISOString():Array.isArray(x)?x.map(norm):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])])):x;
export const digest=x=>createHash('sha256').update(JSON.stringify(norm(x))).digest('hex');
const text=(value,max=10000)=>String(value??'').trim().slice(0,max);
const required=(value,name,min=1,max=10000)=>{const s=text(value,max);if(s.length<min)fail('Preencha '+name+'.');return s;};
const oneOf=(value,values,name)=>{if(!values.includes(value))fail(name+' inválido.');return value;};
const numeric=(value,name)=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e13)fail(name+' inválido.');return n;};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=x=>DATE.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
export const comparisonRules=[{id:'docentes',label:'Docentes: lista acadêmica × pessoal',left:'ACA-01',right:'TRA-06'},{id:'alunos',label:'Alunos: cadastro acadêmico × base financeira',left:'REG-31',right:'FIN-13'},{id:'receita',label:'Receita: relatório por curso × conciliação contábil',left:'FIN-11',right:'FIN-39'},{id:'processos',label:'Contingências: relatório jurídico × provisões',left:'TRA-01',right:'SOC-39'}];
export function reviewBasis(data,state){
 const {comparisons,...scope}=data.profile?.body||{};
 const linked=data.links.filter(l=>l.state_id===state.id).map(l=>({id:l.id,document_id:l.document_id,location:l.evidence_location,template:l.template_id,document:data.documents.find(d=>d.id===l.document_id),quality:data.checks.find(c=>c.link_id===l.id)?.body||null}));
 return digest({instrument:data.revision.sha256,profile:scope,state:{id:state.id,answer:state.answer,note:state.note,rows:state.structured_rows},linked});
}
function compute(data){
 data.effective=data.states.map(s=>{const review=data.reviews.find(r=>r.state_id===s.id),basis=reviewBasis(data,s);return {state_id:s.id,requirement_id:s.requirement_id,basis_hash:basis,valid:!!review&&review.basis_hash===basis,review:review&&review.basis_hash===basis?review:null,previous_review:review||null};});
 data.counts={pending:0,verified:0,qualified:0,noncompliant:0,not_applicable:0,not_verified:0};
 for(const item of data.effective)data.counts[item.valid?item.review.body.decision:'pending']++;
 data.comparisons=comparisonRules.map(rule=>{
  const entry=data.profile?.body?.comparisons?.find(c=>c.id===rule.id),left=entry?.left??null,right=entry?.right??null;
  let result='pending';
  if(entry?.decision==='not_applicable'&&text(entry.note).length>=30)result='not_applicable';
  else if(left!==null&&right!==null&&entry?.left_document&&entry?.right_document&&entry.reviewed&&text(entry.note).length>=15){
   const ready=(code,id)=>data.links.some(l=>l.document_id===id&&data.states.some(s=>s.id===l.state_id&&data.requirements.some(r=>r.id===s.requirement_id&&r.code===code))&&data.checks.some(c=>c.link_id===l.id&&c.body.result==='sufficient'));
   if(ready(rule.left,entry.left_document)&&ready(rule.right,entry.right_document))result=Math.abs(left-right)<0.005?'consistent':'difference_explained';
  }
  return {...rule,...entry,left_code:rule.left,right_code:rule.right,left,right,result,difference:left!==null&&right!==null?left-right:null};
 });
 if(data.valuation){data.valuation.result=calculateValuation(data.valuation.body,data);data.valuation.citations=[...data.valuation.body.sources,...data.valuation.body.adjustments.map(a=>({kind:'adjustment',link_id:a.link_id,note:a.reason}))].map(s=>{const l=data.links.find(l=>l.id===s.link_id),d=data.documents.find(d=>d.id===l?.document_id),c=data.checks.find(c=>c.link_id===s.link_id),state=data.states.find(st=>st.id===l?.state_id);return {...s,code:data.requirements.find(r=>r.id===state?.requirement_id)?.code||'Indisponível',file_name:d?.file_name||'Indisponível',sha256:d?.sha256||'',location:c?.body.location||l?.evidence_location||''};});}
 if(data.ebitda){data.ebitda.result=calculateEbitda(data.ebitda.body);const d=data.documents.find(d=>d.id===data.ebitda.body.evidence_document_id);data.ebitda.evidence=d?{id:d.id,file_name:d.file_name,sha256:d.sha256}:null;data.ebitda.calculation_hash=digest(data.ebitda.body);data.ebitda.link_id=data.links.find(l=>l.document_id===d?.id&&data.states.some(s=>s.id===l.state_id&&data.requirements.some(r=>r.id===s.requirement_id&&r.code==='FIN-01')))?.id||null;}
 if(data.valuation?.body.ebitda_calculation_hash&&data.ebitda){const gaps=data.valuation.result.gaps;if(data.valuation.body.ebitda_calculation_hash!==data.ebitda.calculation_hash)gaps.push('O EBITDA da calculadora foi alterado: atualize a análise do preço.');if(data.ebitda.result.education&&!data.ebitda.result.education.reconciled)gaps.push('O detalhamento da IES ainda não fecha com a DRE.');if(data.ebitda.body.lease_basis==='unknown')gaps.push('Confirme o tratamento contábil dos aluguéis antes de comparar o preço.');if(gaps.length){data.valuation.result.status='conditional';data.valuation.result.conclusion='Compatibilidade do preço condicionada à conferência das fontes e do cálculo de EBITDA.';}}
 const context={revision:data.revision.sha256,profile:data.profile?.body||null,states:data.states,documents:data.documents,links:data.links,checks:data.checks,reviews:data.reviews,events:data.events,legacy:data.legacy,...(data.ebitda?{ebitda:{body:data.ebitda.body,updated_at:data.ebitda.updated_at}}:{})};
 data.economic_context_hash=digest(context);
 if(data.valuation&&data.valuation.body.context_hash!==data.economic_context_hash){data.valuation.result.gaps.push('A base da DD mudou após a conferência econômica. Reabra e confira a análise de preço.');data.valuation.result.status='conditional';data.valuation.result.conclusion+=' Base alterada: revisão econômica pendente.';}
 const input=data.valuation?{...context,valuation:{body:data.valuation.body,updated_at:data.valuation.updated_at}}:context;
 data.basis_hash=digest(input);
 const issues=[];const p=data.profile?.body;
 if(!p||!text(p.entities)||!text(p.included)||!text(p.excluded)||!validDate(p.reference_date||'')||!text(p.transaction_type)||!text(p.education_system)||!text(p.institution_type)||!text(p.modalities)||!text(p.tax_regime)||!text(p.materiality_reason))issues.push('Complete o escopo da operação e os critérios de relevância.');
 if(data.counts.pending)issues.push(`${data.counts.pending} requisitos ainda não possuem análise atual válida.`);
 if(data.comparisons.some(c=>c.result==='pending'))issues.push('Revise as quatro conferências entre frentes ou justifique sua não aplicabilidade.');
 if(!data.checks.some(c=>c.body.result==='sufficient'))issues.push('Nenhuma evidência foi considerada suficiente pelo analista.');
 if(!data.effective.some(r=>r.valid&&['verified','qualified','noncompliant'].includes(r.review.body.decision)))issues.push('É necessário ao menos um requisito efetivamente analisado com base documental.');
 for(const f of data.legacy)if(!data.events.some(e=>e.body.legacy_id===f.id))issues.push('Achado anterior ainda sem tratamento no novo fluxo: '+f.code+'.');
 for(const e of data.events){if(!eventComplete(e.body))issues.push('Complete as providências, prazos e evidências do evento '+e.body.title+'.');if(e.body.proofs?.some(id=>!data.links.some(l=>l.id===id&&data.documents.some(d=>d.id===l.document_id))))issues.push('Uma evidência do evento não está mais disponível: '+e.body.title+'.');}
 for(const r of data.effective.filter(r=>r.valid&&['qualified','noncompliant','not_verified'].includes(r.review.body.decision)))if(!data.events.some(e=>e.body.requirement_ids?.includes(r.requirement_id)&&!e.body.resolved))issues.push('Análise com ressalva, pendência ou não verificada precisa de evento e providência: '+data.requirements.find(q=>q.id===r.requirement_id)?.code+'.');
 data.readiness=[...new Set(issues)];
 data.price_readiness=data.valuation?data.valuation.result.gaps:['Preencha a análise do preço pedido.'];
 data.closing_readiness=[...data.readiness,...data.price_readiness,...data.events.filter(e=>!e.body.resolved&&e.body.closing_block).map(e=>'Bloqueia fechamento: '+e.body.title)];
 data.opinions=data.opinions.map(o=>({...o,current:o.basis_hash===data.basis_hash,approval:data.approvals.find(a=>a.opinion_id===o.id)||null}));
 return data;
}
function eventComplete(b){return text(b.title).length>=3&&text(b.issue).length>=15&&text(b.consequence).length>=15&&text(b.risk_reason).length>=15&&b.requirement_ids?.length>0&&b.proofs?.length>0&&text(b.action).length>=10&&text(b.mechanism).length>=10&&text(b.owner).length>=3&&validDate(b.due_date||'')&&text(b.closure_criteria).length>=10&&!b.migration_pending;}
export async function createWorkflow({local,asUser,directory,revision,verifyRemote}){

 async function load(user,m){
  if(!uuid(m))fail('Mandato inválido.');
  const result=await asUser(user,async tx=>{
   const matter=(await tx.query('select * from public.dd_matters where id=$1',[m])).rows[0];if(!matter)fail('Mandato sem acesso autorizado.',403);
   const rights=(await tx.query('select dd_private.can_access($1,true) writable, public.dd_is_matter_lead($1) lead',[m])).rows[0];
   const tables={states:'dd_requirement_state',documents:'dd_documents',links:'dd_document_links',checks:'dd_evidence_checks',reviews:'dd_reviews',events:'dd_work_events',opinions:'dd_opinions',approvals:'dd_opinion_approvals',legacy:'dd_findings'};
   const data={matter,...rights,revision,profile:(await tx.query('select * from dd_case_profiles where matter_id=$1',[m])).rows[0]||null,valuation:(await tx.query('select * from dd_valuations where matter_id=$1',[m])).rows[0]||null,ebitda:(await tx.query('select * from dd_ebitda_calculations where matter_id=$1',[m])).rows[0]||null};
   for(const [key,table] of Object.entries(tables))data[key]=(await tx.query(`select * from public.${table} where matter_id=$1 order by id`,[m])).rows;
   data.requirements=(await tx.query('select r.* from public.dd_requirements r join public.dd_requirement_state s on s.requirement_id=r.id where s.matter_id=$1 order by r.code',[m])).rows.map(r=>({...r,...revision.requirements.find(q=>q.code===r.code),id:r.id}));
   return data;
  });
  return compute(result);
 }
 async function mutate(user,m,callback){
  return local.db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('dd.matter_id',$2,true)",[user.id,m]);return callback(tx);});
 }
 function canWrite(data){if(!data.writable)fail('Somente analista ou responsável com acesso vigente pode editar.',403);}
 function leadOnly(data){if(!data.lead||!data.writable)fail('Somente o responsável com acesso vigente pode preparar ou aprovar o parecer.',403);}
 function stateOf(data,id){const state=data.states.find(s=>s.id===id);if(!state)fail('Requisito fora do mandato.',403);return state;}
 function linkOf(data,id){const link=data.links.find(l=>l.id===id);if(!link||!data.documents.some(d=>d.id===link.document_id))fail('Evidência sem acesso neste mandato.',403);return link;}
 const verifyFiles=verifyRemote;
 async function act(user,m,action,p={}){
  const data=await load(user,m);canWrite(data);
  if(action==='ebitda'){
   leadOnly(data);let body;try{body=normalizeEbitda(p);}catch(e){fail(e.message);}
   if((p.previous_calculation_hash||null)!==(data.ebitda?.calculation_hash||null))fail('Outro cálculo foi salvo. Reabra a calculadora para não substituir uma versão mais recente.',409);
   if(p.basis_hash!==data.basis_hash)fail('Os dados mudaram. Reabra a calculadora antes de salvar.',409);
   const doc=data.documents.find(d=>d.id===body.evidence_document_id);if(!doc)fail('Selecione ou anexe a DRE deste mandato.',403);
   const state=data.states.find(s=>data.requirements.some(r=>r.id===s.requirement_id&&r.code==='FIN-01'));if(!state)fail('Requisito FIN-01 indisponível neste mandato.');
   const link=data.links.find(l=>l.document_id===doc.id&&l.state_id===state.id);
   await verifyFiles({...data,links:[...data.links,{document_id:doc.id}]});
   await mutate(user,m,async tx=>{
    if(!link)await tx.query('insert into dd_document_links(id,matter_id,document_id,state_id,evidence_location) values($1,$2,$3,$4,$5)',[randomUUID(),m,doc.id,state.id,body.evidence_location]);
    else if(link.evidence_location!==body.evidence_location)await tx.query('update dd_document_links set evidence_location=$1 where id=$2 and matter_id=$3',[body.evidence_location,link.id,m]);
    await tx.query('insert into dd_ebitda_calculations(matter_id,body,updated_by) values($1,$2,$3) on conflict(matter_id) do update set body=excluded.body,updated_by=excluded.updated_by,updated_at=now()',[m,JSON.stringify(body),user.id]);
   });
  }else if(action==='valuation'){
   leadOnly(data);let body;try{body=normalizeValuation(p);}catch(e){fail(e.message);}
   if(p.context_hash!==data.economic_context_hash)fail('A base mudou. Reabra a análise econômica antes de salvar.',409);
   body.context_hash=data.economic_context_hash;
   if(p.ebitda_calculation_hash){
    if(!data.ebitda||p.ebitda_calculation_hash!==data.ebitda.calculation_hash)fail('O cálculo de EBITDA mudou. Use novamente o cálculo salvo.',409);
    if(Math.abs(body.ebitda-data.ebitda.result.ebitda)>0.005||Math.abs(body.revenue-data.ebitda.body.net_revenue)>0.005||body.period_months!==data.ebitda.result.period_months||body.earnings_type!==data.ebitda.body.basis)fail('Os valores ou o período não correspondem ao cálculo de EBITDA selecionado.');
    if(!body.sources.some(s=>s.kind==='earnings'&&s.link_id===data.ebitda.link_id))fail('Vincule a DRE da calculadora como fonte de resultado.');
    body.ebitda_calculation_hash=data.ebitda.calculation_hash;
   }
   for(const source of [...body.sources,...body.adjustments])linkOf(data,source.link_id);
   for(const t of body.treatments)if(!data.events.some(e=>e.id===t.event_id))fail('Evento econômico fora do mandato.',403);
   await mutate(user,m,tx=>tx.query('insert into dd_valuations(matter_id,body,updated_by) values($1,$2,$3) on conflict(matter_id) do update set body=excluded.body,updated_by=excluded.updated_by,updated_at=now()',[m,JSON.stringify(body),user.id]));
  }else if(action==='profile'){
   leadOnly(data);
   const body={entities:required(p.entities,'entidades e unidades',5),included:required(p.included,'o que está incluído',5),excluded:required(p.excluded,'o que está excluído, ou escreva nenhum',3),reference_date:required(p.reference_date,'a data-base'),transaction_type:required(p.transaction_type,'a estrutura da compra'),education_system:required(p.education_system,'o sistema de ensino'),institution_type:required(p.institution_type,'o tipo de instituição'),modalities:required(p.modalities,'os formatos de oferta'),tax_regime:required(p.tax_regime,'o regime tributário'),materiality:numeric(p.materiality,'Limite de relevância'),materiality_reason:required(p.materiality_reason,'os critérios de relevância, inclusive riscos sem valor',20),comparisons:[]};
   if(!validDate(body.reference_date))fail('Data-base inválida.');
   for(const rule of comparisonRules){const raw=(p.comparisons||[]).find(c=>c.id===rule.id)||{};for(const key of ['left_document','right_document'])if(raw[key]&&!data.documents.some(d=>d.id===raw[key]))fail('Fonte da conferência fora do mandato.',403);
    body.comparisons.push({id:rule.id,left:numeric(raw.left,'Valor à esquerda'),right:numeric(raw.right,'Valor à direita'),left_document:raw.left_document||null,right_document:raw.right_document||null,note:text(raw.note),decision:raw.decision==='not_applicable'?'not_applicable':'compared',reviewed:raw.reviewed===true});
   }
   await mutate(user,m,tx=>tx.query('insert into dd_case_profiles(matter_id,body,updated_by) values($1,$2,$3) on conflict(matter_id) do update set body=excluded.body,updated_by=excluded.updated_by,updated_at=now()',[m,JSON.stringify(body),user.id]));
  }else if(action==='table'){
   const state=stateOf(data,p.state_id),req=data.requirements.find(r=>r.id===state.requirement_id);if(!req.columns.length)fail('Este requisito utiliza resposta descritiva.');
   if(!Array.isArray(p.rows)||p.rows.length>1000)fail('Importe até mil linhas por requisito.');
   const rows=p.rows.map(row=>{if(!Array.isArray(row)||row.length!==req.columns.length)fail('As colunas devem corresponder à ficha.');return row.map(c=>{if(String(c??'').length>2000)fail('Uma célula excede o limite de 2.000 caracteres.');return text(c,2000);});});
   await mutate(user,m,tx=>tx.query('update dd_requirement_state set structured_rows=$1,updated_at=now() where id=$2 and matter_id=$3',[JSON.stringify(rows),state.id,m]));
  }else if(action==='evidence'){
   const link=linkOf(data,p.link_id);
   const body={origin:required(p.origin,'a origem da evidência',3),period:required(p.period,'o período ou data da informação',3),unit:required(p.unit,'a entidade ou unidade abrangida',3),version:required(p.version,'a versão ou data de obtenção',3),location:required(p.location,'a página, aba, linha ou seção examinada',3),signature:oneOf(p.signature,['verified','not_applicable','unverified'],'Situação de assinatura/autenticidade'),method:required(p.method,'como a evidência foi conferida',15),coverage:required(p.coverage,'a abrangência e as limitações',10),result:oneOf(p.result,['sufficient','partial','rejected'],'Resultado da conferência'),note:text(p.note)};
   if(body.result==='sufficient'&&body.signature==='unverified')fail('Autenticidade ainda não verificada: registre como parcial e explique a limitação.');
   await mutate(user,m,tx=>tx.query('insert into dd_evidence_checks(matter_id,link_id,body,updated_by) values($1,$2,$3,$4) on conflict(link_id) do update set body=excluded.body,updated_by=excluded.updated_by,updated_at=now()',[m,link.id,JSON.stringify(body),user.id]));
  }else if(action==='review'){
   const state=stateOf(data,p.state_id),basis=reviewBasis(data,state);if(p.basis_hash!==basis)fail('A resposta ou as evidências mudaram. Reabra a revisão.',409);
   const body={decision:oneOf(p.decision,['verified','qualified','noncompliant','not_applicable','not_verified'],'Conclusão'),analysis:required(p.analysis,'a análise e sua justificativa',30),rule:required(p.rule,'o critério ou regra utilizado, com data e aplicabilidade',15),risk:null,proofs:[],limitations:required(p.limitations,'as limitações, ou escreva nenhuma identificada',5)};
   if(body.decision==='verified')body.risk='green';else if(['qualified','noncompliant'].includes(body.decision))body.risk=oneOf(p.risk,['amber','red'],'Risco');
   if(['verified','qualified','noncompliant'].includes(body.decision)){
    if(!Array.isArray(p.proofs)||!p.proofs.length)fail('Selecione as evidências que sustentam a análise.');
    for(const id of [...new Set(p.proofs)]){const l=linkOf(data,id);if(l.state_id!==state.id)fail('Prova vinculada a outro requisito.',403);const check=data.checks.find(c=>c.link_id===id);if(!check||check.body.result!=='sufficient')fail('A conclusão exige evidência conferida como suficiente.');body.proofs.push({link_id:id,document_id:l.document_id,location:check.body.location});}
   }
   if(['qualified','noncompliant'].includes(body.decision))body.risk_reason=required(p.risk_reason,'a justificativa da relevância, probabilidade e urgência',20);
   await mutate(user,m,tx=>tx.query('insert into dd_reviews(matter_id,state_id,basis_hash,body,reviewed_by) values($1,$2,$3,$4,$5) on conflict(state_id) do update set basis_hash=excluded.basis_hash,body=excluded.body,reviewed_by=excluded.reviewed_by,reviewed_at=now()',[m,state.id,basis,JSON.stringify(body),user.id]));
  }else if(action==='event'){
   const previous=p.id?data.events.find(e=>e.id===p.id):null;if(p.id&&!previous)fail('Evento fora do mandato.',403);
   const reqs=[...new Set(p.requirement_ids||[])];if(!reqs.length||reqs.some(id=>!data.states.some(s=>s.requirement_id===id)))fail('Selecione requisitos deste mandato.');
   const proofs=[...new Set(p.proofs||[])];for(const id of proofs){const l=linkOf(data,id);if(!data.states.some(s=>s.id===l.state_id&&reqs.includes(s.requirement_id)))fail('Prova fora dos requisitos do evento.',403);}
   const body={legacy_id:previous?.body.legacy_id||p.legacy_id||null,title:required(p.title,'o título do evento',3,300),requirement_ids:reqs,proofs,issue:required(p.issue,'o problema observado',15),consequence:required(p.consequence,'a consequência para a operação',15),risk:oneOf(p.risk,['amber','red'],'Risco'),risk_reason:required(p.risk_reason,'probabilidade, impacto e urgência',15),nature:oneOf(p.nature,['debt','loss_estimate','capex','price_adjustment','unknown'],'Natureza do valor'),amount:numeric(p.amount,'Valor'),probability:oneOf(p.probability,['low','medium','high','unknown'],'Probabilidade'),timing:text(p.timing,500),action:required(p.action,'a providência',10),mechanism:required(p.mechanism,'a proteção sugerida',10),owner:required(p.owner,'o responsável pela providência',3),due_date:required(p.due_date,'o prazo'),closure_criteria:required(p.closure_criteria,'o comprovante exigido para encerrar',10),closing_block:p.closing_block===true,resolved:p.resolved===true,resolution:text(p.resolution),migration_pending:false};
   if(!validDate(body.due_date))fail('Prazo inválido.');if(body.legacy_id&&!data.legacy.some(f=>f.id===body.legacy_id))fail('Achado anterior fora do mandato.',403);
   if(!proofs.length)fail('Vincule ao menos uma evidência recebida; se ela for parcial, explicite a limitação.');
   if(body.resolved){leadOnly(data);required(body.resolution,'o fundamento do encerramento',30);if(!proofs.some(id=>data.checks.some(c=>c.link_id===id&&c.body.result==='sufficient')))fail('O encerramento exige comprovante conferido como suficiente.');}
   const id=previous?.id||randomUUID();
   body.value_basis=body.amount!==null?required(p.value_basis,'a fonte e o cálculo do valor, sem dupla contagem',15):text(p.value_basis);
   if(body.legacy_id&&data.events.some(e=>e.id!==id&&e.body.legacy_id===body.legacy_id))fail('Este achado anterior já possui um evento. Edite o evento existente.');
   await mutate(user,m,tx=>tx.query('insert into dd_work_events(id,matter_id,body,created_by,updated_by) values($1,$2,$3,$4,$4) on conflict(id) do update set body=excluded.body,updated_by=excluded.updated_by,updated_at=now()',[id,m,JSON.stringify(body),user.id]));
  }else if(action==='draft'){
   leadOnly(data);await verifyFiles(data);
   const recommendation=oneOf(p.recommendation,['caution','proceed','do_not_proceed','more_information'],'Recomendação');
   if(recommendation==='proceed'&&(data.counts.pending||data.counts.not_verified||data.counts.qualified||data.counts.noncompliant||data.events.some(e=>!e.body.resolved)))fail('Há pendências ou riscos abertos. Utilize recomendação com cautela, informações adicionais ou não prosseguir.');
   if(recommendation==='proceed'&&(data.price_readiness.length||data.valuation?.result.position==='above'))fail('Preço sem suporte suficiente ou acima da faixa: revise a negociação antes de recomendar prosseguir.');
   const narrative=required(p.narrative,'os fundamentos da recomendação final',80),conditions=required(p.conditions,'as condições para fechar e os riscos que permanecem',30),author=required(p.author,'o nome do responsável',5),registration=required(p.registration,'a identificação profissional ou função do responsável',3);
   const snapshot={...norm(data),opinions:undefined,approvals:undefined,readiness:data.readiness,recommendation,narrative,conditions,author,registration,prepared_at:new Date().toISOString(),prepared_by:user.id};
   const report=buildReport(snapshot),id=randomUUID(),hash=createHash('sha256').update(report).digest('hex');
   await mutate(user,m,tx=>tx.query('insert into dd_opinions(id,matter_id,basis_hash,snapshot,report_text,report_hash,created_by) values($1,$2,$3,$4,$5,$6,$7)',[id,m,data.basis_hash,JSON.stringify(snapshot),report,hash,user.id]));
  }else if(action==='approve'){
   leadOnly(data);const opinion=data.opinions.find(o=>o.id===p.opinion_id);if(!opinion)fail('Parecer não encontrado.',404);
   if(opinion.approval)fail('Esta versão já possui aprovação.');if(!opinion.current)fail('A base mudou. Prepare uma nova versão antes de aprovar.',409);
   if(data.readiness.length)fail('Aprovação bloqueada: '+data.readiness.join(' '),409);
   if(p.accept!==true)fail('Confirme a revisão pessoal das evidências e da conclusão.');
   if(data.price_readiness.length&&p.accept_economic_limits!==true)fail('Confirme expressamente as limitações econômicas antes de aprovar um parecer com cautela.');
   await verifyFiles(data);
   const note=required(p.note,'o registro da aprovação pessoal',30),snapshot=opinion.snapshot;
   const body={name:snapshot.author,registration:snapshot.registration,authenticated_email:user.email,identity:'Nome e identificação profissional declarados pelo responsável.',note,basis_hash:data.basis_hash,report_hash:opinion.report_hash,economic_limits:data.price_readiness,accepted_economic_limits:p.accept_economic_limits===true,authentication:'Conta autenticada e senha reconfirmada. Aprovação interna; não é assinatura digital qualificada.'};
   await mutate(user,m,tx=>tx.query('insert into dd_opinion_approvals(matter_id,opinion_id,body,approved_by) values($1,$2,$3,$4)',[m,opinion.id,JSON.stringify(body),user.id]));
  }else fail('Operação não encontrada.',404);
  await local.persist();return load(user,m);
 }
 async function history(user,m){const data=await load(user,m);leadOnly(data);return asUser(user,async tx=>(await tx.query('select * from dd_workflow_audit where matter_id=$1 order by id desc limit 500',[m])).rows);}
 async function report(user,m,id){const data=await load(user,m);leadOnly(data);const o=data.opinions.find(o=>o.id===id);if(!o)fail('Parecer não encontrado.',404);await verifyFiles(data);return {id:o.id,current:o.current,approved:!!o.approval,approval:o.approval,report_hash:o.report_hash,basis_hash:o.basis_hash,text:o.report_text,snapshot:o.snapshot};}
 async function briefing(user,m){const data=await load(user,m);leadOnly(data);await verifyFiles(data);return {schema:'vertice-dd-agent-input-v1',generated_at:new Date().toISOString(),basis_hash:data.basis_hash,instructions:'Analise os 305 requisitos e a consonância do preço. Não invente provas, múltiplos, taxas, normas ou dados ausentes. Diferencie declaração, evidência e premissa. Cite requisito, vínculo, arquivo, localização e hash. Não some o mesmo evento duas vezes. Use as fórmulas e limitações da análise econômica. Se faltar suporte, conclua insuficiência. Toda proposta exige revisão humana e nova versão do parecer. Não aprove nem autorize fechamento.',expected_output:{schema:'vertice-dd-agent-proposal-v1',basis_hash:data.basis_hash,findings:[{requirement_code:'código existente',link_ids:['vínculos existentes'],finding:'texto',risk:'red|amber|green|not_verified',mechanism:'proteção sugerida',limitations:'texto'}],price_analysis:{conclusion:'texto',source_link_ids:[],assumptions:[],missing_data:[],double_counting:[],suggested_negotiation:'texto'},recommendation:'caution|proceed|do_not_proceed|more_information',human_approval_required:true},data:{...norm(data),opinions:undefined,approvals:undefined},notice:'Exportação local. Nenhum documento foi enviado a IA. O arquivo contém respostas e metadados; não contém os arquivos binários. O futuro agente precisará ler o conteúdo dos comprovantes pelo acesso autorizado antes de concluir. A integração e a validação da resposta do futuro provedor ainda deverão ser habilitadas.'};}
 return {load,act,history,report,briefing,revision};
}
export function buildReport(s){
 const labels={verified:'Conforme após revisão',qualified:'Com ressalva',noncompliant:'Não conforme',not_applicable:'Não aplicável',not_verified:'Não verificado'},rec={caution:'CAUTELA NA AQUISIÇÃO',proceed:'PROSSEGUIR NAS CONDIÇÕES DESCRITAS',do_not_proceed:'NÃO PROSSEGUIR',more_information:'AGUARDAR INFORMAÇÕES ADICIONAIS'};
 const lines=['PARECER DO MANDATO — VERSÃO IDENTIFICADA',s.matter.code+' — '+s.matter.title,'Instrumento: '+s.revision.version,'Base documental: '+s.basis_hash,'Data-base: '+(s.profile?.body.reference_date||'Não definida'),'Recomendação: '+rec[s.recommendation],'Responsável indicado: '+s.author+' — '+s.registration,'','ESCOPO',...Object.entries({Entidades:s.profile?.body.entities,'Incluído':s.profile?.body.included,'Excluído':s.profile?.body.excluded,'Estrutura da compra':s.profile?.body.transaction_type,'Tipo de instituição':s.profile?.body.institution_type,'Sistema de ensino':s.profile?.body.education_system,'Formatos de oferta':s.profile?.body.modalities,'Regime e benefícios':s.profile?.body.tax_regime,'Critérios de relevância':s.profile?.body.materiality_reason}).map(([label,value])=>label+': '+(value||'Não definido')),'','FUNDAMENTOS DA CONCLUSÃO',s.narrative,'','CONDIÇÕES PARA FECHAR E RISCOS REMANESCENTES',s.conditions,'','COBERTURA E LIMITAÇÕES',...Object.entries(s.counts).map(([key,value])=>(labels[key]||'Pendente de revisão atual')+': '+value),...s.readiness,'','CONFERÊNCIAS ENTRE FRENTES',...s.comparisons.map(c=>c.label+': '+({pending:'Pendente',consistent:'Valores comparados',difference_explained:'Diferença explicada para revisão',not_applicable:'Não aplicável, justificado'}[c.result])+'; diferença '+(c.difference??'não calculada')+'; fontes '+[c.left_document,c.right_document].map(id=>s.documents.find(d=>d.id===id)?.file_name||'não informada').join(' / ')+'; '+(c.note||'Sem análise')),'','EVENTOS E PROTEÇÕES (VALORES AGRUPADOS POR EVENTO; NÃO SÃO DESCONTO AUTOMÁTICO)'];
 for(const event of s.events){const b=event.body;lines.push('',event.id+' — '+b.title,'Requisitos: '+b.requirement_ids.map(id=>s.requirements.find(r=>r.id===id)?.code).join(', '),'Risco: '+b.risk+'; fundamento: '+b.risk_reason,'Achado: '+b.issue,'Consequência: '+b.consequence,'Natureza do valor: '+b.nature+'; valor: '+(b.amount??'Não quantificado')+'; probabilidade: '+b.probability+'; base de cálculo: '+(b.value_basis||'Não informada'),'Providência: '+b.action,'Proteção sugerida: '+b.mechanism,'Responsável e prazo: '+b.owner+' — '+b.due_date,'Critério de conclusão: '+b.closure_criteria,'Bloqueia fechamento: '+(b.closing_block&&!b.resolved?'Sim':'Não')+'; encerrado: '+!!b.resolved);for(const id of b.proofs||[]){const l=s.links.find(l=>l.id===id),d=s.documents.find(d=>d.id===l?.document_id),q=s.checks.find(c=>c.link_id===id),state=s.states.find(st=>st.id===l?.state_id),code=s.requirements.find(r=>r.id===state?.requirement_id)?.code;lines.push('Prova do evento: '+code+' — '+(d?.file_name||'Arquivo indisponível')+'; localização '+(q?.body.location||l?.evidence_location||'não informada')+'; ID '+(d?.id||'—')+'; SHA256 '+(d?.sha256||'—')+'; conferência '+(q?.body.result||'não verificada'));}}
 lines.unshift('RESUMO PARA DECISÃO',rec[s.recommendation],s.narrative,'Eventos abertos: '+s.events.filter(e=>!e.body.resolved).length+'; impedimentos ao fechamento: '+s.events.filter(e=>!e.body.resolved&&e.body.closing_block).length,'Preço: '+(s.valuation?.result.conclusion||'Compatibilidade não analisada.'),'A aprovação deste parecer não autoriza fechar a operação nem efetuar pagamentos.','');
 lines.push('',ebitdaText(s.ebitda),'',valuationText(s.valuation),'','CONDIÇÕES ECONÔMICAS E DE FECHAMENTO',...(s.closing_readiness||[]),'Aprovação do parecer não equivale a liberação do fechamento. Verifique os impedimentos, contratos e documentos atualizados antes de fechar.','','ANEXO DE RASTREABILIDADE POR REQUISITO');
 for(const state of s.states){const req=s.requirements.find(r=>r.id===state.requirement_id),effective=s.effective.find(r=>r.state_id===state.id),r=effective?.valid?effective.review:null;lines.push('',req.code+' — '+req.question,'Resposta declarada: '+(state.answer||'Não fornecida'),'Registros estruturados: '+((state.structured_rows||[]).map((row,i)=>(i+1)+'. '+row.map((cell,j)=>(req.columns?.[j]||'Campo '+(j+1))+': '+cell).join(' | ')).join(' / ')||'Sem tabela'),'Conclusão: '+(r?labels[r.body.decision]:'Sem revisão atual válida'),'Análise: '+(r?.body.analysis||'Pendente'),'Critério: '+(r?.body.rule||'Não informado'),'Limitações: '+(r?.body.limitations||'Não informadas'),'Analista e data: '+(r?.body.reviewer_label?r.body.reviewer_label+' (ID '+r.reviewed_by+')':r?.reviewed_by||'—')+' — '+(r?.reviewed_at||'—'));
  for(const l of s.links.filter(l=>l.state_id===state.id)){const d=s.documents.find(d=>d.id===l.document_id),c=s.checks.find(c=>c.link_id===l.id);lines.push('Evidência: '+d.file_name+'; ID '+d.id+'; SHA256 '+d.sha256+'; localização '+(c?.body.location||l.evidence_location||'Não informada')+'; conferência '+(c?.body.result||'Não verificada')+'; origem/período/unidade '+[c?.body.origin,c?.body.period,c?.body.unit].filter(Boolean).join(' / '));}
 }
 lines.push('','APROVAÇÃO','Esta versão só é final quando existir registro de aprovação vinculado ao seu hash e à base documental. Alterações posteriores exigem nova versão e nova aprovação. Aprovação interna autenticada não equivale a assinatura digital qualificada.');return lines.join('\n');
}
