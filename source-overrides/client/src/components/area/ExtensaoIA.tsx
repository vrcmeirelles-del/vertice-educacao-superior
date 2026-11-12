/**
 * ExtensaoIA — Painel de análises de IA
 * Restrito a alta gestão (master, reitor, pro_reitoria)
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Analysis {
  id: string; analysis_type: string; project_id: string | null;
  course_id: string | null; model_used: string; status: string;
  summary: string; findings_count: number;
  requested_by: string; requested_at: string; completed_at: string | null;
  processing_time_ms: number | null; tokens_used: number | null;
  validated_by: string | null; validated_at: string | null; validation_notes: string | null;
}

interface AIFinding {
  id: string; analysis_id: string; finding_type: string;
  title: string; description: string; confidence: number | null;
  conformity_status: string | null; justification: string | null;
  severity: string; recommendation: string | null;
}

interface SourceRef {
  id: string; finding_id: string; document_name: string;
  page_number: number | null; section_title: string | null;
  text_excerpt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  documental: '📄 Documental', estrutural: '🏗️ Estrutural',
  projeto: '📋 Projeto', evidencia: '📁 Evidência',
  curricularizacao: '📚 Curricularização', cruzamento: '🔀 Cruzamento',
  conformidade: '✅ Conformidade',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: '⏳ Pendente', processando: '⚙️ Processando',
  concluida: '✅ Concluída', falha: '❌ Falha', cancelada: '🚫 Cancelada',
};

const FINDING_TYPE_LABELS: Record<string, string> = {
  informacao_comprovada: '✅ Comprovada', informacao_parcial: '🟡 Parcial',
  inferencia_ia: '🤖 Inferência IA', informacao_nao_localizada: '❓ Não localizada',
  pendente_validacao: '⏳ Pendente', inconsistencia: '⚠️ Inconsistência',
  lacuna: '🕳️ Lacuna', recomendacao: '💡 Recomendação',
};

const CONFORMITY_COLORS: Record<string, string> = {
  conforme: '#22c55e', parcialmente_conforme: '#f59e0b',
  nao_conforme: '#ef4444', nao_identificado: '#6b7280',
  nao_aplicavel: '#9ca3af', aguardando_validacao: '#3b82f6',
};

export default function ExtensaoIA({
  institutionId, canEdit, onClose,
}: {
  institutionId: string; canEdit: boolean; onClose: () => void;
}) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [findings, setFindings] = useState<AIFinding[]>([]);
  const [refs, setRefs] = useState<Record<string, SourceRef[]>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_ai_analyses')
      .select('*').eq('institution_id', institutionId)
      .order('requested_at', { ascending: false });
    setAnalyses(data || []);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const runProjectAnalysis = async () => {
    setAnalyzing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAnalyzing(false); return; }

    // Buscar todos os projetos da instituição
    const { data: projects } = await supabase.from('vertice_extension_projects')
      .select('*').eq('institution_id', institutionId);
    if (!projects || projects.length === 0) { setAnalyzing(false); return alert('Nenhum projeto encontrado.'); }

    // Criar registro da análise
    const { data: analysis, error } = await supabase.from('vertice_ai_analyses').insert({
      institution_id: institutionId,
      analysis_type: 'projeto',
      model_used: 'regras-estaticas-v1',
      status: 'processando',
      requested_by: user.id,
    }).select('id').single();
    if (error || !analysis) { setAnalyzing(false); return alert('Erro: ' + (error?.message || '')); }

    // Analisar cada projeto com regras estáticas
    let totalFindings = 0;
    for (const project of projects) {
      const checks: { type: string; title: string; desc: string; sev: string }[] = [];
      const required: [string, string][] = [
        ['social_problem', 'Problema social não identificado'],
        ['general_objective', 'Objetivo geral não definido'],
        ['methodology', 'Metodologia não descrita'],
        ['target_community', 'Comunidade atendida não identificada'],
        ['beneficiary_profile', 'Perfil do público beneficiário ausente'],
      ];
      for (const [field, msg] of required) {
        if (!project[field] || String(project[field]).trim().length < 10) {
          checks.push({ type: 'lacuna', title: `${msg} — ${project.title}`, desc: `Campo "${field}" vazio ou insuficiente.`, sev: 'alto' });
        }
      }
      if (!project.specific_objectives || project.specific_objectives.length === 0) {
        checks.push({ type: 'lacuna', title: `Objetivos específicos ausentes — ${project.title}`, desc: 'Projeto sem objetivos específicos.', sev: 'medio' });
      }
      if (!project.total_hours || project.total_hours < 1) {
        checks.push({ type: 'inconsistencia', title: `Carga horária não definida — ${project.title}`, desc: 'Sem carga horária total.', sev: 'critico' });
      }
      if (!project.start_date || !project.end_date) {
        checks.push({ type: 'lacuna', title: `Período não definido — ${project.title}`, desc: 'Sem datas de início/término.', sev: 'medio' });
      }
      if (checks.length === 0) {
        checks.push({ type: 'informacao_comprovada', title: `Projeto completo — ${project.title}`, desc: 'Campos obrigatórios preenchidos.', sev: 'informativo' });
      }

      for (const c of checks) {
        await supabase.from('vertice_ai_findings').insert({
          analysis_id: analysis.id, institution_id: institutionId,
          finding_type: c.type, title: c.title, description: c.desc,
          confidence: 1.0, severity: c.sev,
        });
        totalFindings++;
      }
    }

    await supabase.from('vertice_ai_analyses').update({
      status: 'concluida', findings_count: totalFindings,
      completed_at: new Date().toISOString(),
    }).eq('id', analysis.id);

    setAnalyzing(false);
    load();
  };

  const [docAnalysisType, setDocAnalysisType] = useState<string>('documental');
  const [docAnalyzing, setDocAnalyzing] = useState(false);

  const runDocumentAnalysis = async () => {
    setDocAnalyzing(true);
    // Buscar evidências pendentes ou aprovadas do repositório
    const { data: docs } = await supabase.from('vertice_extension_evidence_registry')
      .select('storage_path, file_name').eq('institution_id', institutionId)
      .eq('is_current', true).limit(5);
    if (!docs || docs.length === 0) { setDocAnalyzing(false); return alert('Nenhum documento encontrado no repositório de evidências.'); }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDocAnalyzing(false); return alert('Sessão expirada.'); }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/vertice-impacto-analyze`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          institution_id: institutionId,
          analysis_type: docAnalysisType,
          document_paths: docs.map(d => d.storage_path),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro na análise');
      alert(`Análise concluída: ${result.findings_count} achados em ${Math.round(result.processing_time_ms / 1000)}s`);
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
    setDocAnalyzing(false);
    load();
  };

  const loadFindings = async (analysisId: string) => {
    setSelectedAnalysis(analysisId);
    const { data } = await supabase.from('vertice_ai_findings')
      .select('*').eq('analysis_id', analysisId)
      .order('severity');
    setFindings(data || []);

    // Load refs for all findings
    if (data && data.length > 0) {
      const { data: refData } = await supabase.from('vertice_ai_source_references')
        .select('*').in('finding_id', data.map(f => f.id));
      const grouped: Record<string, SourceRef[]> = {};
      (refData || []).forEach(r => {
        if (!grouped[r.finding_id]) grouped[r.finding_id] = [];
        grouped[r.finding_id].push(r);
      });
      setRefs(grouped);
    }
  };

  const validateAnalysis = async (id: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('vertice_ai_analyses').update({
      validated_by: user.id, validated_at: new Date().toISOString(), validation_notes: notes,
    }).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtConfidence = (c: number | null) => c != null ? `${Math.round(c * 100)}%` : '—';

  const concluidas = analyses.filter(a => a.status === 'concluida').length;
  const pendentesValidacao = analyses.filter(a => a.status === 'concluida' && !a.validated_at).length;
  const totalFindings = analyses.reduce((s, a) => s + (a.findings_count || 0), 0);

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🤖 Análises de IA</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      <div style={{ padding: '.75rem', background: '#fef3c7', borderRadius: '8px', marginBottom: '1rem', fontSize: '.85rem' }}>
        ⚠️ Acesso restrito à alta gestão. Resultados de IA são auxiliares — toda classificação deve ser validada por humano qualificado.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{analyses.length}</span>
          <span className="ext-stat-label">Análises</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#22c55e' }}>{concluidas}</span>
          <span className="ext-stat-label">Concluídas</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value" style={{ color: '#f59e0b' }}>{pendentesValidacao}</span>
          <span className="ext-stat-label">Pendentes validação</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{totalFindings}</span>
          <span className="ext-stat-label">Achados</span>
        </div>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="ext-btn-primary" disabled={analyzing} onClick={runProjectAnalysis}>
            {analyzing ? '⏳...' : '🔍 Completude dos projetos'}
          </button>
          <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
            <select value={docAnalysisType} onChange={e => setDocAnalysisType(e.target.value)} style={{ fontSize: '.8rem', padding: '.4rem' }}>
              <option value="documental">📄 Documental</option>
              <option value="estrutural">🏗️ Estrutural (DCN)</option>
              <option value="evidencia">📁 Verificar evidências</option>
              <option value="conformidade">⚖️ Conformidade INEP</option>
            </select>
            <button className="ext-btn-secondary" disabled={docAnalyzing} onClick={runDocumentAnalysis}>
              {docAnalyzing ? '⏳ Analisando...' : '🤖 Analisar documentos'}
            </button>
          </div>
        </div>
      )}

      {loading ? <p>Carregando...</p> : analyses.length === 0 ? (
        <p className="ext-empty">Nenhuma análise de IA registrada. Clique no botão acima para iniciar.</p>
      ) : !selectedAnalysis ? (
        <table className="ext-table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Status</th><th>Achados</th><th>Modelo</th><th>Validação</th><th>Ação</th></tr>
          </thead>
          <tbody>
            {analyses.map(a => (
              <tr key={a.id}>
                <td>{fmtDate(a.requested_at)}</td>
                <td>{TYPE_LABELS[a.analysis_type] || a.analysis_type}</td>
                <td>{STATUS_LABELS[a.status]}</td>
                <td className="num">{a.findings_count || 0}</td>
                <td><small>{a.model_used}</small></td>
                <td>{a.validated_at ? <span style={{ color: '#22c55e' }}>✅ {fmtDate(a.validated_at)}</span> : <span style={{ color: '#f59e0b' }}>⏳</span>}</td>
                <td>
                  {a.status === 'concluida' && (
                    <button className="ext-btn-small" onClick={() => loadFindings(a.id)}>Ver achados</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <button className="ext-btn-cancel" style={{ marginBottom: '1rem' }} onClick={() => { setSelectedAnalysis(null); setFindings([]); setRefs({}); }}>
            ← Voltar para lista
          </button>
          <h4>Achados da análise</h4>
          {findings.length === 0 ? <p className="ext-empty">Nenhum achado.</p> : (
            <div style={{ display: 'grid', gap: '.75rem' }}>
              {findings.map(f => (
                <div key={f.id} style={{ padding: '1rem', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{f.title}</strong>
                    <span style={{ fontSize: '.8rem' }}>
                      {FINDING_TYPE_LABELS[f.finding_type] || f.finding_type}
                      {f.confidence != null && <span style={{ marginLeft: '.5rem', color: '#6b7280' }}>({fmtConfidence(f.confidence)})</span>}
                    </span>
                  </div>
                  <p style={{ margin: '.5rem 0', fontSize: '.9rem' }}>{f.description}</p>
                  {f.conformity_status && (
                    <span style={{ fontSize: '.8rem', color: CONFORMITY_COLORS[f.conformity_status] || '#6b7280' }}>
                      Conformidade: {f.conformity_status.replace(/_/g, ' ')}
                    </span>
                  )}
                  {f.justification && <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: '#4b5563' }}>📌 {f.justification}</p>}
                  {f.recommendation && <p style={{ margin: '.25rem 0', fontSize: '.85rem', color: '#2563eb' }}>💡 {f.recommendation}</p>}

                  {/* Source references */}
                  {refs[f.id] && refs[f.id].length > 0 && (
                    <div style={{ marginTop: '.5rem', padding: '.5rem', background: 'var(--bg-secondary, #f9fafb)', borderRadius: '4px', fontSize: '.8rem' }}>
                      <strong>Fontes:</strong>
                      {refs[f.id].map(r => (
                        <div key={r.id} style={{ marginTop: '.25rem' }}>
                          📎 {r.document_name}
                          {r.page_number && ` (p. ${r.page_number})`}
                          {r.section_title && ` — ${r.section_title}`}
                          {r.text_excerpt && <div style={{ fontStyle: 'italic', color: '#6b7280', marginTop: '.15rem' }}>"{r.text_excerpt}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Validate button */}
          {canEdit && (() => {
            const analysis = analyses.find(a => a.id === selectedAnalysis);
            return analysis && !analysis.validated_at ? (
              <div style={{ marginTop: '1rem' }}>
                <button className="ext-btn-primary" onClick={() => {
                  const notes = prompt('Notas de validação (opcional):') || '';
                  validateAnalysis(selectedAnalysis!, notes);
                }}>✅ Validar análise</button>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
