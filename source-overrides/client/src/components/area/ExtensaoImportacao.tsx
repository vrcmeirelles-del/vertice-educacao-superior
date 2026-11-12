/**
 * ExtensaoImportacao — UI para importação DreamShaper (CSV/XLSX)
 * Preview → Confirmação → Execução → Resultado
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ImportRecord {
  id: string; source_system: string; file_name: string; file_hash: string;
  status: string; total_rows: number; created_count: number;
  updated_count: number; skipped_count: number; error_count: number;
  error_details: any; started_by: string; started_at: string; completed_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pendente', processing: '⚙️ Processando',
  completed: '✅ Concluída', failed: '❌ Falha', cancelled: '🚫 Cancelada',
};

export default function ExtensaoImportacao({
  institutionId, canEdit, onClose,
}: {
  institutionId: string; canEdit: boolean; onClose: () => void;
}) {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'list' | 'upload' | 'preview' | 'result'>('list');
  const [previewData, setPreviewData] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_extension_imports')
      .select('*').eq('institution_id', institutionId)
      .order('started_at', { ascending: false });
    setImports(data || []);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  // Parse CSV client-side
  const parseCSV = (text: string): string[][] => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if ((char === ',' || char === ';') && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += char; }
        }
        result.push(current.trim());
        return result;
      });
  };

  const handleFile = async (f: File) => {
    setFile(f);
    if (f.name.endsWith('.csv') || f.name.endsWith('.tsv') || f.name.endsWith('.txt')) {
      const text = await f.text();
      const rows = parseCSV(text);
      setParsedRows(rows);
      generatePreview(rows);
    } else {
      // For XLSX, show message to export as CSV
      alert('Para arquivos .xlsx, exporte como CSV primeiro. Suporte XLSX será adicionado em breve.');
      setStep('list');
    }
  };

  const generatePreview = (rows: string[][]) => {
    if (rows.length < 2) {
      setPreviewData({ error: 'Arquivo vazio ou sem dados.' });
      setStep('preview');
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Map columns
    const columnAliases: Record<string, string[]> = {
      matricula: ['matricula', 'registration', 'ra', 'registro'],
      projeto: ['projeto', 'project', 'desafio', 'challenge'],
      horas: ['horas', 'hours', 'carga_horaria', 'ch'],
      status: ['status', 'situacao', 'estado'],
      curso: ['curso', 'course', 'programa'],
    };

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_');
    const normalizedHeaders = headers.map(normalize);

    const mapped: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(columnAliases)) {
      const idx = normalizedHeaders.findIndex(h => aliases.includes(h));
      if (idx >= 0) mapped[field] = idx;
    }

    const missingFields = ['matricula', 'horas'].filter(f => !(f in mapped));
    const warnings = missingFields.map(f => `Coluna "${f}" não encontrada. Aceitos: ${columnAliases[f].join(', ')}`);

    const preview = {
      fileName: file?.name || '',
      totalRows: dataRows.length,
      headers,
      mappedFields: mapped,
      warnings,
      sampleRows: dataRows.slice(0, 10),
      validRows: dataRows.filter(r => {
        const mat = mapped.matricula != null ? r[mapped.matricula] : null;
        const hrs = mapped.horas != null ? r[mapped.horas] : null;
        return mat && hrs && !isNaN(Number(hrs));
      }).length,
    };

    setPreviewData(preview);
    setStep('preview');
  };

  const executeImport = async () => {
    if (!previewData || !file) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    // Compute file hash
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check idempotency
    const { data: existing } = await supabase.from('vertice_extension_imports')
      .select('id').eq('institution_id', institutionId).eq('file_hash', fileHash).limit(1);
    if (existing && existing.length > 0) {
      setImporting(false);
      alert('Este arquivo já foi importado anteriormente (hash duplicado).');
      return;
    }

    // Create import record
    const { data: importRecord, error: insertError } = await supabase.from('vertice_extension_imports').insert({
      institution_id: institutionId,
      source_system: 'dreamshaper',
      file_name: file.name,
      file_hash: fileHash,
      status: 'processing',
      total_rows: previewData.totalRows,
      started_by: user.id,
    }).select().single();

    if (insertError || !importRecord) {
      setImporting(false);
      alert('Erro ao criar registro de importação: ' + (insertError?.message || 'desconhecido'));
      return;
    }

    // Process rows
    let created = 0, updated = 0, skipped = 0, errorCount = 0;
    const errors: any[] = [];
    const dataRows = parsedRows.slice(1);
    const mapped = previewData.mappedFields;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const registration = mapped.matricula != null ? row[mapped.matricula]?.trim() : null;
      const hours = mapped.horas != null ? Number(row[mapped.horas]) : NaN;

      if (!registration || isNaN(hours)) {
        skipped++;
        continue;
      }

      // Find student by registration
      const { data: student } = await supabase.from('vertice_extension_students')
        .select('id, project_id').eq('institution_id', institutionId)
        .eq('registration_number', registration).limit(1).single();

      if (!student) {
        skipped++;
        errors.push({ row: i + 2, field: 'matricula', value: registration, reason: 'Estudante não encontrado' });
        errorCount++;
        continue;
      }

      // Insert hour entry
      const { error } = await supabase.from('vertice_extension_hour_entries').insert({
        institution_id: institutionId,
        project_id: student.project_id,
        student_id: student.id,
        entry_type: 'credit',
        minutes: Math.round(hours * 60),
        description: `Importação DreamShaper — ${file.name} (linha ${i + 2})`,
        activity_date: new Date().toISOString().slice(0, 10),
        hour_state: 'declarada',
        recorded_by: user.id,
      });

      if (error) { errorCount++; errors.push({ row: i + 2, reason: error.message }); }
      else { created++; }
    }

    // Update import record
    await supabase.from('vertice_extension_imports').update({
      status: errorCount > 0 && created === 0 ? 'failed' : 'completed',
      created_count: created, updated_count: updated,
      skipped_count: skipped, error_count: errorCount,
      error_details: errors.length > 0 ? errors : null,
      completed_at: new Date().toISOString(),
    }).eq('id', importRecord.id);

    setImporting(false);
    setPreviewData({ ...previewData, result: { created, updated, skipped, errorCount, errors } });
    setStep('result');
    load();
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📥 Importação DreamShaper</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      <div style={{ padding: '.75rem', background: '#eff6ff', borderRadius: '8px', marginBottom: '1rem', fontSize: '.85rem' }}>
        ℹ️ Importa horas de extensão a partir de exports CSV do DreamShaper. Aceita variações de nomes de coluna (PT/EN). Idempotente por hash de arquivo.
      </div>

      {step === 'list' && (
        <>
          {canEdit && (
            <button className="ext-btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setStep('upload')}>
              📤 Nova importação
            </button>
          )}

          {loading ? <p>Carregando...</p> : imports.length === 0 ? (
            <p className="ext-empty">Nenhuma importação registrada.</p>
          ) : (
            <table className="ext-table">
              <thead>
                <tr><th>Data</th><th>Arquivo</th><th>Status</th><th>Linhas</th><th>Criados</th><th>Erros</th></tr>
              </thead>
              <tbody>
                {imports.map(imp => (
                  <tr key={imp.id}>
                    <td>{fmtDate(imp.started_at)}</td>
                    <td>{imp.file_name}</td>
                    <td>{STATUS_LABELS[imp.status] || imp.status}</td>
                    <td className="num">{imp.total_rows}</td>
                    <td className="num" style={{ color: '#22c55e' }}>{imp.created_count || 0}</td>
                    <td className="num" style={{ color: imp.error_count > 0 ? '#ef4444' : '#6b7280' }}>{imp.error_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {step === 'upload' && (
        <div className="ext-form">
          <h3>Selecionar arquivo CSV</h3>
          <p style={{ fontSize: '.85rem', color: '#6b7280' }}>
            Colunas esperadas: <strong>matrícula</strong> (obrigatória), <strong>horas</strong> (obrigatória), projeto, curso, status.
            Aceita variações: "ra", "registration", "ch", "carga_horaria", etc.
          </p>
          <input type="file" accept=".csv,.tsv,.txt" onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }} />
          <div className="ext-form-actions" style={{ marginTop: '1rem' }}>
            <button className="ext-btn-cancel" onClick={() => setStep('list')}>Cancelar</button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div>
          <h3>Prévia da importação — {previewData.fileName}</h3>

          {previewData.error ? (
            <p style={{ color: '#ef4444' }}>{previewData.error}</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '.5rem', marginBottom: '1rem' }}>
                <div className="ext-stat-card">
                  <span className="ext-stat-value">{previewData.totalRows}</span>
                  <span className="ext-stat-label">Linhas</span>
                </div>
                <div className="ext-stat-card">
                  <span className="ext-stat-value" style={{ color: '#22c55e' }}>{previewData.validRows}</span>
                  <span className="ext-stat-label">Válidas</span>
                </div>
                <div className="ext-stat-card">
                  <span className="ext-stat-value" style={{ color: '#ef4444' }}>{previewData.totalRows - previewData.validRows}</span>
                  <span className="ext-stat-label">Inválidas</span>
                </div>
              </div>

              {previewData.warnings.length > 0 && (
                <div style={{ padding: '.75rem', background: '#fef3c7', borderRadius: '8px', marginBottom: '1rem' }}>
                  {previewData.warnings.map((w: string, i: number) => <p key={i} style={{ margin: '.25rem 0', fontSize: '.85rem' }}>⚠️ {w}</p>)}
                </div>
              )}

              <h4>Amostra (primeiras 10 linhas)</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="ext-table">
                  <thead><tr>{previewData.headers.map((h: string, i: number) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>
                    {previewData.sampleRows.map((row: string[], i: number) => (
                      <tr key={i}>{row.map((cell: string, j: number) => <td key={j}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ext-form-actions" style={{ marginTop: '1rem' }}>
                <button className="ext-btn-save" disabled={importing || previewData.validRows === 0}
                  onClick={executeImport}>
                  {importing ? '⏳ Importando...' : `✅ Importar ${previewData.validRows} registros`}
                </button>
                <button className="ext-btn-cancel" onClick={() => { setStep('list'); setPreviewData(null); }} disabled={importing}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'result' && previewData?.result && (
        <div>
          <h3>✅ Importação concluída</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '.5rem', marginBottom: '1rem' }}>
            <div className="ext-stat-card">
              <span className="ext-stat-value" style={{ color: '#22c55e' }}>{previewData.result.created}</span>
              <span className="ext-stat-label">Criados</span>
            </div>
            <div className="ext-stat-card">
              <span className="ext-stat-value" style={{ color: '#f59e0b' }}>{previewData.result.skipped}</span>
              <span className="ext-stat-label">Ignorados</span>
            </div>
            <div className="ext-stat-card">
              <span className="ext-stat-value" style={{ color: '#ef4444' }}>{previewData.result.errorCount}</span>
              <span className="ext-stat-label">Erros</span>
            </div>
          </div>

          {previewData.result.errors.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
              <table className="ext-table">
                <thead><tr><th>Linha</th><th>Campo</th><th>Motivo</th></tr></thead>
                <tbody>
                  {previewData.result.errors.slice(0, 20).map((e: any, i: number) => (
                    <tr key={i}>
                      <td>{e.row}</td>
                      <td>{e.field || '—'}</td>
                      <td>{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="ext-btn-primary" onClick={() => { setStep('list'); setPreviewData(null); setFile(null); }}>
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
