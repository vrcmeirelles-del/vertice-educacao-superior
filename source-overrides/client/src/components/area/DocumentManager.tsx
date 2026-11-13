import { HelpLabel } from '@/components/ContextHelp';
/**
 * DocumentManager.tsx — Gestão Documental Inteligente
 * Tab: "documentos" (superior) / "escola-documentos" (escolas)
 * Upload, catalogação, análise IA, alertas, busca full-text
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
const PreValidationPanel = lazy(() => import('./PreValidationPanel'));

// ── Types ──────────────────────────────────────────────────

interface DocCategory {
  linked_module?: string | null;
  code: string;
  label: string;
  tier: string;
  regulatory_basis: string | null;
  renewal_months: number | null;
  required_for: string[] | null;
  required_note: string | null;
}

interface Document {
  id: string;
  institution_id: string;
  category_code: string;
  title: string;
  description: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  effective_date: string | null;
  expiry_date: string | null;
  ai_status: string;
  ai_summary: string | null;
  ai_compliance_score: number | null;
  ai_findings: any[];
  version_number: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  vertice_doc_categories?: DocCategory;
}

interface DocAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  due_date: string | null;
  acknowledged: boolean;
  created_at: string;
}

interface DocHealth {
  total_docs: number;
  active_docs: number;
  expired_docs: number;
  expiring_soon: number;
  analyzed: number;
  pending_analysis: number;
  avg_compliance_score: number | null;
  critical_findings: number;
  open_findings: number;
}

interface Finding {
  id: string;
  finding_type: string;
  severity: string;
  title: string;
  message: string;
  regulatory_reference: string | null;
  suggestion: string | null;
  resolved: boolean;
}

interface Props {
  institutionId: string;
  isMaster: boolean;
}

// ── Helpers ────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#6b7280',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
  info: 'Info',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  expired: 'Vencido',
  superseded: 'Substituído',
  archived: 'Arquivado',
};

const AI_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Aguardando análise',
  processing: '🔄 Analisando...',
  completed: '✅ Analisado',
  failed: '❌ Falhou',
  skipped: '⏭️ Ignorado',
};

const FINDING_TYPE_LABELS: Record<string, string> = {
  gap: '🔍 Lacuna',
  inconsistency: '⚠️ Inconsistência',
  non_compliance: '🚫 Desconformidade',
  outdated: '📅 Desatualizado',
  suggestion: '💡 Sugestão',
  risk: '🔴 Risco',
  strength: '✅ Ponto forte',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ── Component ──────────────────────────────────────────────

export default function DocumentManager({ institutionId, isMaster }: Props) {
  const [view, setView] = useState<'dashboard' | 'list' | 'upload' | 'detail' | 'alerts' | 'missing'>('dashboard');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [alerts, setAlerts] = useState<DocAlert[]>([]);
  const [health, setHealth] = useState<DocHealth | null>(null);
  const [missingDocs, setMissingDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showPrevalidation, setShowPrevalidation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadEffective, setUploadEffective] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // ── Data loading ───────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const [docsRes, catsRes, alertsRes, healthRes, missingRes] = await Promise.all([
      supabase
        .from('vertice_documents')
        .select('*, vertice_doc_categories(*)')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('vertice_doc_categories')
        .select('*')
        .order('sort_order'),
      supabase
        .from('vertice_doc_alerts')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('v_doc_health')
        .select('*')
        .eq('institution_id', institutionId)
        .single(),
      supabase
        .from('v_missing_required_docs')
        .select('*')
        .eq('institution_id', institutionId),
    ]);

    if (docsRes.data) setDocuments(docsRes.data);
    if (catsRes.data) setCategories(catsRes.data);
    if (alertsRes.data) setAlerts(alertsRes.data);
    if (healthRes.data) setHealth(healthRes.data);
    if (missingRes.data) setMissingDocs(missingRes.data);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Upload ─────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategory || !uploadTitle) return;
    setUploading(true);

    try {
      // 1. Upload to storage
      const ext = uploadFile.name.split('.').pop();
      const path = `${institutionId}/${uploadCategory}/${Date.now()}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from('vertice-documents')
        .upload(path, uploadFile);
      if (storageErr) throw storageErr;

      // 2. Compute SHA-256
      const buffer = await uploadFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Get category for auto-expiry
      const cat = categories.find((c) => c.code === uploadCategory);
      let expiry = uploadExpiry || null;
      if (!expiry && cat?.renewal_months && uploadEffective) {
        const d = new Date(uploadEffective);
        d.setMonth(d.getMonth() + cat.renewal_months);
        expiry = d.toISOString().split('T')[0];
      }

      // 4. Insert document record
      const { data: doc, error: insertErr } = await supabase
        .from('vertice_documents')
        .insert({
          institution_id: institutionId,
          category_code: uploadCategory,
          title: uploadTitle,
          description: uploadDescription || null,
          storage_path: path,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type,
          sha256,
          status: 'active',
          effective_date: uploadEffective || null,
          expiry_date: expiry,
          review_due_date: expiry, // review = expiry por padrão
          linked_module: cat?.linked_module || null,
          ai_status: 'pending',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 5. Trigger AI analysis
      if (doc) {
        supabase.functions.invoke('vertice-doc-analyze', {
          body: { document_id: doc.id },
        }).catch(console.error); // fire and forget
      }

      // Reset form
      setUploadCategory('');
      setUploadTitle('');
      setUploadDescription('');
      setUploadEffective('');
      setUploadExpiry('');
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setView('list');
      loadData();
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Re-analyze ─────────────────────────────────────────

  const reanalyze = async (docId: string) => {
    await supabase
      .from('vertice_documents')
      .update({ ai_status: 'pending' })
      .eq('id', docId);
    await supabase
      .from('vertice_doc_findings')
      .delete()
      .eq('document_id', docId);
    supabase.functions.invoke('vertice-doc-analyze', {
      body: { document_id: docId },
    }).catch(console.error);
    loadData();
  };

  // ── Search ─────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase.rpc('search_documents', {
      p_institution_id: institutionId,
      p_query: searchQuery,
    });
    setSearchResults(data || []);
  };

  // ── Document detail ────────────────────────────────────

  const openDetail = async (doc: Document) => {
    setSelectedDoc(doc);
    const { data } = await supabase
      .from('vertice_doc_findings')
      .select('*')
      .eq('document_id', doc.id)
      .order('severity');
    setFindings(data || []);
    setView('detail');
  };

  // ── Acknowledge alert ──────────────────────────────────

  const ackAlert = async (alertId: string) => {
    await supabase
      .from('vertice_doc_alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    loadData();
  };

  // ── Resolve finding ────────────────────────────────────

  const resolveFinding = async (findingId: string, notes: string) => {
    await supabase
      .from('vertice_doc_findings')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolution_notes: notes })
      .eq('id', findingId);
    if (selectedDoc) openDetail(selectedDoc);
  };

  // ── Render ─────────────────────────────────────────────

  const ScoreGauge = ({ score }: { score: number | null }) => {
    if (score === null) return <span style={{ color: '#999' }}>—</span>;
    const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626';
    return (
      <span style={{ color, fontWeight: 700, fontSize: '1.2rem' }}>
        {score.toFixed(0)}
      </span>
    );
  };

  // ── Dashboard ──────────────────────────────────────────

  const renderDashboard = () => (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Documentos', value: health?.total_docs || 0, color: '#2563eb' },
          { label: 'Ativos', value: health?.active_docs || 0, color: '#16a34a' },
          { label: 'Vencidos', value: health?.expired_docs || 0, color: '#dc2626' },
          { label: 'Vence em 30d', value: health?.expiring_soon || 0, color: '#ea580c' },
          { label: 'Score Médio IA', value: health?.avg_compliance_score?.toFixed(0) || '—', color: '#7c3aed' },
          { label: 'Achados abertos', value: health?.open_findings || 0, color: '#ca8a04' },
          { label: 'Críticos', value: health?.critical_findings || 0, color: '#dc2626' },
          { label: 'Docs faltantes', value: missingDocs.length, color: '#dc2626' },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: 'var(--bg-card, #fff)', borderRadius: 8, padding: '16px 12px',
            borderLeft: `4px solid ${kpi.color}`,
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}>
            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '.5px' }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Alertas pendentes */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.5px', color: '#666' }}>
            Alertas ({alerts.length})
          </h3>
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: 'var(--bg-card, #fff)', borderRadius: 6, marginBottom: 6,
              borderLeft: `4px solid ${SEVERITY_COLORS[a.severity]}`,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{a.message}</div>
              </div>
              <button onClick={() => ackAlert(a.id)} style={{
                background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '4px 10px',
                cursor: 'pointer', fontSize: 11,
              }}>OK</button>
            </div>
          ))}
          {alerts.length > 5 && (
            <button onClick={() => setView('alerts')} style={{
              background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12,
            }}>Ver todos ({alerts.length})</button>
          )}
        </div>
      )}

      {/* Busca */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text" placeholder="Buscar nos documentos..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
        />
        <button onClick={handleSearch} style={{
          padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontWeight: 600,
        }}>Buscar</button>
      </div>

      {searchResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#666' }}>Resultados</h3>
          {searchResults.map((r: any) => (
            <div key={r.id} style={{
              padding: 12, background: 'var(--bg-card, #fff)', borderRadius: 6, marginBottom: 6,
              cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
            }} onClick={() => {
              const doc = documents.find((d) => d.id === r.id);
              if (doc) openDetail(doc);
            }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{r.category_label} · Score: {r.ai_compliance_score?.toFixed(0) || '—'}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}
                dangerouslySetInnerHTML={{ __html: (r.snippet || '').replace(/\*\*/g, '<mark>').replace(/<mark>(.*?)<mark>/g, '<mark>$1</mark>') }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Ações rápidas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setView('upload')} style={btnStyle('#16a34a')}>📤 Enviar documento</button>
        <button onClick={() => setView('list')} style={btnStyle('#2563eb')}>📋 Todos os documentos</button>
        <button onClick={() => setView('missing')} style={btnStyle('#dc2626')}>⚠️ Docs faltantes ({missingDocs.length})</button>
      </div>
    </div>
  );

  // ── Upload form ────────────────────────────────────────

  const renderUpload = () => (
    <div>
      <h3 style={{ margin: '0 0 16px' }}>Enviar documento</h3>
      <div style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <div>
          <HelpLabel style={labelStyle}>Categoria *</HelpLabel>
          <select value={uploadCategory} onChange={(e) => {
            setUploadCategory(e.target.value);
            const cat = categories.find((c) => c.code === e.target.value);
            if (cat && !uploadTitle) setUploadTitle(cat.label);
          }} style={inputStyle}>
            <option value="">Selecione...</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} {c.regulatory_basis ? `(${c.regulatory_basis})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <HelpLabel style={labelStyle}>Título *</HelpLabel>
          <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <HelpLabel style={labelStyle}>Descrição</HelpLabel>
          <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 60 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <HelpLabel style={labelStyle}>Data de vigência</HelpLabel>
            <input type="date" value={uploadEffective} onChange={(e) => setUploadEffective(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <HelpLabel style={labelStyle}>Data de vencimento</HelpLabel>
            <input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} style={inputStyle} />
            {!uploadExpiry && uploadCategory && (() => {
              const cat = categories.find((c) => c.code === uploadCategory);
              return cat?.renewal_months ? (
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  Auto: {cat.renewal_months} meses após vigência
                </div>
              ) : null;
            })()}
          </div>
        </div>
        <div>
          <HelpLabel style={labelStyle}>Arquivo *</HelpLabel>
          <input type="file" ref={fileRef}
            accept=".pdf,.docx,.doc,.odt,.txt,.png,.jpg,.jpeg"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={inputStyle}
          />
          {uploadFile && <div style={{ fontSize: 11, color: '#666' }}>{formatBytes(uploadFile.size)}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadCategory || !uploadTitle}
            style={{ ...btnStyle('#16a34a'), opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Enviando...' : '📤 Enviar e analisar'}
          </button>
          <button onClick={() => setView('dashboard')} style={btnStyle('#666')}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  // ── Document list ──────────────────────────────────────

  const renderList = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Documentos ({documents.length})</h3>
        <button onClick={() => setView('upload')} style={btnStyle('#16a34a')}>📤 Enviar</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={thStyle}>Documento</th>
            <th style={thStyle}>Categoria</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Vencimento</th>
            <th style={thStyle}>Score IA</th>
            <th style={thStyle}>Análise</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
              onClick={() => openDetail(d)}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{d.file_name} · {d.file_size ? formatBytes(d.file_size) : ''}</div>
              </td>
              <td style={tdStyle}>{d.vertice_doc_categories?.label || d.category_code}</td>
              <td style={tdStyle}>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: d.status === 'active' ? '#dcfce7' : d.status === 'expired' ? '#fee2e2' : '#f3f4f6',
                  color: d.status === 'active' ? '#16a34a' : d.status === 'expired' ? '#dc2626' : '#666',
                }}>{STATUS_LABELS[d.status]}</span>
              </td>
              <td style={tdStyle}>{formatDate(d.expiry_date)}</td>
              <td style={tdStyle}><ScoreGauge score={d.ai_compliance_score} /></td>
              <td style={tdStyle}><span style={{ fontSize: 12 }}>{AI_STATUS_LABELS[d.ai_status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Document detail ────────────────────────────────────

  const renderDetail = () => {
    if (!selectedDoc) return null;
    const d = selectedDoc;
    return (
      <div>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', marginBottom: 12 }}>
          ← Voltar
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>{d.title}</h3>
            <div style={{ fontSize: 12, color: '#666' }}>
              {d.vertice_doc_categories?.label} · v{d.version_number} · {formatDate(d.created_at)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#666' }}>Score de conformidade</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}><ScoreGauge score={d.ai_compliance_score} /></div>
          </div>
        </div>

        {/* Resumo IA */}
        {d.ai_summary && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>Resumo da IA</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{d.ai_summary}</div>
          </div>
        )}

        {/* Metadados */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={metaCard}><strong>Status:</strong> {STATUS_LABELS[d.status]}</div>
          <div style={metaCard}><strong>Vigência:</strong> {formatDate(d.effective_date)}</div>
          <div style={metaCard}><strong>Vencimento:</strong> {formatDate(d.expiry_date)}</div>
          <div style={metaCard}><strong>Arquivo:</strong> {d.file_name} ({d.file_size ? formatBytes(d.file_size) : ''})</div>
          <div style={metaCard}><strong>Análise:</strong> {AI_STATUS_LABELS[d.ai_status]}</div>
          <div style={metaCard}><strong>Fundamento:</strong> {d.vertice_doc_categories?.regulatory_basis || '—'}</div>
        </div>

        {/* Achados */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>Achados ({findings.length})</h4>
          <button onClick={() => reanalyze(d.id)} style={btnStyle('#7c3aed')}>🔄 Reanalisar</button>
          <button onClick={() => setShowPrevalidation(!showPrevalidation)} style={btnStyle('#2563eb')}>🤖 {showPrevalidation ? 'Fechar pré-validação' : 'PRÉ-VALIDAR COM IA'}</button>
        </div>
        {findings.map((f) => (
          <div key={f.id} style={{
            padding: 12, borderRadius: 6, marginBottom: 8,
            background: f.resolved ? '#f9fafb' : 'var(--bg-card, #fff)',
            borderLeft: `4px solid ${SEVERITY_COLORS[f.severity]}`,
            opacity: f.resolved ? 0.6 : 1,
            boxShadow: '0 1px 2px rgba(0,0,0,.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, color: SEVERITY_COLORS[f.severity], fontWeight: 600 }}>
                  {SEVERITY_LABELS[f.severity]}
                </span>
                <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>{FINDING_TYPE_LABELS[f.finding_type]}</span>
              </div>
              {!f.resolved && (
                <button onClick={() => resolveFinding(f.id, 'Resolvido')} style={{
                  background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 8px',
                  cursor: 'pointer', fontSize: 11,
                }}>Resolver</button>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{f.message}</div>
            {f.regulatory_reference && (
              <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>📜 {f.regulatory_reference}</div>
            )}
            {f.suggestion && (
              <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>💡 {f.suggestion}</div>
            )}
          </div>
        ))}

        {/* Painel de Pré-validação IA */}
        {showPrevalidation && d && (
          <Suspense fallback={<p>Carregando pré-validação…</p>}>
            <PreValidationPanel
              file={{ id: d.id, file_name: d.file_name } as any}
              institutionId={institutionId}
              sourceTable="vertice_documents"
              onClose={() => setShowPrevalidation(false)}
              onLinksUpdated={() => void loadData()}
            />
          </Suspense>
        )}
      </div>
    );
  };

  // ── Missing docs ───────────────────────────────────────

  const renderMissing = () => (
    <div>
      <h3>Documentos obrigatórios faltantes ({missingDocs.length})</h3>
      {missingDocs.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#16a34a', fontSize: 16 }}>
          ✅ Todos os documentos obrigatórios estão em dia
        </div>
      ) : (
        missingDocs.map((m: any) => (
          <div key={m.category_code} style={{
            padding: 12, borderRadius: 6, marginBottom: 8,
            background: 'var(--bg-card, #fff)', borderLeft: '4px solid #dc2626',
            boxShadow: '0 1px 2px rgba(0,0,0,.06)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.category_label}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {m.regulatory_basis || 'Sem fundamento específico'}
              {m.required_note && ` · ${m.required_note}`}
              {m.renewal_months && ` · Renova a cada ${m.renewal_months} meses`}
            </div>
            <button onClick={() => { setUploadCategory(m.category_code); setUploadTitle(m.category_label); setView('upload'); }}
              style={{ ...btnStyle('#2563eb'), marginTop: 6, padding: '4px 12px', fontSize: 11 }}>
              📤 Enviar este documento
            </button>
          </div>
        ))
      )}
    </div>
  );

  // ── Nav + Layout ───────────────────────────────────────

  const navItems = [
    { key: 'dashboard', label: '📊 Painel', onClick: () => setView('dashboard') },
    { key: 'list', label: '📋 Documentos', onClick: () => setView('list') },
    { key: 'upload', label: '📤 Enviar', onClick: () => setView('upload') },
    { key: 'missing', label: `⚠️ Faltantes (${missingDocs.length})`, onClick: () => setView('missing') },
    { key: 'alerts', label: `🔔 Alertas (${alerts.length})`, onClick: () => setView('alerts') },
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {navItems.map((n) => (
          <button key={n.key} onClick={n.onClick} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: view === n.key ? '#2563eb' : '#f3f4f6',
            color: view === n.key ? '#fff' : '#333',
          }}>{n.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Carregando...</div>
      ) : (
        <>
          {view === 'dashboard' && renderDashboard()}
          {view === 'list' && renderList()}
          {view === 'upload' && renderUpload()}
          {view === 'detail' && renderDetail()}
          {view === 'missing' && renderMissing()}
          {view === 'alerts' && (
            <div>
              <h3>Alertas</h3>
              {alerts.map((a) => (
                <div key={a.id} style={{
                  padding: 12, borderRadius: 6, marginBottom: 8,
                  borderLeft: `4px solid ${SEVERITY_COLORS[a.severity]}`,
                  background: 'var(--bg-card, #fff)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{a.message}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#999' }}>{formatDate(a.due_date)}</span>
                    <button onClick={() => ackAlert(a.id)} style={btnStyle('#666')}>Confirmar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '6px 14px', background: bg, color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
});

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13,
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = { padding: '8px 6px', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '10px 6px', verticalAlign: 'top' };
const metaCard: React.CSSProperties = { padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12 };
