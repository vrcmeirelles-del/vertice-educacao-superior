import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('supabase/functions/vertice-sapiens-briefing/index.ts','utf8').replace(/^import .*\n/m,'');
const code=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
const exportsObj:any={};
vm.runInNewContext(code,{exports:exportsObj,module:{exports:exportsObj},Deno:{env:{get:()=>undefined},serve:()=>{}},createClient:()=>({}),fetch:()=>{throw new Error('sem rede');},globalThis:{fetch:()=>{}},Response,URL,Date,JSON,String,Number,Array,Object,Math,Promise,console});
const {buildBriefing}=exportsObj;
const base={institution:'Faculdade Exemplo',briefingType:'morning',diagnoses:[],interventions:[],findings:[],goals:[],actions:[],
 counters:{activeRisks:0,offTrackGoals:0,pendingActions:0,pendingApprovals:0,inProgress:0},now:new Date('2026-11-20T12:00:00Z')};
describe('briefing do Sapiens por algoritmo',()=>{
 it('sem pendências: seção de situação e resumo com os contadores',()=>{
  const b=buildBriefing(base);
  expect(b.sections.map((s:any)=>s.title)).toEqual(['Situação']);
  expect(b.summary).toContain('Briefing matinal — Faculdade Exemplo');
  expect(b.summary).toContain('0 riscos críticos ou altos ativos');
 });
 it('ordena riscos, metas, aprovações e ações atrasadas, com prioridade no resumo',()=>{
  const b=buildBriefing({...base,
   findings:[{finding_ref:'A-2',risk_level:'high',recommendation:'Revisar PPC',due_date:'2026-12-01',resolution_status:'open'},{finding_ref:'A-1',risk_level:'critical',recommendation:'Atualizar NDE',due_date:'2026-11-25',resolution_status:'in_progress'}],
   goals:[{title:'Aprovação OAB 30%',trajectory:'off_track',current_value:18,target_value:30,due_at:'2026-12-31'}],
   interventions:[{title:'Reforço de Constitucional',status:'proposed',module:'oab'}],
   actions:[{what:'Simulado integrado',status:'pending',planned_date:'2026-11-10'},{what:'Contratar monitor',status:'blocked',planned_date:null}],
   counters:{activeRisks:2,offTrackGoals:1,pendingActions:1,pendingApprovals:1,inProgress:0}});
  expect(b.sections.map((s:any)=>s.title)).toEqual(['Riscos críticos e altos','Metas fora da trajetória','Intervenções aguardando aprovação','Ações 5W2H atrasadas ou bloqueadas']);
  expect(b.sections[0].severity).toBe('critical');
  expect(b.sections[0].items[0].text).toMatch(/^A-1: Atualizar NDE/);
  expect(b.sections[3].items.map((i:any)=>i.text)).toEqual(['Bloqueada: Contratar monitor','Atrasada desde 10/11/2026: Simulado integrado']);
  expect(b.summary).toContain('Prioridade: riscos críticos e altos — A-1: Atualizar NDE');
 });
 it('auditoria semanal traz o balanço',()=>{
  const b=buildBriefing({...base,briefingType:'weekly_audit'});
  expect(b.sections.map((s:any)=>s.title)).toContain('Balanço da semana');
  expect(b.summary).toContain('Auditoria semanal');
 });
 it('o código não chama mais OpenAI nem Anthropic',()=>{
  const withoutGuard=source.replace(/\{const __aiFetch[\s\S]*?as typeof fetch;\}/,'');
  expect(withoutGuard).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
 });
});
