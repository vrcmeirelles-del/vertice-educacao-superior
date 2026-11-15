import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const manifest=JSON.parse(readFileSync('archives/vertice-app-de67f5fe.manifest.json','utf8'));
const digest=createHash('sha256').update(readFileSync('archives/vertice-app-de67f5fe.tar.gz')).digest('hex');
assert.equal(digest,manifest.archive_sha256,'O snapshot histórico foi alterado');
assert.equal(manifest.files.length,120,'O acervo histórico está incompleto');
function checkTree(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);
  if(item.isDirectory())checkTree(file);
  else if(/\.(tsx?|jsx?)$/.test(file)){
   const text=readFileSync(file,'utf8');
   assert(!text.includes('https://vertice-app-oyst.onrender.com'),`Dependência do serviço retirado: ${file}`);
  }
 }
}
checkTree('source-overrides/client/src');
const planning=readFileSync('source-overrides/client/src/components/area/CoursePlanning.tsx','utf8');
assert(planning.includes("supabase.rpc('vertice_course_planning'"),'Planejamento deve usar a sessão nativa do portal');
console.log('Fonte canônica, integração nativa e integridade histórica verificadas.');
