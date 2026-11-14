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
  const [ensalamentoReal, setEnsalamentoReal] = useState<any[]>([]);
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
      supabase.from('vertice_eorbit_direito_raio_x').select('semestre,dados').eq('institution_id', institutionId).eq('tipo', 'quantitativo_turma').order('semestre').then(r => r).catch(() => ({ data: [] })),
    ]).then(([evR, enR, ofR, ghR, enRealR]) => {
      if (ghR.data) setFantasmas((ghR.data as any[]).filter(g => g.semester < '2026/02'));
      if (evR.data) setEvolucao(evR.data.map((d: any) => ({ ...d.payload, date: d.source_report_at })));
      if (enR.data) setEnsalamento(enR.data);
      // Build ensalamento real
      if (enRealR.data) {
        const real: any[] = [];
        for (const r of enRealR.data as any[]) {
          const sem = r.semestre; const d = r.dados;
          if (d.turmas) { for (const t of d.turmas) real.push({ semestre: sem, turma: t.turma, periodo: t.periodo, total: t.total||0, mat: t.mat||0, tranc: t.tranc||0, cancel: t.cancel||0, transf: t.transf||0 }); }
          else if (d.turma) { real.push({ semestre: sem, turma: d.turma, periodo: d.periodo, total: d.total||0, mat: d.matriculado||0, tranc: d.trancado||0, cancel: d.cancelado||0, transf: d.transferido||0 }); }
        }
        setEnsalamentoReal(real);
      }
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
    { key: 'vagas', label: '📊 Vagas & Extensão', color: '#7c3aed' },
    { key: 'alerta262', label: '🚨 Alertas 26.2', color: '#dc2626' },
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
      {!drill && tab === 'ensalamento' && <EnsalamentoTab data={ensalamento} real={ensalamentoReal} vacancies={vacancies} evolucao={evolucao} onDrill={setDrill} />}
      {!drill && tab === 'profs' && <ProfsTab profs={profs} onDrill={setDrill} />}
      {!drill && tab === 'disciplinas' && <DisciplinasTab outcomes={outcomes} onDrill={setDrill} />}
      {!drill && tab === 'fantasmas' && <FantasmasTab data={fantasmas} evolucao={evolucao} />}
      {!drill && tab === 'estrategia' && <EstrategiaTab profs={profs} profsPerSem={profsPerSem} evolucao={evolucao} />}
      {!drill && tab === 'vagas' && <VagasExtensaoTab outcomes={outcomes} evolucao={evolucao} vacancies={vacancies} />}
      {!drill && tab === 'alerta262' && <Alertas262Tab outcomes={outcomes} evolucao={evolucao} />}
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
function EnsalamentoTab({ data, real, vacancies, evolucao, onDrill }: { data: any[]; real: any[]; vacancies: number; evolucao: any[]; onDrill: (d: any) => void }) {
  // Use REAL data (total da época) when available, fallback to turma_stats (só ativos hoje)
  const IDEAL = 40; // alunos por sala ideal
  const source = real.length > 0 ? real : data.map(d => ({ semestre: d.semestre, turma: d.turma, periodo: d.serie, total: d.matriculados, mat: d.matriculados, tranc: 0, cancel: 0, transf: 0 }));

  // For 2026/01 and 2026/02, supplement from turma_stats if not in real
  const realSems = new Set(real.map(r => r.semestre));
  const supplemented = [...source];
  if (!realSems.has('2026/01')) {
    for (const d of data.filter(d => d.semestre === '2026/01')) {
      const ev = evolucao.find(e => e.semestre === '2026/01');
      supplemented.push({ semestre: d.semestre, turma: d.turma, periodo: d.serie, total: d.matriculados, mat: d.matriculados, tranc: 0, cancel: 0, transf: 0 });
    }
  }
  if (!realSems.has('2026/02')) {
    for (const d of data.filter(d => d.semestre === '2026/02')) {
      supplemented.push({ semestre: d.semestre, turma: d.turma, periodo: d.serie, total: d.matriculados, mat: d.matriculados, tranc: 0, cancel: 0, transf: 0 });
    }
  }

  const bySem: Record<string, any[]> = {};
  for (const r of supplemented) { if (!bySem[r.semestre]) bySem[r.semestre] = []; bySem[r.semestre].push(r); }
  const sems = Object.keys(bySem).sort();

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div><strong style={{ fontSize: '1.05rem' }}>Ensalamento Real — Cada sala, cada semestre</strong><br/>
        <span style={{ fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>Total de alunos que ESTAVAM na turma naquele semestre (matriculados + trancados + cancelados + transferidos). Ideal: {IDEAL}/sala.</span></div>
        <span style={badge('#7c3aed')}>{vacancies} vagas/sem</span>
      </div>
    </div>

    {sems.map(sem => {
      const turmas = bySem[sem].sort((a: any, b: any) => a.periodo - b.periodo || a.turma.localeCompare(b.turma));
      const totalGeral = turmas.reduce((s: number, t: any) => s + t.total, 0);
      const totalMat = turmas.reduce((s: number, t: any) => s + t.mat, 0);
      const totalTranc = turmas.reduce((s: number, t: any) => s + (t.tranc || 0), 0);
      const totalCancel = turmas.reduce((s: number, t: any) => s + (t.cancel || 0), 0);
      const salasNecessarias = turmas.filter((t: any) => t.total > 0).length;
      const ev = evolucao.find(e => e.semestre === sem);

      return <div key={sem} style={{ ...card, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}
          onClick={() => onDrill({ type: 'semestre', data: { semestre: sem } })}>
          <div>
            <strong style={{ fontSize: '1.1rem' }}>{sem}</strong>
            <span style={{ fontSize: '.8rem', color: '#64748b', marginLeft: 8 }}>{salasNecessarias} sala{salasNecessarias > 1 ? 's' : ''} ativa{salasNecessarias > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={badge('#1e293b')}>{totalGeral} total</span>
            <span style={badge('#2563eb')}>{totalMat} cursando</span>
            {totalTranc > 0 && <span style={badge('#f59e0b')}>{totalTranc} tranc.</span>}
            {totalCancel > 0 && <span style={badge('#dc2626')}>{totalCancel} cancel.</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {turmas.filter((t: any) => t.total > 0).map((t: any, i: number) => {
            const ocupacao = Math.round(100 * t.total / IDEAL);
            const critical = t.total < 25;
            const warning = t.total >= 25 && t.total < 35;
            const good = t.total >= 35;
            const barColor = critical ? '#dc2626' : warning ? '#f59e0b' : good ? '#16a34a' : '#2563eb';
            const retenção = t.total > 0 ? Math.round(100 * t.mat / t.total) : 0;
            return <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: critical ? '#fef2f2' : good ? '#f0fdf4' : '#f8fafc', border: `1px solid ${critical ? '#fecaca' : good ? '#bbf7d0' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: '.9rem' }}>{t.turma}</strong>
                <span style={{ fontSize: '.65rem', color: '#94a3b8' }}>{t.periodo}º período</span>
              </div>
              {/* Barra de ocupação */}
              <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', marginBottom: 6, position: 'relative' }}>
                <div style={{ height: 8, borderRadius: 4, background: barColor, width: `${Math.min(100, ocupacao)}%`, transition: 'width .3s' }} />
                {/* Linha do ideal */}
                <div style={{ position: 'absolute', left: '100%', top: -2, height: 12, width: 2, background: '#64748b', borderRadius: 1 }} title={`Ideal: ${IDEAL}`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem' }}>
                <span><strong style={{ color: '#1e293b', fontSize: '.85rem' }}>{t.total}</strong> <span style={{ color: '#64748b' }}>alunos</span></span>
                <span style={{ color: barColor, fontWeight: 700 }}>{ocupacao}% do ideal</span>
              </div>
              {/* Breakdown */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 6, background: '#dbeafe', color: '#2563eb' }}>✓ {t.mat} mat.</span>
                {(t.tranc || 0) > 0 && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 6, background: '#fef3c7', color: '#f59e0b' }}>⏸ {t.tranc} tranc.</span>}
                {(t.cancel || 0) > 0 && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 6, background: '#fee2e2', color: '#dc2626' }}>✕ {t.cancel} cancel.</span>}
                {(t.transf || 0) > 0 && <span style={{ fontSize: '.6rem', padding: '1px 6px', borderRadius: 6, background: '#e2e8f0', color: '#64748b' }}>↗ {t.transf} transf.</span>}
              </div>
              {critical && <div style={{ marginTop: 4, fontSize: '.65rem', color: '#dc2626', fontWeight: 600 }}>🚨 Turma crítica: {t.total} alunos — abaixo de 25</div>}
              {warning && <div style={{ marginTop: 4, fontSize: '.65rem', color: '#f59e0b', fontWeight: 600 }}>⚠ Atenção: {t.total} alunos — abaixo do ideal</div>}
              {retenção < 50 && <div style={{ marginTop: 4, fontSize: '.65rem', color: '#7c3aed', fontWeight: 600 }}>📉 Retenção: {retenção}% — mais da metade saiu</div>}
            </div>;
          })}
        </div>

        {/* Resumo do semestre */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '.7rem', color: '#64748b' }}>
          <span>Salas com &gt;35 alunos: <strong style={{ color: '#16a34a' }}>{turmas.filter((t: any) => t.total >= 35).length}</strong> ✓</span>
          <span>Salas com &lt;25 alunos: <strong style={{ color: turmas.some((t: any) => t.total > 0 && t.total < 25) ? '#dc2626' : '#16a34a' }}>{turmas.filter((t: any) => t.total > 0 && t.total < 25).length}</strong>{turmas.some((t: any) => t.total > 0 && t.total < 25) ? ' 🚨' : ''}</span>
          <span>Retenção média: <strong style={{ color: totalGeral > 0 && totalMat / totalGeral < 0.5 ? '#dc2626' : '#16a34a' }}>{totalGeral > 0 ? Math.round(100 * totalMat / totalGeral) : 0}%</strong></span>
        </div>
      </div>;
    })}

    <div style={{ padding: 12, background: 'linear-gradient(135deg, #f5f3ff, #eff6ff)', borderRadius: 10, fontSize: '.85rem' }}>
      🏫 <strong>2023/01:</strong> 1 sala com 44 alunos (110% do ideal). <strong>2026/02:</strong> {bySem['2026/02']?.filter((t: any) => t.total > 0).length || '?'} salas ativas. Ideal: {IDEAL} alunos/sala. Vagas autorizadas: {vacancies}/semestre.
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
  const totalRF = profs.reduce((s,p) => s + p.rf, 0); const totalRN = profs.reduce((s,p) => s + p.rn, 0); const totalRA = profs.reduce((s,p) => s + p.ra, 0);
  const totalRep = totalRF + totalRN + totalRA;
  const thais = profs.find(p => p.nome === 'THAIS ALMEIDA DE AGUIAR');

  // Gerar alertas docentes automaticamente
  const alertasDocentes = profs.filter(p => p.alunos >= 20 && (p.pct_rep > 15 || (p.total_rep === 0 && (p.media ?? 0) >= 9.5))).map(p => {
    if (p.total_rep === 0 && (p.media ?? 0) >= 9.5) return { prof: p, tipo: 'branda' as const, color: '#ca8a04', prio: 'ATENÇÃO' };
    if (p.pct_rep > 20) return { prof: p, tipo: 'critico' as const, color: '#dc2626', prio: 'CRÍTICA' };
    return { prof: p, tipo: 'alerta' as const, color: '#f59e0b', prio: 'ALTA' };
  }).sort((a, b) => {
    const order = { critico: 0, alerta: 1, branda: 2 };
    return order[a.tipo] - order[b.tipo] || b.prof.total_rep - a.prof.total_rep;
  });

  // Professores com sobrecarga (>5 turmas em um semestre)
  const sobrecarga = profsPerSem.filter(p => p.turmas >= 5).sort((a, b) => b.turmas - a.turmas);

  const Card = ({ icon, prio, color, title, sub, children }: { icon: string; prio: string; color: string; title: string; sub: string; children: React.ReactNode }) => (
    <div style={{ ...card, borderLeft: `4px solid ${color}`, padding: '1.25rem' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <span style={{ ...badge(color), textTransform: 'uppercase' }}>{prio}</span>
      </div>
      <strong style={{ fontSize: '1.05rem' }}>{title}</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '2px 0 10px' }}>{sub}</p>
      {children}
    </div>
  );

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* 1. Alertas de reprovação docente — TODOS que ultrapassam limiar */}
    <Card icon="🔴" prio="DOCENTES EM ALERTA" color="#dc2626" title={`${alertasDocentes.length} professores com indicadores fora do padrão`} sub="Taxa de reprovação >15% persistente OU zero reprovação com média ≥9.5">
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr>{['Professor','Alunos','Reprov.','%','RF','RN','RA','Média','Diagnóstico'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{alertasDocentes.map((a, i) => {
          const p = a.prof;
          const diag = a.tipo === 'branda' ? 'Possível avaliação branda' : p.rf > p.rn + p.ra ? 'Evasão silenciosa (RF alto)' : p.rn > p.rf ? 'Rigor avaliativo (RN alto)' : 'Múltiplas causas (RF+RN+RA)';
          return <tr key={i} style={{ background: a.tipo === 'critico' ? '#fef2f2' : a.tipo === 'branda' ? '#fefce8' : '#fffbeb' }}>
            <td style={{ ...td, fontWeight: 700, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</td>
            <td style={tdR}>{p.alunos}</td>
            <td style={{ ...tdR, fontWeight: 700, color: a.color }}>{p.total_rep}</td>
            <td style={{ ...tdR, fontWeight: 800, color: a.color }}>{p.pct_rep}%</td>
            <td style={{ ...tdR, color: p.rf > 10 ? '#dc2626' : '#64748b' }}>{p.rf}</td>
            <td style={{ ...tdR, color: p.rn > 5 ? '#7c3aed' : '#64748b' }}>{p.rn}</td>
            <td style={{ ...tdR, color: p.ra > 5 ? '#dc2626' : '#64748b' }}>{p.ra}</td>
            <td style={{ ...tdR, color: (p.media ?? 10) < 7 ? '#dc2626' : '#1e293b' }}>{p.media ?? '—'}</td>
            <td style={{ ...td, fontSize: '.7rem' }}><span style={badge(a.color)}>{diag}</span></td>
          </tr>;
        })}</tbody>
      </table>
      <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>
        📌 <strong>Ação:</strong> Reunião individual com cada docente em alerta. Comparar resultados com a média do NDE. Analisar se é perfil de disciplina (Penal é tradicionalmente mais difícil) ou desalinhamento pedagógico. Professores com média ≥9.5 e zero reprovação devem ter avaliações auditadas.
      </div>
    </Card>

    {/* 2. RF = evasão */}
    <Card icon="⚡" prio="ALTA" color="#f59e0b" title="Reprovação por falta = evasão disfarçada" sub="Aluno para de frequentar antes de ser avaliado">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'RF (Falta)', value: totalRF, color: '#dc2626', pct: Math.round(100*totalRF/totalRep) },
          { label: 'RN (Nota)', value: totalRN, color: '#7c3aed', pct: Math.round(100*totalRN/totalRep) },
          { label: 'RA (Ambos)', value: totalRA, color: '#f59e0b', pct: Math.round(100*totalRA/totalRep) },
        ].map((m, i) => <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
          <div style={{ fontSize: '.65rem', color: '#64748b' }}>{m.label} ({m.pct}%)</div>
          <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', marginTop: 4 }}><div style={{ height: 4, borderRadius: 2, background: m.color, width: `${m.pct}%` }} /></div>
        </div>)}
      </div>
      <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>
        📌 <strong>Ação:</strong> Alerta automático em 25% de faltas. Busca ativa por WhatsApp/telefone. Notificar coordenador + tutor antes que o aluno vire RF.
      </div>
      <div style={{ marginTop: 6, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>📎 2025/01: 83 RF no 1º período. 2026/01: 43 RF em DIR-1A. RF predomina em {Math.round(100*totalRF/totalRep)}% das reprovações.</div>
    </Card>

    {/* 3. Gargalo 1º período */}
    <Card icon="🎯" prio="ALTA" color="#f59e0b" title="Disciplinas gargalo do 1º período" sub="Onde se perde a maioria dos calouros">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {['INTRODUÇÃO AO ESTUDO DO DIREITO', 'ECONOMIA APLICADA AO DIREITO', 'CIÊNCIAS POLÍTICA', 'CIÊNCIA POLÍTICA E TEORIA GERAL DO ESTADO', 'FUNDAMENTOS DA LÍNGUA PORTUGUESA E REDAÇÃO OFICIAL', 'HISTÓRIA DO DIREITO E DAS INSTITUIÇÕES JURÍDICAS'].map(disc => {
          const p = profs.find(p => p.nome && profsPerSem.some(ps => ps.nome === p.nome)); // won't use this
          // aggregate from profsPerSem data is not great here, let's just show disc name
          return null; // simplified below
        }).filter(Boolean)}
      </div>
      <div style={{ fontSize: '.8rem', lineHeight: 1.8 }}>
        <div style={{ padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4 }}>📚 <strong>Intro. ao Estudo do Direito</strong> — média oscilou de 9.7 (2023, Julio) a 5.7 (2024, Sibele) a 6.7 (2026, Thais). Disciplina mais sensível ao professor.</div>
        <div style={{ padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4 }}>📚 <strong>Economia Aplicada</strong> — média 6.0 em 2024/01 (Casé, 22.8% rep). Melhorou para 6.9 em 2025/01 com o mesmo professor.</div>
        <div style={{ padding: '6px 10px', background: '#fffbeb', borderRadius: 6, marginBottom: 4 }}>📚 <strong>Ciência Política</strong> — média 6.2 em 2024/01 (Eronides), 6.6 em 2025/01 (mesmo prof, 25% rep com 95 alunos).</div>
        <div style={{ padding: '6px 10px', background: '#fffbeb', borderRadius: 6, marginBottom: 4 }}>📚 <strong>História do Direito</strong> — caiu de 9.5 (2023) para 5.85 (2025/01, Thais com 97 alunos e 35 aprovações de 97).</div>
      </div>
      <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem', marginTop: 8 }}>
        📌 <strong>Ação:</strong> Tutoria e monitoria obrigatória nestas disciplinas. Acompanhamento semanal de frequência no 1º período. Considerar professor dedicado para IED e Economia.
      </div>
    </Card>

    {/* 4. Sobrecarga */}
    <Card icon="⚠" prio="MÉDIA" color="#7c3aed" title="Professores com sobrecarga" sub="Docentes com 5+ turmas em um semestre — correlação com queda de média e aumento de RF">
      {sobrecarga.length > 0 ? <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr>{['Professor','Semestre','Turmas','Alunos','Reprov.','%','Média'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{sobrecarga.map((s, i) => <tr key={i} style={{ background: s.turmas >= 6 ? '#f5f3ff' : undefined }}>
          <td style={{ ...td, fontWeight: 600, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.nome}>{s.nome.split(' ').slice(0, 3).join(' ')}</td>
          <td style={td}>{s.sem}</td><td style={{ ...tdR, fontWeight: 700, color: '#7c3aed' }}>{s.turmas}</td><td style={tdR}>{s.alunos}</td>
          <td style={{ ...tdR, color: s.total_rep > 10 ? '#dc2626' : '#64748b' }}>{s.total_rep}</td>
          <td style={{ ...tdR, fontWeight: 700, color: s.pct > 15 ? '#dc2626' : s.pct > 10 ? '#f59e0b' : '#16a34a' }}>{s.pct}%</td>
          <td style={tdR}>{s.media ?? '—'}</td>
        </tr>)}</tbody>
      </table> : <p style={{ fontSize: '.8rem', color: '#64748b' }}>Nenhum professor com 5+ turmas em um semestre.</p>}
      {thais && <div style={{ marginTop: 6, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)' }}>📎 Thais: de 2 turmas (2023) para {thais.turmas} acumuladas. RF acumulado: {thais.rf}. Redistribuir carga.</div>}
      <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem', marginTop: 8 }}>
        📌 <strong>Ação:</strong> Limitar a 4 turmas/semestre por docente. Redistribuir excedente. Monitorar correlação turmas × queda de média.
      </div>
    </Card>

    {/* 5. Monitorar */}
    <Card icon="📋" prio="MONITORAR" color="#0891b2" title="2026/02 — Semestre em curso" sub="Notas ainda em lançamento (CR = cursando)">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.75rem' }}>Status: CR (cursando)</span>
        <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.75rem' }}>{evolucao[evolucao.length-1]?.matriculados || '?'} matriculados</span>
        <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.75rem' }}>10+ turmas (1º ao 10º período)</span>
      </div>
      <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>
        📌 <strong>Ação:</strong> Repetir esta análise completa ao final de 2026/02 para verificar se intervenções surtiram efeito.
      </div>
    </Card>
  </div>;
}

/* ============ VAGAS & EXTENSÃO ============ */
function VagasExtensaoTab({ outcomes, evolucao, vacancies }: { outcomes: any[]; evolucao: any[]; vacancies: number }) {
  const VAGAS_ANUAIS = vacancies; // 75

  // Ingressantes por ano (1º período apenas)
  // Dados da série histórica: ingressantes_1per
  const ingressantesPorSem: Record<string, number> = {
    '2023/01': 40, '2023/02': 0, '2024/01': 59, '2024/02': 29,
    '2025/01': 97, '2025/02': 40, '2026/01': 114, '2026/02': 38,
  };
  const anos = ['2023', '2024', '2025', '2026'];
  const vagasData = anos.map(ano => {
    const s1 = ingressantesPorSem[`${ano}/01`] || 0;
    const s2 = ingressantesPorSem[`${ano}/02`] || 0;
    const total = s1 + s2;
    const ociosas = Math.max(0, VAGAS_ANUAIS - total);
    const excedente = Math.max(0, total - VAGAS_ANUAIS);
    return { ano, s1, s2, total, ociosas, excedente, pctOcupacao: Math.round(100 * total / VAGAS_ANUAIS) };
  });

  // Extensão (CE) em 2026/02
  const ce262 = outcomes.filter(o => o.semester === '2026/02' && o.discipline_enrollments > 0 && (o.discipline?.includes('(CE)') || o.discipline?.includes('INTEGRADOR')));
  const totalExtensao = ce262.reduce((s, o) => s + o.discipline_enrollments, 0);
  // Extensão histórica
  const ceBySem: Record<string, { discs: any[]; total: number }> = {};
  for (const o of outcomes) {
    if (o.discipline_enrollments > 0 && (o.discipline?.includes('(CE)') || o.discipline?.includes('INTEGRADOR') || o.discipline?.includes('RESOC'))) {
      if (!ceBySem[o.semester]) ceBySem[o.semester] = { discs: [], total: 0 };
      ceBySem[o.semester].discs.push(o);
      ceBySem[o.semester].total += o.discipline_enrollments;
    }
  }

  // Estágio (Prática) em 2026/02
  const est262 = outcomes.filter(o => o.semester === '2026/02' && o.discipline_enrollments > 0 && (o.discipline?.includes('PRÁTICA') || o.discipline?.includes('PRATICA')));
  const totalEstagio = est262.reduce((s, o) => s + o.discipline_enrollments, 0);
  // Estágio histórico
  const estBySem: Record<string, number> = {};
  for (const o of outcomes) {
    if (o.discipline_enrollments > 0 && (o.discipline?.includes('PRÁTICA') || o.discipline?.includes('PRATICA'))) {
      estBySem[o.semester] = (estBySem[o.semester] || 0) + o.discipline_enrollments;
    }
  }

  const totalMatric262 = evolucao.find(e => e.semestre === '2026/02')?.matriculados || 353;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* VAGAS OCIOSAS */}
    <div style={card}>
      <strong style={{ fontSize: '1.1rem' }}>📊 Vagas Ociosas — Evolução Anual</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '4px 0 12px' }}>Vagas autorizadas: <strong>{VAGAS_ANUAIS}/ano</strong>. Ingressantes = alunos que entraram no 1º período (não conta reposição de estoque a partir do 2º período).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Ano', '1º sem', '2º sem', 'Total ingress.', 'Vagas', 'Ociosas', 'Excedente', 'Ocupação'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{vagasData.map((v, i) => (
          <tr key={i} style={{ background: v.ociosas > 0 ? '#fef2f2' : v.excedente > 30 ? '#f0fdf4' : undefined }}>
            <td style={{ ...td, fontWeight: 800, fontSize: '.95rem' }}>{v.ano}</td>
            <td style={tdR}>{v.s1 || '—'}</td>
            <td style={tdR}>{v.s2 || '—'}</td>
            <td style={{ ...tdR, fontWeight: 700, color: '#2563eb' }}>{v.total}</td>
            <td style={tdR}>{VAGAS_ANUAIS}</td>
            <td style={{ ...tdR, fontWeight: 800, color: v.ociosas > 0 ? '#dc2626' : '#16a34a' }}>{v.ociosas > 0 ? v.ociosas : '—'}</td>
            <td style={{ ...tdR, fontWeight: 700, color: v.excedente > 0 ? '#16a34a' : '#64748b' }}>{v.excedente > 0 ? `+${v.excedente}` : '—'}</td>
            <td style={tdR}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <div style={{ width: 60, height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: 8, borderRadius: 4, background: v.pctOcupacao >= 100 ? '#16a34a' : v.pctOcupacao >= 70 ? '#f59e0b' : '#dc2626', width: `${Math.min(100, v.pctOcupacao)}%` }} />
                </div>
                <strong style={{ color: v.pctOcupacao >= 100 ? '#16a34a' : '#dc2626' }}>{v.pctOcupacao}%</strong>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: vagasData[0].ociosas > 0 ? 'linear-gradient(135deg, #fef2f2, #fffbeb)' : 'linear-gradient(135deg, #f0fdf4, #eff6ff)' }}>
        <strong>Resumo:</strong> Em 2023 houve <strong style={{ color: '#dc2626' }}>35 vagas ociosas</strong> (primeiro vestibular, 40 ingressantes de 75). A partir de 2024 o curso <strong style={{ color: '#16a34a' }}>superou as vagas todos os anos</strong>. Em 2026: 152 ingressantes para 75 vagas = <strong style={{ color: '#16a34a' }}>+77 excedente (203% de ocupação)</strong>.
        <br/><span style={{ fontSize: '.8rem', color: '#64748b' }}>Total de vagas ociosas acumuladas desde 2023: <strong>35</strong> (apenas no 1º ano).</span>
      </div>
    </div>

    {/* EXTENSÃO */}
    <div style={card}>
      <strong style={{ fontSize: '1.1rem' }}>🤝 Extensão (CE) — Alunos Matriculados</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '4px 0 12px' }}>Disciplinas com código (CE) ou Projeto Integrador = extensão curricular. Res. 7/2018 exige 10% da carga.</p>

      {/* 2026/02 destaque */}
      <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#059669' }}>2026/02 — {totalExtensao} alunos em extensão</strong>
          <span style={badge('#059669')}>{Math.round(100 * totalExtensao / totalMatric262)}% dos matriculados</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8, marginTop: 10 }}>
          {ce262.map((d, i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '.8rem' }}>{d.discipline}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span style={badge('#2563eb')}>{d.discipline_enrollments} alunos</span>
                <span style={badge('#64748b')}>{d.class_label} · {d.academic_period}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evolução histórica */}
      <strong style={{ fontSize: '.85rem' }}>Evolução por semestre</strong>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead><tr>{['Semestre', 'Disciplinas CE', 'Matrículas em CE', 'Total curso', '% em extensão'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{Object.entries(ceBySem).sort(([a],[b]) => a.localeCompare(b)).map(([sem, d]) => {
          const evSem = evolucao.find(e => e.semestre === sem);
          const matSem = evSem?.matriculados || evSem?.total_matriculados || 1;
          const pct = Math.round(100 * d.total / matSem);
          return <tr key={sem}>
            <td style={{ ...td, fontWeight: 700 }}>{sem}</td>
            <td style={tdR}>{d.discs.length}</td>
            <td style={{ ...tdR, fontWeight: 700, color: '#059669' }}>{d.total}</td>
            <td style={tdR}>{matSem}</td>
            <td style={{ ...tdR, fontWeight: 700, color: pct >= 30 ? '#16a34a' : pct >= 10 ? '#f59e0b' : '#dc2626' }}>{pct}%</td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {/* ESTÁGIO */}
    <div style={card}>
      <strong style={{ fontSize: '1.1rem' }}>⚖ Estágio (Prática Jurídica) — Alunos Matriculados</strong>
      <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '4px 0 12px' }}>Prática Simulada (a partir do 6º per.) + Prática Real / NPJ (a partir do 8º per.)</p>

      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ color: '#2563eb' }}>2026/02 — {totalEstagio} alunos em prática jurídica</strong>
          <span style={badge('#2563eb')}>{Math.round(100 * totalEstagio / totalMatric262)}% dos matriculados</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8, marginTop: 10 }}>
          {est262.map((d, i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '.8rem' }}>{d.discipline}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span style={badge(d.discipline_enrollments > 0 ? '#2563eb' : '#dc2626')}>{d.discipline_enrollments} alunos</span>
                <span style={badge('#64748b')}>{d.class_label} · {d.academic_period}</span>
                {d.rf > 0 && <span style={badge('#dc2626')}>{d.rf} RF</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evolução histórica */}
      <strong style={{ fontSize: '.85rem' }}>Evolução por semestre</strong>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead><tr>{['Semestre', 'Matrículas estágio'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{Object.entries(estBySem).sort(([a],[b]) => a.localeCompare(b)).map(([sem, total]) => (
          <tr key={sem}><td style={{ ...td, fontWeight: 700 }}>{sem}</td><td style={{ ...tdR, fontWeight: 700, color: '#2563eb' }}>{total}</td></tr>
        ))}</tbody>
      </table>

      <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: '.8rem', color: '#64748b' }}>
        NPJ (Prática Real I) iniciou em 2026/02 com 13 alunos. Prática Real II e III estão com turma vazia (DIR-9A e DIR-10A) — primeiros alunos chegarão em 2027.
      </div>
    </div>
  </div>;
}

/* ============ ALERTAS 2026/02 ============ */
function Alertas262Tab({ outcomes, evolucao }: { outcomes: any[]; evolucao: any[] }) {
  const sem = '2026/02';
  const rows = outcomes.filter(o => o.semester === sem && o.discipline_enrollments > 0);
  const ev = evolucao.find(e => e.semestre === sem);
  const totalAlunos = ev?.matriculados || ev?.total_matriculados || 353;

  // Disciplinas com RF já registrado
  const comRF = rows.filter(r => r.rf > 0).sort((a, b) => b.rf - a.rf);
  const totalRF = comRF.reduce((s, r) => s + r.rf, 0);

  // Disciplinas sem nenhuma nota (avg_final null e passed_direct = 0) — AV1 não aplicada
  const semNota = rows.filter(r => !r.avg_final && r.passed_direct === 0 && r.rf === 0);

  // Disciplinas com nota já lançada (parcial)
  const comNota = rows.filter(r => r.avg_final || r.passed_direct > 0);

  // Turmas com maior número de TR (transferidos = saídas no semestre)
  const trByTurma: Record<string, number> = {};
  for (const r of rows) {
    const trMatch = r.other_status?.match(/TR:(\d+)/);
    if (trMatch) trByTurma[r.class_label] = Math.max(trByTurma[r.class_label] || 0, parseInt(trMatch[1]));
  }

  // Períodos com dados
  const periodos = [...new Set(rows.map(r => r.academic_period))].sort();
  const byPeriodo: Record<string, typeof rows> = {};
  for (const r of rows) { if (!byPeriodo[r.academic_period]) byPeriodo[r.academic_period] = []; byPeriodo[r.academic_period].push(r); }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* Header de alerta */}
    <div style={{ ...card, borderLeft: '4px solid #dc2626', background: 'linear-gradient(135deg, #fef2f2, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: '1.2rem', color: '#dc2626' }}>🚨 Painel de Alerta — 2026/02 (Semestre em Curso)</strong>
          <p style={{ fontSize: '.85rem', color: '#64748b', margin: '4px 0 0' }}>Dados parciais: semestre em andamento. O que já sabemos agora e exige ação imediata.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{totalRF}</div>
          <div style={{ fontSize: '.7rem', color: '#64748b' }}>RF já registrados</div>
        </div>
      </div>
    </div>

    {/* KPIs rápidos */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
      {[
        { label: 'Matriculados', value: totalAlunos, color: '#2563eb' },
        { label: 'Disciplinas ofertadas', value: rows.length, color: '#7c3aed' },
        { label: 'Com RF registrado', value: comRF.length, color: '#dc2626', bad: true },
        { label: 'Alunos c/ falta', value: totalRF, color: '#dc2626', bad: true },
        { label: 'Sem AV1 lançada', value: semNota.length, color: '#f59e0b' },
        { label: 'Períodos ativos', value: periodos.length, color: '#0891b2' },
      ].map((k, i) => (
        <div key={i} style={{ ...card, padding: '10px 12px', borderLeft: `3px solid ${k.color}`, background: k.bad ? '#fef2f2' : undefined }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color }}>{k.value}</div>
          <div style={{ fontSize: '.65rem', color: '#64748b', marginTop: 2 }}>{k.label}</div>
        </div>
      ))}
    </div>

    {/* ALERTA 1: Disciplinas com RF — ação URGENTE */}
    {comRF.length > 0 && <div style={{ ...card, borderLeft: '4px solid #dc2626' }}>
      <strong style={{ color: '#dc2626' }}>🔴 URGENTE — {totalRF} alunos já com reprovação por falta em andamento</strong>
      <p style={{ fontSize: '.8rem', color: '#64748b', margin: '4px 0 10px' }}>Estas disciplinas já registram RF no diário. Alunos pararam de frequentar. Busca ativa imediata.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Disciplina','Professor','Turma','Per.','Alunos','RF','CR','Situação'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{comRF.map((r, i) => {
          const crMatch = r.other_status?.match(/CR:(\d+)/);
          const cr = crMatch ? parseInt(crMatch[1]) : 0;
          const pctRF = r.discipline_enrollments > 0 ? Math.round(100 * r.rf / r.discipline_enrollments) : 0;
          return <tr key={i} style={{ background: '#fef2f2' }}>
            <td style={{ ...td, fontWeight: 700, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.discipline}>{r.discipline}</td>
            <td style={{ ...td, fontSize: '.7rem', maxWidth: 140 }} title={r.teachers}>{r.teachers?.split(' ').slice(0, 3).join(' ')}</td>
            <td style={td}>{r.class_label}</td>
            <td style={tdR}>{r.academic_period}</td>
            <td style={tdR}>{r.discipline_enrollments}</td>
            <td style={{ ...tdR, fontWeight: 800, color: '#dc2626', fontSize: '.95rem' }}>{r.rf}</td>
            <td style={{ ...tdR, color: '#2563eb' }}>{cr}</td>
            <td style={td}><span style={badge(pctRF > 25 ? '#dc2626' : '#f59e0b')}>{pctRF}% faltando</span></td>
          </tr>;
        })}</tbody>
      </table>
      <div style={{ marginTop: 10, padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>
        📌 <strong>Ação imediata:</strong> Contatar os {totalRF} alunos com RF por WhatsApp/telefone AGORA. Perguntar: "O que está acontecendo? Precisa de ajuda?" Notificar cada professor. Ativar tutoria emergencial.
      </div>
    </div>}

    {/* ALERTA 2: Turmas superlotadas no 4º período */}
    <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
      <strong style={{ color: '#f59e0b' }}>⚠ ATENÇÃO — DIR-4A com 53 alunos (133% da capacidade ideal)</strong>
      <p style={{ fontSize: '.8rem', color: '#64748b', margin: '4px 0 10px' }}>Turma mais lotada do semestre. 7 disciplinas para 49-53 alunos em uma única sala.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {rows.filter(r => r.class_label === 'DIR-4A').map((r, i) => {
          const crM = r.other_status?.match(/CR:(\d+)/); const trM = r.other_status?.match(/TR:(\d+)/);
          return <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: r.rf > 0 ? '#fef2f2' : '#f8fafc', border: '1px solid #e2e8f0', fontSize: '.75rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.discipline?.split('(')[0]?.substring(0, 35)}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span style={badge('#2563eb')}>{r.discipline_enrollments} alunos</span>
              {r.rf > 0 && <span style={badge('#dc2626')}>{r.rf} RF</span>}
              {crM && <span style={badge('#16a34a')}>{crM[1]} cursando</span>}
              {trM && <span style={badge('#64748b')}>{trM[1]} transf.</span>}
            </div>
          </div>;
        })}
      </div>
    </div>

    {/* Visão por período */}
    <div style={card}>
      <strong>📚 Situação por Período — 2026/02</strong>
      <p style={{ fontSize: '.8rem', color: '#64748b', margin: '4px 0 12px' }}>Cada período com suas disciplinas, status dos alunos e alertas</p>
      {periodos.map(per => {
        const perRows = byPeriodo[per] || [];
        const maxEnroll = Math.max(...perRows.map(r => r.discipline_enrollments));
        const perRF = perRows.reduce((s, r) => s + r.rf, 0);
        const perTR = perRows.reduce((s, r) => { const m = r.other_status?.match(/TR:(\d+)/); return s + (m ? parseInt(m[1]) : 0); }, 0);
        const perCR = perRows.reduce((s, r) => { const m = r.other_status?.match(/CR:(\d+)/); return s + (m ? parseInt(m[1]) : 0); }, 0);
        const hasNota = perRows.some(r => r.avg_final);
        return <div key={per} style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: perRF > 5 ? '#fef2f2' : '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{per} período</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={badge('#2563eb')}>~{maxEnroll} alunos</span>
              <span style={badge('#16a34a')}>{perRows.length} disciplinas</span>
              {perRF > 0 && <span style={badge('#dc2626')}>{perRF} RF</span>}
              {!hasNota && <span style={badge('#f59e0b')}>Sem AV1</span>}
              {hasNota && <span style={badge('#16a34a')}>AV1 lançada</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {perRows.map((r, j) => (
              <span key={j} style={{ padding: '3px 8px', borderRadius: 6, fontSize: '.65rem', fontWeight: 600, background: r.rf > 0 ? '#fee2e2' : r.avg_final ? '#dcfce7' : '#f1f5f9', color: r.rf > 0 ? '#dc2626' : r.avg_final ? '#16a34a' : '#64748b', border: '1px solid ' + (r.rf > 0 ? '#fecaca' : r.avg_final ? '#bbf7d0' : '#e2e8f0') }}
                title={`${r.discipline} — ${r.teachers}`}>
                {r.discipline?.split(' ').slice(0, 3).join(' ')}{r.rf > 0 ? ` ⚠${r.rf}RF` : ''}{r.avg_final ? ` ✓${r.avg_final}` : ''}
              </span>
            ))}
          </div>
        </div>;
      })}
    </div>

    {/* Estratégia para reunião */}
    <div style={{ ...card, borderLeft: '4px solid #059669', background: 'linear-gradient(135deg, #f0fdf4, #fff)' }}>
      <strong style={{ fontSize: '1.05rem', color: '#059669' }}>🎯 Estratégia para Reunião — O que apresentar sobre 2026/02</strong>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <strong>1. Situação geral:</strong>
          <p style={{ fontSize: '.85rem', margin: '4px 0', lineHeight: 1.6 }}>353 matriculados em {periodos.length} períodos (1º ao {periodos[periodos.length-1]?.replace('º','')}º). Semestre em curso — maioria das notas ainda não lançada (CR = cursando). {comNota.length} disciplinas com avaliação parcial, {semNota.length} sem nenhuma nota.</p>
        </div>
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
          <strong style={{ color: '#dc2626' }}>2. Alerta vermelho — {totalRF} alunos já faltando:</strong>
          <p style={{ fontSize: '.85rem', margin: '4px 0', lineHeight: 1.6 }}>
            {comRF.map(r => `${r.discipline?.split('(')[0]?.trim()} (${r.class_label}): ${r.rf} alunos com RF`).join('. ')}.
            Pior caso: <strong>Formas Consensuais (DIR-4A): 16 RF</strong> de 53 alunos (30%). Segundo: <strong>Linguagem Jurídica (DIR-1A): 8 RF</strong> de 36.
          </p>
          <p style={{ fontSize: '.85rem', margin: '4px 0', color: '#dc2626', fontWeight: 600 }}>→ Ação: busca ativa imediata dos {totalRF} alunos. Se não houver intervenção, projeta-se ~{Math.round(totalRF * 1.5)} RF ao final do semestre (padrão histórico: RF duplica na 2ª metade).</p>
        </div>
        <div style={{ padding: 12, background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
          <strong style={{ color: '#f59e0b' }}>3. DIR-4A superlotada:</strong>
          <p style={{ fontSize: '.85rem', margin: '4px 0', lineHeight: 1.6 }}>53 alunos em 7 disciplinas no 4º período. É a turma que veio do grande ingresso de 2025/01 + rematrículas. 16 já faltando em Formas Consensuais. Lotação 133% do ideal.</p>
          <p style={{ fontSize: '.85rem', margin: '4px 0', color: '#f59e0b', fontWeight: 600 }}>→ Ação: avaliar desdobramento de turma para 2027/01 (DIR-4A + DIR-4B).</p>
        </div>
        <div style={{ padding: 12, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
          <strong style={{ color: '#2563eb' }}>4. Pontos positivos:</strong>
          <p style={{ fontSize: '.85rem', margin: '4px 0', lineHeight: 1.6 }}>
            Curso atingiu {periodos.length} períodos simultâneos pela primeira vez. 353 matriculados — recorde. Taxa de trancamento em 2026/02 é apenas 4% (a mais baixa da história do curso). 8º período já funcionando com NPJ (Prática Real I). O curso está se consolidando.
          </p>
        </div>
        <div style={{ padding: 12, background: '#f5f3ff', borderRadius: 10, border: '1px solid #c4b5fd' }}>
          <strong style={{ color: '#7c3aed' }}>5. Próximos passos:</strong>
          <ul style={{ fontSize: '.85rem', margin: '4px 0', lineHeight: 1.8, paddingLeft: 20 }}>
            <li>Busca ativa dos {totalRF} alunos com RF registrado</li>
            <li>Monitorar AV1 nas disciplinas que ainda não lançaram nota</li>
            <li>Planejar desdobramento DIR-4A para 2027/01</li>
            <li>Acompanhar DIR-8A (NPJ) — primeira turma em prática real</li>
            <li>Repetir esta análise após AV1 para projetar resultado final</li>
          </ul>
        </div>
      </div>
    </div>
  </div>;
}