import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./sync-health.css";

interface ProvenanceRow { tabela:string; conjunto:string; fonte:string; metodo:string; status:string; linhas:number; congelado:boolean; observacao?:string; registrado_em:string; }
interface SyncLogRow { id:string; module:string; source:string; destination:string; records_processed:number; records_inserted:number; records_updated:number; divergences:number; failures:number; status:string; started_at:string; finished_at?:string; }

// Module definitions with expected tables and status logic
const MODULES = [
  { key:'eorbit', label:'e-ORBIT (legado)', source:'e-ORBIT', dest:'Supabase', tables:['vertice_eorbit_semestres','vertice_eorbit_cursos','vertice_eorbit_quantitativo','vertice_eorbit_professores'] },
  { key:'academic_reports', label:'Relatórios Acadêmicos', source:'e-ORBIT', dest:'vertice_academic_reports', tables:['vertice_academic_reports'] },
  { key:'offering_outcomes', label:'Ofertas / Reprovações', source:'e-ORBIT', dest:'vertice_offering_outcomes', tables:['vertice_offering_outcomes'] },
  { key:'fato_ordem', label:'Fato & Ordem (ponte)', source:'F&O API', dest:'vertice_roster_entries', tables:['vertice_roster_imports','vertice_roster_entries','vertice_enade_eligibility'] },
  { key:'governanca', label:'Governança 360°', source:'Portal', dest:'governance_*', tables:['governance_bodies','governance_meetings','governance_deliberations'] },
  { key:'inclusao', label:'Inclusão 360° + PEI', source:'Portal', dest:'student_support_*', tables:['student_support_cases','student_individual_plans','student_plan_accommodations'] },
  { key:'acompanhamento', label:'Acompanhamento Especial', source:'Portal', dest:'student_special_*', tables:['student_special_cases','student_special_requests','student_special_plans'] },
  { key:'egressos', label:'Egressos 360°', source:'Portal + API', dest:'vertice_alumni_*', tables:['vertice_alumni_profiles','vertice_alumni_education'] },
  { key:'captacao', label:'Captação Integrada', source:'Meta/TikTok', dest:'vertice_captacao_*', tables:['vertice_captacao_connections','vertice_captacao_campaigns'] },
  { key:'onedrive', label:'Espelhamento OneDrive', source:'Portal', dest:'OneDrive', tables:['vertice_onedrive_espelho','vertice_onedrive_documentos'] },
  { key:'instrumento', label:'Instrumento INEP', source:'Portal', dest:'vertice_instrumento_*', tables:['vertice_instrumento_checklist','vertice_instrumento_evidencias'] },
  { key:'whitelabel', label:'White-label dinâmico', source:'Portal', dest:'vertice_institutions.ui_branding', tables:[] },
];

type ModuleStatus = 'operacional'|'parcial'|'pendente'|'bloqueado'|'com_erro'|'nao_configurado';

interface Props { institutionId:string; }

export default function SyncHealth({ institutionId }:Props) {
  const [provenance, setProvenance] = useState<ProvenanceRow[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string,number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Get provenance
    const { data: prov } = await supabase.from('vertice_data_provenance').select('*').eq('institution_id', institutionId).order('registrado_em', { ascending: false });
    if (prov) setProvenance(prov);

    // Get counts for key tables
    const counts: Record<string,number> = {};
    for (const m of MODULES) {
      for (const t of m.tables) {
        try {
          const { count } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
          counts[t] = count ?? 0;
        } catch {
          // table might use instituicao_id (eorbit) or not have institution_id
          const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
          counts[t] = count ?? 0;
        }
      }
    }
    setTableCounts(counts);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  function getModuleStatus(m: typeof MODULES[number]): ModuleStatus {
    if (m.tables.length === 0) return 'operacional'; // no tables to check
    const total = m.tables.reduce((s, t) => s + (tableCounts[t] || 0), 0);
    const hasProvenance = provenance.some(p => m.tables.includes(p.tabela));
    const allZero = m.tables.every(t => (tableCounts[t] || 0) === 0);
    if (allZero && !hasProvenance) return 'nao_configurado';
    if (allZero && hasProvenance) return 'pendente';
    const someZero = m.tables.some(t => (tableCounts[t] || 0) === 0);
    if (someZero) return 'parcial';
    return 'operacional';
  }

  const statusLabel: Record<ModuleStatus, string> = {
    operacional: 'Operacional', parcial: 'Parcial', pendente: 'Pendente',
    bloqueado: 'Bloqueado', com_erro: 'Com erro', nao_configurado: 'Não configurado',
  };
  const statusClass: Record<ModuleStatus, string> = {
    operacional: 'sh-ok', parcial: 'sh-warn', pendente: 'sh-pending',
    bloqueado: 'sh-blocked', com_erro: 'sh-error', nao_configurado: 'sh-none',
  };

  if (loading) return <div className="sh-loading">Carregando integrações…</div>;

  const totalProv = provenance.length;
  const totalRecords = provenance.reduce((s, p) => s + (p.linhas || 0), 0);
  const frozen = provenance.filter(p => p.congelado).length;

  return (
    <div className="sync-health">
      <h3 className="sh-title">Vértice · Central de Sincronização e Integrações</h3>

      <div className="sh-summary">
        <div className="sh-stat"><span className="sh-stat-n">{MODULES.length}</span><span className="sh-stat-l">Módulos</span></div>
        <div className="sh-stat"><span className="sh-stat-n">{MODULES.filter(m => getModuleStatus(m) === 'operacional').length}</span><span className="sh-stat-l">Operacionais</span></div>
        <div className="sh-stat"><span className="sh-stat-n">{totalProv}</span><span className="sh-stat-l">Fontes registradas</span></div>
        <div className="sh-stat"><span className="sh-stat-n">{totalRecords.toLocaleString('pt-BR')}</span><span className="sh-stat-l">Registros rastreados</span></div>
        <div className="sh-stat"><span className="sh-stat-n">{frozen}</span><span className="sh-stat-l">Congelados (v1)</span></div>
      </div>

      <div className="sh-table-wrap">
        <table className="sh-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Fonte</th>
              <th>Destino</th>
              <th>Registros</th>
              <th>Status</th>
              <th>Última atualização</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map(m => {
              const st = getModuleStatus(m);
              const total = m.tables.reduce((s, t) => s + (tableCounts[t] || 0), 0);
              const lastProv = provenance.find(p => m.tables.includes(p.tabela));
              return (
                <tr key={m.key}>
                  <td><strong>{m.label}</strong></td>
                  <td>{m.source}</td>
                  <td className="sh-mono">{m.dest}</td>
                  <td className="sh-right">{total.toLocaleString('pt-BR')}</td>
                  <td><span className={`sh-badge ${statusClass[st]}`}>{statusLabel[st]}</span></td>
                  <td>{lastProv ? new Date(lastProv.registrado_em).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="sh-details">
        <summary>Inventário completo de dados ({totalProv} fontes)</summary>
        <div className="sh-table-wrap">
          <table className="sh-table sh-table-sm">
            <thead><tr><th>Tabela</th><th>Conjunto</th><th>Fonte</th><th>Método</th><th>Linhas</th><th>Status</th><th>Congelado</th><th>Data</th></tr></thead>
            <tbody>
              {provenance.map((p, i) => (
                <tr key={i}>
                  <td className="sh-mono">{p.tabela}</td>
                  <td>{p.conjunto || '—'}</td>
                  <td>{p.fonte}</td>
                  <td>{p.metodo}</td>
                  <td className="sh-right">{p.linhas?.toLocaleString('pt-BR')}</td>
                  <td><span className={`sh-badge ${p.status === 'legado' ? 'sh-warn' : 'sh-ok'}`}>{p.status}</span></td>
                  <td>{p.congelado ? '🔒' : '—'}</td>
                  <td>{new Date(p.registrado_em).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
