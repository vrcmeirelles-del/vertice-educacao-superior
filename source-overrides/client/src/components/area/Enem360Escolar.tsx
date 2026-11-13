import { IndicatorHelp } from "@/components/ContextHelp";
import { HelpLabel } from '@/components/ContextHelp';
/**
 * Enem360Escolar.tsx — ENEM 360° para Escolas
 * Histórico ENEM, simulados, competências, metas, evolução
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import LearningConnected from './LearningConnected';
import type {Role,Row} from '@/lib/area';

interface Props { institutionId: string; isMaster: boolean; courses: Row[]; role: Role|null; }

interface EnemEscola { year: number; media_geral: number|null; linguagens: number|null; humanas: number|null; natureza: number|null; matematica: number|null; redacao: number|null; participantes: number|null; ranking_estadual: number|null; ranking_nacional: number|null; }
interface Simulado { simulado_id: string; title: string; applied_date: string; area: string; turma: string|null; participantes: number; media: number|null; percentual_acima_600: number|null; percentual_acima_700: number|null; }
interface Competencia { simulado: string; applied_date: string; area: string; competencia_code: string; competencia_label: string; acerto_percentual: number; faixa: string; }
interface Config { id: string; academic_year: number; target_avg: number|null; target_redacao: number|null; target_approval_rate: number|null; }

const AREA_LABELS: Record<string,string> = { linguagens:'Linguagens', humanas:'Humanas', natureza:'Natureza', matematica:'Matemática', redacao:'Redação', geral:'Geral' };
const AREA_COLORS: Record<string,string> = { linguagens:'#2563eb', humanas:'#7c3aed', natureza:'#16a34a', matematica:'#ea580c', redacao:'#dc2626', geral:'#333' };
const FAIXA_COLORS: Record<string,string> = { critico:'#dc2626', baixo:'#ea580c', medio:'#ca8a04', alto:'#16a34a' };

function fmt(n: number|null): string { return n !== null && n !== undefined ? n.toFixed(1) : '—'; }

export default function Enem360Escolar({ institutionId, isMaster, courses, role }: Props) {
  const [view, setView] = useState<'painel'|'historico'|'simulados'|'competencias'|'metas'>('painel');
  const [evolucao, setEvolucao] = useState<EnemEscola[]>([]);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [config, setConfig] = useState<Config|null>(null);
  const [loading, setLoading] = useState(false);

  // Form metas
  const [metaAvg, setMetaAvg] = useState('');
  const [metaRed, setMetaRed] = useState('');
  const [metaAprov, setMetaAprov] = useState('');
  const currentYear = new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    const [evRes, simRes, compRes, cfgRes] = await Promise.all([
      supabase.from('v_enem_evolucao').select('*').eq('institution_id', institutionId).order('year'),
      supabase.from('v_enem_simulados_evolucao').select('*').eq('institution_id', institutionId).order('applied_date'),
      supabase.from('v_enem_competencias_heatmap').select('*').eq('institution_id', institutionId),
      supabase.from('vertice_enem_config').select('*').eq('institution_id', institutionId).eq('academic_year', currentYear).maybeSingle(),
    ]);
    if (evRes.data) setEvolucao(evRes.data);
    if (simRes.data) setSimulados(simRes.data);
    if (compRes.data) setCompetencias(compRes.data);
    if (cfgRes.data) { setConfig(cfgRes.data); setMetaAvg(String(cfgRes.data.target_avg??'')); setMetaRed(String(cfgRes.data.target_redacao??'')); setMetaAprov(String(cfgRes.data.target_approval_rate??'')); }
    setLoading(false);
  }, [institutionId, currentYear]);

  useEffect(() => { load(); }, [load]);

  const saveMetas = async () => {
    const data = { institution_id: institutionId, academic_year: currentYear, target_avg: metaAvg ? Number(metaAvg) : null, target_redacao: metaRed ? Number(metaRed) : null, target_approval_rate: metaAprov ? Number(metaAprov) : null, active: true };
    if (config?.id) { await supabase.from('vertice_enem_config').update(data).eq('id', config.id); }
    else { await supabase.from('vertice_enem_config').insert(data); }
    load();
  };

  const latest = evolucao.length > 0 ? evolucao[evolucao.length - 1] : null;
  const prev = evolucao.length > 1 ? evolucao[evolucao.length - 2] : null;
  const delta = (curr: number|null, old: number|null) => {
    if (curr === null || old === null) return null;
    const d = curr - old;
    return d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1);
  };

  // Agrupar simulados por data
  const simByDate = simulados.reduce((acc, s) => {
    const key = `${s.simulado_id}`;
    if (!acc[key]) acc[key] = { title: s.title, date: s.applied_date, areas: [] };
    acc[key].areas.push(s);
    return acc;
  }, {} as Record<string, { title: string; date: string; areas: Simulado[] }>);

  // Competências do último simulado
  const lastSimComp = competencias.length > 0
    ? competencias.filter(c => c.applied_date === competencias[competencias.length-1]?.applied_date)
    : [];

  const nav = [
    { key: 'painel', label: '📊 Painel' },
    { key: 'historico', label: '📈 Histórico ENEM' },
    { key: 'simulados', label: '📝 Simulados' },
    { key: 'competencias', label: '🎯 Competências' },
    { key: 'metas', label: '🏆 Metas' },
  ];

  const kpiStyle = (color: string): React.CSSProperties => ({
    background: 'var(--bg-card,#fff)', borderRadius: 8, padding: '16px 12px',
    borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  });

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <LearningConnected key={institutionId} institutionId={institutionId} courses={courses} role={role} schoolMode />
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {nav.map(n => (
          <button key={n.key} onClick={() => setView(n.key as any)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: view === n.key ? '#2563eb' : '#f3f4f6',
            color: view === n.key ? '#fff' : '#333',
          }}>{n.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Carregando...</div> : <>

      {/* PAINEL */}
      {view === 'painel' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Média Geral', value: fmt(latest?.media_geral??null), color: '#333', sub: delta(latest?.media_geral??null, prev?.media_geral??null) },
              { label: 'Linguagens', value: fmt(latest?.linguagens??null), color: AREA_COLORS.linguagens, sub: delta(latest?.linguagens??null, prev?.linguagens??null) },
              { label: 'Humanas', value: fmt(latest?.humanas??null), color: AREA_COLORS.humanas, sub: delta(latest?.humanas??null, prev?.humanas??null) },
              { label: 'Natureza', value: fmt(latest?.natureza??null), color: AREA_COLORS.natureza, sub: delta(latest?.natureza??null, prev?.natureza??null) },
              { label: 'Matemática', value: fmt(latest?.matematica??null), color: AREA_COLORS.matematica, sub: delta(latest?.matematica??null, prev?.matematica??null) },
              { label: 'Redação', value: fmt(latest?.redacao??null), color: AREA_COLORS.redacao, sub: delta(latest?.redacao??null, prev?.redacao??null) },
              { label: 'Ranking Estadual', value: latest?.ranking_estadual ? `#${latest.ranking_estadual}` : '—', color: '#7c3aed', sub: null },
              { label: 'Simulados', value: String(Object.keys(simByDate).length), color: '#16a34a', sub: null },
            ].map(k => (
              <div key={k.label} style={kpiStyle(k.color)}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}<IndicatorHelp title={k.label}/></div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
                {k.sub && <div style={{ fontSize: 11, color: Number(k.sub) >= 0 ? '#16a34a' : '#dc2626' }}>{k.sub} vs ano anterior</div>}
              </div>
            ))}
          </div>

          {config && (
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Metas {currentYear}</div>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                <div><span style={{ fontSize: 11, color: '#999' }}>Média alvo</span><div style={{ fontSize: 18, fontWeight: 700 }}>{config.target_avg ?? '—'}</div></div>
                <div><span style={{ fontSize: 11, color: '#999' }}>Redação alvo</span><div style={{ fontSize: 18, fontWeight: 700 }}>{config.target_redacao ?? '—'}</div></div>
                <div><span style={{ fontSize: 11, color: '#999' }}>Taxa aprovação</span><div style={{ fontSize: 18, fontWeight: 700 }}>{config.target_approval_rate ? `${config.target_approval_rate}%` : '—'}</div></div>
              </div>
            </div>
          )}

          {lastSimComp.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>Competências críticas (último simulado)</h4>
              {lastSimComp.filter(c => c.faixa === 'critico' || c.faixa === 'baixo').slice(0, 5).map(c => (
                <div key={c.competencia_code} style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 4,
                  borderLeft: `4px solid ${FAIXA_COLORS[c.faixa]}`,
                  background: 'var(--bg-card,#fff)', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 600 }}>{AREA_LABELS[c.area]}</span> · {c.competencia_label}
                  <span style={{ float: 'right', fontWeight: 700, color: FAIXA_COLORS[c.faixa] }}>{c.acerto_percentual.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}

          {evolucao.length === 0 && simulados.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              Nenhum dado ENEM cadastrado ainda. Comece inserindo o histórico ou aplicando um simulado.
            </div>
          )}
        </div>
      )}

      {/* HISTÓRICO */}
      {view === 'historico' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Histórico ENEM da Escola</h3>
          {evolucao.length === 0 ? (
            <p style={{ color: '#999' }}>Nenhum resultado ENEM cadastrado. Insira os dados históricos para acompanhar a evolução.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>ANO</th>
                  {['linguagens','humanas','natureza','matematica','redacao','geral'].map(a => (
                    <th key={a} style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: AREA_COLORS[a] }}>{AREA_LABELS[a]}</th>
                  ))}
                  <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>PARTIC.</th>
                  <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>RANK EST.</th>
                </tr>
              </thead>
              <tbody>
                {evolucao.map(e => (
                  <tr key={e.year} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{e.year}</td>
                    <td style={{ padding: '8px 6px', color: AREA_COLORS.linguagens }}>{fmt(e.linguagens)}</td>
                    <td style={{ padding: '8px 6px', color: AREA_COLORS.humanas }}>{fmt(e.humanas)}</td>
                    <td style={{ padding: '8px 6px', color: AREA_COLORS.natureza }}>{fmt(e.natureza)}</td>
                    <td style={{ padding: '8px 6px', color: AREA_COLORS.matematica }}>{fmt(e.matematica)}</td>
                    <td style={{ padding: '8px 6px', color: AREA_COLORS.redacao }}>{fmt(e.redacao)}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{fmt(e.media_geral)}</td>
                    <td style={{ padding: '8px 6px' }}>{e.participantes ?? '—'}</td>
                    <td style={{ padding: '8px 6px' }}>{e.ranking_estadual ? `#${e.ranking_estadual}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SIMULADOS */}
      {view === 'simulados' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Simulados Aplicados ({Object.keys(simByDate).length})</h3>
          {Object.entries(simByDate).map(([key, sim]) => (
            <div key={key} style={{ background: 'var(--bg-card,#fff)', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><strong>{sim.title}</strong></div>
                <div style={{ fontSize: 12, color: '#999' }}>{new Date(sim.date).toLocaleDateString('pt-BR')}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {sim.areas.filter(a => a.area !== 'geral').map(a => (
                  <div key={a.area} style={{ padding: '8px', borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: AREA_COLORS[a.area], fontWeight: 600, textTransform: 'uppercase' }}>{AREA_LABELS[a.area]}</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(a.media)}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{a.participantes} alunos</div>
                    {a.percentual_acima_600 !== null && <div style={{ fontSize: 10, color: '#16a34a' }}>{a.percentual_acima_600?.toFixed(0)}% acima de 600</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(simByDate).length === 0 && <p style={{ color: '#999' }}>Nenhum simulado aplicado ainda.</p>}
        </div>
      )}

      {/* COMPETÊNCIAS */}
      {view === 'competencias' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Mapa de Competências</h3>
          {competencias.length === 0 ? (
            <p style={{ color: '#999' }}>Aplique um simulado com questões classificadas por competência para gerar o mapa.</p>
          ) : (
            ['linguagens','humanas','natureza','matematica'].map(area => {
              const items = lastSimComp.filter(c => c.area === area).sort((a,b) => a.acerto_percentual - b.acerto_percentual);
              if (!items.length) return null;
              return (
                <div key={area} style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 6px', color: AREA_COLORS[area], fontSize: 13 }}>{AREA_LABELS[area]}</h4>
                  {items.map(c => (
                    <div key={c.competencia_code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ width: 50, fontSize: 11, fontWeight: 700, color: FAIXA_COLORS[c.faixa], textAlign: 'right' }}>{c.acerto_percentual.toFixed(0)}%</div>
                      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ width: `${c.acerto_percentual}%`, height: '100%', background: FAIXA_COLORS[c.faixa], borderRadius: 4, transition: 'width .3s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#666', minWidth: 200 }}>{c.competencia_label}</div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* METAS */}
      {view === 'metas' && (
        <div>
          <h3 style={{ margin: '0 0 16px' }}>Metas ENEM {currentYear}</h3>
          <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            <div>
              <HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Média geral alvo</HelpLabel>
              <input type="number" step="0.1" value={metaAvg} onChange={e => setMetaAvg(e.target.value)} placeholder="Ex: 580" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
            <div>
              <HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Redação alvo</HelpLabel>
              <input type="number" step="0.1" value={metaRed} onChange={e => setMetaRed(e.target.value)} placeholder="Ex: 650" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
            <div>
              <HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Taxa de aprovação em vestibular (%)</HelpLabel>
              <input type="number" step="0.1" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} placeholder="Ex: 75" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
            <button onClick={saveMetas} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {config ? 'Atualizar metas' : 'Definir metas'}
            </button>
          </div>
        </div>
      )}

      </>}
    </div>
  );
}
