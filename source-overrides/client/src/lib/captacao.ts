import { supabase } from './supabase';

// ---------- types ----------
export type Lead = {
  id: string;
  institution_id: string;
  origem: string;
  curso: string | null;
  etapa_funil: 'lead' | 'contato' | 'visita' | 'inscricao' | 'matricula';
  periodo: string | null;
  created_at: string;
};
export type CustoCaptacao = {
  id: string;
  institution_id: string;
  canal: string;
  periodo: string;
  investimento: number;
  matriculas_atribuidas: number;
};
export type CaptacaoSnapshot = {
  id: string;
  institution_id: string;
  mes: string;
  total_leads: number;
  total_matriculas: number;
  investimento_total: number;
};

// ---------- queries ----------
async function fetchAll<T>(table: string, institutionId: string, order = 'created_at'): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('institution_id', institutionId)
      .order(order, { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function fetchLeads(institutionId: string) {
  return fetchAll<Lead>('vertice_captacao_leads', institutionId);
}
export async function fetchCustos(institutionId: string) {
  return fetchAll<CustoCaptacao>('vertice_captacao_custos', institutionId);
}
export async function fetchSnapshots(institutionId: string) {
  return fetchAll<CaptacaoSnapshot>('vertice_captacao_snapshots', institutionId, 'mes');
}

export async function insertLead(lead: Omit<Lead, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('vertice_captacao_leads').insert(lead).select().single();
  if (error) throw error;
  return data as Lead;
}
export async function insertCusto(custo: Omit<CustoCaptacao, 'id'>) {
  const { data, error } = await supabase.from('vertice_captacao_custos').insert(custo).select().single();
  if (error) throw error;
  return data as CustoCaptacao;
}
export async function upsertSnapshot(snap: Omit<CaptacaoSnapshot, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('vertice_captacao_snapshots')
    .upsert(snap, { onConflict: 'institution_id,mes' })
    .select()
    .single();
  if (error) throw error;
  return data as CaptacaoSnapshot;
}

// ---------- aggregations ----------
export type FunnelStage = { stage: string; count: number };
export type OrigemData = { canal: string; leads: number };
export type EvolucaoMensal = { mes: string; leads: number; mat: number };
export type CustoCanal = { canal: string; investimento: number; cac: number };
export type CursoMatricula = { curso: string; mat: number };
export type ConversaoOrigem = { canal: string; rate: number; mat: number };

const FUNIL_LABELS: Record<string, string> = {
  lead: 'Lead captado',
  contato: 'Contato realizado',
  visita: 'Visita / evento',
  inscricao: 'Inscrição',
  matricula: 'Matrícula efetivada',
};
const FUNIL_ORDER = ['lead', 'contato', 'visita', 'inscricao', 'matricula'];

export function aggregateBI(leads: Lead[], custos: CustoCaptacao[], snapshots: CaptacaoSnapshot[]) {
  // KPIs
  const totalLeads = leads.length;
  const totalMat = leads.filter(l => l.etapa_funil === 'matricula').length;
  const totalInvest = custos.reduce((s, c) => s + Number(c.investimento), 0);
  const cac = totalMat > 0 ? totalInvest / totalMat : 0;

  // Funil
  const funnelMap = new Map<string, number>();
  for (const l of leads) funnelMap.set(l.etapa_funil, (funnelMap.get(l.etapa_funil) ?? 0) + 1);
  // Funil acumulado (cada etapa inclui os anteriores)
  let accumulated = 0;
  const funnel: FunnelStage[] = FUNIL_ORDER.map(stage => {
    accumulated += funnelMap.get(stage) ?? 0;
    return { stage: FUNIL_LABELS[stage] ?? stage, count: accumulated };
  }).reverse();

  // Leads por origem
  const origemMap = new Map<string, number>();
  for (const l of leads) origemMap.set(l.origem, (origemMap.get(l.origem) ?? 0) + 1);
  const origens: OrigemData[] = [...origemMap].map(([canal, leads]) => ({ canal, leads })).sort((a, b) => b.leads - a.leads);

  // Evolução mensal (dos snapshots)
  const evolucao: EvolucaoMensal[] = snapshots
    .map(s => ({ mes: s.mes, leads: s.total_leads, mat: s.total_matriculas }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Custo por canal
  const custoMap = new Map<string, { investimento: number; mat: number }>();
  for (const c of custos) {
    const prev = custoMap.get(c.canal) ?? { investimento: 0, mat: 0 };
    custoMap.set(c.canal, { investimento: prev.investimento + Number(c.investimento), mat: prev.mat + c.matriculas_atribuidas });
  }
  const custosCanal: CustoCanal[] = [...custoMap].map(([canal, v]) => ({
    canal,
    investimento: v.investimento,
    cac: v.mat > 0 ? v.investimento / v.mat : 0,
  })).sort((a, b) => b.investimento - a.investimento);

  // Matrículas por curso
  const cursoMap = new Map<string, number>();
  for (const l of leads.filter(l => l.etapa_funil === 'matricula' && l.curso)) {
    cursoMap.set(l.curso!, (cursoMap.get(l.curso!) ?? 0) + 1);
  }
  const cursos: CursoMatricula[] = [...cursoMap].map(([curso, mat]) => ({ curso, mat })).sort((a, b) => b.mat - a.mat);

  // Conversão por origem
  const convMap = new Map<string, { total: number; mat: number }>();
  for (const l of leads) {
    const prev = convMap.get(l.origem) ?? { total: 0, mat: 0 };
    convMap.set(l.origem, { total: prev.total + 1, mat: prev.mat + (l.etapa_funil === 'matricula' ? 1 : 0) });
  }
  const conversao: ConversaoOrigem[] = [...convMap].map(([canal, v]) => ({
    canal,
    rate: v.total > 0 ? (v.mat / v.total) * 100 : 0,
    mat: v.mat,
  })).sort((a, b) => b.rate - a.rate);

  return {
    kpis: { totalLeads, totalMat, totalInvest, cac },
    funnel,
    origens,
    evolucao,
    custosCanal,
    cursos,
    conversao,
  };
}

// ---------- demo seed ----------
export function getDemoData() {
  const leads: Lead[] = [];
  const origens = ['Google Ads', 'Instagram', 'Indicação', 'Feira presencial', 'Site orgânico', 'WhatsApp'];
  const cursosList = ['Direito', 'Administração', 'Enfermagem', 'Pedagogia', 'Eng. Civil', 'Psicologia'];
  const etapas: Lead['etapa_funil'][] = ['lead', 'contato', 'visita', 'inscricao', 'matricula'];
  const weights = [0.35, 0.25, 0.18, 0.12, 0.10];
  let idCounter = 0;

  for (let m = 1; m <= 12; m++) {
    const monthLeads = 40 + Math.floor(Math.random() * 30);
    for (let i = 0; i < monthLeads; i++) {
      const origemIdx = Math.floor(Math.random() * origens.length);
      const cursoIdx = Math.floor(Math.random() * cursosList.length);
      let etapaIdx = 0;
      const r = Math.random();
      let cum = 0;
      for (let e = 0; e < weights.length; e++) {
        cum += weights[e];
        if (r < cum) { etapaIdx = e; break; }
      }
      leads.push({
        id: `demo-${idCounter++}`,
        institution_id: 'demo',
        origem: origens[origemIdx],
        curso: cursosList[cursoIdx],
        etapa_funil: etapas[etapaIdx],
        periodo: `2026/${m < 7 ? 1 : 2}`,
        created_at: `2026-${String(m).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}T10:00:00Z`,
      });
    }
  }

  const custos: CustoCaptacao[] = origens.slice(0, 5).map((canal, i) => ({
    id: `demo-custo-${i}`,
    institution_id: 'demo',
    canal,
    periodo: '2026/1',
    investimento: [12000, 8500, 2000, 6500, 3200][i],
    matriculas_atribuidas: [18, 12, 8, 10, 6][i],
  }));

  const snapshots: CaptacaoSnapshot[] = Array.from({ length: 12 }, (_, i) => {
    const monthLeads = leads.filter(l => l.created_at.startsWith(`2026-${String(i + 1).padStart(2, '0')}`));
    return {
      id: `demo-snap-${i}`,
      institution_id: 'demo',
      mes: `2026-${String(i + 1).padStart(2, '0')}`,
      total_leads: monthLeads.length,
      total_matriculas: monthLeads.filter(l => l.etapa_funil === 'matricula').length,
      investimento_total: 2500 + Math.floor(Math.random() * 1500),
    };
  });

  return { leads, custos, snapshots };
}
