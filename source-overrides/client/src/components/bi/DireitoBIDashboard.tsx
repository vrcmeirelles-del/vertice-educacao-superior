// DireitoBIDashboard.tsx — BI completo do curso de Direito
// Evolução, evasão, ensalamento, reprovações, professores, notas
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '../area/egressos360.css';

interface Props { institutionId: string; courseId: string; courseCode: string; vacancies: number; }

export default function DireitoBIDashboard({ institutionId, courseId, courseCode, vacancies }: Props) {
  const [evolucao, setEvolucao] = useState<any[]>([]);
  const [ensalamento, setEnsalamento] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [profsPerSem, setProfsPerSem] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'evolucao'|'ensalamento'|'profs'|'notas'|'semestre'>('evolucao');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      // Evolução quantitativa
      supabase.from('vertice_academic_reports').select('payload,source_report_at').eq('institution_id', institutionId).eq('course_id', courseId).eq('kind', 'quantitativo_alunos').order('source_report_at', { ascending: true }),
      // Ensalamento
      supabase.from('vertice_turma_stats').select('semestre,serie,turma,matriculados').eq('institution_id', institutionId).eq('codigo', courseCode).order('semestre', { ascending: true }),
      // Offering outcomes completo
      supabase.from('vertice_offering_outcomes').select('semester,teachers,discipline,class_label,academic_period,discipline_enrollments,passed_direct,passed_final,rf,rn,ra,avg_final').eq('institution_id', institutionId).eq('course_code', courseCode).gte('semester', '2023/01').order('semester', { ascending: true }),
    ]).then(([evR, enR, ofR]) => {
      if (evR.data) setEvolucao(evR.data.map((d: any) => ({ ...d.payload, date: d.source_report_at })));
      if (enR.data) setEnsalamento(enR.data);
      if (ofR.data) {
        const rows = ofR.data as any[];
        // Aggregate by professor
        const byProf: Record<string, any> = {};
        const bySemProf: Record<string, Record<string, any>> = {};
        for (const r of rows) {
          if (!r.teachers || r.discipline_enrollments === 0) continue;
          const k = r.teachers;
          if (!byProf[k]) byProf[k] = { nome: k, turmas: 0, alunos: 0, ad: 0, af: 0, rf: 0, rn: 0, ra: 0, total_rep: 0, somas: 0, n: 0 };
          byProf[k].turmas++;
          byProf[k].alunos += r.discipline_enrollments;
          byProf[k].ad += r.passed_direct;
          byProf[k].af += r.passed_final;
          byProf[k].rf += r.rf;
          byProf[k].rn += r.rn;
          byProf[k].ra += r.ra;
          byProf[k].total_rep += r.rf + r.rn + r.ra;
          if (r.avg_final) { byProf[k].somas += parseFloat(r.avg_final); byProf[k].n++; }
          // Per semester
          if (!bySemProf[r.semester]) bySemProf[r.semester] = {};
          const sk = r.semester;
          if (!bySemProf[sk][k]) bySemProf[sk][k] = { nome: k, turmas: 0, alunos: 0, rf: 0, rn: 0, ra: 0, total_rep: 0, somas: 0, n: 0 };
          bySemProf[sk][k].turmas++;
          bySemProf[sk][k].alunos += r.discipline_enrollments;
          bySemProf[sk][k].rf += r.rf;
          bySemProf[sk][k].rn += r.rn;
          bySemProf[sk][k].ra += r.ra;
          bySemProf[sk][k].total_rep += r.rf + r.rn + r.ra;
          if (r.avg_final) { bySemProf[sk][k].somas += parseFloat(r.avg_final); bySemProf[sk][k].n++; }
        }
        const profArr = Object.values(byProf).map((p: any) => ({
          ...p,
          media: p.n > 0 ? Math.round(100 * p.somas / p.n) / 100 : null,
          pct_rep: p.alunos > 0 ? Math.round(1000 * p.total_rep / p.alunos) / 10 : 0,
          pct_ad: p.alunos > 0 ? Math.round(1000 * p.ad / p.alunos) / 10 : 0,
        })).sort((a: any, b: any) => b.alunos - a.alunos);
        setProfs(profArr);
        // Flatten per-sem
        const semArr: any[] = [];
        for (const [sem, profs] of Object.entries(bySemProf)) {
          for (const p of Object.values(profs) as any[]) {
            semArr.push({ sem, ...p, media: p.n > 0 ? Math.round(100 * p.somas / p.n) / 100 : null, pct: p.alunos > 0 ? Math.round(1000 * p.total_rep / p.alunos) / 10 : 0 });
          }
        }
        setProfsPerSem(semArr);
      }
    }).finally(() => setLoading(false));
  }, [institutionId, courseId, courseCode]);

  if (loading) return <p className="alumni-loading">Carregando BI do Direito…</p>;

  const tabs = [
    { key: 'evolucao', label: '📈 Evolução' },
    { key: 'ensalamento', label: '🏫 Ensalamento' },
    { key: 'profs', label: '🔴 Professores' },
    { key: 'notas', label: '🏆 Notas Altas' },
    { key: 'semestre', label: '📅 Por Semestre' },
  ] as const;

  // Professors that never fail and always give high grades
  const notasAltas = profs.filter(p => p.total_rep === 0 && p.media !== null && p.alunos >= 20).sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  // Top reprovadores
  const topRep = [...profs].filter(p => p.total_rep > 0).sort((a, b) => b.total_rep - a.total_rep).slice(0, 12);

  return (
    <div className="alumni-360">
      <header className="alumni-header"><h2>📊 BI Analítico — Direito</h2><p className="alumni-subtitle">Cruzamento completo: evolução, evasão, ensalamento, reprovações e desempenho docente</p></header>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '1rem 0' }}>
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '6px 14px', borderRadius: 20, border: tab === t.key ? '2px solid var(--vx-accent, #2563eb)' : '1px solid var(--vx-border, #e2e8f0)', background: tab === t.key ? 'var(--vx-accent, #2563eb)' : 'var(--vx-surface, #fff)', color: tab === t.key ? '#fff' : 'inherit', fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>)}
      </div>

      {tab === 'evolucao' && <EvolucaoTab data={evolucao} vacancies={vacancies} />}
      {tab === 'ensalamento' && <EnsalamentoTab data={ensalamento} vacancies={vacancies} />}
      {tab === 'profs' && <ProfsTab data={topRep} />}
      {tab === 'notas' && <NotasAltasTab data={notasAltas} allProfs={profs} />}
      {tab === 'semestre' && <SemestreTab data={profsPerSem} />}
    </div>
  );
}

function EvolucaoTab({ data, vacancies }: { data: any[]; vacancies: number }) {
  if (!data.length) return <p>Sem dados de evolução.</p>;
  const maxMat = Math.max(...data.map(e => e.matriculados || e.total_matriculados || 0));
  return <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <strong>Evolução Semestral — Matrículas vs Evasão</strong>
    <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead><tr style={{ borderBottom: '2px solid var(--vx-border, #e2e8f0)', fontSize: '.75rem' }}>
        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Semestre</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Total</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Matric.</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Tranc.</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Cancel.</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Transf.</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Evasão</th>
        <th style={{ width: '25%', padding: '6px 4px' }}>Gráfico</th>
      </tr></thead>
      <tbody>{data.map((e: any, i: number) => {
        const m = e.matriculados || e.total_matriculados || 0;
        const t = e.trancados || e.trancado || 0;
        const c = e.cancelados || e.cancelado || 0;
        const tr = e.transferidos || e.transferido || 0;
        const total = e.total || e.total_vinculos || (m + t + c + tr);
        const evasao = total > 0 ? Math.round(100 * (t + c + tr) / total) : 0;
        const barW = maxMat > 0 ? Math.round(100 * m / maxMat) : 0;
        const evasaoW = total > 0 ? Math.round(100 * (t + c) / total) : 0;
        return <tr key={i} style={{ borderBottom: '1px solid var(--vx-border, #f1f5f9)' }}>
          <td style={{ padding: '5px 4px', fontWeight: 700 }}>{e.semestre || ''}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{total}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#2563eb', fontWeight: 700 }}>{m}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: t > 30 ? '#dc2626' : '#64748b' }}>{t}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: c > 10 ? '#dc2626' : '#64748b' }}>{c}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#64748b' }}>{tr}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 800, color: evasao > 30 ? '#dc2626' : evasao > 15 ? '#f59e0b' : '#16a34a' }}>{evasao}%</td>
          <td style={{ padding: '5px 4px' }}>
            <div style={{ display: 'flex', gap: 1, height: 16, borderRadius: 3, overflow: 'hidden', background: '#f1f5f9' }}>
              <div style={{ width: `${barW}%`, background: '#2563eb', transition: 'width .3s' }} />
              <div style={{ width: `${evasaoW}%`, background: '#fca5a5', transition: 'width .3s' }} />
            </div>
          </td>
        </tr>;
      })}</tbody>
    </table>
    <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)', display: 'flex', gap: 12 }}>
      <span>🟦 Matriculados</span><span>🟥 Trancados+Cancelados</span>
      <span>Vagas: {vacancies}/sem ({vacancies * 2}/ano)</span>
    </div>
    {data.length >= 2 && (() => {
      const first = data[0]; const last = data[data.length - 1];
      const m0 = first.matriculados || first.total_matriculados || 1;
      const mN = last.matriculados || last.total_matriculados || 0;
      const crescimento = Math.round(100 * (mN - m0) / m0);
      return <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', borderRadius: 8, fontSize: '.8rem' }}>
        <strong>Crescimento:</strong> {m0} → {mN} matriculados ({crescimento > 0 ? '+' : ''}{crescimento}%). Evasão caiu de {data[0].total > 0 ? Math.round(100 * ((data[0].trancados || 0) + (data[0].cancelados || 0)) / data[0].total) : '?'}% para {last.total > 0 ? Math.round(100 * ((last.trancados || last.trancado || 0) + (last.cancelados || last.cancelado || 0)) / (last.total || last.total_vinculos || 1)) : '?'}%.
      </div>;
    })()}
  </div>;
}

function EnsalamentoTab({ data, vacancies }: { data: any[]; vacancies: number }) {
  const bySem: Record<string, { turmas: { turma: string; serie: number; mat: number }[]; total: number }> = {};
  for (const e of data) {
    if (!bySem[e.semestre]) bySem[e.semestre] = { turmas: [], total: 0 };
    bySem[e.semestre].turmas.push({ turma: e.turma, serie: e.serie, mat: e.matriculados });
    bySem[e.semestre].total += e.matriculados;
  }
  const sems = Object.entries(bySem).sort(([a], [b]) => a.localeCompare(b));
  const maxPeriodo = Math.max(...data.map(e => e.serie));

  return <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <strong>Ensalamento — Turmas e Vagas por Semestre</strong>
    <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead><tr style={{ borderBottom: '2px solid var(--vx-border, #e2e8f0)' }}>
        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Semestre</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Turmas</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alunos</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Períodos</th>
        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Composição</th>
      </tr></thead>
      <tbody>{sems.map(([sem, d]) => {
        const periodos = new Set(d.turmas.map(t => t.serie)).size;
        return <tr key={sem} style={{ borderBottom: '1px solid var(--vx-border, #f1f5f9)' }}>
          <td style={{ padding: '5px 4px', fontWeight: 700 }}>{sem}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{d.turmas.length}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#2563eb', fontWeight: 700 }}>{d.total}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{periodos}</td>
          <td style={{ padding: '5px 8px', fontSize: '.6875rem', color: '#64748b' }}>{d.turmas.sort((a, b) => a.serie - b.serie).map(t => `${t.turma}(${t.mat})`).join(' · ')}</td>
        </tr>;
      })}</tbody>
    </table>
    <div style={{ marginTop: 12, padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: '.8rem' }}>
      <strong>Vagas autorizadas:</strong> {vacancies}/semestre ({vacancies * 2}/ano). Curso atingiu {maxPeriodo}º período em {sems[sems.length - 1]?.[0]}. Cresceu de {sems[0]?.[1].turmas.length} turma para {sems[sems.length - 1]?.[1].turmas.length} turmas.
    </div>
  </div>;
}

function ProfsTab({ data }: { data: any[] }) {
  return <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <strong>🔴 Professores que mais reprovam (acumulado desde 2023)</strong>
    <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead><tr style={{ borderBottom: '2px solid var(--vx-border, #e2e8f0)' }}>
        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Professor</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alunos</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RF</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RN</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RA</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Total</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>%</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Média</th>
        <th style={{ width: '18%', padding: '6px 4px' }}>Perfil</th>
      </tr></thead>
      <tbody>{data.map((p, i) => {
        const mainType = p.rf >= p.rn && p.rf >= p.ra ? 'falta' : p.rn >= p.ra ? 'nota' : 'ambos';
        const profileLabel = mainType === 'falta' ? '⚡ Falta' : mainType === 'nota' ? '📝 Nota' : '💀 Ambos';
        const profileColor = mainType === 'falta' ? '#f59e0b' : mainType === 'nota' ? '#7c3aed' : '#dc2626';
        return <tr key={i} style={{ borderBottom: '1px solid var(--vx-border, #f1f5f9)' }}>
          <td style={{ padding: '5px 4px', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.alunos}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#f59e0b', fontWeight: p.rf > 10 ? 700 : 400 }}>{p.rf}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#7c3aed', fontWeight: p.rn > 10 ? 700 : 400 }}>{p.rn}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#dc2626', fontWeight: p.ra > 5 ? 700 : 400 }}>{p.ra}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 800, color: p.total_rep > 30 ? '#dc2626' : '#1e293b' }}>{p.total_rep}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 800, color: p.pct_rep > 20 ? '#dc2626' : p.pct_rep > 10 ? '#f59e0b' : '#16a34a' }}>{p.pct_rep}%</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: (p.media ?? 0) < 7 ? '#dc2626' : '#16a34a' }}>{p.media ?? '—'}</td>
          <td style={{ padding: '5px 4px' }}><span style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 12, background: profileColor + '18', color: profileColor, fontWeight: 600 }}>{profileLabel}</span></td>
        </tr>;
      })}</tbody>
    </table>
    <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--vx-muted, #64748b)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <span>⚡ Falta = evasão silenciosa</span><span>📝 Nota = rigor avaliativo</span><span>💀 Ambos = aluno desiste E não atinge nota</span>
    </div>
    <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', borderRadius: 8, fontSize: '.8rem' }}>
      <strong>Atenção:</strong> Professores com perfil "⚡ Falta" alto indicam que alunos desistem da disciplina antes mesmo de serem avaliados. Cruzar com evasão por período.
    </div>
  </div>;
}

function NotasAltasTab({ data, allProfs }: { data: any[]; allProfs: any[] }) {
  // Also show professors who never give failures
  const neverFail = allProfs.filter(p => p.total_rep === 0 && p.alunos >= 10 && p.media !== null).sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  return <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <strong>🏆 Professores que nunca reprovam e dão notas altas</strong>
    <p style={{ fontSize: '.8rem', color: 'var(--vx-muted, #64748b)', margin: '6px 0 12px' }}>Zero reprovações (RF=0, RN=0, RA=0) em todo o histórico desde 2023. Mínimo 10 alunos.</p>
    <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse' }}>
      <thead><tr style={{ borderBottom: '2px solid var(--vx-border, #e2e8f0)' }}>
        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Professor</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alunos</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Turmas</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Aprov.Direto</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>% AD</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Média</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Reprov.</th>
        <th style={{ width: '15%', padding: '6px 4px' }}>Sinal</th>
      </tr></thead>
      <tbody>{neverFail.map((p, i) => {
        const signal = (p.media ?? 0) >= 9.5 ? '🔶 Média ≥9.5' : (p.media ?? 0) >= 8.5 ? '🟡 Alta' : '🟢 Normal';
        const sigColor = (p.media ?? 0) >= 9.5 ? '#f59e0b' : (p.media ?? 0) >= 8.5 ? '#eab308' : '#16a34a';
        return <tr key={i} style={{ borderBottom: '1px solid var(--vx-border, #f1f5f9)' }}>
          <td style={{ padding: '5px 4px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.alunos}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.turmas}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.ad}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 700, color: '#2563eb' }}>{p.pct_ad}%</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 800, color: (p.media ?? 0) >= 9.5 ? '#f59e0b' : '#16a34a' }}>{p.media}</td>
          <td style={{ textAlign: 'right', padding: '5px 4px', color: '#16a34a', fontWeight: 700 }}>0</td>
          <td style={{ padding: '5px 4px' }}><span style={{ fontSize: '.6875rem', padding: '2px 8px', borderRadius: 12, background: sigColor + '18', color: sigColor, fontWeight: 600 }}>{signal}</span></td>
        </tr>;
      })}</tbody>
    </table>
    <div style={{ marginTop: 12, padding: 10, background: '#fffbeb', borderRadius: 8, fontSize: '.8rem' }}>
      <strong>Interpretação:</strong> Média ≥9.5 com zero reprovação em múltiplos semestres pode indicar avaliação branda. Não é necessariamente negativo — pode ser excelência pedagógica. Mas o avaliador do INEP observa discrepância entre professores do mesmo curso. {neverFail.some(p => (p.media ?? 0) >= 9.8) && <><br/><span style={{ color: '#dc2626' }}>⚠ Há professor(es) com média ≥9.8 — discrepância significativa com colegas que ficam em 6-7.</span></>}
    </div>
  </div>;
}

function SemestreTab({ data }: { data: any[] }) {
  const semesters = [...new Set(data.map(d => d.sem))].sort();
  const [selSem, setSelSem] = useState(semesters[semesters.length - 2] || semesters[0] || '');
  const filtered = data.filter(d => d.sem === selSem && d.alunos > 0).sort((a, b) => b.total_rep - a.total_rep);
  return <div style={{ background: 'var(--vx-surface, #fff)', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 10, padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <strong>📅 Professores por Semestre</strong>
      <select value={selSem} onChange={e => setSelSem(e.target.value)} style={{ padding: '4px 10px', border: '1px solid var(--vx-border, #e2e8f0)', borderRadius: 6, fontSize: '.8rem' }}>
        {semesters.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse' }}>
      <thead><tr style={{ borderBottom: '2px solid var(--vx-border, #e2e8f0)' }}>
        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Professor</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Turmas</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alunos</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RF</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RN</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>RA</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>% Rep.</th>
        <th style={{ textAlign: 'right', padding: '6px 4px' }}>Média</th>
      </tr></thead>
      <tbody>{filtered.map((p, i) => <tr key={i} style={{ borderBottom: '1px solid var(--vx-border, #f1f5f9)', background: p.total_rep > 10 ? '#fef2f2' : undefined }}>
        <td style={{ padding: '5px 4px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.turmas}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.alunos}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px', color: p.rf > 0 ? '#f59e0b' : '#64748b' }}>{p.rf}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px', color: p.rn > 0 ? '#7c3aed' : '#64748b' }}>{p.rn}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px', color: p.ra > 0 ? '#dc2626' : '#64748b' }}>{p.ra}</td>
        <td style={{ textAlign: 'right', padding: '5px 4px', fontWeight: 800, color: p.pct > 20 ? '#dc2626' : p.pct > 10 ? '#f59e0b' : '#16a34a' }}>{p.pct}%</td>
        <td style={{ textAlign: 'right', padding: '5px 4px' }}>{p.media ?? '—'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
