// Catálogo autoritativo no servidor. Nenhuma conclusão de conformidade é gerada.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=6000)=>{if(typeof v!=='string'||v.length>max)fail('Confira o texto e o limite dos campos.');return v.trim();};
export function validateFields(fields,schema){
 if(!fields||typeof fields!=='object'||Array.isArray(fields))fail('Campos inválidos.');
 const allowed=new Map(schema.map(f=>[f.key,f])),out={};
 for(const [key,value] of Object.entries(fields)){const f=allowed.get(key);if(!f)fail('Campo não previsto no formulário.');out[key]=text(value);if(f.type==='select'&&out[key]&&!Object.hasOwn(f.options,out[key]))fail('Situação inválida.');if(f.type==='date'&&out[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(out[key]))fail('Data inválida.');}
 return out;
}
export function validateRows(rows,columns){
 if(!Array.isArray(rows)||rows.length>500)fail('Use até 500 linhas por lista.');
 return rows.map(row=>{if(!Array.isArray(row)||row.length!==columns.length)fail('Confira as colunas da lista.');return row.map(v=>text(v,2000));});
}
export async function formsLoad(tx,m){
 return {form_answers:(await tx.query('select * from dd_form_answers where matter_id=$1 and institution_id=(select institution_id from dd_matters where id=$1) order by state_id',[m])).rows,shared_data:(await tx.query('select * from dd_shared_data where matter_id=$1 and institution_id=(select institution_id from dd_matters where id=$1) order by key',[m])).rows};
}
export async function saveOperationForm({s,asUser,user,m,p,catalog,kind}){
 // Chamada sob a mesma trava de mandato utilizada pela revisão e aprovação.
 if(!Number.isInteger(p.version)||p.version<0)fail('Reabra o formulário para confirmar a versão.');
 const schema=kind==='shared'?catalog.groups.find(g=>g.key===p.key):catalog.requirements[p.code];if(!schema)fail('Formulário inexistente.');
 const fields=validateFields(p.fields,schema.fields),rows=validateRows(p.rows||[],schema.columns||[]);
 const table=kind==='shared'?'dd_shared_data':'dd_form_answers',idField=kind==='shared'?'key':'state_id';
 let id=p.key,fronts,state;
 if(kind==='shared'){
  if(!Array.isArray(p.front_scope)||!p.front_scope.length||p.front_scope.some(f=>!schema.fronts.includes(f)))fail('Selecione as frentes que poderão consultar esta seção.');
  fronts=[...new Set(p.front_scope)].sort();
  const rights=await asUser(user,async tx=>{for(const f of fronts){const r=(await tx.query('select dd_private.can_access($1,true,$2) ok',[m,f])).rows[0];if(!r.ok)fail('Sua equipe não pode compartilhar dados com uma frente fora da sua autorização.',403);}return true;});
  if(!rights)fail('Sem autorização.',403);
 }else{
  state=await asUser(user,async tx=>(await tx.query('select s.id,s.requirement_id,s.answer,dd_private.can_access(s.matter_id,true,r.front) ok from dd_requirement_state s join dd_requirements r on r.id=s.requirement_id where s.matter_id=$1 and s.institution_id=(select institution_id from dd_matters where id=$1) and r.code=$2',[m,p.code])).rows[0]);
  if(!state?.ok)fail('Requisito sem acesso de edição.',403);id=state.id;
 }
 // A existência é verificada sob RLS. Um ID oculto não pode ser substituído.
 const visible=await asUser(user,async tx=>(await tx.query(`select * from ${table} where matter_id=$1 and institution_id=(select institution_id from dd_matters where id=$1) and ${idField}=$2`,[m,id])).rows[0]);
 const existing=(await s.unsafe(`select * from ${table} where matter_id=$1 and institution_id=(select institution_id from dd_matters where id=$1) and ${idField}=$2 for update`,[m,id]))[0];
 if(existing&&!visible)fail('Seção indisponível para esta equipe.',403);
 if(existing&&kind==='shared')for(const f of existing.front_scope){const ok=await asUser(user,async tx=>(await tx.query('select dd_private.can_access($1,true,$2) ok',[m,f])).rows[0].ok);if(!ok)fail('Somente responsável com acesso a todas as frentes desta seção pode alterá-la.',403);}
 if((existing?.version||0)!==p.version)fail('Outra pessoa alterou estes dados. Reabra para conferir a versão atual; seu preenchimento não foi salvo.',409);
 if(!Object.entries(fields).some(([k,v])=>k!=='declaration'&&v)&&!rows.some(row=>row.some(Boolean)))fail('Informe ao menos um dado ou uma limitação antes de salvar.');
 if(kind!=='shared'&&!fields.declaration)fail('Selecione a situação da informação.');
 const body={schema_version:catalog.version,fields,rows},version=p.version+1;
 if(JSON.stringify(body).length>700000)fail('A lista excede o limite. Divida o levantamento em grupos menores.');
 if(kind!=='shared'&&p.attachments!==undefined&&(!Array.isArray(p.attachments)||p.attachments.length>50))fail('Use até 50 anexos complementares.');
 if(kind==='shared')await s.unsafe('insert into dd_shared_data(matter_id,key,front_scope,body,version,updated_by) values($1,$2,$3,$4::jsonb,$5,$6) on conflict(matter_id,key) do update set front_scope=excluded.front_scope,body=excluded.body,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()',[m,id,fronts,JSON.stringify(body),version,user.id]);
 else{
  await s.unsafe('insert into dd_form_answers(matter_id,state_id,body,version,updated_by) values($1,$2,$3::jsonb,$4,$5) on conflict(state_id) do update set body=excluded.body,version=excluded.version,updated_by=excluded.updated_by,updated_at=now()',[m,id,JSON.stringify(body),version,user.id]);
  // Só recebimento: nunca declara conformidade, dispensa revisão ou altera a resposta anterior.
  await s.unsafe("update dd_requirement_state set received_at=coalesce(received_at,now()),updated_at=now(),status=case when status in ('finding','in_review','compliant','not_applicable') then 'in_review'::dd_requirement_status else 'received'::dd_requirement_status end where id=$1 and matter_id=$2 and institution_id=(select institution_id from dd_matters where id=$2)",[id,m]);
  if(p.attachments?.length)await asUser(user,tx=>tx.query('select public.dd_green_response($1,$2,$3,$4::jsonb)',[m,state.requirement_id,state.answer||'Declaração registrada no formulário deste requisito; anexos complementares sujeitos à conferência.',JSON.stringify(p.attachments)]));
 }
 return {ok:true,version};
}
export function formBasis(data,state,catalog){
 const code=data.requirements.find(r=>r.id===state.requirement_id)?.code,schema=catalog.requirements[code],own=data.form_answers?.find(a=>a.state_id===state.id),shared=(data.shared_data||[]).filter(row=>schema?.sharedKeys.includes(row.key)&&row.front_scope.includes(schema.front));
 return {...(own?{form:{body:own.body,version:own.version}}:{}),...(shared.length?{shared:shared.map(r=>({key:r.key,body:r.body,version:r.version}))}:{})};
}
export function operationFormsText(data,catalog){
 const lines=[],table=(columns,rows)=>rows.map((row,i)=>(i+1)+'. '+row.map((v,j)=>(columns[j]||'Campo '+(j+1))+': '+v).join(' | '));
 for(const record of data.form_answers||[]){const state=data.states.find(s=>s.id===record.state_id),req=data.requirements.find(r=>r.id===state?.requirement_id),schema=catalog.requirements[req?.code];if(!schema)continue;lines.push('',req.code+' — Formulário declarado, versão '+record.version,...schema.fields.filter(f=>record.body.fields[f.key]).map(f=>f.label+': '+record.body.fields[f.key]),...table(schema.columns,record.body.rows));}
 for(const record of data.shared_data||[]){const group=catalog.groups.find(g=>g.key===record.key);if(!group)continue;lines.push('','BASE COMPARTILHADA — '+group.title+' — versão '+record.version,'Frentes autorizadas: '+record.front_scope.join(', '),...group.fields.filter(f=>record.body.fields[f.key]).map(f=>f.label+': '+record.body.fields[f.key]),...table(group.columns,record.body.rows));}
 return lines;
}
