/**
 * ExtensaoRelatorios — Exportação de relatórios em CSV
 * Gera planilhas a partir das views consolidadas
 */
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

type ReportType = 'hours' | 'projects' | 'students' | 'activities' | 'evidence' | 'findings' | 'curricularization';

const REPORTS: { type: ReportType; label: string; icon: string; desc: string }[] = [
  { type: 'hours', label: 'Livro-razão de horas', icon: '📒', desc: 'Todos os lançamentos de horas com estado, tipo e data' },
  { type: 'projects', label: 'Projetos de extensão', icon: '📋', desc: 'Lista completa com status, coordenador, comunidade e orçamento' },
  { type: 'students', label: 'Estudantes', icon: '🎓', desc: 'Estudantes vinculados com matrícula, projeto e horas' },
  { type: 'activities', label: 'Atividades realizadas', icon: '📅', desc: 'Atividades por projeto com tipo, duração e status' },
  { type: 'evidence', label: 'Repositório de evidências', icon: '📁', desc: 'Documentos com tipo, versão e status de validação' },
  { type: 'findings', label: 'Achados e ações', icon: '🔍', desc: 'Achados com severidade, categoria e status de resolução' },
  { type: 'curricularization', label: 'Curricularização por curso', icon: '📊', desc: 'Horas previstas/executadas/validadas/integralizadas por curso' },
];

function toCSV(data: any[], columns?: string[]): string {
  if (data.length === 0) return '';
  const keys = columns || Object.keys(data[0]);
  const header = keys.join(';');
  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k];
      if (val == null) return '';
      const str = Array.isArray(val) ? val.join(', ') : String(val);
      return str.includes(';') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(';')
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const BOM = '﻿'; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExtensaoRelatorios({
  institutionId, onClose,
}: {
  institutionId: string; onClose: () => void;
}) {
  const [generating, setGenerating] = useState<ReportType | null>(null);

  const generate = useCallback(async (type: ReportType) => {
    setGenerating(type);
    const now = new Date().toISOString().slice(0, 10);
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'hours': {
        const { data: d } = await supabase.from('vertice_extension_hour_entries')
          .select('student_id, project_id, entry_type, minutes, hour_state, description, activity_date, recorded_at')
          .eq('institution_id', institutionId).order('activity_date', { ascending: false });
        data = (d || []).map(r => ({ ...r, horas: (Math.abs(r.minutes) / 60).toFixed(1) }));
        filename = `impacto-horas-${now}.csv`;
        break;
      }
      case 'projects': {
        const { data: d } = await supabase.from('vertice_extension_projects')
          .select('code, title, project_type, status, review_status, coordinator_name, target_community, target_audience_count, total_hours, semester, start_date, end_date, social_problem, general_objective, methodology')
          .eq('institution_id', institutionId).order('created_at', { ascending: false });
        data = d || [];
        filename = `impacto-projetos-${now}.csv`;
        break;
      }
      case 'students': {
        const { data: d } = await supabase.from('vertice_extension_students')
          .select('registration_number, project_id, hours_assigned, hours_completed, status, is_scholarship')
          .eq('institution_id', institutionId).order('registration_number');
        data = d || [];
        filename = `impacto-estudantes-${now}.csv`;
        break;
      }
      case 'activities': {
        const { data: d } = await supabase.from('vertice_extension_activities')
          .select('project_id, title, activity_type, scheduled_date, duration_minutes, location, status')
          .eq('institution_id', institutionId).order('scheduled_date', { ascending: false });
        data = (d || []).map(r => ({ ...r, horas: (r.duration_minutes / 60).toFixed(1) }));
        filename = `impacto-atividades-${now}.csv`;
        break;
      }
      case 'evidence': {
        const { data: d } = await supabase.from('vertice_extension_evidence_registry')
          .select('title, document_type, file_name, file_size_bytes, version, validation_status, period, uploaded_at')
          .eq('institution_id', institutionId).eq('is_current', true).order('uploaded_at', { ascending: false });
        data = (d || []).map(r => ({ ...r, tamanho_kb: (r.file_size_bytes / 1024).toFixed(1) }));
        filename = `impacto-evidencias-${now}.csv`;
        break;
      }
      case 'findings': {
        const { data: d } = await supabase.from('vertice_extension_findings')
          .select('title, description, severity, category, source_type, status, potential_impact, found_at')
          .eq('institution_id', institutionId).order('found_at', { ascending: false });
        data = d || [];
        filename = `impacto-achados-${now}.csv`;
        break;
      }
      case 'curricularization': {
        const { data: d } = await supabase.from('v_extension_curricularization')
          .select('*').eq('institution_id', institutionId);
        data = d || [];
        filename = `impacto-curricularizacao-${now}.csv`;
        break;
      }
    }

    if (data.length === 0) {
      alert('Nenhum dado encontrado para este relatório.');
    } else {
      downloadCSV(toCSV(data), filename);
    }
    setGenerating(null);
  }, [institutionId]);

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>📊 Relatórios e Exportação</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      <p style={{ fontSize: '.85rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Exporta os dados do módulo Impacto em CSV (compatível com Excel). Separador: ponto-e-vírgula. Codificação: UTF-8 com BOM.
      </p>

      <div style={{ display: 'grid', gap: '.75rem' }}>
        {REPORTS.map(r => (
          <div key={r.type} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem', border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px',
          }}>
            <div>
              <strong>{r.icon} {r.label}</strong>
              <p style={{ margin: '.25rem 0 0', fontSize: '.82rem', color: '#6b7280' }}>{r.desc}</p>
            </div>
            <button
              className="ext-btn-primary"
              style={{ flexShrink: 0 }}
              disabled={generating === r.type}
              onClick={() => generate(r.type)}
            >
              {generating === r.type ? '⏳...' : '📥 CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
