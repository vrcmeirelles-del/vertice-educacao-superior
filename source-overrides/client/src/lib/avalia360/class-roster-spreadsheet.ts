export type RosterImportRow={name:string;registration:string};

export function parseClassRosterRows(rows:unknown[][]):RosterImportRow[]{
 const index=rows.findIndex(row=>row.some(value=>String(value??'').trim()));
 if(index<0)throw Error('A planilha está vazia.');
 const header=rows[index].map(value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'')
   .trim().replace(/\s+/g,' ').toLowerCase());
 const nameIndex=header.findIndex(value=>['nome','nome completo','aluno','nome do aluno'].includes(value));
 const registrationIndex=header.findIndex(value=>['matricula','numero de matricula','codigo de matricula'].includes(value));
 if(nameIndex<0||registrationIndex<0)throw Error('Inclua as colunas Nome e Matrícula na primeira linha da planilha.');
 const result:RosterImportRow[]=[];
 const seen=new Set<string>();
 for(let i=index+1;i<rows.length;i++){
  const row=rows[i];
  if(!row.some(value=>String(value??'').trim()))continue;
  const name=typeof row[nameIndex]==='string'?row[nameIndex].trim():'';
  const value=row[registrationIndex];
  const registration=typeof value==='string'?value.trim():
   typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):'';
  if(!name||name.length>120||/[\u0000-\u001f]/u.test(name))
   throw Error(`Linha ${i+1}: informe o nome do aluno (até 120 caracteres).`);
  if(!/^[A-Za-z0-9][A-Za-z0-9./_-]{0,63}$/.test(registration))
   throw Error(`Linha ${i+1}: informe uma matrícula válida. Use texto para manter zeros à esquerda.`);
  const key=registration.toLowerCase();
  if(seen.has(key))throw Error(`Linha ${i+1}: matrícula repetida na planilha.`);
  seen.add(key);
  result.push({name,registration});
 }
 if(!result.length)throw Error('Inclua pelo menos um aluno com nome e matrícula.');
 return result;
}
