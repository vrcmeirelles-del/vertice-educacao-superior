/**
 * ExtensaoConformidade — Checklist regulatório DCN/MEC/INEP
 * Verifica conformidade dos projetos com requisitos de extensão
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface CheckItem {
  id: string;
  category: string;
  requirement: string;
  reference: string;
  status: 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel';
  detail: string;
  severity: 'critico' | 'alto' | 'medio' | 'baixo';
}

const CATEGORIES = [
  { key: 'curricularizacao', label: '📚 Curricularização', ref: 'Resolução CNE/CES nº 7/2018, Art. 4º' },
  { key: 'carga_horaria', label: '⏱ Carga Horária', ref: 'Resolução CNE/CES nº 7/2018, Art. 4º, §2º' },
  { key: 'comunidade', label: '👥 Interação com Comunidade', ref: 'Resolução CNE/CES nº 7/2018, Art. 5º' },
  { key: 'registro', label: '📋 Registro e Acompanhamento', ref: 'Instrumento de Avaliação INEP, Dimensão 5' },
  { key: 'avaliacao', label: '📊 Avaliação e Evidências', ref: 'Instrumento de Avaliação INEP, Indicador 5.3' },
  { key: 'politica', label: '📜 Política Institucional', ref: 'Resolução CNE/CES nº 7/2018, Art. 7º' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  conforme: { label: 'Conforme', color: '#22c55e', icon: '✅' },
  parcial: { label: 'Parcialmente conforme', color: '#f59e0b', icon: '🟡' },
  nao_conforme: { label: 'Não conforme', color: '#ef4444', icon: '❌' },
  nao_aplicavel: { label: 'Não aplicável', color: '#9ca3af', icon: '⚪' },
};

export default function ExtensaoConformidade({
  institutionId, onClose,
}: {
  institutionId: string; onClose: () => void;
}) {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);

    // Buscar dados necessários
    const [projects, students, hours, policies, evidence, activities, partners] = await Promise.all([
      supabase.from('vertice_extension_projects').select('*').eq('institution_id', institutionId),
      supabase.from('vertice_extension_students').select('id, status, hours_completed, course_id').eq('institution_id', institutionId),
      supabase.from('vertice_extension_hour_entries').select('minutes, hour_state').eq('institution_id', institutionId),
      supabase.from('vertice_extension_policies').select('*').eq('institution_id', institutionId).eq('status', 'vigente'),
      supabase.from('vertice_extension_evidence_registry').select('id, validation_status').eq('institution_id', institutionId).eq('is_current', true),
      supabase.from('vertice_extension_activities').select('id, status').eq('institution_id', institutionId),
      supabase.from('vertice_extension_partners').select('id').eq('institution_id', institutionId).eq('active', true),
    ]);

    const p = projects.data || [];
    const s = students.data || [];
    const h = hours.data || [];
    const pol = policies.data || [];
    const ev = evidence.data || [];
    const act = activities.data || [];
    const part = partners.data || [];

    const results: CheckItem[] = [];
    let idx = 0;

    // === CURRICULARIZAÇÃO ===
    const coursesWithProjects = new Set(p.flatMap((proj: any) => proj.course_ids || []));
    results.push({
      id: String(++idx), category: 'curricularizacao',
      requirement: 'Extensão presente em todos os cursos de graduação',
      reference: 'Art. 4º — curricularização obrigatória',
      status: coursesWithProjects.size > 0 ? (coursesWithProjects.size >= 3 ? 'conforme' : 'parcial') : 'nao_conforme',
      detail: `${coursesWithProjects.size} curso(s) com projetos vinculados.`,
      severity: 'critico',
    });

    results.push({
      id: String(++idx), category: 'curricularizacao',
      requirement: 'Projetos com problema social e metodologia definidos',
      reference: 'Art. 5º — interação dialógica',
      status: (() => {
        const withMethod = p.filter((proj: any) => proj.social_problem && proj.methodology).length;
        return withMethod === p.length && p.length > 0 ? 'conforme' : withMethod > 0 ? 'parcial' : 'nao_conforme';
      })(),
      detail: `${p.filter((proj: any) => proj.social_problem && proj.methodology).length}/${p.length} projetos com problema social e metodologia.`,
      severity: 'alto',
    });

    // === CARGA HORÁRIA ===
    const totalValidated = h.filter((x: any) => ['validada', 'integralizada'].includes(x.hour_state)).reduce((sum: number, x: any) => sum + Math.abs(x.minutes), 0);
    const totalPending = h.filter((x: any) => !['validada', 'integralizada', 'indeferida'].includes(x.hour_state)).reduce((sum: number, x: any) => sum + Math.abs(x.minutes), 0);

    results.push({
      id: String(++idx), category: 'carga_horaria',
      requirement: 'Mínimo 10% da carga horária total em extensão',
      reference: 'Art. 4º, §2º — no mínimo 10%',
      status: totalValidated > 0 ? 'parcial' : 'nao_conforme',
      detail: `${Math.floor(totalValidated / 60)}h validadas, ${Math.floor(totalPending / 60)}h em trâmite. Verificar percentual por curso.`,
      severity: 'critico',
    });

    results.push({
      id: String(++idx), category: 'carga_horaria',
      requirement: 'Livro-razão de horas com rastreabilidade completa',
      reference: 'Instrumento INEP — registro de atividades',
      status: h.length > 0 ? 'conforme' : 'nao_conforme',
      detail: `${h.length} lançamentos no livro-razão.`,
      severity: 'medio',
    });

    // === COMUNIDADE ===
    results.push({
      id: String(++idx), category: 'comunidade',
      requirement: 'Projetos com comunidade externa identificada',
      reference: 'Art. 5º, I — interação dialógica',
      status: (() => {
        const withCommunity = p.filter((proj: any) => proj.target_community).length;
        return withCommunity === p.length && p.length > 0 ? 'conforme' : withCommunity > 0 ? 'parcial' : 'nao_conforme';
      })(),
      detail: `${p.filter((proj: any) => proj.target_community).length}/${p.length} projetos com comunidade identificada.`,
      severity: 'alto',
    });

    results.push({
      id: String(++idx), category: 'comunidade',
      requirement: 'Parceiros externos formalizados',
      reference: 'Art. 5º — parcerias com a sociedade',
      status: part.length > 0 ? (part.length >= 3 ? 'conforme' : 'parcial') : 'nao_conforme',
      detail: `${part.length} parceiro(s) ativo(s).`,
      severity: 'medio',
    });

    // === REGISTRO ===
    results.push({
      id: String(++idx), category: 'registro',
      requirement: 'Estudantes vinculados a projetos',
      reference: 'Dimensão 5 — participação discente',
      status: s.length > 0 ? 'conforme' : 'nao_conforme',
      detail: `${s.filter((x: any) => x.status === 'ativo').length} estudantes ativos em ${p.length} projetos.`,
      severity: 'alto',
    });

    results.push({
      id: String(++idx), category: 'registro',
      requirement: 'Atividades registradas e acompanhadas',
      reference: 'Indicador 5.3 — atividades de extensão',
      status: act.length > 0 ? (act.filter((a: any) => a.status === 'concluida').length > 0 ? 'conforme' : 'parcial') : 'nao_conforme',
      detail: `${act.length} atividades (${act.filter((a: any) => a.status === 'concluida').length} concluídas).`,
      severity: 'medio',
    });

    // === AVALIAÇÃO ===
    results.push({
      id: String(++idx), category: 'avaliacao',
      requirement: 'Evidências documentais com validação',
      reference: 'Indicador 5.3 — comprovação',
      status: ev.length > 0 ? (ev.filter((e: any) => e.validation_status === 'aprovada').length > 0 ? 'conforme' : 'parcial') : 'nao_conforme',
      detail: `${ev.length} documentos (${ev.filter((e: any) => e.validation_status === 'aprovada').length} aprovados).`,
      severity: 'alto',
    });

    results.push({
      id: String(++idx), category: 'avaliacao',
      requirement: 'Relatórios de execução produzidos',
      reference: 'Art. 10 — formas de registro',
      status: ev.filter((e: any) => ['relatorio_execucao', 'relatorio_parcial', 'relatorio_final'].includes((e as any).document_type)).length > 0 ? 'conforme' : 'nao_conforme',
      detail: 'Verificar existência de relatórios no repositório de evidências.',
      severity: 'medio',
    });

    // === POLÍTICA ===
    results.push({
      id: String(++idx), category: 'politica',
      requirement: 'Política institucional de extensão vigente',
      reference: 'Art. 7º — regulamentação institucional',
      status: pol.length > 0 ? 'conforme' : 'nao_conforme',
      detail: pol.length > 0 ? `Política vigente encontrada.` : 'Nenhuma política de extensão vigente cadastrada.',
      severity: 'critico',
    });

    results.push({
      id: String(++idx), category: 'politica',
      requirement: 'Alinhamento com ODS da Agenda 2030',
      reference: 'DCN — responsabilidade social',
      status: p.some((proj: any) => (proj.ods_goals || []).length > 0) ? 'conforme' : 'parcial',
      detail: `${p.filter((proj: any) => (proj.ods_goals || []).length > 0).length}/${p.length} projetos com ODS vinculados.`,
      severity: 'baixo',
    });

    setChecks(results);
    setLastRun(new Date().toLocaleString('pt-BR'));
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { runAudit(); }, [runAudit]);

  const byCategory = (cat: string) => checks.filter(c => c.category === cat);
  const totalConf = checks.filter(c => c.status === 'conforme').length;
  const totalParcial = checks.filter(c => c.status === 'parcial').length;
  const totalNC = checks.filter(c => c.status === 'nao_conforme').length;
  const pctConf = checks.length > 0 ? Math.round((totalConf / checks.length) * 100) : 0;

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>⚖️ Conformidade Regulatória</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      {loading ? <p>Executando auditoria...</p> : (
        <>
          {/* Score */}
          <div style={{ textAlign: 'center', padding: '1.5rem', background: pctConf >= 80 ? '#22c55e10' : pctConf >= 50 ? '#f59e0b10' : '#ef444410', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: pctConf >= 80 ? '#22c55e' : pctConf >= 50 ? '#f59e0b' : '#ef4444' }}>{pctConf}%</div>
            <div style={{ color: '#6b7280', fontSize: '.85rem' }}>Conformidade regulatória</div>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '.75rem', fontSize: '.8rem' }}>
              <span style={{ color: '#22c55e' }}>✅ {totalConf} conforme</span>
              <span style={{ color: '#f59e0b' }}>🟡 {totalParcial} parcial</span>
              <span style={{ color: '#ef4444' }}>❌ {totalNC} não conforme</span>
            </div>
            {lastRun && <div style={{ fontSize: '.7rem', color: '#9ca3af', marginTop: '.5rem' }}>Última auditoria: {lastRun}</div>}
          </div>

          {/* Por categoria */}
          {CATEGORIES.map(cat => {
            const items = byCategory(cat.key);
            if (items.length === 0) return null;
            const catConf = items.filter(i => i.status === 'conforme').length;
            return (
              <div key={cat.key} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                  <h4 style={{ margin: 0 }}>{cat.label}</h4>
                  <span style={{ fontSize: '.75rem', color: '#6b7280' }}>{catConf}/{items.length} · {cat.ref}</span>
                </div>
                <div style={{ display: 'grid', gap: '.5rem' }}>
                  {items.map(item => {
                    const st = STATUS_LABELS[item.status];
                    return (
                      <div key={item.id} style={{
                        padding: '.75rem', borderLeft: `3px solid ${st.color}`,
                        background: 'var(--bg-secondary, #f9fafb)', borderRadius: '0 6px 6px 0',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: '.85rem' }}>{item.requirement}</strong>
                            <p style={{ margin: '.2rem 0', fontSize: '.8rem', color: '#4b5563' }}>{item.detail}</p>
                          </div>
                          <span style={{ color: st.color, fontSize: '.8rem', whiteSpace: 'nowrap', marginLeft: '.5rem' }}>{st.icon} {st.label}</span>
                        </div>
                        <div style={{ fontSize: '.7rem', color: '#9ca3af' }}>{item.reference}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button className="ext-btn-primary" onClick={runAudit}>🔄 Reexecutar auditoria</button>
        </>
      )}
    </div>
  );
}
