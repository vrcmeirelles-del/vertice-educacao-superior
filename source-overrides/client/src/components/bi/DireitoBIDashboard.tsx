// DireitoBIDashboard.tsx — BI Analítico completo do Direito
// Visual profissional, drill-down clicável, layout responsivo
import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import '../area/egressos360.css';

interface Props { institutionId: string; courseId: string; courseCode: string; vacancies: number; }

// Shared styles
const card = { background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,.04)' } as const;
const pill = (color: string, active?: boolean) => ({ padding: '6px 16px', borderRadius: 20, border: active ? `2px solid ${color}` : '1px solid var(--vx-border, #e2e8f0)', background: active ? color : 'var(--vx-surface, #fff)', color: active ? '#fff' : 'var(--vx-text, #1e293b)', fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }) as const;
const badge = (color: string) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: color + '14', color, fontSize: '.6875rem', fontWeight: 700 }) as const;
const th = { textAlign: 'left' as const, padding: '8px 6px', fontSize: '.6875rem', fontWeight: 700, color: 'var(--vx-muted, #64748b)', textTransform: 'uppercase' as const, letterSpacing: '.5px', borderBottom: '2px solid var(--vx-border, #e2e8f0)' };
const td = { padding: '8px 6px', fontSize: '.8rem', borderBottom: '1px solid #f1f5f9' };
const tdR = { ...td, textAlign: 'right' as const };
const mini = (color: string, val: number, max: number) => ({ width: Math.min(100, Math.round(100 * val / Math.max(max, 1))) + '%', height: 6, borderRadius: 3, background: color, transition: 'width .4s ease' });

export default function DireitoBIDashboard({ institutionId, courseId, courseCode, vacancies }: Props) {
  const [evolucao, setEvolucao] = useState<any[]>([]);
  const [ensalamento, setEnsalamento] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [profsPerSem, setProfsPerSem] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [fantasmas, setFantasmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('evolucao');
  const [drill, setDrill] = useState<{ type: string; data: any } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('vertice_academic_reports').select('payload,source_report_at').eq('institution_id', institutionId).eq('course_id', courseId).eq('kind', 'quantitativo_alunos').order('source_report_at', { ascending: true }),
      supabase.from('vertice_turma_stats').select('semestre,serie,turma,matriculados').eq('institution_id', institutionId).eq('codigo', courseCode).order('semestre', { ascending: true }),
      supabase.from('vertice_offering_outcomes').select('semester,teachers,discipline,class_label,academic_period,discipline_enrollments,passed_direct,passed_final,rf,rn,ra,avg_final,other_status').eq('institution_id', institutionId).eq('course_code', courseCode).gte('semester', '2023/01').order('semester', { ascending: true }),
      supabase.from('v_ghost_students_analysis').select('*').then(r => r).catch(() => ({ data: [] })),
    ]).then(([evR, enR, ofR, ghR]) => {
      if (ghR.data) setFantasmas((ghR.data as any[]).filter(g => g.semester < '2026/02'));
      if (evR.data) setEvolucao(evR.data.map((d: any) => ({ ...d.payload, date: d.source_report_at })));
      if (enR.data) setEnsalamento(enR.data);
      if (ofR.data) {
        const rows = ofR.data as any[];
        setOutcomes(rows);
        // Aggregate by professor
        const byProf: Record<string, any> = {};
        const bySemProf: Record<string, Record<string, any>> = {};
        for (const r of rows) {
          if (!r.teachers || r.discipline_enrollments === 0) continue;
          const k = r.teachers;
          if (!byProf[k]) byProf[k] = { nome: k, turmas: 0, alunos: 0, ad: 0, af: 0, rf: 0, rn: 0, ra: 0, total_rep: 0, somas: 0, n: 0, semesters: new Set() };
          byProf[k].turmas++; byProf[k].alunos += r.discipline_enrollments; byProf[k].ad += r.passed_direct; byProf[k].af += r.passed_final;
          byProf[k].rf += r.rf; byProf[k].rn += r.rn; byProf[k].ra += r.ra; byProf[k].total_rep += r.rf + r.rn + r.ra;
          if (r.avg_final) { byProf[k].somas += parseFloat(r.avg_final); byProf[k].n++; }
          byProf[k].semesters.add(r.semester);
          if (!bySemProf[r.semester]) bySemProf[r.semester] = {};
          if (!bySemProf[r.semester][k]) bySemProf[r.semester][k] = { nome: k, turmas: 0, alunos: 0, rf: 0, rn: 0, ra: 0, total_rep: 0, somas: 0, n: 0 };
          const sp = bySemProf[r.semester][k]; sp.turmas++; sp.alunos += r.discipline_enrollments; sp.rf += r.rf; sp.rn += r.rn; sp.ra += r.ra; sp.total_rep += r.rf + r.rn + r.ra;
          if (r.avg_final) { sp.somas += parseFloat(r.avg_final); sp.n++; }
        }
        setProfs(Object.values(byProf).map((p: any) => ({ ...p, semesters: p.semesters.size, media: p.n > 0 ? Math.round(100 * p.somas / p.n) / 100 : null, pct_rep: p.alunos > 0 ? Math.round(1000 * p.total_rep / p.alunos) / 10 : 0, pct_ad: p.alunos > 0 ? Math.round(1000 * p.ad / p.alunos) / 10 : 0 })).sort((a: any, b: any) => b.alunos - a.alunos));
        const semArr: any[] = [];
        for (const [sem, ps] of Object.entries(bySemProf)) for (const p of Object.values(ps) as any[]) semArr.push({ sem, ...p, media: p.n > 0 ? Math.round(100 * p.somas / p.n) / 100 : null, pct: p.alunos > 0 ? Math.round(1000 * p.total_rep / p.alunos) / 10 : 0 });
        setProfsPerSem(semArr);
      }
    }).finally(() => setLoading(false));
  }, [institutionId, courseId, courseCode]);

  if (loading) return <p className="alumni-loading">Carregando BI…</p>;

  const tabs = [
    { key: 'evolucao', label: '📈 Evolução', color: '#2563eb' },
    { key: 'ensalamento', label: '🏫 Ensalamento', color: '#7c3aed' },
    { key: 'profs', label: '👨‍🏫 Docentes', color: '#dc2626' },
    { key: 'disciplinas', label: '📚 Disciplinas', color: '#f59e0b' },
    { key: 'fantasmas', label: '👻 Fantasmas', color: '#64748b' },
    { key: 'estrategia', label: '🎯 Estratégia', color: '#059669' },
  ];

  return (
    <div className="alumni-360">
      <header className="alumni-header" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>📊 BI Analítico — Direito</h2>
        <p className="alumni-subtitle">Dados cruzados de 2023/01 a 2026/02 · Clique em qualquer linha para detalhar</p>
      </header>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, margin: '12px 0' }}>
        {[
          { label: 'Matriculados', value: evolucao[evolucao.length-1]?.matriculados || evolucao[evolucao.length-1]?.total_matriculados || 0, color: '#2563eb' },
          { label: 'Vagas/sem', value: vacancies, color: '#7c3aed' },
          { label: 'Docentes', value: profs.length, color: '#0891b2' },
          { label: 'Reprovações', value: profs.reduce((s,p) => s + p.total_rep, 0), color: '#dc2626' },
          { label: 'Disciplinas', value: new Set(outcomes.map(o => o.discipline)).size, color: '#f59e0b' },
        ].map((k,i) => (
          <div key={i} style={{ ...card, padding: '10px 12px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: k.color }}>{typeof k.value === 'number' ? k.value.toLocaleString('pt-BR') : k.value}</div>
            <div style={{ fontSize: '.6875rem', color: 'var(--vx-muted, #64748b)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {tabs.map(t => <button key={t.key} onClick={() => { setTab(t.key); setDrill(null); }} style={pill(t.color, tab === t.key)}>{t.label}</button>)}
      </div>

      {/* Drill-down overlay */}
      {drill && <DrillDown drill={drill} outcomes={outcomes} profs={profs} profsPerSem={profsPerSem} onClose={() => setDrill(null)} />}

      {/* Tab content */}
      {!drill && tab === 'evolucao' && <EvolucaoTab data={evolucao} vacancies={vacancies} onDrill={setDrill} />}
      {!drill && tab === 'ensalamento' && <EnsalamentoTab data={ensalamento} vacancies={vacancies} evolucao={evolucao} onDrill={setDrill} />}
      {!drill && tab === 'profs' && <ProfsTab profs={profs} onDrill={setDrill} />}
      {!drill && tab === 'disciplinas' && <DisciplinasTab outcomes={outcomes} onDrill={setDrill} />}
      {!drill && tab === 'fantasmas' && <FantasmasTab data={fantasmas} evolucao={evolucao} />}
      {!drill && tab === 'estrategia' && <EstrategiaTab profs={profs} profsPerSem={profsPerSem} evolucao={evolucao} />}
    </div>
  );
}

/* ============ DRILL DOWN ============ */
function DrillDown({ drill, outcomes, profs, profsPerSem, onClose }: { drill: { type: string; data: any }; outcomes: any[]; profs: any[]; profsPerSem: any[]; onClose: () => void }) {
  if (drill.type === 'professor') {
    const nome = drill.data.nome;
    const discs = outcomes.filter(o => o.teachers === nome && o.discipline_enrollments > 0);
    const p = profs.find(p => p.nome === nome);
    const semData = profsPerSem.filter(s => s.nome === nome).sort((a,b) => a.sem.localeCompare(b.sem));
    return <div style={{ ...card, borderLeft: '4px solid #dc2626' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.8rem', fontWeight: 600, padding: 0 }}>← Voltar</button>
          <h3 style={{ margin: '4px 0 0' }}>{nome}</h3>
          {p && <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={badge('#2563eb')}>{p.alunos} alunos</span>
            <span style={badge('#dc2626')}>{p.total_rep} reprovações ({p.pct_rep}%)</span>
            <span style={badge('#f59e0b')}>RF:{p.rf} RN:{p.rn} RA:{p.ra}</span>
            <span style={badge('#16a34a')}>Média {p.media ?? '—'}</span>
            <span style={badge('#7c3aed')}>{p.semesters} semestres</span>
          </div>}
        </div>
      </div>
      {/* Evolução por semestre */}
      {semData.length > 1 && <>
        <h4 style={{ fontSize: '.8rem', margin: '16px 0 8px', color: 'var(--vx-muted, #64748b)' }}>EVOLUÇÃO POR SEMESTRE</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Sem.','Turmas','Alunos','RF','RN','RA','Total','%','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{semData.map((s,i) => <tr key={i}><td style={td}><strong>{s.sem}</strong></td><td style={tdR}>{s.turmas}</td><td style={tdR}>{s.alunos}</td>
            <td style={{ ...tdR, color: s.rf > 5 ? '#dc2626' : '#64748b', fontWeight: s.rf > 5 ? 700 : 400 }}>{s.rf}</td>
            <td style={{ ...tdR, color: s.rn > 3 ? '#7c3aed' : '#64748b' }}>{s.rn}</td><td style={{ ...tdR, color: s.ra > 3 ? '#dc2626' : '#64748b' }}>{s.ra}</td>
            <td style={{ ...tdR, fontWeight: 700 }}>{s.total_rep}</td>
            <td style={{ ...tdR, fontWeight: 800, color: s.pct > 20 ? '#dc2626' : s.pct > 10 ? '#f59e0b' : '#16a34a' }}>{s.pct}%</td>
            <td style={tdR}>{s.media ?? '—'}</td>
          </tr>)}</tbody>
        </table>
      </>}
      {/* Disciplinas detalhadas */}
      <h4 style={{ fontSize: '.8rem', margin: '16px 0 8px', color: 'var(--vx-muted, #64748b)' }}>DISCIPLINAS ({discs.length} turmas)</h4>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Sem.','Disciplina','Turma','Per.','Alunos','AD','AF','RF','RN','RA','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{discs.sort((a,b) => a.semester.localeCompare(b.semester)).map((d,i) => {
            const rep = d.rf + d.rn + d.ra;
            return <tr key={i} style={{ background: rep > 5 ? '#fef2f2' : undefined }}>
              <td style={td}>{d.semester}</td>
              <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={d.discipline}>{d.discipline}</td>
              <td style={td}>{d.class_label}</td><td style={tdR}>{d.academic_period}</td><td style={tdR}>{d.discipline_enrollments}</td>
              <td style={{ ...tdR, color: '#16a34a' }}>{d.passed_direct}</td><td style={tdR}>{d.passed_final}</td>
              <td style={{ ...tdR, color: d.rf > 3 ? '#dc2626' : '#64748b', fontWeight: d.rf > 3 ? 700 : 400 }}>{d.rf}</td>
              <td style={{ ...tdR, color: d.rn > 2 ? '#7c3aed' : '#64748b' }}>{d.rn}</td>
              <td style={{ ...tdR, color: d.ra > 2 ? '#dc2626' : '#64748b' }}>{d.ra}</td>
              <td style={{ ...tdR, fontWeight: 600, color: parseFloat(d.avg_final) < 7 ? '#dc2626' : '#1e293b' }}>{d.avg_final ?? '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>;
  }
  if (drill.type === 'disciplina') {
    const disc = drill.data.discipline;
    const rows = outcomes.filter(o => o.discipline === disc).sort((a,b) => a.semester.localeCompare(b.semester));
    return <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.8rem', fontWeight: 600, padding: 0 }}>← Voltar</button>
      <h3 style={{ margin: '4px 0 8px' }}>{disc}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Sem.','Professor','Turma','Alunos','AD','AF','RF','RN','RA','Média','Outros'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((d,i) => <tr key={i} style={{ background: (d.rf+d.rn+d.ra) > 3 ? '#fef2f2' : undefined }}>
          <td style={td}><strong>{d.semester}</strong></td>
          <td style={{ ...td, fontSize: '.75rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.teachers}>{d.teachers?.split(' ').slice(0,2).join(' ')}</td>
          <td style={td}>{d.class_label}</td><td style={tdR}>{d.discipline_enrollments}</td>
          <td style={{ ...tdR, color: '#16a34a' }}>{d.passed_direct}</td><td style={tdR}>{d.passed_final}</td>
          <td style={{ ...tdR, color: d.rf > 0 ? '#dc2626' : '#64748b', fontWeight: d.rf > 3 ? 700 : 400 }}>{d.rf}</td>
          <td style={{ ...tdR, color: d.rn > 0 ? '#7c3aed' : '#64748b' }}>{d.rn}</td>
          <td style={{ ...tdR, color: d.ra > 0 ? '#dc2626' : '#64748b' }}>{d.ra}</td>
          <td style={{ ...tdR, fontWeight: 600, color: d.avg_final && parseFloat(d.avg_final) < 7 ? '#dc2626' : '#1e293b' }}>{d.avg_final ?? '—'}</td>
          <td style={{ ...td, fontSize: '.65rem', color: '#64748b', maxWidth: 100 }}>{d.other_status || '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>;
  }
  if (drill.type === 'semestre') {
    const sem = drill.data.semestre;
    const ev = evolucao.find(e => e.semestre === sem);
    const rows = outcomes.filter(o => o.semester === sem && o.discipline_enrollments > 0).sort((a,b) => (b.rf+b.rn+b.ra) - (a.rf+a.rn+a.ra));
    return <div style={{ ...card, borderLeft: '4px solid #2563eb' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vx-accent, #2563eb)', fontSize: '.8rem', fontWeight: 600, padding: 0 }}>← Voltar</button>
      <h3 style={{ margin: '4px 0' }}>Semestre {sem}</h3>
      {ev && <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={badge('#2563eb')}>{ev.matriculados || ev.total_matriculados} matriculados</span>
        <span style={badge('#dc2626')}>{ev.trancados || ev.trancado || 0} trancados</span>
        <span style={badge('#f59e0b')}>{ev.cancelados || ev.cancelado || 0} cancelados</span>
      </div>}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Disciplina','Professor','Turma','Per.','Alunos','AD','RF','RN','RA','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((d,i) => <tr key={i} style={{ background: (d.rf+d.rn+d.ra) > 3 ? '#fef2f2' : undefined, cursor: 'pointer' }} onClick={() => {}}>
            <td style={{ ...td, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.discipline}>{d.discipline}</td>
            <td style={{ ...td, fontSize: '.7rem', maxWidth: 120 }} title={d.teachers}>{d.teachers?.split(' ').slice(0,2).join(' ')}</td>
            <td style={td}>{d.class_label}</td><td style={tdR}>{d.academic_period}</td><td style={tdR}>{d.discipline_enrollments}</td>
            <td style={{ ...tdR, color: '#16a34a' }}>{d.passed_direct}</td>
            <td style={{ ...tdR, color: d.rf > 3 ? '#dc2626' : '#64748b', fontWeight: d.rf > 3 ? 700 : 400 }}>{d.rf}</td>
            <td style={{ ...tdR, color: d.rn > 2 ? '#7c3aed' : '#64748b' }}>{d.rn}</td>
            <td style={{ ...tdR, color: d.ra > 2 ? '#dc2626' : '#64748b' }}>{d.ra}</td>
            <td style={{ ...tdR, fontWeight: 600 }}>{d.avg_final ?? '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>;
  }
  return null;
}

/* ============ EVOLUÇÃO ============ */
function EvolucaoTab({ data, vacancies, onDrill }: { data: any[]; vacancies: number; onDrill: (d: any) => void }) {
  if (!data.length) return <p>Sem dados.</p>;
  const maxTotal = Math.max(...data.map(e => e.total || e.total_vinculos || 0));
  return <div style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div><strong style={{ fontSize: '1rem' }}>Evolução Semestral</strong><br/><span style={{ fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>Clique em um semestre para ver disciplinas</span></div>
      <span style={badge('#7c3aed')}>{vacancies} vagas/sem</span>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['Semestre','Total','Matric.','Tranc.','Cancel.','Transf.','Evasão',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{data.map((e: any, i: number) => {
        const m = e.matriculados || e.total_matriculados || 0;
        const t = e.trancados || e.trancado || 0; const c = e.cancelados || e.cancelado || 0; const tr = e.transferidos || e.transferido || 0;
        const total = e.total || e.total_vinculos || (m + t + c + tr);
        const evasao = total > 0 ? Math.round(100 * (t + c + tr) / total) : 0;
        return <tr key={i} style={{ cursor: 'pointer', transition: 'background .1s' }} onClick={() => onDrill({ type: 'semestre', data: { semestre: e.semestre } })}
          onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')} onMouseLeave={ev => (ev.currentTarget.style.background = '')}>
          <td style={{ ...td, fontWeight: 700 }}>{e.semestre}</td>
          <td style={tdR}>{total}</td>
          <td style={{ ...tdR, color: '#2563eb', fontWeight: 700 }}>{m}</td>
          <td style={{ ...tdR, color: t > 30 ? '#dc2626' : '#64748b' }}>{t}</td>
          <td style={{ ...tdR, color: c > 10 ? '#dc2626' : '#64748b' }}>{c}</td>
          <td style={{ ...tdR, color: '#64748b' }}>{tr}</td>
          <td style={{ ...tdR, fontWeight: 800, color: evasao > 30 ? '#dc2626' : evasao > 15 ? '#f59e0b' : '#16a34a' }}>{evasao}%</td>
          <td style={{ ...td, width: '20%' }}>
            <div style={{ display: 'flex', gap: 1, height: 8, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9' }}>
              <div style={mini('#2563eb', m, maxTotal)} /><div style={mini('#fca5a5', t + c, maxTotal)} />
            </div>
          </td>
        </tr>;
      })}</tbody>
    </table>
    {data.length >= 2 && (() => {
      const m0 = data[0].matriculados || data[0].total_matriculados || 1;
      const mN = data[data.length-1].matriculados || data[data.length-1].total_matriculados || 0;
      return <div style={{ marginTop: 16, padding: 12, background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: 10, fontSize: '.85rem' }}>
        📈 <strong>{m0} → {mN}</strong> matriculados ({mN > m0 ? '+' : ''}{Math.round(100*(mN-m0)/m0)}%). Evasão: <strong>{data[0].total > 0 ? Math.round(100*((data[0].trancados||0)+(data[0].cancelados||0))/data[0].total) : '?'}% → {data[data.length-1].total > 0 ? Math.round(100*((data[data.length-1].trancados||data[data.length-1].trancado||0)+(data[data.length-1].cancelados||data[data.length-1].cancelado||0))/(data[data.length-1].total||data[data.length-1].total_vinculos||1)) : '?'}%</strong>
      </div>;
    })()}
  </div>;
}

/* ============ ENSALAMENTO ============ */
function EnsalamentoTab({ data, vacancies, evolucao, onDrill }: { data: any[]; vacancies: number; evolucao: any[]; onDrill: (d: any) => void }) {
  const sems = [...new Set(data.map(d => d.semestre))].sort();
  const maxPer = Math.max(...data.map(d => d.serie));
  const grid: Record<string, Record<number, { turmas: string[]; total: number }>> = {};
  for (const e of data) {
    if (!grid[e.semestre]) grid[e.semestre] = {};
    if (!grid[e.semestre][e.serie]) grid[e.semestre][e.serie] = { turmas: [], total: 0 };
    grid[e.semestre][e.serie].turmas.push(`${e.turma}(${e.matriculados})`);
    grid[e.semestre][e.serie].total += e.matriculados;
  }
  const periodos = Array.from({ length: Math.min(maxPer, 10) }, (_, i) => i + 1);
  return <div style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div><strong style={{ fontSize: '1rem' }}>Mapa de Ensalamento</strong><br/><span style={{ fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>Semestre × Período — cada célula mostra turmas e alunos. Clique no semestre para detalhar.</span></div>
      <span style={badge('#7c3aed')}>{vacancies} vagas/sem · {vacancies * 2}/ano</span>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead><tr>
          <th style={{ ...th, position: 'sticky', left: 0, background: 'var(--vx-surface, #fff)', zIndex: 1 }}>Semestre</th>
          {periodos.map(p => <th key={p} style={{ ...th, textAlign: 'center', minWidth: 70 }}>{p}º</th>)}
          <th style={{ ...th, textAlign: 'right' }}>Total</th>
        </tr></thead>
        <tbody>{sems.map(sem => {
          const semTotal = Object.values(grid[sem] || {}).reduce((s, c) => s + c.total, 0);
          const ev = evolucao.find(e => e.semestre === sem);
          return <tr key={sem} style={{ cursor: 'pointer' }} onClick={() => onDrill({ type: 'semestre', data: { semestre: sem } })}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <td style={{ ...td, fontWeight: 700, position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>{sem}</td>
            {periodos.map(p => {
              const cell = grid[sem]?.[p];
              if (!cell) return <td key={p} style={{ ...td, textAlign: 'center', color: '#e2e8f0' }}>—</td>;
              const intensity = Math.min(1, cell.total / 60);
              const bg = `rgba(37, 99, 235, ${0.05 + intensity * 0.2})`;
              return <td key={p} style={{ ...td, textAlign: 'center', background: bg, borderRadius: 4 }}>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#1e293b' }}>{cell.total}</div>
                <div style={{ fontSize: '.6rem', color: '#64748b' }}>{cell.turmas.length} turma{cell.turmas.length > 1 ? 's' : ''}</div>
              </td>;
            })}
            <td style={{ ...tdR, fontWeight: 800, color: '#2563eb' }}>{semTotal}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{ marginTop: 16, padding: 12, background: 'linear-gradient(135deg, #f5f3ff, #eff6ff)', borderRadius: 10, fontSize: '.85rem' }}>
      🏫 Cresceu de <strong>{Object.values(grid[sems[0]] || {}).reduce((s,c) => s + c.turmas.length, 0)} turma</strong> ({sems[0]}) para <strong>{Object.values(grid[sems[sems.length-1]] || {}).reduce((s,c) => s + c.turmas.length, 0)} turmas</strong> ({sems[sems.length-1]}). Curso atingiu o <strong>{maxPer}º período</strong>.
    </div>
  </div>;
}

/* ============ DOCENTES ============ */
function ProfsTab({ profs, onDrill }: { profs: any[]; onDrill: (d: any) => void }) {
  const maxRep = Math.max(...profs.map(p => p.total_rep));
  const sorted = [...profs].filter(p => p.alunos >= 10);
  return <div style={card}>
    <div style={{ marginBottom: 16 }}><strong style={{ fontSize: '1rem' }}>Corpo Docente — Performance Completa</strong><br/><span style={{ fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>Clique em qualquer professor para ver evolução e disciplinas</span></div>

    {/* Matriz 2×2 visual */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
      {[
        { label: '🔴 Reprova muito + Média baixa', filter: (p: any) => p.pct_rep > 10 && (p.media ?? 10) < 7.5, bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
        { label: '🟡 Reprova + Média ok', filter: (p: any) => p.pct_rep > 10 && (p.media ?? 0) >= 7.5, bg: '#fffbeb', border: '#fde68a', color: '#f59e0b' },
        { label: '🟢 Equilibrado', filter: (p: any) => p.pct_rep <= 10 && p.pct_rep > 0 && (p.media ?? 0) < 9.5, bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
        { label: '🔶 Nunca reprova + Média ≥9.5', filter: (p: any) => p.total_rep === 0 && (p.media ?? 0) >= 9.5, bg: '#fefce8', border: '#fef08a', color: '#ca8a04' },
      ].map((q, i) => {
        const list = sorted.filter(q.filter);
        return <div key={i} style={{ padding: 10, background: q.bg, borderRadius: 10, border: `1px solid ${q.border}` }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, color: q.color, marginBottom: 6 }}>{q.label} ({list.length})</div>
          {list.map((p, j) => <div key={j} onClick={() => onDrill({ type: 'professor', data: p })} style={{ fontSize: '.75rem', padding: '4px 0', borderBottom: `1px solid ${q.border}`, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.fontWeight = '700')} onMouseLeave={e => (e.currentTarget.style.fontWeight = '')}>
            {p.nome.split(' ').slice(0,3).join(' ')} — {p.pct_rep}%, média {p.media}
          </div>)}
          {list.length === 0 && <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>Nenhum</div>}
        </div>;
      })}
    </div>

    {/* Tabela completa */}
    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Professor','Alunos','Turmas','Sem.','RF','RN','RA','Total','%','Média','Perfil'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{sorted.sort((a,b) => b.total_rep - a.total_rep).map((p, i) => {
          const main = p.rf >= p.rn && p.rf >= p.ra ? 'falta' : p.rn >= p.ra ? 'nota' : 'ambos';
          const profLabel = p.total_rep === 0 ? (p.media >= 9.5 ? '🔶 Branda' : '🟢 OK') : main === 'falta' ? '⚡ Falta' : main === 'nota' ? '📝 Nota' : '💀 Ambos';
          const profColor = p.total_rep === 0 ? (p.media >= 9.5 ? '#ca8a04' : '#16a34a') : main === 'falta' ? '#f59e0b' : main === 'nota' ? '#7c3aed' : '#dc2626';
          return <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onDrill({ type: 'professor', data: p })}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <td style={{ ...td, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</td>
            <td style={tdR}>{p.alunos}</td><td style={tdR}>{p.turmas}</td><td style={tdR}>{p.semesters}</td>
            <td style={{ ...tdR, color: p.rf > 10 ? '#dc2626' : '#64748b' }}>{p.rf}</td>
            <td style={{ ...tdR, color: p.rn > 5 ? '#7c3aed' : '#64748b' }}>{p.rn}</td>
            <td style={{ ...tdR, color: p.ra > 5 ? '#dc2626' : '#64748b' }}>{p.ra}</td>
            <td style={{ ...tdR, fontWeight: 700 }}>{p.total_rep}</td>
            <td style={{ ...tdR, fontWeight: 800, color: p.pct_rep > 20 ? '#dc2626' : p.pct_rep > 10 ? '#f59e0b' : '#16a34a' }}>{p.pct_rep}%</td>
            <td style={{ ...tdR, color: (p.media ?? 10) < 7 ? '#dc2626' : '#1e293b' }}>{p.media ?? '—'}</td>
            <td style={td}><span style={badge(profColor)}>{profLabel}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: '.7rem', color: 'var(--vx-muted, #64748b)', flexWrap: 'wrap' }}>
      <span>⚡ Falta = evasão silenciosa</span><span>📝 Nota = rigor avaliativo</span><span>💀 Ambos = aluno desiste E não atinge nota</span><span>🔶 Branda = nunca reprova, média ≥9.5</span>
    </div>
  </div>;
}

/* ============ DISCIPLINAS ============ */
function DisciplinasTab({ outcomes, onDrill }: { outcomes: any[]; onDrill: (d: any) => void }) {
  // Aggregate by discipline
  const byDisc: Record<string, { discipline: string; turmas: number; alunos: number; rf: number; rn: number; ra: number; total_rep: number; somas: number; n: number }> = {};
  for (const o of outcomes) {
    if (!o.discipline || o.discipline_enrollments === 0) continue;
    if (!byDisc[o.discipline]) byDisc[o.discipline] = { discipline: o.discipline, turmas: 0, alunos: 0, rf: 0, rn: 0, ra: 0, total_rep: 0, somas: 0, n: 0 };
    const d = byDisc[o.discipline]; d.turmas++; d.alunos += o.discipline_enrollments; d.rf += o.rf; d.rn += o.rn; d.ra += o.ra; d.total_rep += o.rf + o.rn + o.ra;
    if (o.avg_final) { d.somas += parseFloat(o.avg_final); d.n++; }
  }
  const discs = Object.values(byDisc).map(d => ({ ...d, media: d.n > 0 ? Math.round(100 * d.somas / d.n) / 100 : null, pct: d.alunos > 0 ? Math.round(1000 * d.total_rep / d.alunos) / 10 : 0 })).sort((a, b) => b.total_rep - a.total_rep);

  return <div style={card}>
    <div style={{ marginBottom: 16 }}><strong style={{ fontSize: '1rem' }}>Disciplinas — Ranking por Reprovação</strong><br/><span style={{ fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>Clique em qualquer disciplina para ver histórico semestre a semestre com professor</span></div>
    <div style={{ maxHeight: 600, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Disciplina','Ofertas','Alunos','RF','RN','RA','Total','%','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{discs.map((d, i) => <tr key={i} style={{ cursor: 'pointer', background: d.total_rep > 20 ? '#fef2f2' : undefined }}
          onClick={() => onDrill({ type: 'disciplina', data: d })}
          onMouseEnter={e => (e.currentTarget.style.background = d.total_rep > 20 ? '#fee2e2' : '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = d.total_rep > 20 ? '#fef2f2' : '')}>
          <td style={{ ...td, fontWeight: 600, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.discipline}>{d.discipline}</td>
          <td style={tdR}>{d.turmas}</td><td style={tdR}>{d.alunos}</td>
          <td style={{ ...tdR, color: d.rf > 5 ? '#dc2626' : '#64748b', fontWeight: d.rf > 10 ? 700 : 400 }}>{d.rf}</td>
          <td style={{ ...tdR, color: d.rn > 5 ? '#7c3aed' : '#64748b' }}>{d.rn}</td>
          <td style={{ ...tdR, color: d.ra > 3 ? '#dc2626' : '#64748b' }}>{d.ra}</td>
          <td style={{ ...tdR, fontWeight: 800, color: d.total_rep > 20 ? '#dc2626' : '#1e293b' }}>{d.total_rep}</td>
          <td style={{ ...tdR, fontWeight: 700, color: d.pct > 15 ? '#dc2626' : d.pct > 8 ? '#f59e0b' : '#16a34a' }}>{d.pct}%</td>
          <td style={{ ...tdR, color: (d.media ?? 10) < 7 ? '#dc2626' : '#1e293b' }}>{d.media ?? '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

/* ============ FANTASMAS ============ */
function FantasmasTab({ data, evolucao }: { data: any[]; evolucao: any[] }) {
  const bySem: Record<string, { turmas: any[]; totalMat: number; totalFantasmas: number }> = {};
  for (const g of data) { if (!bySem[g.semester]) bySem[g.semester] = { turmas: [], totalMat: 0, totalFantasmas: 0 }; bySem[g.semester].turmas.push(g); bySem[g.semester].totalMat += g.snapshot_matriculados; bySem[g.semester].totalFantasmas += parseInt(g.fantasmas_estimados) || 0; }
  const sems = Object.entries(bySem).sort(([a],[b]) => a.localeCompare(b));
  // Não-renovação
  const semOrder = evolucao.map(e => e.semestre).filter(Boolean);
  const naoRen: any[] = [];
  for (let i = 0; i < semOrder.length - 1; i++) {
    const a = evolucao.find(e => e.semestre === semOrder[i]); const b = evolucao.find(e => e.semestre === semOrder[i+1]);
    if (a && b) { const mA = a.matriculados || a.total_matriculados || 0; const mB = b.matriculados || b.total_matriculados || 0; const p = Math.max(0, mA - mB); if (mA > 0) naoRen.push({ de: semOrder[i], para: semOrder[i+1], mat: mA, ren: Math.min(mA, mB), perdidos: p, pct: Math.round(100*p/mA) }); }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={card}>
      <strong style={{ fontSize: '1rem' }}>👻 Fantasmas por Turma</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '4px 0 12px' }}>Fantasma = consta no sistema como matriculado mas não teve nota em nenhuma disciplina do semestre</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Sem.','Turma','Per.','Snapshot','C/ nota','Fantasmas','%','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{sems.map(([,d]) => d.turmas.map((g: any, j: number) => {
          const f = parseInt(g.fantasmas_estimados) || 0; const cn = g.snapshot_matriculados - f; const pf = parseFloat(g.pct_fantasma) || 0;
          if (f === 0 && g.snapshot_matriculados < 3) return null;
          return <tr key={`${g.semester}-${j}`} style={{ background: pf > 10 ? '#fef2f2' : f > 0 ? '#fffbeb' : undefined }}>
            <td style={{ ...td, fontWeight: 700 }}>{g.semester}</td><td style={{ ...td, fontWeight: 600 }}>{g.class_label}</td><td style={tdR}>{g.periodo}º</td>
            <td style={tdR}>{g.snapshot_matriculados}</td><td style={{ ...tdR, color: '#2563eb' }}>{cn}</td>
            <td style={{ ...tdR, fontWeight: 800, color: f > 3 ? '#dc2626' : f > 0 ? '#f59e0b' : '#16a34a' }}>{f}</td>
            <td style={{ ...tdR, fontWeight: 700, color: pf > 15 ? '#dc2626' : pf > 5 ? '#f59e0b' : '#16a34a' }}>{pf}%</td>
            <td style={tdR}>{parseFloat(g.media_turma) > 0 ? g.media_turma : '—'}</td>
          </tr>;
        }))}</tbody>
      </table>
    </div>
    <div style={card}>
      <strong style={{ fontSize: '1rem' }}>🔄 Retenção entre Semestres</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '4px 0 12px' }}>Matriculados no semestre A que não aparecem no semestre B</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['De','Para','Matric.','Renov.','Perdidos','%',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{naoRen.map((r,i) => <tr key={i}>
          <td style={{ ...td, fontWeight: 600 }}>{r.de}</td><td style={td}>{r.para}</td><td style={tdR}>{r.mat}</td>
          <td style={{ ...tdR, color: '#2563eb', fontWeight: 700 }}>{r.ren}</td>
          <td style={{ ...tdR, color: r.perdidos > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{r.perdidos}</td>
          <td style={{ ...tdR, fontWeight: 800, color: r.pct > 20 ? '#dc2626' : r.pct > 0 ? '#f59e0b' : '#16a34a' }}>{r.pct}%</td>
          <td style={{ ...td, width: '18%' }}><div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9' }}><div style={{ width: `${100-r.pct}%`, background: '#2563eb', transition: 'width .3s' }} /><div style={{ width: `${r.pct}%`, background: '#fca5a5' }} /></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

/* ============ ESTRATÉGIA ============ */
function EstrategiaTab({ profs, profsPerSem, evolucao }: { profs: any[]; profsPerSem: any[]; evolucao: any[] }) {
  const mezz = profs.find(p => p.nome?.includes('MEZZAROBA'));
  const thais = profs.find(p => p.nome === 'THAIS ALMEIDA DE AGUIAR');
  const totalRF = profs.reduce((s,p) => s + p.rf, 0); const totalRN = profs.reduce((s,p) => s + p.rn, 0); const totalRA = profs.reduce((s,p) => s + p.ra, 0);
  const cards = [
    { icon: '🔴', prio: 'CRÍTICA', color: '#dc2626', title: 'Cristiane Mezzaroba — Penal', sub: 'Taxa >20% persistente', metrics: mezz ? [`${mezz.alunos} alunos`, `${mezz.total_rep} reprovações (${mezz.pct_rep}%)`, `RF:${mezz.rf} RN:${mezz.rn} RA:${mezz.ra}`, `Média ${mezz.media}`] : [], action: 'Reunião individual. Comparar com média do NDE. Verificar se é rigor ou desalinhamento.', evidence: 'Teoria da Pena 2024/01: 33.3%, média 5.62. Penal II (3B) 2026/01: 8 RF.' },
    { icon: '⚡', prio: 'ALTA', color: '#f59e0b', title: 'RF = evasão disfarçada', sub: 'Aluno para de ir antes de ser avaliado', metrics: [`RF total: ${totalRF}`, `RN total: ${totalRN}`, `RA total: ${totalRA}`, `RF = ${Math.round(100*totalRF/(totalRF+totalRN+totalRA))}% das reprovações`], action: 'Alerta automático em 25% de faltas. Busca ativa por WhatsApp. Notificar coordenador + tutor.', evidence: '2025/01: 83 RF no 1º período. 2026/01: 43 RF em DIR-1A.' },
    { icon: '🎯', prio: 'ALTA', color: '#f59e0b', title: 'Gargalo do 1º período', sub: 'IED, Economia e Ciência Política', metrics: ['IED: média oscilou de 9.7 a 5.7', 'Economia: média 6.0 em 2024/01', 'Ciência Política: média 6.2', '60%+ das reprovações de calouros'], action: 'Tutoria + monitoria obrigatória nos 3 componentes críticos. Acompanhamento semanal de frequência.', evidence: 'IED com Sibele: 22.6% rep, média 5.73. Economia com Casé: 22.8%, média 6.00.' },
    { icon: '⚠', prio: 'MÉDIA', color: '#7c3aed', title: 'Thais com sobrecarga', sub: '2→6 turmas, média caiu, RF subiu', metrics: thais ? [`${thais.alunos} alunos total`, `${thais.turmas} turmas`, `${thais.total_rep} reprovações (${thais.pct_rep}%)`, `RF: ${thais.rf} (${Math.round(100*thais.rf/Math.max(thais.total_rep,1))}% das reprova.)`] : [], action: 'Redistribuir ao menos 2 turmas. Média caiu e RF subiu com a sobrecarga.', evidence: 'De 2 turmas (2023) para 6 (2026/01). RF: 76 acumulados.' },
    { icon: '📋', prio: 'MONITORAR', color: '#0891b2', title: '2026/02 em andamento', sub: 'Notas em lançamento', metrics: ['Status: CR (cursando)', `${evolucao[evolucao.length-1]?.matriculados || '?'} matriculados`, '10+ turmas (1º ao 10º)'], action: 'Repetir análise ao final do semestre.', evidence: 'Apenas 14 notas lançadas até agora.' },
  ];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {cards.map((c, i) => (
      <div key={i} style={{ ...card, borderLeft: `4px solid ${c.color}`, padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '1.25rem' }}>{c.icon}</span>
          <span style={{ ...badge(c.color), textTransform: 'uppercase' }}>{c.prio}</span>
        </div>
        <strong style={{ fontSize: '1.05rem' }}>{c.title}</strong>
        <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '2px 0 10px' }}>{c.sub}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {c.metrics.map((m, j) => <span key={j} style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.75rem' }}>{m}</span>)}
        </div>
        <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>📌 <strong>Ação:</strong> {c.action}</div>
        {c.evidence && <div style={{ marginTop: 6, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>📎 {c.evidence}</div>}
      </div>
    ))}
  </div>;
}
