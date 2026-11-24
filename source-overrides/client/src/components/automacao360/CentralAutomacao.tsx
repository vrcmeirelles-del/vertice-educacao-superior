// Central de Automação 360° — Master (com seletor de IES) e painel da IES (escopo por curso).
// A interface não é barreira de segurança: papéis, MFA, escopo e aprovação independente são
// impostos pelas RPCs. Nenhuma regra é ativada por esta tela; a operação real exige autorização.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { acoes, cadencias, estados, filtrar, fontes, mensagemErro, parsePainel, resumo, rotulo, type Painel } from './modelo';
import './automacao360.css';

type Curso = { id: string; name: string };
type Props = { master?: boolean; institutionId?: string; courses?: Curso[]; courseFunctionIds?: string[]; role?: string | null };
const quando = (v: string | null | undefined) => v ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v)) : 'Sem registro';
const FULL = ['master', 'gestor', 'reitor', 'diretor_geral'];

export default function CentralAutomacao({ master = false, institutionId, courses = [], courseFunctionIds = [], role = null }: Props) {
  const [ies, setIes] = useState(institutionId ?? '');
  const [lista, setLista] = useState<{ id: string; name: string }[]>([]);
  const institutionalAllowed = master || (role !== null && role !== 'leitor' && !(role === 'coordenador' || role === 'nde'));
  const cursosPermitidos = useMemo(() => master || (role !== null && FULL.includes(role)) ? courses : courses.filter((c) => courseFunctionIds.includes(c.id)), [master, role, courses, courseFunctionIds]);
  const [curso, setCurso] = useState<string>(institutionalAllowed ? '' : (cursosPermitidos[0]?.id ?? ''));
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState(''), [aviso, setAviso] = useState(''), [carregando, setCarregando] = useState(false), [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState(''), [estado, setEstado] = useState(''), [prioridade, setPrioridade] = useState('');
  const [selecao, setSelecao] = useState<Set<string>>(new Set()), [ativar, setAtivar] = useState(false);
  const pedido = useRef(0);
  const courseId = curso || null;

  useEffect(() => {
    if (!master) return;
    let vivo = true;
    (async () => {
      const r = await supabase.from('vertice_institutions').select('id,name').eq('status', 'ativa').order('name');
      if (vivo && !r.error) setLista((r.data ?? []) as { id: string; name: string }[]);
    })();
    return () => { vivo = false; };
  }, [master]);

  const carregar = useCallback(async () => {
    if (!ies || (!institutionalAllowed && !courseId)) { setPainel(null); return; }
    const n = ++pedido.current; setCarregando(true); setErro('');
    const r = await supabase.rpc('vertice_automation_dashboard', { p_institution: ies, p_course: courseId });
    if (n !== pedido.current) return; // resposta atrasada de outro escopo
    setCarregando(false);
    if (r.error) { setPainel(null); setErro(mensagemErro(r.error)); return; }
    try {
      const p = parsePainel(r.data, ies, courseId);
      setPainel(p); setSelecao(new Set(p.config?.ruleIds ?? [])); setAtivar(p.config?.enabled ?? false);
    } catch { setPainel(null); setErro('A resposta da fonte não pôde ser verificada. Nada é exibido como zero.'); }
  }, [ies, courseId, institutionalAllowed]);

  useEffect(() => { setPainel(null); setAviso(''); void carregar(); }, [carregar]);

  const podeConfigurar = master || (role !== null && ['master', 'gestor'].includes(role)) || (!!courseId && courseFunctionIds.includes(courseId));
  const podeAprovar = master || (role !== null && FULL.includes(role));
  const regras = painel ? filtrar(painel.rules, { busca, estado, prioridade }) : [];
  const r = painel ? resumo(painel) : null;
  const alterada = painel && (ativar !== (painel.config?.enabled ?? false) || [...selecao].sort().join() !== [...(painel.config?.ruleIds ?? [])].sort().join());

  async function propor() {
    if (!painel) return;
    setEnviando(true); setAviso('');
    const esperada = painel.pendingConfig?.revision ?? painel.config?.revision ?? 0;
    const res = await supabase.rpc('vertice_automation_propose_config', {
      p_institution: ies, p_course: courseId, p_rule_ids: [...selecao].sort(), p_enabled: ativar, p_mode: 'shadow',
      p_max_age_hours: 24, p_expected_revision: esperada, p_reason: 'Revisão proposta pela Central de Automação 360°' });
    setEnviando(false);
    if (res.error) { setAviso(mensagemErro(res.error)); return; }
    setAviso('Revisão registrada. Ela só passa a valer após aprovação por outra pessoa autorizada.'); void carregar();
  }
  async function aprovar() {
    if (!painel?.pendingConfig) return;
    setEnviando(true); setAviso('');
    const res = await supabase.rpc('vertice_automation_approve_config', { p_config_id: painel.pendingConfig.id, p_reason: 'Aprovação registrada pela Central de Automação 360°' });
    setEnviando(false);
    if (res.error) { setAviso(mensagemErro(res.error)); return; }
    setAviso('Revisão aprovada. Execução em modo sombra, sem efeitos operacionais.'); void carregar();
  }
  const alternar = (id: string) => setSelecao((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <section className="a360" aria-labelledby="a360-titulo">
      <header className="a360-head">
        <div>
          <span className="a360-eyebrow">AUTOMAÇÃO 360° · ALGORITMO DETERMINÍSTICO COM DECISÃO HUMANA</span>
          <h2 id="a360-titulo">Central de Automação</h2>
          <p>Regras versionadas que geram propostas para revisão. Nenhuma ação, nota ou mensagem é produzida automaticamente.</p>
        </div>
      </header>

      <div className="a360-filtros">
        {master && <label>Instituição <select value={ies} onChange={(e) => { setIes(e.target.value); setCurso(''); }}>
          <option value="">Selecione</option>{lista.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
        <label>Escopo <select value={curso} onChange={(e) => setCurso(e.target.value)}>
          {institutionalAllowed && <option value="">Instituição (todos os cursos)</option>}
          {cursosPermitidos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>

      {!ies && <p className="a360-vazio">Selecione uma instituição para consultar as automações.</p>}
      {ies && !institutionalAllowed && cursosPermitidos.length === 0 && <p className="a360-vazio">Nenhum curso atribuído ao seu perfil.</p>}
      {carregando && <p role="status">Consultando a Central de Automação…</p>}
      {erro && <p className="a360-erro" role="alert">{erro}</p>}

      {painel && r && <>
        <div className="a360-cards" role="list" aria-label="Situação das regras">
          {(Object.keys(estados) as (keyof typeof estados)[]).map((k) => <div role="listitem" key={k} className={`a360-card a360-${k}`}><strong>{r.porEstado[k]}</strong><span>{estados[k]}</span></div>)}
        </div>

        <div className="a360-grid">
          <section className="a360-painel">
            <h3>Qualidade das fontes</h3>
            <div className="a360-barra" role="img" aria-label={`Fontes: ${r.porFonte.validada} validadas, ${r.porFonte.identificada} identificadas, ${r.porFonte.pendente} pendentes`}>
              {(Object.keys(fontes) as (keyof typeof fontes)[]).map((k) => r.porFonte[k] > 0 && <span key={k} className={`a360-f-${k}`} style={{ flexGrow: r.porFonte[k] }} />)}
            </div>
            <ul className="a360-legenda">{(Object.keys(fontes) as (keyof typeof fontes)[]).map((k) => <li key={k}><i className={`a360-f-${k}`} />{fontes[k]}: {r.porFonte[k]}</li>)}</ul>
          </section>
          <section className="a360-painel">
            <h3>Configuração vigente</h3>
            {painel.config ? <dl><dt>Revisão</dt><dd>{painel.config.revision}</dd><dt>Situação</dt><dd>{painel.config.enabled ? (painel.config.mode === 'shadow' ? 'Modo sombra' : 'Operacional') : 'Desativada'}</dd><dt>Aprovada em</dt><dd>{quando(painel.config.approvedAt)}</dd></dl>
              : <p>Nenhuma configuração aprovada. Todas as regras estão inativas.</p>}
            {painel.pendingConfig && <p className="a360-alerta">Revisão {painel.pendingConfig.revision} aguardando aprovação independente.
              {podeAprovar && <button type="button" onClick={aprovar} disabled={enviando}>Aprovar revisão {painel.pendingConfig.revision}</button>}</p>}
          </section>
          <section className="a360-painel">
            <h3>Última execução</h3>
            {painel.lastRun ? <dl><dt>Registrada em</dt><dd>{quando(painel.lastRun.at)}</dd><dt>Resultado</dt><dd>{painel.lastRun.status === 'partial' ? 'Parcial (há fontes ou registros não verificados)' : 'Avaliada'}</dd>
              <dt>Alertas observados</dt><dd>{painel.lastRun.alerts}</dd><dt>Tempo de processamento</dt><dd>{painel.lastRun.durationMs === null ? 'Não medido' : `${painel.lastRun.durationMs} ms`}</dd></dl>
              : <p>Sem execução registrada.</p>}
          </section>
          <section className="a360-painel">
            <h3>Propostas aguardando decisão</h3>
            {painel.pending === null ? <p>Fila não verificada: a configuração não está em operação aprovada.</p>
              : painel.pending.length === 0 ? <p>Nenhuma proposta pendente na fila operacional verificada.</p>
              : <ul>{painel.pending.map((p) => <li key={p.id}><b>{p.priority}</b> · {rotulo(p.ruleId)}</li>)}</ul>}
          </section>
        </div>

        <section className="a360-painel">
          <div className="a360-tabela-topo">
            <h3>Catálogo de regras</h3>
            <div className="a360-filtros">
              <label>Buscar <input value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
              <label>Situação <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todas</option>{Object.entries(estados).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Prioridade <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}><option value="">Todas</option>{['P0', 'P1', 'P2'].map((p) => <option key={p}>{p}</option>)}</select></label>
            </div>
          </div>
          <div className="a360-rolagem" tabIndex={0} role="region" aria-label="Catálogo de regras">
            <table>
              <caption>Regras da Automação 360° neste escopo. A marcação propõe uma nova revisão; nada é ativado sem aprovação.</caption>
              <thead><tr><th scope="col">Incluir</th><th scope="col">Regra</th><th scope="col">Módulo</th><th scope="col">Prioridade</th><th scope="col">Frequência</th><th scope="col">Fonte</th><th scope="col">Situação</th></tr></thead>
              <tbody>{regras.map((x) => <tr key={x.id}>
                <td><input type="checkbox" aria-label={`Incluir ${rotulo(x.id)}`} checked={selecao.has(x.id)} disabled={!podeConfigurar || enviando} onChange={() => alternar(x.id)} /></td>
                <td>{rotulo(x.id)}</td><td>{x.module}</td><td>{x.priority}</td><td>{cadencias[x.cadence] ?? x.cadence}</td><td>{fontes[x.sourceStatus]}</td><td>{estados[x.state]}</td></tr>)}</tbody>
            </table>
            {!regras.length && <p className="a360-vazio">Nenhuma regra corresponde ao filtro.</p>}
          </div>
          {podeConfigurar && <div className="a360-acoes">
            <label><input type="checkbox" checked={ativar} onChange={(e) => setAtivar(e.target.checked)} disabled={enviando} /> Executar em modo sombra (sem efeitos operacionais)</label>
            <p className="a360-nota">O modo operacional não é oferecido nesta tela: exige homologação e autorização expressa.</p>
            <button type="button" onClick={propor} disabled={!alterada || enviando}>Propor nova revisão</button>
          </div>}
          {aviso && <p className="a360-aviso" role="status">{aviso}</p>}
        </section>

        <section className="a360-painel">
          <h3>Histórico de decisões</h3>
          {painel.events.length ? <ol className="a360-historico">{painel.events.map((e, i) => <li key={i}>{quando(e.at)} · {acoes[e.action] ?? 'Registro'}</li>)}</ol> : <p>Sem decisões registradas.</p>}
        </section>
      </>}
    </section>
  );
}
