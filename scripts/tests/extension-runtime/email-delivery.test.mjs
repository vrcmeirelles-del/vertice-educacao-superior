import {test} from 'node:test';import assert from 'node:assert/strict';
import {classifyEmailFailure,sendPortalEmail,portalEmailConfig} from '../../../supabase/functions/_shared/portal-email.ts';
import {parsePortalInvitationLink} from '../../../source-overrides/shared/portal-invitation-link.ts';
const id='00000000-0000-4000-8000-000000000001';
const context={module:'tcc',requestId:id,recipient:'person@example.org',fingerprint:'synthetic-invitation'};
const message={subject:'Convite fictício',text:'https://example.org/#segredo-sintetico'};
function setup(fetcher=async()=>new Response(JSON.stringify({id:'recibo-ficticio'}),{status:200})){
 const rows=new Map(),logs=[],calls=[];
 const db={rpc:async(name,{p_action,p_data})=>{calls.push({name,p_action,p_data});if(p_action==='claim'){const row=rows.get(p_data.id);if(row)return {data:{claimed:false,status:row.status},error:null};rows.set(p_data.id,{status:'processing'});return {data:{claimed:true,status:'processing'},error:null};}rows.set(p_data.id,p_data);return {data:{status:p_data.status},error:null};}};
 return {rows,logs,calls,deps:{env:k=>({VERTICE_RESEND_API_KEY:'segredo-config',VERTICE_RESEND_FROM:'Vértice <noreply@verticesuperior.com.br>'})[k],db,fetch:fetcher,log:x=>logs.push(x)}};
}
test('uma configuração para qualquer módulo; remetente de outro domínio é recusado',()=>{
 const env=k=>({VERTICE_RESEND_API_KEY:'global',RESEND_API_KEY:'legada',EXTENSION_RESEND_API_KEY:'compatibilidade'})[k];assert.equal(portalEmailConfig(env).key,'global');assert.equal(portalEmailConfig(k=>k==='RESEND_FROM'?'F&O <sender@fatoeordem.com.br>':env(k)).configured,false);
});
test('credencial já salva com nome antigo atende todos os módulos, com prioridade sobre a chave genérica',async()=>{
 const saved={EXTENSION_RESEND_API_KEY:'credencial-vertice-sintetica',RESEND_API_KEY:'credencial-generica-sintetica',EXTENSION_RESEND_FROM:'Vértice <noreply@verticesuperior.com.br>',RESEND_FROM:'F&O <sender@fatoeordem.com.br>'};
 assert.equal(portalEmailConfig(k=>saved[k]).configured,true);
 for(const module of ['tcc','estagio','cadastro','extensao','governanca','contrato','notificacoes']){
  let calls=0;const s=setup(async(_url,init)=>{calls++;assert.equal(init.headers.Authorization,'Bearer '+saved.EXTENSION_RESEND_API_KEY);assert.equal(JSON.parse(init.body).from,saved.EXTENSION_RESEND_FROM);return new Response(JSON.stringify({id:'receipt'}),{status:200});});
  const result=await sendPortalEmail({...context,module},async()=>message,{...s.deps,env:k=>saved[k]});assert.equal(result.ok,true);assert.equal(calls,1);assert.equal(result.delivery_confirmed,false);
 }
 assert.equal(portalEmailConfig(k=>({ ...saved,VERTICE_RESEND_API_KEY:'preferencial',VERTICE_RESEND_FROM:'Vértice <mail@verticesuperior.com.br>'})[k]).key,'preferencial');
});
test('categorias seguras de credencial, domínio, cota e conexão',()=>{
 for(const [status,body,code] of [[401,{},'email_credentials'],[403,{name:'restricted_api_key'},'email_credentials'],[403,{message:'domain is not verified'},'email_sender_domain'],[429,{name:'daily_quota_exceeded'},'email_quota'],[429,{},'email_rate_limit'],[422,{},'email_invalid_request']])assert.equal(classifyEmailFailure(status,body).code,code);
});
test('TCC, estágio, cursos e Extensão usam o mesmo remetente e transporte auditado',async()=>{
 for(const module of ['tcc','estagio','cadastro','extensao','governanca','experience','master','contrato','notificacoes','conecta']){
  let n=0;const s=setup(async(url,init)=>{n++;assert.equal(url,'https://api.resend.com/emails');assert.equal(JSON.parse(init.body).from,'Vértice <noreply@verticesuperior.com.br>');assert.equal(init.headers['Idempotency-Key'],'vertice/'+id);return new Response(JSON.stringify({id:'receipt'}),{status:200});});
  const r=await sendPortalEmail({...context,module},async()=>message,s.deps);assert.equal(r.ok,true);assert.equal(r.delivery_confirmed,false);assert.equal(n,1);assert.equal(s.calls[0].p_data.module,module);
 }
});
test('repetição de tentativa aceita não gera outro token nem outro e-mail',async()=>{
 let build=0,sends=0;const s=setup(async()=>{sends++;return new Response(JSON.stringify({id:'receipt'}),{status:200});});
 const b=async()=>{build++;return message;};await sendPortalEmail(context,b,s.deps);const r=await sendPortalEmail(context,b,s.deps);assert.equal(r.duplicate,true);assert.equal(build,1);assert.equal(sends,1);
});
test('falha e resultado incerto não são repetidos automaticamente e não expõem dados',async()=>{
 for(const fetcher of [async()=>new Response(JSON.stringify({name:'restricted_api_key',message:JSON.stringify({...context,key:'segredo-config'})}),{status:403}),async()=>{throw Error('segredo-config');},async()=>new Response('{}',{status:200})]){
  const s=setup(fetcher);const r=await sendPortalEmail(context,async()=>message,s.deps);assert.equal(r.ok,false);await sendPortalEmail(context,async()=>{throw Error('não deve preparar novamente');},s.deps);
  const stored=JSON.stringify({logs:s.logs,calls:s.calls});for(const privateValue of [context.recipient,message.text,'segredo-config'])assert.ok(!stored.includes(privateValue));
 }
});
test('falha de autorização/preparação ou auditoria impede o transporte',async()=>{
 let sends=0;const s=setup(async()=>{sends++;throw Error('não pode chamar');});
 const r=await sendPortalEmail(context,async()=>{throw Error('invitation_denied');},s.deps);assert.equal(r.code,'email_preparation_failed');assert.equal(sends,0);
 const invalid=await sendPortalEmail({...context,requestId:crypto.randomUUID()},async()=>({text:'sem assunto'}),s.deps);assert.equal(invalid.code,'email_preparation_failed');assert.equal(sends,0);
 const r2=await sendPortalEmail({...context,requestId:crypto.randomUUID()},async()=>message,{...s.deps,db:{rpc:async()=>({error:{},data:null})}});assert.equal(r2.code,'email_audit_unavailable');assert.equal(sends,0);
});
test('links nativos rejeitam troca de origem, fluxo e parâmetros mistos',()=>{
 const token='a'.repeat(64),link=`https://www.verticesuperior.com.br/master#ies_invitation=${id}&ies_token=${token}`;
 assert.deepEqual(parsePortalInvitationLink(link,'ies'),{id,token});assert.throws(()=>parsePortalInvitationLink(link.replace('https://www.verticesuperior.com.br','https://evil.example'),'ies'));
 assert.throws(()=>parsePortalInvitationLink(link+'&master_token=x','ies'));assert.throws(()=>parsePortalInvitationLink(link,'master'));assert.throws(()=>parsePortalInvitationLink(link.replace('/master','/experience'),'ies'));
});
