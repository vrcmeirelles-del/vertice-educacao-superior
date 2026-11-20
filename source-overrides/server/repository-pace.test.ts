import {describe,expect,it} from 'vitest';
import {repositoryPace,type PaceRequest,type PaceFile} from '../client/src/lib/repository-pace';

const today=new Date('2026-11-20T12:00:00Z');
const reqs=(n:number,due:string|null,course='c1',prefix='r'):PaceRequest[]=>Array.from({length:n},(_,i)=>({id:`${prefix}${due}-${course}-${i}`,course_id:course,due_date:due,active:true,not_applicable:false}));
const sent=(r:PaceRequest[],date:string,status='enviado'):PaceFile[]=>r.map(x=>({request_id:x.id,created_at:date,status}));

describe('ritmo de entregas do Repositório',()=>{
 it('importação em lote de pedidos sem prazo não conta como ritmo: prazo próximo sem entregas é crítico',()=>{
  const lote=reqs(545,null),prazo=reqs(252,'2026-12-15');
  const r=repositoryPace([...lote,...prazo],sent(lote,'2026-10-31T10:00:00Z'),today);
  expect(r.undated).toBe(545);
  expect(r.observedPerWeek).toBe(0);
  expect(r.deadlines[0]).toMatchObject({due:'2026-12-15',pending:252,daysLeft:25,status:'critico',projectedDate:null});
  expect(r.deadlines[0].requiredPerWeek).toBeCloseTo(70.6,1);
 });
 it('ritmo observado igual ou acima do necessário: no ritmo, com data projetada antes do prazo',()=>{
  const prazo=reqs(40,'2026-12-15');
  const r=repositoryPace(prazo,sent(prazo.slice(0,28),'2026-11-10T10:00:00Z'),today);
  const d=r.deadlines[0];
  expect(d.observedPerWeek).toBeCloseTo(7,5);
  expect(d.status).toBe('no_ritmo');
  expect(d.projectedDate!<'2026-12-15').toBe(true);
 });
 it('entre metade e o ritmo necessário: em risco; prazo vencido com pendência: vencido; tudo entregue: concluído',()=>{
  const a=reqs(40,'2026-12-15','c1','a');
  expect(repositoryPace(a,sent(a.slice(0,20),'2026-11-10T10:00:00Z'),today).deadlines[0].status).toBe('em_risco');
  const b=reqs(3,'2026-11-01','c1','b');
  expect(repositoryPace(b,[],today).deadlines[0].status).toBe('vencido');
  const c=reqs(3,'2026-12-15','c1','c');
  expect(repositoryPace(c,sent(c,'2026-11-01T10:00:00Z'),today).deadlines[0].status).toBe('concluido');
 });
 it('documento devolvido não conta como entrega; inativo e "não se aplica" ficam fora',()=>{
  const p=reqs(2,'2026-12-15');
  const r=repositoryPace([...p,{id:'x',due_date:'2026-12-15',active:false},{id:'y',due_date:'2026-12-15',not_applicable:true}],sent(p,'2026-11-15T10:00:00Z','devolvido'),today);
  expect(r.deadlines[0]).toMatchObject({total:2,delivered:0,pending:2});
 });
 it('detalha por curso dentro de cada prazo, do mais grave para o menos grave',()=>{
  const c1=reqs(30,'2026-12-15','c1'),c2=reqs(30,'2026-12-15','c2');
  const r=repositoryPace([...c1,...c2],sent(c2.slice(0,28),'2026-11-12T10:00:00Z'),today);
  expect(r.courses.map(c=>[c.courseId,c.status])).toEqual([['c1','critico'],['c2','no_ritmo']]);
 });
});
