const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function validateControl(def,value,previous){
 if(['select','choice','tree'].includes(def.type)&&value&&!Object.hasOwn(def.options||{},value)&&value!==previous)fail('Selecione uma opção prevista; valores anteriores somente podem ser preservados.');
 if(def.type==='date'&&value&&value!==previous&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))fail('Data inválida.');
 if(def.type==='url'&&value){let u;try{u=new URL(value);}catch{fail('Informe uma URL pública válida.');}if(u.protocol!=='https:'||u.username||u.password||Array.from(u.searchParams.keys()).some(k=>/password|senha|token|secret|access_key/i.test(k)))fail('Use somente URL pública HTTPS, sem credenciais ou chaves restritas.');}
}
export function validateFormMetadata(p,schema,previous={}){
 const rows=p.rows||[],ids=p.row_ids??rows.map((_,i)=>previous.row_ids?.[i]||'legacy-'+i);
 if(!Array.isArray(ids)||ids.length!==rows.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^([a-f0-9-]{36}|legacy-\d+)$/.test(id)))fail('Identificadores dos registros inválidos.');
 if(previous.row_ids&&p.row_ids===undefined&&JSON.stringify(rows)!==JSON.stringify(previous.rows))fail('Atualize o portal antes de alterar registros com comentários.',409);
 const allowed=new Set(schema.fields.map(f=>'field:'+f.key));ids.forEach(id=>(schema.columns||[]).forEach((_,j)=>allowed.add('row:'+id+':'+j)));
 const comments=p.comments??previous.comments??{},clean={};if(!comments||typeof comments!=='object'||Array.isArray(comments))fail('Comentários inválidos.');
 for(const [key,value]of Object.entries(comments)){if(!allowed.has(key)||typeof value!=='string'||value.length>2000)fail('Confira o campo e o limite do comentário.');if(value.trim())clean[key]=value.trim();}
 const files=p.row_attachments??previous.row_attachments??{};if(!files||typeof files!=='object'||Array.isArray(files))fail('Vínculos de documentos inválidos.');
 for(const [id,list]of Object.entries(files)){if(!schema.attachments||!ids.includes(id)||!Array.isArray(list)||list.length>50)fail('Documentos vinculados a registro inválido.');for(const f of list)if(!f||typeof f.document_id!=='string'||!/^[a-f0-9-]{36}$/.test(f.document_id)||typeof f.location!=='string'||f.location.length>2000)fail('Referência de documento inválida.');}
 rows.forEach((row,i)=>row.forEach((value,j)=>{const oldIndex=previous.row_ids?previous.row_ids.indexOf(ids[i]):i;validateControl(schema.columnDefs?.[j]||{},value,previous.rows?.[oldIndex]?.[j]);}));
 if(schema.requiresUniqueCode){const codes=rows.map(r=>r[0]?.trim().toLowerCase());if(codes.some(v=>!v)||new Set(codes).size!==codes.length)fail('Cada registro deve ter referência interna única.');}
 if(schema.uniqueProcessColumn!==undefined){const values=rows.map(r=>r[schema.uniqueProcessColumn]?.replace(/\W/g,'')).filter(Boolean);if(new Set(values).size!==values.length)fail('O mesmo processo foi informado mais de uma vez nesta seção.');}
 return {row_ids:ids,comments:clean,row_attachments:files};
}
