/**
 * ExtensaoPerfis — Gestão dos 12 perfis de acesso do Impacto
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ImpactoRole {
  id: string; user_id: string; role: string;
  course_id: string | null; project_id: string | null;
  granted_by: string; granted_at: string;
  expires_at: string | null; active: boolean; notes: string | null;
}

const ROLE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  master: { label: 'Master', icon: '👑', desc: 'Acesso global à plataforma Vértice' },
  reitor: { label: 'Reitor(a)', icon: '🏛️', desc: 'Visão institucional consolidada' },
  direcao: { label: 'Direção', icon: '📊', desc: 'Acompanhamento executivo' },
  pro_reitoria: { label: 'Pró-Reitoria', icon: '🎓', desc: 'Gestão acadêmica e extensão' },
  diretor_pedagogico: { label: 'Diretor Pedagógico', icon: '📖', desc: 'Gestão das estruturas curriculares' },
  coordenador_curso: { label: 'Coordenador de Curso', icon: '📋', desc: 'Gestão da extensão do curso' },
  coordenador_extensao: { label: 'Coordenador de Extensão', icon: '🌍', desc: 'Gestão dos projetos e atividades' },
  nde: { label: 'NDE', icon: '📝', desc: 'Acompanhamento pedagógico e curricular' },
  professor_orientador: { label: 'Professor Orientador', icon: '👨‍🏫', desc: 'Orientação e avaliação dos projetos' },
  estudante: { label: 'Estudante', icon: '🎒', desc: 'Acompanhamento das atividades e horas' },
  parceiro_externo: { label: 'Parceiro Externo', icon: '🤝', desc: 'Participação e avaliação autorizadas' },
  auditor: { label: 'Auditor', icon: '🔎', desc: 'Acesso controlado a evidências e relatórios' },
};

const ROLE_ORDER = ['master','reitor','direcao','pro_reitoria','diretor_pedagogico','coordenador_curso','coordenador_extensao','nde','professor_orientador','estudante','parceiro_externo','auditor'];

export default function ExtensaoPerfis({
  institutionId, canEdit, onClose,
}: {
  institutionId: string; canEdit: boolean; onClose: () => void;
}) {
  const [roles, setRoles] = useState<ImpactoRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ user_email: '', role: 'professor_orientador', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vertice_impacto_roles')
      .select('*').eq('institution_id', institutionId)
      .order('role');
    setRoles(data || []);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('vertice_impacto_roles')
      .update({ active: !active }).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else load();
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  // Group by role
  const grouped = ROLE_ORDER.map(r => ({
    role: r,
    ...ROLE_LABELS[r],
    members: roles.filter(m => m.role === r),
  }));

  const totalActive = roles.filter(r => r.active).length;
  const rolesInUse = new Set(roles.filter(r => r.active).map(r => r.role)).size;

  return (
    <div className="ext-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>🔐 Perfis de Acesso — Impacto</h3>
        <button className="ext-btn-cancel" onClick={onClose}>✕ Fechar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{totalActive}</span>
          <span className="ext-stat-label">Usuários ativos</span>
        </div>
        <div className="ext-stat-card">
          <span className="ext-stat-value">{rolesInUse}/12</span>
          <span className="ext-stat-label">Perfis em uso</span>
        </div>
      </div>

      {loading ? <p>Carregando...</p> : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {grouped.map(g => (
            <div key={g.role} style={{ padding: '1rem', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '1.2rem', marginRight: '.5rem' }}>{g.icon}</span>
                  <strong>{g.label}</strong>
                  <span style={{ marginLeft: '.75rem', fontSize: '.8rem', color: '#6b7280' }}>{g.desc}</span>
                </div>
                <span style={{ fontSize: '.85rem', fontWeight: 600, color: g.members.filter(m => m.active).length > 0 ? '#22c55e' : '#9ca3af' }}>
                  {g.members.filter(m => m.active).length} ativo(s)
                </span>
              </div>

              {g.members.length > 0 && (
                <div style={{ marginTop: '.75rem', paddingLeft: '2rem' }}>
                  {g.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.35rem 0', borderBottom: '1px solid var(--border-light, #f3f4f6)', opacity: m.active ? 1 : 0.5 }}>
                      <div>
                        <code style={{ fontSize: '.8rem' }}>{m.user_id.slice(0, 8)}…</code>
                        {m.notes && <span style={{ marginLeft: '.5rem', fontSize: '.8rem', color: '#6b7280' }}>({m.notes})</span>}
                        {m.expires_at && <span style={{ marginLeft: '.5rem', fontSize: '.75rem', color: '#f59e0b' }}>⏰ {fmtDate(m.expires_at)}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                        <small style={{ color: '#9ca3af' }}>desde {fmtDate(m.granted_at)}</small>
                        {canEdit && (
                          <button className="ext-btn-small" onClick={() => toggleActive(m.id, m.active)}>
                            {m.active ? 'Desativar' : 'Ativar'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
