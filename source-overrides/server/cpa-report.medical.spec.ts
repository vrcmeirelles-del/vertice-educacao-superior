import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const dir='supabase/functions/vertice-cpa-report/';
const code=ts.transpile(readFileSync(dir+'report.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
const exportsObj:any={};
vm.runInNewContext(code,{exports:exportsObj,module:{exports:exportsObj},Math,Number,String,Array,Object,JSON,Set,Map});
const {buildCpaSections,SECTIONS}=exportsObj;
const data={inst:{name:'Faculdade Exemplo',acronym:'FEX',emec_code:'1234',city:'Niterói',state:'RJ'},reportType:'parcial',yearBase:'2026',
 members:[{full_name:'Ana Souza',role:'Coordenadora',segment:'Docentes',appointment_ref:'Portaria 12/2026',start_date:'2026-02-01'},{full_name:'Bruno Lima',role:'Membro',segment:'Discentes'}],
 campaigns:[{title:'Avaliação discente 2026.2',target_audience:'discentes',opens_at:'2026-10-01',closes_at:'2026-10-31',status:'encerrada',channels:['email','portal']}],
 results:[{campaign_title:'Avaliação discente 2026.2',target_audience:'discentes',total_responses:212,institutional_avg:3.84,top2_pct:68.4,
  by_axis:[{axis:'Eixo 3',avg_score:3.9},{axis:'Eixo 5',avg_score:3.2}],
  by_dimension:[{dimension:'Infraestrutura',avg_score:3.1},{dimension:'Ensino',avg_score:4.2},{dimension:'Comunicação',avg_score:3.5}],
  questions:[{stable_code:'D01',question_text:'Biblioteca',avg_score:3.0},{stable_code:'D02',question_text:'Didática',avg_score:4.4},{stable_code:'D03',question_text:'Wi-Fi',avg_score:2.6},{stable_code:'D04',question_text:'Coordenação',avg_score:4.1}]}],
 findings:[{finding_type:'fragilidade',title:'Rede sem fio instável',dimension:'Infraestrutura'},{finding_type:'potencialidade',title:'Corpo docente bem avaliado',dimension:'Ensino'}],
 actions:[{title:'Ampliar pontos de Wi-Fi',status:'em_execucao',responsible:'TI',due_date:'2026-12-15'}]};
describe('relatório da CPA por modelo de texto',()=>{
 it('gera as 12 seções na ordem, com dados reais e marcação de origem',()=>{
  const g=buildCpaSections(data);
  expect(Object.keys(g)).toEqual([...SECTIONS]);
  expect(g.dados_ies.content).toContain('Instituição: Faculdade Exemplo (FEX)');
  expect(g.dados_ies.content).toContain('CNPJ: Não informado no cadastro.');
  expect(g.composicao_cpa.content).toContain('• Ana Souza — Coordenadora (ato: Portaria 12/2026), mandato desde 01/02/2026');
  expect(g.resultados.content).toContain('212 resposta(s); média geral 3,84; 68,4% das respostas nas categorias 4 e 5.');
  expect(g.resultados.content).toMatch(/Itens com menor média:\n• D03 — Wi-Fi: 2,60/);
  expect(g.planos_melhoria.content).toContain('• Ampliar pontos de Wi-Fi — em execução; responsável: TI; prazo: 15/12/2026.');
  expect(g.diagnostico.content).toMatch(/Fragilidades:\n• Rede sem fio instável \(dimensão: Infraestrutura\)/);
  expect(g.diagnostico.ai_notes).toMatch(/Roteiro/);
  expect(g.resultados.ai_notes).toMatch(/dados do sistema/);
 });
 it('sem dados, declara a ausência em vez de inventar',()=>{
  const g=buildCpaSections({...data,members:[],campaigns:[],results:[],findings:[],actions:[]});
  expect(g.composicao_cpa.content).toMatch(/Não há membros ativos/);
  expect(g.resultados.content).toMatch(/Não há resultados/);
  expect(g.avaliacoes_externas.content).toMatch(/Não há resultados de avaliações externas/);
 });
 it('regera só a seção pedida',()=>{
  expect(Object.keys(buildCpaSections(data,['participacao']))).toEqual(['participacao']);
 });
 it('a função só usa IA nas seções analíticas e com a IA religada; corrige a coluna emec_code',()=>{
  const index=readFileSync(dir+'index.ts','utf8');
  expect(index).not.toContain('code_emec');
  expect(index).toContain("AI_SUSPENDED') ?? 'true').toLowerCase() === 'false'");
  expect(index).not.toMatch(/ai_not_configured|ai_unavailable/);
 });
});
