// Deterministic, offline catalog extraction. No generated indicator ranges or provider calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='source-overrides/client/src/lib/';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const recognitionPath=base+'repository-indicators.json';
const institutionalPath=base+'avaliacao-institucional.json';
const proposalPath=base+'novo-instrumento.ts';
const ts=read(proposalPath);
const warning='Proposta preliminar de 2026; não é instrumento definitivo confirmado. Títulos podem ser provisórios; orientações editoriais não são critérios oficiais.';
function literal(s){return JSON.parse(s.trim());}
function objects(section,profile){
 return [...section.matchAll(/\{ code: ("[^"]+"),[^\n]*?title: (.*?), hint:/g)].map(m=>{
  const expression=m[2];
  let title;
  if(expression.startsWith('d ?')){
   const choices=expression.match(/^d \? ("(?:[^"\\]|\\.)*") : ("(?:[^"\\]|\\.)*")$/);
   if(!choices||!profile)throw new Error('Unsupported profile expression: '+expression);
   title=literal(choices[profile==='direito'?1:2]);
  }else{
   // Source objects may mark a provisional title before hint.
   const quoted=expression.match(/^"(?:[^"\\]|\\.)*"/);
   if(!quoted)throw new Error('Unsupported title: '+expression);
   title=literal(quoted[0]);
  }
  return {code:literal(m[1]),title};
 });
}
function section(start,end){
 const a=ts.indexOf(start),b=ts.indexOf(end,a+start.length);
 if(a<0||b<0)throw new Error('Source section not found: '+start);
 return ts.slice(a,b);
}
const baseObjects=objects(section('const D1:', 'type PerfilArea'));
const areaSection=section('export function dimensao4(', 'export const OBJETOS_BASE');
const institutionObjects=objects(section('const EI1:', 'export const OBJETOS_INSTITUCIONAL'));
function catalog({key,instrumentCode,version,label,scope,regulatoryStatus,sourcePath,objects:items,...extra}){
 if(new Set(items.map(o=>o.code)).size!==items.length)throw new Error('Duplicate object codes: '+key);
 return {key,instrumentCode,version,label,scope,regulatoryStatus,sourcePath,sourceUrl:instrumentCode==='reconhecimento_curso'?'https://download.inep.gov.br/educacao_superior/avaliacao_cursos_graduacao/instrumentos/2017/curso_reconhecimento.pdf':instrumentCode==='recredenciamento_2017'?'https://download.inep.gov.br/educacao_superior/avaliacao_institucional/instrumentos/2017/IES_recredenciamento.pdf':null,sourceSha256:hash(read(sourcePath)),...extra,objects:items};
}
const currentInstitution=JSON.parse(read(institutionalPath));
const entries=[
 catalog({key:'reconhecimento_curso:2017',instrumentCode:'reconhecimento_curso',version:'2017',label:'Reconhecimento de Curso (2017)',scope:'course',regulatoryStatus:'current',sourcePath:recognitionPath,objects:Object.entries(JSON.parse(read(recognitionPath))).map(([code,title])=>({code,title}))}),
 catalog({key:'recredenciamento_2017:2017',instrumentCode:'recredenciamento_2017',version:'2017',label:'Recredenciamento Institucional (2017)',scope:'institution',regulatoryStatus:'current',sourcePath:institutionalPath,objects:currentInstitution.indicators.map(o=>({code:o.code,title:o.title,criteria:JSON.stringify(o.criteria)}))}),
 catalog({key:'novo_instrumento_2026_institucional:2026-proposta',instrumentCode:'novo_instrumento_2026_institucional',version:'2026-proposta',label:'Proposta de Recredenciamento Institucional (2026)',scope:'institution',regulatoryStatus:'proposal',sourcePath:proposalPath,warning,objects:institutionObjects}),
 ...[['base',baseObjects],['direito',[...baseObjects,...objects(areaSection,'direito')]],['negocios',[...baseObjects,...objects(areaSection,'negocios')]]].map(([profile,items])=>catalog({key:`novo_instrumento_2026_curso:2026-proposta-${profile}`,instrumentCode:'novo_instrumento_2026_curso',version:`2026-proposta-${profile}`,label:`Proposta de Avaliação de Curso (2026) · ${profile==='base'?'Dimensões 1–3':profile==='direito'?'Direito, Área 04':'Negócios e Administração, Área 04'}`,scope:'course',regulatoryStatus:'proposal',sourcePath:proposalPath,warning,applicabilityProfile:profile,objects:items})),
];
const expected=[58,50,26,31,38,38];
entries.forEach((c,i)=>{if(c.objects.length!==expected[i])throw new Error(`${c.key}: expected ${expected[i]}, got ${c.objects.length}`);});
const output=JSON.stringify(entries,null,2)+'\n';
const destination=path.join(root,'supabase/functions/_shared/preanalysis-catalog.json');
if(process.argv.includes('--check')){
 if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==output)throw new Error('Catalog is stale; run node scripts/build-preanalysis-catalog.mjs');
}else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,output);}
console.log(entries.map(c=>`${c.key}: ${c.objects.length}`).join('\n'));
