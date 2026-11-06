import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import './resultado-curso-bi.css';

/* ── Formatação financeira pt-BR ── */
const fmt = new Intl.NumberFormat('pt-BR');
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toFixed(1) + '%';

const COLORS = ['#2678a8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];

/* ── Estrutura das abas de dados (espelha a planilha) ── */
type TabKey =
  | 'ies_unidades' | 'cursos_ofertas' | 'academico_mensal'
  | 'receitas_base' | 'receitas_ampliadas' | 'recebiveis_caixa'
  | 'pessoal' | 'custos_diretos' | 'despesas_comuns'
  | 'rateio' | 'ativos_investimentos' | 'dre_institucional'
  | 'documentos' | 'controle_entrega' | 'simulacao';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  columns: { key: string; label: string; type: 'text' | 'number' | 'date' | 'money' | 'percent' | 'select'; options?: string[]; width?: number }[];
}

const TABS: TabDef[] = [
  {
    key: 'ies_unidades', label: 'IES e Unidades', icon: '🏛',
    columns: [
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'razao_social', label: 'Razão social', type: 'text', width: 200 },
      { key: 'nome_ies', label: 'Nome IES', type: 'text', width: 180 },
      { key: 'cnpj', label: 'CNPJ', type: 'text' },
      { key: 'cod_emec', label: 'Código e-MEC', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'nome_unidade', label: 'Nome unidade', type: 'text', width: 180 },
      { key: 'tipo_unidade', label: 'Tipo', type: 'select', options: ['Sede', 'Campus', 'Polo', 'Outra'] },
      { key: 'cidade_uf', label: 'Cidade / UF', type: 'text' },
      { key: 'inicio_operacao', label: 'Início', type: 'date' },
      { key: 'fim_operacao', label: 'Fim', type: 'date' },
      { key: 'regime_tributario', label: 'Regime tributário', type: 'text' },
      { key: 'observacoes', label: 'Observações', type: 'text', width: 200 },
    ],
  },
  {
    key: 'cursos_ofertas', label: 'Cursos e Ofertas', icon: '📚',
    columns: [
      { key: 'id_curso', label: 'ID curso / oferta', type: 'text' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'nome_curso', label: 'Nome curso / produto', type: 'text', width: 220 },
      { key: 'cod_emec_curso', label: 'Código e-MEC', type: 'text' },
      { key: 'nivel_tipo', label: 'Nível / tipo', type: 'select', options: ['Graduação', 'Especialização', 'MBA', 'Mestrado', 'Doutorado', 'Extensão', 'Curso livre', 'Serviço', 'Outro'] },
      { key: 'modalidade', label: 'Modalidade', type: 'select', options: ['Presencial', 'Semipresencial', 'EAD', 'Outra'] },
      { key: 'turno', label: 'Turno', type: 'text' },
      { key: 'centro_custo', label: 'Centro de custo', type: 'text' },
      { key: 'inicio_oferta', label: 'Início da oferta', type: 'date' },
      { key: 'fim_oferta', label: 'Fim da oferta', type: 'date' },
      { key: 'duracao_semestres', label: 'Duração (sem)', type: 'number' },
      { key: 'carga_horaria', label: 'Carga horária', type: 'number' },
      { key: 'vagas_autorizadas', label: 'Vagas anuais', type: 'number' },
      { key: 'situacao', label: 'Situação', type: 'select', options: ['Ativo', 'Suspenso', 'Em extinção', 'Encerrado', 'Planejado'] },
    ],
  },
  {
    key: 'academico_mensal', label: 'Acadêmico Mensal', icon: '🎓',
    columns: [
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso', type: 'text' },
      { key: 'alunos_ativos', label: 'Alunos ativos', type: 'number' },
      { key: 'alunos_faturados', label: 'Faturados', type: 'number' },
      { key: 'ingressantes', label: 'Ingressantes', type: 'number' },
      { key: 'rematriculados', label: 'Rematriculados', type: 'number' },
      { key: 'concluintes', label: 'Concluintes', type: 'number' },
      { key: 'evadidos', label: 'Evadidos', type: 'number' },
      { key: 'trancados', label: 'Trancados', type: 'number' },
      { key: 'turmas_ofertadas', label: 'Turmas', type: 'number' },
      { key: 'horas_aula', label: 'Horas-aula', type: 'number' },
      { key: 'reprovados_unicos', label: 'Reprovados', type: 'number' },
      { key: 'dependencias', label: 'Dependências', type: 'number' },
    ],
  },
  {
    key: 'receitas_base', label: 'Receitas Regulares', icon: '💰',
    columns: [
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso', type: 'text' },
      { key: 'mensalidades_brutas', label: 'Mensalidades brutas', type: 'money' },
      { key: 'outras_receitas', label: 'Outras receitas', type: 'money' },
      { key: 'receita_bruta', label: 'Receita bruta', type: 'money' },
      { key: 'bolsas', label: 'Bolsas / gratuidades', type: 'money' },
      { key: 'descontos', label: 'Descontos', type: 'money' },
      { key: 'cancelamentos', label: 'Cancelamentos', type: 'money' },
      { key: 'tributos', label: 'Tributos s/ receita', type: 'money' },
      { key: 'ajustes', label: 'Ajustes (+/-)', type: 'money' },
      { key: 'receita_liquida', label: 'Receita líquida', type: 'money' },
      { key: 'fies_convenios', label: 'FIES / convênios', type: 'text' },
    ],
  },
  {
    key: 'receitas_ampliadas', label: 'Receitas Ampliadas', icon: '📈',
    columns: [
      { key: 'id_receita', label: 'ID receita ampliada', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_curso_origem', label: 'Curso origem', type: 'text' },
      { key: 'id_curso_beneficiario', label: 'Curso beneficiário', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'text' },
      { key: 'descricao', label: 'Descrição', type: 'text', width: 200 },
      { key: 'quantidade', label: 'Quantidade', type: 'number' },
      { key: 'preco_unitario', label: 'Preço unitário', type: 'money' },
      { key: 'receita_bruta', label: 'Receita bruta', type: 'money' },
      { key: 'bolsas_isencoes', label: 'Bolsas / isenções', type: 'money' },
      { key: 'receita_liquida', label: 'Receita líquida', type: 'money' },
      { key: 'custo_incremental', label: 'Custo incremental', type: 'money' },
      { key: 'contribuicao', label: 'Contribuição', type: 'money' },
    ],
  },
  {
    key: 'recebiveis_caixa', label: 'Recebíveis e Caixa', icon: '🏦',
    columns: [
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso', type: 'text' },
      { key: 'saldo_inicial', label: 'Saldo inicial', type: 'money' },
      { key: 'faturamento', label: 'Novos títulos', type: 'money' },
      { key: 'recebimentos', label: 'Recebimentos', type: 'money' },
      { key: 'cancelamentos', label: 'Cancelamentos', type: 'money' },
      { key: 'saldo_final', label: 'Saldo final', type: 'money' },
      { key: 'vencido_30', label: 'Vencido até 30d', type: 'money' },
      { key: 'vencido_90', label: 'Vencido 31-90d', type: 'money' },
      { key: 'vencido_acima', label: 'Vencido +90d', type: 'money' },
      { key: 'provisao_perda', label: 'Provisão / perda', type: 'money' },
    ],
  },
  {
    key: 'pessoal', label: 'Pessoal', icon: '👥',
    columns: [
      { key: 'id_custo', label: 'ID custo pessoal', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso / pool', type: 'text' },
      { key: 'funcao', label: 'Função / categoria', type: 'text' },
      { key: 'vinculo', label: 'Vínculo', type: 'text' },
      { key: 'alocacao', label: 'Alocação', type: 'text' },
      { key: 'horas_mes', label: 'Horas/mês', type: 'number' },
      { key: 'salarios', label: 'Salários / honorários', type: 'money' },
      { key: 'encargos', label: 'Encargos', type: 'money' },
      { key: 'beneficios', label: 'Benefícios', type: 'money' },
      { key: 'provisoes', label: 'Provisões 13º/férias', type: 'money' },
      { key: 'custo_total', label: 'Custo total', type: 'money' },
    ],
  },
  {
    key: 'custos_diretos', label: 'Custos Diretos', icon: '📋',
    columns: [
      { key: 'id_custo', label: 'ID custo direto', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'text' },
      { key: 'descricao', label: 'Descrição', type: 'text', width: 200 },
      { key: 'conta_contabil', label: 'Conta contábil', type: 'text' },
      { key: 'centro_custo', label: 'Centro de custo', type: 'text' },
      { key: 'quantidade', label: 'Quantidade', type: 'number' },
      { key: 'custo_unitario', label: 'Custo unitário', type: 'money' },
      { key: 'despesa', label: 'Despesa reconhecida', type: 'money' },
    ],
  },
  {
    key: 'despesas_comuns', label: 'Despesas Comuns', icon: '🏢',
    columns: [
      { key: 'id_pool', label: 'ID pool / despesa', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade / escopo', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'text' },
      { key: 'descricao', label: 'Descrição do pool', type: 'text', width: 200 },
      { key: 'conta_contabil', label: 'Conta contábil', type: 'text' },
      { key: 'despesa', label: 'Despesa reconhecida', type: 'money' },
      { key: 'elegivel_rateio', label: 'Elegível p/ rateio', type: 'money' },
      { key: 'parcela_corporativa', label: 'Parcela não rateada', type: 'money' },
      { key: 'criterio', label: 'Critério sugerido', type: 'text' },
    ],
  },
  {
    key: 'rateio', label: 'Rateio', icon: '⚖',
    columns: [
      { key: 'id_rateio', label: 'ID rateio', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_pool', label: 'ID pool / despesa', type: 'text' },
      { key: 'id_curso', label: 'ID curso beneficiário', type: 'text' },
      { key: 'criterio', label: 'Critério aprovado', type: 'text' },
      { key: 'base_curso', label: 'Base deste curso', type: 'number' },
      { key: 'base_total', label: 'Base total', type: 'number' },
      { key: 'participacao', label: 'Participação', type: 'percent' },
      { key: 'valor_pool', label: 'Valor do pool', type: 'money' },
      { key: 'custo_alocado', label: 'Custo alocado', type: 'money' },
    ],
  },
  {
    key: 'ativos_investimentos', label: 'Ativos e Investimentos', icon: '🏗',
    columns: [
      { key: 'id_ativo', label: 'ID ativo / grupo', type: 'text' },
      { key: 'competencia', label: 'Competência', type: 'date' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'id_unidade', label: 'ID unidade', type: 'text' },
      { key: 'id_curso', label: 'ID curso / pool', type: 'text' },
      { key: 'descricao', label: 'Descrição do ativo', type: 'text', width: 200 },
      { key: 'categoria', label: 'Categoria', type: 'text' },
      { key: 'investimento', label: 'Investimento', type: 'money' },
      { key: 'custo_historico', label: 'Custo histórico', type: 'money' },
      { key: 'depreciacao', label: 'Depreciação', type: 'money' },
      { key: 'amortizacao', label: 'Amortização', type: 'money' },
      { key: 'valor_contabil', label: 'Valor contábil', type: 'money' },
    ],
  },
  {
    key: 'dre_institucional', label: 'DRE Institucional', icon: '📊',
    columns: [
      { key: 'grupo', label: 'Grupo', type: 'text' },
      { key: 'conta', label: 'Conta / conferência', type: 'text', width: 250 },
      { key: 'v2016', label: '2016', type: 'money' },
      { key: 'v2017', label: '2017', type: 'money' },
      { key: 'v2018', label: '2018', type: 'money' },
      { key: 'v2019', label: '2019', type: 'money' },
      { key: 'v2020', label: '2020', type: 'money' },
      { key: 'v2021', label: '2021', type: 'money' },
      { key: 'v2022', label: '2022', type: 'money' },
      { key: 'v2023', label: '2023', type: 'money' },
      { key: 'v2024', label: '2024', type: 'money' },
      { key: 'v2025', label: '2025', type: 'money' },
      { key: 'v2026', label: '2026 parcial', type: 'money' },
    ],
  },
  {
    key: 'documentos', label: 'Documentos', icon: '📎',
    columns: [
      { key: 'id_documento', label: 'ID documento', type: 'text' },
      { key: 'ano', label: 'Ano', type: 'number' },
      { key: 'id_ies', label: 'ID IES', type: 'text' },
      { key: 'tipo_fonte', label: 'Tipo de fonte', type: 'text' },
      { key: 'nome_arquivo', label: 'Nome do arquivo', type: 'text', width: 200 },
      { key: 'local_acesso', label: 'Local / link', type: 'text', width: 200 },
      { key: 'inicio_cobertura', label: 'Início cobertura', type: 'date' },
      { key: 'fim_cobertura', label: 'Fim cobertura', type: 'date' },
      { key: 'sistema_origem', label: 'Sistema de origem', type: 'text' },
      { key: 'situacao', label: 'Situação', type: 'select', options: ['Disponível', 'Verificado', 'Parcial', 'Indisponível'] },
    ],
  },
  {
    key: 'controle_entrega', label: 'Controle de Entrega', icon: '✅',
    columns: [
      { key: 'ano', label: 'Ano', type: 'number' },
      { key: 'recorte', label: 'Recorte', type: 'text' },
      { key: 'base_solicitada', label: 'Base solicitada', type: 'text', width: 200 },
      { key: 'abrangencia', label: 'Abrangência', type: 'text' },
      { key: 'responsavel', label: 'Responsável / setor', type: 'text' },
      { key: 'prazo', label: 'Prazo', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Não iniciado', 'Em preparação', 'Parcial', 'Entregue', 'Conferido', 'Indisponível', 'Não se aplica'] },
      { key: 'data_entrega', label: 'Data de entrega', type: 'date' },
      { key: 'id_documento', label: 'ID documento', type: 'text' },
      { key: 'pendencia', label: 'Pendência / justificativa', type: 'text', width: 200 },
    ],
  },
];

/* ── Tipo de linha de dados ── */
type DataRow = Record<string, string | number | null>;

/* ── Componente de tabela editável ── */
function DataTable({ tab, rows, onChange, onAddRow, onDeleteRow }: {
  tab: TabDef;
  rows: DataRow[];
  onChange: (rowIndex: number, key: string, value: string | number | null) => void;
  onAddRow: () => void;
  onDeleteRow: (index: number) => void;
}) {
  return (
    <div className="rbi-table-wrap">
      <table className="rbi-table">
        <thead>
          <tr>
            <th className="rbi-row-num">#</th>
            {tab.columns.map(col => (
              <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                {col.label}
              </th>
            ))}
            <th className="rbi-row-action"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={tab.columns.length + 2} className="rbi-empty">
              Nenhum registro. Clique em "Adicionar linha" para começar.
            </td></tr>
          )}
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="rbi-row-num">{ri + 1}</td>
              {tab.columns.map(col => (
                <td key={col.key}>
                  {col.type === 'select' ? (
                    <select
                      className="rbi-input"
                      value={String(row[col.key] ?? '')}
                      onChange={e => onChange(ri, col.key, e.target.value || null)}
                    >
                      <option value="">—</option>
                      {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : col.type === 'money' ? (
                    <input
                      className="rbi-input rbi-money"
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={row[col.key] ?? ''}
                      onChange={e => onChange(ri, col.key, e.target.value === '' ? null : Number(e.target.value))}
                    />
                  ) : col.type === 'number' || col.type === 'percent' ? (
                    <input
                      className="rbi-input"
                      type="number"
                      step={col.type === 'percent' ? '0.1' : '1'}
                      value={row[col.key] ?? ''}
                      onChange={e => onChange(ri, col.key, e.target.value === '' ? null : Number(e.target.value))}
                    />
                  ) : col.type === 'date' ? (
                    <input
                      className="rbi-input"
                      type="date"
                      value={String(row[col.key] ?? '')}
                      onChange={e => onChange(ri, col.key, e.target.value || null)}
                    />
                  ) : (
                    <input
                      className="rbi-input"
                      type="text"
                      value={String(row[col.key] ?? '')}
                      onChange={e => onChange(ri, col.key, e.target.value || null)}
                      style={col.width ? { minWidth: col.width } : undefined}
                    />
                  )}
                </td>
              ))}
              <td className="rbi-row-action">
                <button
                  className="rbi-del"
                  title="Remover linha"
                  onClick={() => onDeleteRow(ri)}
                >×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="rbi-add" onClick={onAddRow}>+ Adicionar linha</button>
    </div>
  );
}

/* ── Simulador de resultado por curso ── */
interface SimValues {
  nome_curso: string;
  alunos: number;
  ticket_medio: number;
  meses: number;
  bolsa_pct: number;
  tributo_pct: number;
  folha_docente: number;
  folha_admin: number;
  custos_diretos: number;
  rateio: number;
  depreciacao: number;
}

const SIM_INITIAL: SimValues = {
  nome_curso: '',
  alunos: 0,
  ticket_medio: 0,
  meses: 12,
  bolsa_pct: 0,
  tributo_pct: 0,
  folha_docente: 0,
  folha_admin: 0,
  custos_diretos: 0,
  rateio: 0,
  depreciacao: 0,
};

function Simulador() {
  const [values, setValues] = useState<SimValues>(SIM_INITIAL);
  const [historico, setHistorico] = useState<Array<SimValues & { resultado: number; margem: number }>>([]);

  const set = (key: keyof SimValues, raw: string) => {
    setValues(prev => ({ ...prev, [key]: key === 'nome_curso' ? raw : (raw === '' ? 0 : Number(raw)) }));
  };

  const receita_bruta = values.alunos * values.ticket_medio * values.meses;
  const bolsas = receita_bruta * (values.bolsa_pct / 100);
  const receita_com_desconto = receita_bruta - bolsas;
  const tributos = receita_com_desconto * (values.tributo_pct / 100);
  const receita_liquida = receita_com_desconto - tributos;
  const custos_totais = values.folha_docente + values.folha_admin + values.custos_diretos + values.rateio;
  const resultado_operacional = receita_liquida - custos_totais;
  const resultado_final = resultado_operacional - values.depreciacao;
  const margem = receita_liquida > 0 ? (resultado_final / receita_liquida) * 100 : 0;
  const custo_aluno = values.alunos > 0 ? custos_totais / values.alunos : 0;
  const receita_aluno = values.alunos > 0 ? receita_liquida / values.alunos : 0;

  const salvar = () => {
    if (!values.nome_curso) return;
    setHistorico(prev => [...prev, { ...values, resultado: resultado_final, margem }]);
  };

  const field = (label: string, key: keyof SimValues, opts?: { money?: boolean; pct?: boolean }) => (
    <label className="rbi-sim-field">
      <span>{label}</span>
      <div className="rbi-sim-input-wrap">
        {opts?.money && <span className="rbi-sim-prefix">R$</span>}
        <input
          type={key === 'nome_curso' ? 'text' : 'number'}
          step={opts?.money ? '0.01' : opts?.pct ? '0.1' : '1'}
          min="0"
          value={values[key]}
          onChange={e => set(key, e.target.value)}
          className={`rbi-input ${opts?.money ? 'rbi-money' : ''}`}
        />
        {opts?.pct && <span className="rbi-sim-suffix">%</span>}
      </div>
    </label>
  );

  return (
    <div className="rbi-sim">
      <div className="rbi-sim-header">
        <h3>Simulação de Resultado por Curso</h3>
        <p>Preencha os campos para projetar o resultado. Os cálculos atualizam em tempo real.</p>
      </div>

      <div className="rbi-sim-grid">
        <fieldset className="rbi-sim-group">
          <legend>Identificação e receita</legend>
          {field('Nome do curso', 'nome_curso')}
          {field('Alunos ativos (média)', 'alunos')}
          {field('Ticket médio mensal', 'ticket_medio', { money: true })}
          {field('Meses do período', 'meses')}
          {field('Bolsas e descontos', 'bolsa_pct', { pct: true })}
          {field('Tributos sobre receita', 'tributo_pct', { pct: true })}
        </fieldset>

        <fieldset className="rbi-sim-group">
          <legend>Custos e despesas (período)</legend>
          {field('Folha docente / tutoria', 'folha_docente', { money: true })}
          {field('Folha administrativa', 'folha_admin', { money: true })}
          {field('Custos diretos operacionais', 'custos_diretos', { money: true })}
          {field('Rateio de despesas comuns', 'rateio', { money: true })}
          {field('Depreciação e amortização', 'depreciacao', { money: true })}
        </fieldset>

        <div className="rbi-sim-result">
          <h4>Resultado projetado</h4>
          <div className="rbi-sim-kpis">
            <div className="rbi-sim-kpi">
              <span>Receita bruta</span>
              <strong>{fmtMoney.format(receita_bruta)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Bolsas / descontos</span>
              <strong className="rbi-neg">– {fmtMoney.format(bolsas)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Tributos</span>
              <strong className="rbi-neg">– {fmtMoney.format(tributos)}</strong>
            </div>
            <div className="rbi-sim-kpi rbi-highlight">
              <span>Receita líquida</span>
              <strong>{fmtMoney.format(receita_liquida)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Custos totais</span>
              <strong className="rbi-neg">– {fmtMoney.format(custos_totais)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Depreciação</span>
              <strong className="rbi-neg">– {fmtMoney.format(values.depreciacao)}</strong>
            </div>
            <hr />
            <div className={`rbi-sim-kpi rbi-big ${resultado_final >= 0 ? 'rbi-pos' : 'rbi-neg-bg'}`}>
              <span>Resultado líquido</span>
              <strong>{fmtMoney.format(resultado_final)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Margem líquida</span>
              <strong style={{ color: margem >= 0 ? '#1baf7a' : '#e2574c' }}>{fmtPct(margem)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Receita líq. / aluno (período)</span>
              <strong>{fmtMoney.format(receita_aluno)}</strong>
            </div>
            <div className="rbi-sim-kpi">
              <span>Custo / aluno (período)</span>
              <strong>{fmtMoney.format(custo_aluno)}</strong>
            </div>
          </div>
          <button className="rbi-btn-primary" onClick={salvar} disabled={!values.nome_curso}>
            Salvar cenário na tabela comparativa
          </button>
        </div>
      </div>

      {historico.length > 0 && (
        <div className="rbi-sim-compare">
          <h4>Comparação de cenários</h4>
          <div className="rbi-table-wrap">
            <table className="rbi-table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Alunos</th>
                  <th>Ticket médio</th>
                  <th>Receita líquida</th>
                  <th>Custos totais</th>
                  <th>Resultado</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h, i) => {
                  const rl = h.alunos * h.ticket_medio * h.meses * (1 - h.bolsa_pct / 100) * (1 - h.tributo_pct / 100);
                  const ct = h.folha_docente + h.folha_admin + h.custos_diretos + h.rateio + h.depreciacao;
                  return (
                    <tr key={i}>
                      <td>{h.nome_curso}</td>
                      <td>{fmt.format(h.alunos)}</td>
                      <td>{fmtMoney.format(h.ticket_medio)}</td>
                      <td>{fmtMoney.format(rl)}</td>
                      <td>{fmtMoney.format(ct)}</td>
                      <td style={{ color: h.resultado >= 0 ? '#1baf7a' : '#e2574c', fontWeight: 700 }}>
                        {fmtMoney.format(h.resultado)}
                      </td>
                      <td style={{ color: h.margem >= 0 ? '#1baf7a' : '#e2574c' }}>
                        {fmtPct(h.margem)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ── */
export default function ResultadoCursoBI({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>('simulacao');
  const [data, setData] = useState<Record<TabKey, DataRow[]>>(() => {
    const initial: Record<string, DataRow[]> = {};
    for (const tab of TABS) initial[tab.key] = [];
    initial['simulacao'] = [];
    return initial as Record<TabKey, DataRow[]>;
  });

  const currentTab = TABS.find(t => t.key === activeTab);

  const handleChange = useCallback((rowIndex: number, key: string, value: string | number | null) => {
    setData(prev => {
      const rows = [...prev[activeTab]];
      rows[rowIndex] = { ...rows[rowIndex], [key]: value };
      return { ...prev, [activeTab]: rows };
    });
  }, [activeTab]);

  const handleAddRow = useCallback(() => {
    setData(prev => {
      const rows = [...prev[activeTab], {}];
      return { ...prev, [activeTab]: rows };
    });
  }, [activeTab]);

  const handleDeleteRow = useCallback((index: number) => {
    setData(prev => {
      const rows = prev[activeTab].filter((_, i) => i !== index);
      return { ...prev, [activeTab]: rows };
    });
  }, [activeTab]);

  /* Exportar dados como JSON */
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado-curso-${institutionName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Importar dados de JSON */
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        setData(prev => ({ ...prev, ...parsed }));
      } catch { alert('Arquivo inválido. Use um JSON exportado por este módulo.'); }
    };
    input.click();
  };

  /* Resumo rápido */
  const summary = useMemo(() => {
    let totalRows = 0;
    let tabsWithData = 0;
    for (const tab of TABS) {
      if (data[tab.key].length > 0) { tabsWithData++; totalRows += data[tab.key].length; }
    }
    return { totalRows, tabsWithData };
  }, [data]);

  return (
    <section className="rbi-root">
      <div className="rbi-header">
        <div>
          <h2>Resultado por Curso · 10 anos</h2>
          <p>Coleta de dados para apuração de resultado por curso · {institutionName}</p>
          <p className="rbi-meta">Período: 2016 a 2025, complemento parcial 2026 · Valores em reais nominais</p>
        </div>
        <div className="rbi-header-actions">
          <span className="rbi-badge">{summary.tabsWithData} abas · {fmt.format(summary.totalRows)} registros</span>
          <button className="rbi-btn-secondary" onClick={importData}>↑ Importar JSON</button>
          <button className="rbi-btn-primary" onClick={exportData}>↓ Exportar JSON</button>
        </div>
      </div>

      <nav className="rbi-tabs" aria-label="Abas de dados">
        <button
          className={`rbi-tab ${activeTab === 'simulacao' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulacao')}
        >
          🧮 Simulação
        </button>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`rbi-tab ${activeTab === tab.key ? 'active' : ''} ${data[tab.key].length > 0 ? 'has-data' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
            {data[tab.key].length > 0 && <span className="rbi-tab-count">{data[tab.key].length}</span>}
          </button>
        ))}
      </nav>

      <div className="rbi-content">
        {activeTab === 'simulacao' ? (
          <Simulador />
        ) : currentTab ? (
          <DataTable
            tab={currentTab}
            rows={data[activeTab]}
            onChange={handleChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        ) : null}
      </div>
    </section>
  );
}
