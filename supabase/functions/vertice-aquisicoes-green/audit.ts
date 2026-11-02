const codePattern=/\b(?:REG|QUA|ACA|FIN|TRIB|TRA|SOC|IMO|CON|DAD)-\d{2}\b/g;
const codes=text=>[...new Set(String(text).match(codePattern)||[])];
const isStandard=name=>/^DD-(?:CADERNO-|DECL-|INDICE-MESTRE)/i.test(name);
const normalized=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const blank=text=>!String(text||'').replace(/\[[^\]]*\]|_+|\.{2,}/g,'').trim()||/^\s*(?:pendente|a preencher|preencher|sem resposta)\s*$/i.test(String(text).replace(/\[[^\]]*\]/g,''));
export function buildAudit(requirements,documents,decoded,{responses=[],links=[]}={}){
 const parsed=new Map(decoded.map(d=>[d.id,d])),answers=new Map(),indexes=new Map(),warnings=[];
 for(const doc of documents){
  const data=parsed.get(doc.id);
  if(data&&!data.ok){warnings.push({file:doc.file_name,message:'Word não lido: '+data.error});continue;}
  if(!data)continue;
  if(/^DD-CADERNO-/i.test(doc.file_name))for(const table of data.tables){
   const header=table.rows.find(r=>r.cells.some(c=>normalized(c).includes('resposta da instituicao')));
   if(!header)continue;const column=header.cells.findIndex(c=>normalized(c).includes('resposta da instituicao'));
   for(const row of table.rows){if(row.row<=header.row)continue;for(const code of codes(row.cells[0])){
    const entries=answers.get(code)||[];entries.push({answer:row.cells[column]||'',file:doc.file_name,document_id:doc.id,sha256:doc.sha256,location:`tabela ${table.table}, linha ${row.row}, coluna ${column+1}`});answers.set(code,entries);
   }}
  }
  if(/^DD-INDICE-MESTRE(?:\.docx)$/i.test(doc.file_name))for(const table of data.tables)for(const row of table.rows){
   for(const code of codes(row.cells[0])){const entries=indexes.get(code)||[];entries.push({cells:row.cells,file:doc.file_name,location:`tabela ${table.table}, linha ${row.row}`});indexes.set(code,entries);}
  }
 }
 const results=requirements.map(r=>{
  const native=responses.find(s=>s.requirement_id===r.id&&s.answer?.trim());
  const response=native?[{answer:native.answer,file:'Formulário do requisito '+r.code,location:'Resposta salva no módulo em '+native.answered_at,document_id:null}]:answers.get(r.code)||[],index=indexes.get(r.code)||[];
  const filled=response.filter(a=>!blank(a.answer));
  const declaration=documents.filter(d=>d.file_name.toUpperCase()===`DD-DECL-${r.front}.DOCX`);
  const trace=response.map(a=>({file:a.file,document_id:a.document_id,sha256:a.sha256,location:a.location,kind:'Resposta institucional'}));
  trace.push(...index.map(i=>({file:i.file,location:i.location,kind:'Índice mestre'})));
  const joined=index.map(i=>i.cells.join(' ; ')).join(' ; ');
  const state=responses.find(s=>s.requirement_id===r.id),directLinks=links.filter(l=>l.state_id===state?.id);
  const evidence=documents.filter(d=>directLinks.some(l=>l.document_id===d.id)||(!isStandard(d.file_name)&&joined.toLowerCase().includes(d.file_name.toLowerCase())));
  trace.push(...evidence.map(d=>{const link=directLinks.find(l=>l.document_id===d.id);return {file:d.file_name,document_id:d.id,location:link?link.evidence_location||'Anexo vinculado no formulário; conteúdo ainda não validado':'Arquivo citado no índice; conteúdo ainda não validado',template_id:link?.template_id,kind:'Comprovante presente',sha256:d.sha256};}));
  const uniqueAnswers=new Set(filled.map(a=>normalized(a.answer)));
  let status,reason;
  if(!response.length){status='missing_response';reason='Não foi localizada resposta deste requisito no formulário ou no caderno da frente.';}
  else if(!filled.length){status='blank_response';reason='O campo de resposta está em branco ou contém apenas marcador de preenchimento.';}
  else if(uniqueAnswers.size>1){status='conflicting_versions';reason='Há respostas diferentes em mais de uma versão. Selecione e confira a versão aplicável.';}
  else if(!evidence.length){status='missing_evidence';reason='Há resposta, mas não há comprovante disponível vinculado pelo formulário ou pelo índice.';}
  else {status='ready_for_review';reason='Resposta e referências localizadas. O conteúdo, a autenticidade e a suficiência das provas exigem revisão do analista.';}
  return {code:r.code,front:r.front,question:r.question,expected_doc:r.expected_doc,status,reason,answer_excerpt:filled[0]?.answer.slice(0,1200)||null,trace,declaration:{present:declaration.length>0,signature_verified:false,files:declaration.map(d=>d.file_name)},risk:null,mechanism:null,review_required:true};
 });
 return {version:'1.0',mode:'local_document_check',created_at:new Date().toISOString(),limits:['Sem modelo de IA e sem chamadas externas.','Não verifica assinatura, autenticidade, conteúdo de PDF, cálculos ou conformidade jurídica.','Não atribui cor de risco, mecanismo contratual nem altera o tracker automaticamente.','Localização por tabela, linha e coluna. Paginação de Word não foi inferida.'],summary:{requirements:results.length,documents:documents.length,answers:results.filter(r=>r.answer_excerpt).length,ready:results.filter(r=>r.status==='ready_for_review').length,pending:results.filter(r=>r.status!=='ready_for_review').length},warnings,results};
}
