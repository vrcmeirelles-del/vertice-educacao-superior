// IntegrationSettings.tsx — Painel de configuração de integração da IES
// A IES insere chave de API, escolhe quais dados integrar, com explicação de cada um
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import "./integration-settings.css";

interface DataScope {
  key: string;
  label: string;
  description: string;
  impact: string;
  required: boolean;
  category: 'basico' | 'academico' | 'financeiro' | 'pessoal';
}

const DATA_SCOPES: DataScope[] = [
  // Básico — sempre necessário
  { key: 'cursos', label: 'Cursos e Modalidades', description: 'Lista de cursos ativos, modalidades (presencial, EAD, semipresencial), turnos e vagas.', impact: 'Essencial para qualquer módulo da Vértice. Sem isso, o painel não tem estrutura.', required: true, category: 'basico' },
  { key: 'docentes', label: 'Corpo Docente', description: 'Nome, titulação, regime de trabalho e disciplinas ministradas por cada professor.', impact: 'Alimenta o BI Acadêmico, Simulador de Custo e indicadores regulatórios (INEP).', required: true, category: 'basico' },

  // Acadêmico — recomendado
  { key: 'matriculas_agregado', label: 'Matrículas (agregado)', description: 'Quantitativo de matrículas por curso, semestre e status (ativo, trancado, cancelado, concluído). Sem dados pessoais.', impact: 'Alimenta BI da Direção, evasão, captação e todos os indicadores de ocupação.', required: false, category: 'academico' },
  { key: 'evasao', label: 'Dados de Evasão', description: 'Alunos que cancelaram ou abandonaram, por período e curso. Agregado, sem identificação.', impact: 'Permite calcular taxa de evasão real, separar lead frio de abandono e projetar rematrícula.', required: false, category: 'academico' },
  { key: 'notas_frequencia', label: 'Notas e Frequência', description: 'Médias por disciplina/turma e percentual de frequência. Sem nome de aluno.', impact: 'Alimenta reprovações por disciplina/professor, risco agregado e preparação ENADE.', required: false, category: 'academico' },
  { key: 'alunos_nominais', label: 'Dados Nominais de Alunos', description: 'Nome, matrícula, situação individual do aluno. NÃO inclui CPF, RG ou documentos.', impact: 'Necessário para ENADE 360° (elegibilidade), egressos e acompanhamento individual. Acesso restrito ao gestor da IES.', required: false, category: 'pessoal' },
  { key: 'vestibular', label: 'Vestibular e Seletivos', description: 'Inscritos, aprovados, matriculados por edital e curso.', impact: 'Alimenta BI de Captação, funil de conversão e análise de concorrência.', required: false, category: 'academico' },

  // Financeiro — opcional, sob aprovação
  { key: 'financeiro_receita', label: 'Receita por Curso', description: 'Ticket médio, inadimplência, receita bruta por curso/período. Sem dados de alunos.', impact: 'Alimenta Resultado por Curso, EBITDA simulado e projeções financeiras.', required: false, category: 'financeiro' },
  { key: 'financeiro_folha', label: 'Gasto com Pessoal (estimado)', description: 'Custo estimado da folha docente por curso, baseado em horas-aula e pisos da CCT. NÃO são dados contábeis reais.', impact: 'Necessário para o Simulador de Custo. Usa a CCT como referência, não abre dados reais de RH.', required: false, category: 'financeiro' },
];

const CATEGORY_INFO: Record<string, { label: string; color: string; icon: string }> = {
  basico: { label: 'Dados Básicos (obrigatório)', color: '#2563eb', icon: '🏗️' },
  academico: { label: 'Dados Acadêmicos', color: '#059669', icon: '🎓' },
  pessoal: { label: 'Dados Nominais (Camada 2)', color: '#d97706', icon: '👤' },
  financeiro: { label: 'Dados Financeiros', color: '#dc2626', icon: '💰' },
};

interface IntegrationConfig {
  api_url?: string;
  api_key?: string;
  connection_type: 'api' | 'database' | 'csv' | 'onedrive' | 'agent';
  granted_scopes: string[];
  sync_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  last_sync?: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
}

export default function IntegrationSettings({
  institutionId,
  institutionName,
  role,
}: {
  institutionId: string;
  institutionName: string;
  role: string;
}) {
  const [config, setConfig] = useState<IntegrationConfig>({
    connection_type: 'api',
    granted_scopes: ['cursos', 'docentes'],
    sync_frequency: 'daily',
    status: 'pending',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [upgradeAlert, setUpgradeAlert] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [institutionId]);

  async function loadConfig() {
    const { data } = await supabase
      .from('vertice_captacao_connections')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('provider', 'academic_system')
      .maybeSingle();
    if (data?.config) {
      setConfig({ ...config, ...data.config });
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await supabase.from('vertice_captacao_connections').upsert({
        institution_id: institutionId,
        provider: 'academic_system',
        config,
        status: 'configured',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id,provider' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function toggleScope(key: string) {
    const scope = DATA_SCOPES.find(s => s.key === key);
    if (scope?.required) return; // não desliga obrigatório

    const current = new Set(config.granted_scopes);
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    setConfig({ ...config, granted_scopes: Array.from(current) });
  }

  function handleUpgradeCheck(moduleNeeded: string, scopeNeeded: string) {
    if (!config.granted_scopes.includes(scopeNeeded)) {
      setUpgradeAlert(`Para ativar o módulo "${moduleNeeded}", é necessário que a instituição libere o acesso a "${DATA_SCOPES.find(s => s.key === scopeNeeded)?.label}". Após a liberação, a integração leva de 24 a 72 horas para sincronizar os dados completos.`);
    }
  }

  const categories = ['basico', 'academico', 'pessoal', 'financeiro'] as const;
  const isMaster = role === 'master';

  return (
    <div className="int-settings">
      <div className="int-header">
        <div>
          <p className="int-eyebrow">INTEGRAÇÃO · {institutionName.toUpperCase()}</p>
          <h2>Configuração de Dados</h2>
          <p className="int-subtitle">Configure a conexão com o sistema acadêmico e escolha quais dados serão sincronizados.</p>
        </div>
      </div>

      {/* Tipo de conexão */}
      <section className="int-section">
        <h3>Tipo de Conexão</h3>
        <div className="int-conn-grid">
          {([
            { type: 'api', icon: '🔌', label: 'API REST', desc: 'Integração direta com a API do sistema acadêmico' },
            { type: 'database', icon: '🗄️', label: 'Banco de Dados', desc: 'Conexão somente-leitura ao banco do sistema' },
            { type: 'csv', icon: '📄', label: 'CSV / Planilha', desc: 'Importação manual ou agendada de arquivos' },
            { type: 'onedrive', icon: '☁️', label: 'OneDrive / SharePoint', desc: 'Pasta compartilhada com sincronização automática' },
            { type: 'agent', icon: '🤖', label: 'Agente Local', desc: 'Software instalado na rede da IES para coleta automática' },
          ] as const).map(c => (
            <button
              key={c.type}
              className={`int-conn-card${config.connection_type === c.type ? ' active' : ''}`}
              onClick={() => setConfig({ ...config, connection_type: c.type })}
            >
              <span className="int-conn-icon">{c.icon}</span>
              <strong>{c.label}</strong>
              <small>{c.desc}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Credenciais */}
      {(config.connection_type === 'api' || config.connection_type === 'database') && (
        <section className="int-section">
          <h3>🔑 Credenciais</h3>
          <p className="int-muted">Informe os dados de acesso ao sistema acadêmico. Esses dados são criptografados e acessíveis apenas pela plataforma.</p>
          <div className="int-form-grid">
            <label>
              URL do endpoint / Host
              <input
                type="url"
                placeholder={config.connection_type === 'api' ? 'https://api.sistema.edu.br/v1' : 'db.sistema.edu.br:5432'}
                value={config.api_url || ''}
                onChange={e => setConfig({ ...config, api_url: e.target.value })}
              />
            </label>
            <label>
              Chave de API / Token de acesso
              <div className="int-key-field">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk_live_..."
                  value={config.api_key || ''}
                  onChange={e => setConfig({ ...config, api_key: e.target.value })}
                />
                <button type="button" className="int-toggle-key" onClick={() => setShowKey(!showKey)}>
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* Frequência */}
      <section className="int-section">
        <h3>⏱️ Frequência de Sincronização</h3>
        <div className="int-freq-grid">
          {([
            { freq: 'realtime', label: 'Tempo real', desc: 'Webhook — dados atualizados instantaneamente' },
            { freq: 'hourly', label: 'A cada hora', desc: 'Consulta automática a cada 60 minutos' },
            { freq: 'daily', label: 'Diária', desc: 'Uma vez por dia, de madrugada' },
            { freq: 'weekly', label: 'Semanal', desc: 'Toda segunda-feira' },
            { freq: 'manual', label: 'Manual', desc: 'Só quando a IES disparar' },
          ] as const).map(f => (
            <button
              key={f.freq}
              className={`int-freq-btn${config.sync_frequency === f.freq ? ' active' : ''}`}
              onClick={() => setConfig({ ...config, sync_frequency: f.freq })}
            >
              <strong>{f.label}</strong>
              <small>{f.desc}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Escopos de dados */}
      <section className="int-section">
        <h3>📋 Dados Autorizados para Sincronização</h3>
        <p className="int-muted">Selecione quais dados a instituição autoriza a Vértice a sincronizar. Cada tipo de dado alimenta módulos específicos da plataforma.</p>

        {categories.map(cat => {
          const info = CATEGORY_INFO[cat];
          const scopes = DATA_SCOPES.filter(s => s.category === cat);
          return (
            <div key={cat} className="int-scope-group">
              <div className="int-scope-group-header" style={{ borderLeftColor: info.color }}>
                <span>{info.icon}</span>
                <strong style={{ color: info.color }}>{info.label}</strong>
              </div>
              {scopes.map(scope => {
                const granted = config.granted_scopes.includes(scope.key);
                return (
                  <div key={scope.key} className={`int-scope-item${granted ? ' granted' : ''}`}>
                    <div className="int-scope-toggle">
                      <label className="int-switch">
                        <input
                          type="checkbox"
                          checked={granted}
                          disabled={scope.required}
                          onChange={() => toggleScope(scope.key)}
                        />
                        <span className="int-slider"></span>
                      </label>
                    </div>
                    <div className="int-scope-info">
                      <strong>{scope.label} {scope.required && <span className="int-required">obrigatório</span>}</strong>
                      <p className="int-scope-desc">{scope.description}</p>
                      <p className="int-scope-impact">💡 <em>{scope.impact}</em></p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Alerta de categoria financeira */}
        {config.granted_scopes.some(s => s.startsWith('financeiro')) && (
          <div className="int-alert int-alert-warn">
            <strong>⚠️ Dados financeiros</strong>
            <p>A liberação de dados financeiros requer aprovação do master da plataforma. Os dados são tratados com criptografia e não incluem informações contábeis detalhadas — apenas estimativas baseadas em parâmetros de mercado (CCT).</p>
          </div>
        )}

        {/* Alerta de dados nominais */}
        {config.granted_scopes.includes('alunos_nominais') && (
          <div className="int-alert int-alert-info">
            <strong>👤 Dados nominais de alunos (Camada 2)</strong>
            <p>O acesso nominal é restrito ao gestor da IES e ao master. Nenhum dado pessoal sensível (CPF, RG, documentos) é extraído. Os dados são protegidos por RLS e criptografia em trânsito (TLS 1.3).</p>
          </div>
        )}
      </section>

      {/* Alerta de upgrade sem acesso */}
      {upgradeAlert && (
        <div className="int-alert int-alert-upgrade">
          <strong>🔓 Acesso necessário para upgrade</strong>
          <p>{upgradeAlert}</p>
          <button className="int-alert-close" onClick={() => setUpgradeAlert(null)}>Entendi</button>
        </div>
      )}

      {/* Ações */}
      <div className="int-actions">
        <button className="int-btn-save" onClick={saveConfig} disabled={saving}>
          {saving ? 'Salvando...' : saved ? '✅ Configuração salva' : 'Salvar configuração'}
        </button>
        {isMaster && (
          <button className="int-btn-test" onClick={() => alert('Teste de conexão em desenvolvimento')}>
            Testar conexão
          </button>
        )}
      </div>

      {/* Info de tempo de integração */}
      <div className="int-info-box">
        <strong>⏳ Tempo estimado de integração</strong>
        <ul>
          <li><strong>API REST / Banco:</strong> 24 a 48 horas após configuração da chave</li>
          <li><strong>CSV / OneDrive:</strong> Imediato após upload — dados disponíveis em minutos</li>
          <li><strong>Agente local:</strong> 48 a 72 horas — inclui instalação e validação</li>
          <li><strong>Novos escopos:</strong> Ao liberar um novo tipo de dado, a sincronização completa leva de 24 a 72 horas</li>
        </ul>
      </div>
    </div>
  );
}
