import {describe,expect,it} from 'vitest';
import {bottleneckMap,scoreOfferings,validateBottlenecks,bottlenecks,type OfferingRow} from '../client/src/lib/bottleneck';

const sems=['2022/01','2022/02','2023/01','2023/02','2024/01','2024/02','2025/01','2025/02'];
const off=(discipline:string,semester:string,n:number,fail:number,extra:Partial<OfferingRow>={}):OfferingRow=>({course_code:'013',discipline,semester,teachers:'Docente '+discipline,passed_direct:n-fail,passed_final:0,source_failures:fail,rf:0,rn:fail,ra:0,other_status:'',...extra});
const others=['B','C','D','E','F'];
// Disciplina A reprova 35% em todas as ofertas; as demais, entre 6% e 10%.
const persistent=()=>sems.flatMap((s,si)=>[off('A',s,60,21),...others.map((d,i)=>off(d,s,60,4+((i+si)%3)))]);

describe('mapa de disciplinas-gargalo',()=>{
 it('disciplina persistentemente acima dos pares do curso: mapa validado e gargalo no topo',()=>{
  const r=bottleneckMap(persistent());
  expect(r.validation.ready).toBe(true);
  expect(r.disciplines[0]).toMatchObject({discipline:'A',level:'persistente'});
  expect(r.disciplines[0].excess).toBeGreaterThan(50);
  expect(r.disciplines.filter(d=>d.level!=='normal').map(d=>d.discipline)).toEqual(['A']);
 });
 it('desvios que não se repetem na oferta seguinte: validação barra o mapa',()=>{
  const rows=sems.flatMap((s,si)=>['A',...others].map((d,i)=>off(d,s,60,(i+si)%6===0?21:5)));
  const v=validateBottlenecks(scoreOfferings(rows));
  expect(v.ready).toBe(false);
  expect(v.reason).toMatch(/não antecipou/);
 });
 it('ofertas ainda em curso ou com prova final pendente ficam fora',()=>{
  const rows=[...persistent(),off('A','2026/01',60,0,{other_status:'CR:40'}),...others.map(d=>off(d,'2026/01',60,5))];
  expect(scoreOfferings(rows).some(o=>o.discipline==='A'&&o.semester==='2026/01')).toBe(false);
 });
 it('turmas da mesma disciplina no semestre são somadas numa oferta',()=>{
  const rows=[off('A','2025/01',30,10,{teachers:'Ana'}),off('A','2025/01',30,11,{teachers:'Bia'}),...others.map(d=>off(d,'2025/01',60,5))];
  const a=scoreOfferings(rows).find(o=>o.discipline==='A')!;
  expect(a.n).toBe(60);expect(a.failures).toBe(21);expect(a.teachers).toBe('Ana / Bia');
 });
 it('descreve se o gargalo aparece com docentes diferentes ou com um só',()=>{
  const varios=persistent().map(r=>r.discipline==='A'?{...r,teachers:'Docente '+r.semester}:r);
  expect(bottlenecks(scoreOfferings(varios)).find(d=>d.discipline==='A')!.teacherPattern).toBe('varios_docentes');
  expect(bottlenecks(scoreOfferings(persistent())).find(d=>d.discipline==='A')!.teacherPattern).toBe('um_docente');
 });
 it('separa a reprovação por falta, que sinaliza abandono mais que dificuldade de conteúdo',()=>{
  const rows=persistent().map(r=>r.discipline==='A'?{...r,rf:14,rn:7}:r);
  expect(bottlenecks(scoreOfferings(rows)).find(d=>d.discipline==='A')!.absenceShare).toBeCloseTo(0.67,2);
 });
 it('cursos com menos de 5 ofertas no semestre e ofertas com menos de 10 resultados não são comparados',()=>{
  expect(scoreOfferings([off('A','2025/01',60,30),off('B','2025/01',60,3),off('C','2025/01',60,3),off('D','2025/01',60,3)])).toHaveLength(0);
  expect(scoreOfferings([off('A','2025/01',9,9),...others.map(d=>off(d,'2025/01',60,3))]).some(o=>o.discipline==='A')).toBe(false);
  expect(bottleneckMap([]).validation.reason).toMatch(/Histórico insuficiente/);
 });
});
