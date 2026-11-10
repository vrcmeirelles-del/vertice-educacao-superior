import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
const fixtures = vi.hoisted(() => ({
  semesters: vi.fn(), quant: vi.fn(), compliance: vi.fn(), cohorts: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => {
  const query: Record<string, unknown> = {};
  for (const key of ['select','eq','order']) query[key] = () => query;
  query.limit = async () => ({ data: [], error: null }); return query;
} } }));
vi.mock('@/lib/bi/queries', () => ({
  getKPIs: async () => [], getSerieTemporal: async () => null, getFunil: async () => [], getComposicaoPorCurso: async () => [],
  getCursosRisco: async () => [{ id:'course-a', nome:'Direito', grau:'bacharelado', ocupacaoPct:null, tendencia:'estavel', sinal:'atencao' }],
  getAlertas: async () => [{ severidade:'atencao', descricao:'Documento pendente' }],
  getSaudePeriodo: async () => [{ rotulo:'Saúde da fonte', sinal:'atencao', valor:'Cobertura parcial' }],
  getHeatmap: async () => [{ linha:'Direito', coluna:'2026/1', valor:0 },{ linha:'Pedagogia', coluna:'2026/2', valor:9 }],
}));
vi.mock('@/lib/eorbit/queries', () => ({
  getSemestres: fixtures.semesters, getResumoQuantitativo: fixtures.quant, getResumoCompliance: fixtures.compliance,
  getProfessores: async () => [],
  getEnade: async () => [{ id:1, semestre:'2026/2',curso_id:2,curso_nome:'Direito ENADE',habilitados:23,instituicao_id:'ies-a' }],
  getBibliotecaResumo: async () => ({ total_titulos:12345,total_exemplares:67890 }),
  getVestibularEditais: async () => [{ id:1,codigo:'V1',descricao:'Vestibular sintético',data_inicio:'2026-11-10',data_fim:null,situacao:'Aberto',instituicao_id:'ies-a' }],
  getVestibularCursos: async () => [{ id:1,edital_id:1,curso_nome:'Direito vestibular',turno:'Noturno',vagas:40,inscritos:null,aprovados:null,matriculados:null,instituicao_id:'ies-a' }],
}));
vi.mock('@/lib/academico', () => ({
  fetchCourseNames: async () => new Map(), fetchReports: async () => [], parseCohorts: fixtures.cohorts,
  resumirEvasao: () => ({ taxaEvasao:20,taxaRenovacao:80 }),
  parseProfReprova: () => [{ ranking:1,nome:'Professora sintética',total:9 }],
  parseDiscReprova: () => [], parseFluxo: () => [], parseCourseIndicators: () => [],
  agregarReprovaTipo: () => ({ porSemestre:[],totalRf:0,totalRn:0,totalRa:0 }),
}));
vi.mock('@/lib/area', () => ({TABLES:{ goals:'goals', actions:'actions', diagnosis:'diagnosis' },listByInstitution:async()=>[]}));
vi.mock('@/lib/repository-data', () => ({ listRepository: async () => [] }));
import ReitorBI from './ReitorBI';
let container: HTMLDivElement, root: Root;
const props = { institutions:[{id:'ies-a',name:'IES sintética A'},{id:'ies-b',name:'IES sintética B'}],courses:[],enrollments:[],session:{} as Session,reports:[] };
async function show() { await act(async () => root.render(createElement(ReitorBI,props))); }
async function tab(name:string) {
  const button=[...container.querySelectorAll<HTMLButtonElement>('.rbi-tabs button')].find(element=>element.textContent?.includes(name));
  expect(button).toBeDefined(); await act(async()=>button!.click());
}
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  fixtures.semesters.mockResolvedValue([{id:1,codigo:'2026/2',descricao:'Atual',instituicao_id:'ies-a'}]);
  fixtures.quant.mockResolvedValue([{semestre:'2026/2',semestreId:1,totalMatriculados:120,totalVinculos:130,preMatriculado:0,trancado:0,abandono:0,concluido:0,transferido:0,cancelado:0}]);
  fixtures.compliance.mockResolvedValue([
    {tipo:'plano',semestre:'2026/2',semestreId:1,totalDisciplinas:100,conformes:75,naoConformes:25,percentual:75},
    {tipo:'notas',semestre:'2026/1',semestreId:2,totalDisciplinas:100,conformes:100,naoConformes:0,percentual:100},
  ]);
  fixtures.cohorts.mockReturnValue({coortes:[{cohort:'2025/1',noNext:2,nextLink:8},{cohort:'2026/2',noNext:0,nextLink:0}]});
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
describe('Reitoria: renderização dos contratos efetivos',()=>{
  it('carrega o catálogo de semestres e exibe contagens, nome docente e saúde fornecidos pelas consultas',async()=>{
    await show();await tab('Acadêmico');
    expect(fixtures.quant.mock.calls[0][1]).toEqual([{id:1,codigo:'2026/2',descricao:'Atual',instituicao_id:'ies-a'}]);
    expect(container.textContent).toContain('Vínculos130');expect(container.textContent).toContain('Matriculados120');
    expect(container.textContent).toContain('Professora sintética');expect(container.textContent).toContain('Saúde da fonte');
    expect(container.querySelector('.rbi-health-atencao')?.textContent).toContain('Cobertura parcial');
    expect(container.textContent).toContain('Turmas de ingresso apuradas1');expect(container.textContent).not.toContain('NaN');
  });
  it('mantém plano e notas no mesmo semestre e identifica curso/período ENADE',async()=>{
    await show();await tab('Compliance');
    const card=[...container.querySelectorAll('article')].find(node=>node.querySelector('h3')?.textContent==='Resumo de Compliance')!;
    expect(card.textContent).toContain('2026/2');expect(card.textContent).toContain('75');expect(card.textContent).not.toContain('100');
    expect(card.querySelectorAll('.rbi-kpi-value')[1].textContent).toBe('—');
    expect(container.textContent).toContain('Direito ENADE');expect(container.textContent).toContain('23');
  });
  it('usa títulos e exemplares do resumo da biblioteca',async()=>{
    await show();await tab('Infraestrutura');expect(container.textContent).toContain('12.345');expect(container.textContent).toContain('67.890');
  });
  it('usa data/situação do edital e nome do curso de vestibular',async()=>{
    await show();await tab('Captação');expect(container.textContent).toContain('10/11/2026');expect(container.textContent).toContain('Aberto');expect(container.textContent).toContain('Direito vestibular');
  });
  it('renderiza ocupação desconhecida e a descrição do alerta sem fabricar vagas',async()=>{
    await show();expect(container.textContent).toContain('Documento pendente');expect(container.textContent).toContain('Não informada');expect(container.textContent).not.toContain('NaN');
  });
  it('distingue célula zero de célula sem fonte no mapa de calor',async()=>{
    await show();await tab('Financeiro');
    const rows=[...container.querySelectorAll('.rbi-heatmap tbody tr')];
    expect(rows[0].textContent).toBe('Direito0—');expect(rows[1].textContent).toBe('Pedagogia—9');
    expect(container.querySelector('.rbi-heatmap thead')?.textContent).toBe('2026/12026/2');
  });
  it('não trata ID de período desconhecido como resumo corrente',async()=>{
    fixtures.quant.mockResolvedValue([{semestre:'sem_999',totalMatriculados:999,totalVinculos:1000}]);
    await show();await tab('Acadêmico');expect(container.textContent).toContain('Sem dados do e-Orbit');expect(container.textContent).not.toContain('Matriculados999');
  });
  it('limpa o resumo de evasão quando a próxima instituição não possui coortes',async()=>{
    await show();await tab('Acadêmico');expect(container.textContent).toContain('Turmas de ingresso apuradas1');
    fixtures.cohorts.mockReturnValue(null);
    await act(async()=>{const select=container.querySelector('select')!;select.value='ies-b';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(container.textContent).toContain('Sem dados das turmas de ingresso');expect(container.textContent).not.toContain('Turmas de ingresso apuradas1');
  });
});
