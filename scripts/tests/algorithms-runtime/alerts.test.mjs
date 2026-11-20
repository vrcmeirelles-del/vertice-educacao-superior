import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evasionAlerts,bottleneckAlerts,paceAlerts,titulationAlerts} from '../../../supabase/functions/vertice-algoritmos/alerts.ts';
const inst=JSON.parse(readFileSync(new URL('../../../source-overrides/client/src/lib/avaliacao-institucional.json',import.meta.url),'utf8'));
const criteria=inst.indicators.find(i=>i.code==='4.1').criteria;
const cohorts=['2022/01','2022/02','2023/01','2023/02','2024/01','2024/02','2025/01','2025/02'];

test('evasão: curso persistente vira alerta alto; sem validação, nada é publicado',()=>{
 const row=(codigo,semestre,k)=>({codigo,curso:'Curso '+codigo,modalidade:'Presencial',semestre,total_registros:100,abandono:k,cancelado:0,transferido:0,troca_curso:0,trancado:0});
 const ok=evasionAlerts(cohorts.flatMap((c,ci)=>[row('A',c,25),...['B','C','D','E','F'].map((x,i)=>row(x,c,8+((i+ci)%5)))]));
 assert.equal(ok.published,true);assert.deepEqual(ok.alerts.map(a=>[a.entity_key,a.severity]),[['A','alta']]);
 const noise=evasionAlerts(cohorts.flatMap((c,ci)=>['A','B','C','D','E','F'].map((x,i)=>row(x,c,(i+ci)%6===0?25:10))));
 assert.equal(noise.published,false);assert.equal(noise.alerts.length,0);
});
test('gargalo: disciplina persistente vira alerta alto com nome do curso',()=>{
 const off=(d,s,n,f)=>({course_code:'013',discipline:d,semester:s,teachers:'T '+d,passed_direct:n-f,passed_final:0,source_failures:f,rf:0,rn:f,ra:0,other_status:''});
 const r=bottleneckAlerts(cohorts.flatMap((s,si)=>[off('A',s,60,21),...['B','C','D','E','F'].map((d,i)=>off(d,s,60,4+((i+si)%3)))]),c=>c==='013'?'Enfermagem':c);
 assert.equal(r.published,true);assert.equal(r.alerts[0].severity,'alta');assert.match(r.alerts[0].title,/Disciplina-gargalo: A \(Enfermagem\)/);
});
test('ritmo: prazo crítico gera alerta por prazo e por curso; evidência sem Infinity',()=>{
 const reqs=Array.from({length:30},(_,i)=>({id:'r'+i,course_id:'c1',due_date:'2026-12-15',active:true}));
 const r=paceAlerts(reqs,[],c=>c==='c1'?'Direito':'-',new Date('2026-11-20T12:00:00Z'));
 assert.deepEqual(r.alerts.map(a=>a.entity_key),['prazo:2026-12-15','prazo:2026-12-15|curso:c1']);
 assert.match(r.alerts[1].title,/Ritmo crítico: Direito/);
 assert.doesNotThrow(()=>JSON.stringify(r));
 const vencido=paceAlerts([{id:'x',course_id:'c1',due_date:'2026-11-01'}],[],undefined,new Date('2026-11-20T12:00:00Z'));
 assert.equal(JSON.stringify(vencido).includes('Infinity'),false);
});
test('titulação: cadastro padrão vira alerta médio; faixas lidas do instrumento oficial',()=>{
 const padrao=Array.from({length:95},()=>({titulacao:'mestre',regime:'horista',ch_semanal:16,cursos_vinculados:[]}));
 const r=titulationAlerts(padrao,criteria);
 assert.deepEqual(r.alerts.map(a=>[a.entity_key,a.severity]),[['cadastro','media']]);
 const fraco=Array.from({length:20},(_,i)=>({titulacao:i<3?'mestre':'especialista',regime:i%2?'integral':'parcial',ch_semanal:20+i,cursos_vinculados:['c']}));
 assert.equal(titulationAlerts(fraco,criteria).alerts[0].entity_key,'conceito');
 assert.equal(titulationAlerts(padrao,undefined).published,false);
});
test('recorte do indicador 4.1 usado pela função é idêntico ao instrumento oficial do portal',()=>{
 const recorte=JSON.parse(readFileSync(new URL('../../../supabase/functions/vertice-algoritmos/indicador-4-1.json',import.meta.url),'utf8'));
 assert.deepEqual(recorte.criteria,criteria);assert.equal(recorte.code,'4.1');
});
