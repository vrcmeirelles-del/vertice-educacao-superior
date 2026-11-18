import {test} from 'node:test';import assert from 'node:assert/strict';
import {classifyEmailFailure,deliverInvitation} from '../../../supabase/functions/vertice-extension-student-invite/delivery.ts';
const input={key:'segredo-sintetico',from:'sender@example.org',to:'recipient@example.org',title:'Projeto fictício',link:'https://example.org/#ativacao=token-confidencial'};
const fake=(status,body)=>async()=>new Response(JSON.stringify(body),{status});
test('diferencia credencial, domínio, cota, frequência e dados inválidos',()=>{
 for(const [status,body,code] of [[401,{},'email_credentials'],[403,{name:'restricted_api_key'},'email_credentials'],[403,{name:'validation_error',message:'The example.org domain is not verified'},'email_sender_domain'],[403,{message:'You can only send testing emails to your own email address'},'email_sender_domain'],[429,{name:'daily_quota_exceeded'},'email_quota'],[429,{},'email_rate_limit'],[422,{},'email_invalid_request'],[503,{},'email_provider_unavailable']])assert.equal(classifyEmailFailure(status,body).code,code);
});
test('aceitação exige sucesso HTTP e recibo, sem afirmar entrega',async()=>{
 const logs=[];let calls=0;
 const r=await deliverInvitation(input,{fetch:async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(JSON.parse(init.body).to[0],input.to);return new Response(JSON.stringify({id:'recibo-sintetico'}),{status:200});},log:x=>logs.push(x)});
 assert.deepEqual(r,{ok:true});assert.equal(calls,1);assert.equal(logs[0].event,'extension_email_accepted');assert.ok(!JSON.stringify(logs).includes(input.to));
});
test('recusa não vaza texto bruto, segredo, destinatário ou link',async()=>{
 const logs=[];const r=await deliverInvitation(input,{fetch:fake(403,{name:'validation_error',message:'domain not verified '+JSON.stringify(input)}),log:x=>logs.push(x)});
 assert.equal(r.ok,false);assert.equal(r.code,'email_sender_domain');for(const value of [input.key,input.to,input.from,input.link])assert.ok(!JSON.stringify({r,logs}).includes(value));
});
test('HTTP 200 sem recibo não é declarado enviado',async()=>{
 const r=await deliverInvitation(input,{fetch:fake(200,{}),log:()=>{}});assert.equal(r.ok,false);assert.equal(r.code,'email_receipt_missing');
});
test('falha de rede não dispara repetição nem declara que a mensagem não saiu',async()=>{
 let calls=0;const logs=[];const r=await deliverInvitation(input,{fetch:async()=>{calls++;throw Error('segredo '+input.key);},log:x=>logs.push(x)});
 assert.equal(calls,1);assert.equal(r.code,'email_network_unconfirmed');assert.ok(r.error.includes('pode ter sido aceito'));assert.ok(!JSON.stringify(logs).includes(input.key));
});
test('resposta não JSON de erro fica em categoria segura',async()=>{
 const r=await deliverInvitation(input,{fetch:async()=>new Response('<html>falha</html>',{status:502}),log:()=>{}});assert.equal(r.code,'email_provider_unavailable');
});
