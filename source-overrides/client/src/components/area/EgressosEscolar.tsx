import { HelpLabel } from '@/components/ContextHelp';
/**
 * EgressosEscolar.tsx — Egressos 360° para Escolas
 * Destino pós-escola, aprovações em vestibular, pesquisas, vitrine
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { institutionId: string; isMaster: boolean; }

interface AlumniResumo { graduation_year: number; formados: number; aprovados_vestibular: number; taxa_aprovacao_pct: number; para_publica: number; para_privada: number; para_tecnico: number; para_mercado: number; para_exterior: number; pesquisas: number; satisfacao_media: number|null; }
interface TopDestino { university_name: string; university_type: string; total_aprovados: number; cursos: string[]; anos_presenca: number; }
interface Survey { question_code: string; question_text: string; avg_score: number|null; response_count: number; }

const TYPE_LABELS: Record<string,string> = { publica_federal:'Federal', publica_estadual:'Estadual', publica_municipal:'Municipal', privada:'Privada', tecnico:'Técnico', militar:'Militar' };
const TYPE_COLORS: Record<string,string> = { publica_federal:'#2563eb', publica_estadual:'#7c3aed', publica_municipal:'#0891b2', privada:'#ea580c', tecnico:'#16a34a', militar:'#4b5563' };

export default function EgressosEscolar({ institutionId, isMaster }: Props) {
  const [view, setView] = useState<'painel'|'destinos'|'aprovacoes'|'pesquisa'|'inserir'>('painel');
  const [resumo, setResumo] = useState<AlumniResumo[]>([]);
  const [destinos, setDestinos] = useState<TopDestino[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);

  // Form inserir
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [formTurma, setFormTurma] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formPublica, setFormPublica] = useState('');
  const [formPrivada, setFormPrivada] = useState('');
  const [formTecnico, setFormTecnico] = useState('');
  const [formMercado, setFormMercado] = useState('');
  const [formExterior, setFormExterior] = useState('');
  const [formAprovados, setFormAprovados] = useState('');
  const [formSisu, setFormSisu] = useState('');
  const [formProuni, setFormProuni] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [resRes, destRes, survRes] = await Promise.all([
      supabase.from('v_school_alumni_resumo').select('*').eq('institution_id', institutionId).order('graduation_year', { ascending: false }),
      supabase.from('v_school_alumni_top_destinos').select('*').eq('institution_id', institutionId).limit(20),
      supabase.from('vertice_school_alumni_survey').select('*').eq('institution_id', institutionId).order('survey_date', { ascending: false }).limit(20),
    ]);
    if (resRes.data) setResumo(resRes.data);
    if (destRes.data) setDestinos(destRes.data);
    if (survRes.data) setSurveys(survRes.data);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const handleInsert = async () => {
    if (!formYear || !formTotal) return;
    setSaving(true);
    const aprovados = Number(formAprovados) || 0;
    await supabase.from('vertice_school_alumni').upsert({
      institution_id: institutionId,
      graduation_year: Number(formYear),
      turma: formTurma || null,
      total_formados: Number(formTotal),
      dest_universidade_publica: Number(formPublica) || 0,
      dest_universidade_privada: Number(formPrivada) || 0,
      dest_tecnico: Number(formTecnico) || 0,
      dest_mercado_trabalho: Number(formMercado) || 0,
      dest_exterior: Number(formExterior) || 0,
      aprovados_vestibular: aprovados,
      aprovados_enem_sisu: Number(formSisu) || 0,
      aprovados_prouni: Number(formProuni) || 0,
    }, { onConflict: 'institution_id,graduation_year,turma' });
    setSaving(false);
    setView('painel');
    load();
  };

  const totais = resumo.reduce((acc, r) => ({
    formados: acc.formados + r.formados,
    aprovados: acc.aprovados + r.aprovados_vestibular,
    publica: acc.publica + r.para_publica,
    privada: acc.privada + r.para_privada,
    tecnico: acc.tecnico + r.para_tecnico,
  }), { formados: 0, aprovados: 0, publica: 0, privada: 0, tecnico: 0 });

  const taxaGeral = totais.formados > 0 ? (totais.aprovados / totais.formados * 100).toFixed(1) : '—';

  const nav = [
    { key: 'painel', label: '📊 Painel' },
    { key: 'destinos', label: '🏛️ Destinos' },
    { key: 'aprovacoes', label: '🎓 Por ano' },
    { key: 'pesquisa', label: '📋 Pesquisas' },
    { key: 'inserir', label: '➕ Inserir dados' },
  ];

  const kpiStyle = (color: string): React.CSSProperties => ({
    background: 'var(--bg-card,#fff)', borderRadius: 8, padding: '16px 12px',
    borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  });

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' as const };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {nav.map(n => (
          <button key={n.key} onClick={() => setView(n.key as any)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: view === n.key ? '#7c3aed' : '#f3f4f6',
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
              { label: 'Total formados', value: totais.formados, color: '#333' },
              { label: 'Aprovados vestibular', value: totais.aprovados, color: '#16a34a' },
              { label: 'Taxa de aprovação', value: `${taxaGeral}%`, color: '#2563eb' },
              { label: 'Univ. pública', value: totais.publica, color: '#7c3aed' },
              { label: 'Univ. privada', value: totais.privada, color: '#ea580c' },
              { label: 'Técnico', value: totais.tecnico, color: '#0891b2' },
              { label: 'Anos rastreados', value: resumo.length, color: '#4b5563' },
              { label: 'Universidades destino', value: destinos.length, color: '#16a34a' },
            ].map(k => (
              <div key={k.label} style={kpiStyle(k.color)}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {destinos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>Top universidades de destino</h4>
              {destinos.slice(0, 5).map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  background: 'var(--bg-card,#fff)', borderRadius: 6, marginBottom: 4,
                  borderLeft: `4px solid ${TYPE_COLORS[d.university_type] ?? '#999'}`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#999', width: 24 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.university_name}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{TYPE_LABELS[d.university_type] ?? d.university_type} · {d.cursos.slice(0, 3).join(', ')}{d.cursos.length > 3 ? ` +${d.cursos.length - 3}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: TYPE_COLORS[d.university_type] ?? '#333' }}>{d.total_aprovados}</div>
                </div>
              ))}
            </div>
          )}

          {resumo.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Nenhum dado de egressos ainda. Use "Inserir dados" para começar.</div>}
        </div>
      )}

      {/* DESTINOS */}
      {view === 'destinos' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Universidades de Destino ({destinos.length})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>UNIVERSIDADE</th>
                <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>TIPO</th>
                <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>APROVADOS</th>
                <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>CURSOS</th>
                <th style={{ padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666' }}>ANOS</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{d.university_name}</td>
                  <td style={{ padding: '8px 6px' }}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: `${TYPE_COLORS[d.university_type] ?? '#999'}20`, color: TYPE_COLORS[d.university_type] ?? '#999', fontWeight: 600 }}>{TYPE_LABELS[d.university_type] ?? d.university_type}</span></td>
                  <td style={{ padding: '8px 6px', fontWeight: 700 }}>{d.total_aprovados}</td>
                  <td style={{ padding: '8px 6px', fontSize: 12 }}>{d.cursos.join(', ')}</td>
                  <td style={{ padding: '8px 6px' }}>{d.anos_presenca}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* POR ANO */}
      {view === 'aprovacoes' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Egressos por Ano</h3>
          {resumo.map(r => (
            <div key={r.graduation_year} style={{ background: 'var(--bg-card,#fff)', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>{r.graduation_year}</strong>
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>{r.taxa_aprovacao_pct}% aprovação</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, fontSize: 12 }}>
                <div><span style={{ color: '#999' }}>Formados</span><div style={{ fontWeight: 700 }}>{r.formados}</div></div>
                <div><span style={{ color: '#999' }}>Aprovados</span><div style={{ fontWeight: 700, color: '#16a34a' }}>{r.aprovados_vestibular}</div></div>
                <div><span style={{ color: '#999' }}>Pública</span><div style={{ fontWeight: 700, color: '#7c3aed' }}>{r.para_publica}</div></div>
                <div><span style={{ color: '#999' }}>Privada</span><div style={{ fontWeight: 700, color: '#ea580c' }}>{r.para_privada}</div></div>
                <div><span style={{ color: '#999' }}>Técnico</span><div style={{ fontWeight: 700, color: '#0891b2' }}>{r.para_tecnico}</div></div>
                <div><span style={{ color: '#999' }}>Mercado</span><div style={{ fontWeight: 700 }}>{r.para_mercado}</div></div>
                <div><span style={{ color: '#999' }}>Exterior</span><div style={{ fontWeight: 700 }}>{r.para_exterior}</div></div>
                {r.satisfacao_media && <div><span style={{ color: '#999' }}>Satisfação</span><div style={{ fontWeight: 700 }}>{r.satisfacao_media.toFixed(1)}/5</div></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PESQUISAS */}
      {view === 'pesquisa' && (
        <div>
          <h3 style={{ margin: '0 0 12px' }}>Pesquisas de Egressos</h3>
          {surveys.length === 0 ? (
            <p style={{ color: '#999' }}>Nenhuma pesquisa realizada ainda.</p>
          ) : surveys.map(s => (
            <div key={s.question_code} style={{
              padding: '10px 12px', borderRadius: 6, marginBottom: 6,
              background: 'var(--bg-card,#fff)', borderLeft: '4px solid #7c3aed',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.question_text}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {s.avg_score !== null ? `Média: ${s.avg_score.toFixed(1)}` : '—'} · {s.response_count} respostas
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INSERIR */}
      {view === 'inserir' && (
        <div>
          <h3 style={{ margin: '0 0 16px' }}>Inserir dados de egressos</h3>
          <div style={{ display: 'grid', gap: 12, maxWidth: 500 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ano de formatura *</HelpLabel><input type="number" value={formYear} onChange={e => setFormYear(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Turma</HelpLabel><input type="text" value={formTurma} onChange={e => setFormTurma(e.target.value)} placeholder="Ex: 3A" style={inputStyle} /></div>
            </div>
            <div><HelpLabel style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Total de formados *</HelpLabel><input type="number" value={formTotal} onChange={e => setFormTotal(e.target.value)} style={inputStyle} /></div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginTop: 8 }}>DESTINOS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><HelpLabel style={{ fontSize: 11 }}>Univ. pública</HelpLabel><input type="number" value={formPublica} onChange={e => setFormPublica(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>Univ. privada</HelpLabel><input type="number" value={formPrivada} onChange={e => setFormPrivada(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>Técnico</HelpLabel><input type="number" value={formTecnico} onChange={e => setFormTecnico(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>Mercado</HelpLabel><input type="number" value={formMercado} onChange={e => setFormMercado(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>Exterior</HelpLabel><input type="number" value={formExterior} onChange={e => setFormExterior(e.target.value)} style={inputStyle} /></div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginTop: 8 }}>APROVAÇÕES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><HelpLabel style={{ fontSize: 11 }}>Total aprovados</HelpLabel><input type="number" value={formAprovados} onChange={e => setFormAprovados(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>Via SISU</HelpLabel><input type="number" value={formSisu} onChange={e => setFormSisu(e.target.value)} style={inputStyle} /></div>
              <div><HelpLabel style={{ fontSize: 11 }}>ProUni</HelpLabel><input type="number" value={formProuni} onChange={e => setFormProuni(e.target.value)} style={inputStyle} /></div>
            </div>
            <button onClick={handleInsert} disabled={saving || !formYear || !formTotal} style={{
              padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none',
              borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Salvando...' : 'Salvar dados'}</button>
          </div>
        </div>
      )}

      </>}
    </div>
  );
}
