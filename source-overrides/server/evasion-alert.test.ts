import {describe,expect,it} from 'vitest';
import {evasionAlert,scoreCohorts,validate,courseAlerts,type CohortRow} from '../client/src/lib/evasion-alert';

const cohorts=['2022/01','2022/02','2023/01','2023/02','2024/01','2024/02','2025/01','2025/02'];
const row=(codigo:string,semestre:string,n:number,dropouts:number,extra:Partial<CohortRow>={}):CohortRow=>({codigo,curso:'Curso '+codigo,modalidade:'Presencial',semestre,total_registros:n,abandono:dropouts,cancelado:0,transferido:0,troca_curso:0,trancado:0,...extra});
// Cinco cursos com evasão definitiva entre 8% e 12% e um curso (A) persistentemente em 25%.
const persistent=():CohortRow[]=>cohorts.flatMap((c,ci)=>[row('A',c,100,25),...['B','C','D','E','F'].map((x,i)=>row(x,c,100,8+((i+ci)%5)))]);

describe('alerta precoce de evasão por curso',()=>{
 it('curso persistentemente acima dos pares: validação aprovada e alerta publicado',()=>{
  const r=evasionAlert(persistent());
  expect(r.validation.ready).toBe(true);
  expect(r.validation.pairs).toBe(42);
  expect(r.validation.hitRate).toBe(1);
  expect(r.validation.repeatRate).toBe(1);
  expect(r.courses[0]).toMatchObject({codigo:'A',level:'alerta'});
  expect(r.courses.filter(c=>c.level==='alerta').map(c=>c.codigo)).toEqual(['A']);
 });
 it('desvios que não se repetem na coorte seguinte: validação barra o alerta',()=>{
  // Em cada coorte um curso diferente fica alto; na seguinte ele volta ao normal.
  const rows=cohorts.flatMap((c,ci)=>['A','B','C','D','E','F'].map((x,i)=>row(x,c,100,(i+ci)%6===0?25:10)));
  const v=validate(scoreCohorts(rows));
  expect(v.ready).toBe(false);
  expect(v.reason).toMatch(/não antecipou/);
 });
 it('compara só dentro da coorte: coortes recentes com pouca evasão não viram "melhora"',()=>{
  // Todas as taxas caem com o tempo de exposição, mas A continua acima dos pares em cada coorte.
  const rows=cohorts.flatMap((c,ci)=>{const f=1-ci/9;return [row('A',c,100,Math.round(25*f)),...['B','C','D','E','F'].map((x,i)=>row(x,c,100,Math.max(1,Math.round((8+((i+ci)%5))*f))))];});
  const a=scoreCohorts(rows).filter(s=>s.codigo==='A');
  expect(a.every(s=>s.z>0)).toBe(true);
 });
 it('trancamento em massa não conta como evasão definitiva, mas é sinalizado à parte',()=>{
  const rows=persistent().map(r=>r.codigo==='B'&&r.semestre==='2025/02'?{...r,trancado:90,total_registros:190}:r);
  const b=courseAlerts(scoreCohorts(rows)).find(c=>c.codigo==='B')!;
  expect(b.level).not.toBe('alerta');
  expect(b.lockAtypical).toBe(true);
 });
 it('descarta cursos com menos de 10 registros e grupos com menos de 4 cursos',()=>{
  expect(scoreCohorts([row('A','2025/01',9,9),row('B','2025/01',100,10),row('C','2025/01',100,10),row('D','2025/01',100,10)])).toHaveLength(0);
  const v=evasionAlert([]).validation;
  expect(v.ready).toBe(false);expect(v.reason).toMatch(/Histórico insuficiente/);
 });
 it('modalidades diferentes não se misturam na comparação',()=>{
  const rows=cohorts.flatMap(c=>[...persistent().filter(r=>r.semestre===c),...['G','H','I','J'].map(x=>row(x,c,100,40,{modalidade:'EAD'}))]);
  const scored=scoreCohorts(rows);
  expect(scored.filter(s=>s.modalidade==='EAD').every(s=>Math.abs(s.z)<0.01)).toBe(true);
  expect(courseAlerts(scored).find(c=>c.codigo==='A')!.level).toBe('alerta');
 });
});
