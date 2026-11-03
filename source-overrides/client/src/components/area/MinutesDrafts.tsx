import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { ACTION_STATES, MINUTES_CODE, emptyMinutes, minutesSchema, minutesStore, type MinutesBody, type MinutesRow } from '@/lib/inep-minutes';
import { saveMinutes } from '@/lib/inep-minutes-api';
import type { LibraryDocument } from '@/lib/inep-library';
import './minutes-drafts.css';

type Course = { id: string; name: string };
const labels: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', reprogramada: 'Reprogramada', cancelada: 'Cancelada' };
const bodyFields: [keyof Omit<MinutesBody, 'actions' | 'meetingType'>, string, number, string?][] = [
  ['number', 'Número da ata', 80], ['date', 'Data da reunião', 10, 'date'], ['time', 'Horário', 5, 'time'], ['location', 'Local ou modalidade (sem links restritos)', 250],
  ['chair', 'Presidência · função ou identificação institucional', 200], ['secretary', 'Secretaria · função ou identificação institucional', 200],
  ['quorum', 'Registro do quórum', 1000, 'textarea'], ['participants', 'Participantes · função e presença', 4000, 'textarea'],
  ['agenda', 'Pauta', 8000, 'textarea'], ['previousMinutes', 'Ata anterior · referência, memória e ressalvas', 8000, 'textarea'],
  ['discussion', 'Discussão', 8000, 'textarea'], ['decisions', 'Deliberações e registro de votação', 8000, 'textarea'], ['nextMeeting', 'Próxima reunião prevista', 500],
];

export default function MinutesDrafts({ institutionId }: { institutionId: string }) {
  const [actor, setActor] = useState(''), [role, setRole] = useState('');
  const [rows, setRows] = useState<MinutesRow[]>([]), [courses, setCourses] = useState<Course[]>([]), [sources, setSources] = useState<LibraryDocument[]>([]);
  const [selected, setSelected] = useState(''), [course, setCourse] = useState(''), [source, setSource] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [history, setHistory] = useState<MinutesRow[] | null>(null), [server, setServer] = useState<MinutesRow | null>(null);
  const prefix = `${actor}:${institutionId}:`, key = prefix + selected;
  const currentKey = useRef(key);
  currentKey.current = key;
  useEffect(() => () => { currentKey.current = ''; }, []);
  const session = useSyncExternalStore(minutesStore.subscribe, () => minutesStore.get(key));
  // A revision counter updates the list when an operation completes after navigation.
  const [, refresh] = useState(0);
  useEffect(() => minutesStore.subscribe(() => refresh(x => x + 1)), []);
  useEffect(() => {
    let active = true;
    setActor(''); setRole(''); setRows([]); setCourses([]); setSources([]); setSelected(''); setHistory(null); setServer(null); setLoading(true); setError('');
    (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Sessão indisponível.');
      const [drafts, c, s, membership, admin] = await Promise.all([
        supabase.from('vertice_minutes_drafts').select('*').eq('institution_id', institutionId).order('updated_at', { ascending: false }).limit(500),
        supabase.from('vertice_courses').select('id,name').eq('institution_id', institutionId).order('name'),
        supabase.from('vertice_inep_library').select('id,institution_id,code,title,version').eq('institution_id', institutionId).eq('active', true).eq('code', MINUTES_CODE).eq('format', 'docx').eq('is_placeholder', false),
        supabase.from('vertice_memberships').select('role').eq('institution_id', institutionId).eq('user_id', auth.user.id).maybeSingle(),
        supabase.from('vertice_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle(),
      ]);
      if ([drafts, c, s, membership, admin].some(r => r.error)) throw new Error('Não foi possível carregar os rascunhos. Confira sua sessão e tente novamente.');
      if (!active) return;
      setActor(auth.user.id); setRows(drafts.data as MinutesRow[]); setCourses(c.data as Course[]); setSources(s.data as LibraryDocument[]);
      setRole(admin.data ? 'master' : membership.data?.role ?? '');
    })().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [institutionId, reload]);
  const canCreate = ['master', 'gestor', 'equipe'].includes(role);
  const row = session?.row;
  const editable = canCreate && !!row && (['master', 'gestor'].includes(role) || row.created_by === actor);
  const blocked = !editable || session?.pending || session?.uncertain || session?.conflict;
  const cached = actor ? minutesStore.entries(prefix).map(([, s]) => s.row) : [];
  const shown = [...cached, ...rows.filter(r => !cached.some(c => c.id === r.id))];
  function open(r: MinutesRow) { minutesStore.open(prefix + r.id, r); setSelected(r.id); setHistory(null); setServer(null); setError(''); }
  function create() {
    if (!canCreate || !course || !source) return;
    open({ id: crypto.randomUUID(), institution_id: institutionId, course_id: course, source_library_id: source, title: 'Ata de reunião do colegiado', body: emptyMinutes(), version: 0, mutation_id: '', created_by: actor, updated_by: actor, created_at: '', updated_at: '' });
  }
  function editBody(patch: Partial<MinutesBody>) { if (row) minutesStore.edit(key, { ...row, body: { ...row.body, ...patch } }); }
  async function save() {
    if (!row || !editable) return;
    if (!session?.uncertain) {
      const parsed = minutesSchema.safeParse(row.body);
      if (!row.title.trim() || row.title.length > 250 || !parsed.success) { setError(!parsed.success ? parsed.error.issues[0].message : 'Informe um título de até 250 caracteres.'); return; }
    }
    setError(''); await minutesStore.save(key, saveMinutes);
  }
  async function versions() {
    const requestKey = key;
    const id = selected;
    const { data, error: failure } = await supabase.from('vertice_minutes_revisions').select('snapshot').eq('institution_id', institutionId).eq('draft_id', id).order('version', { ascending: false }).limit(100);
    if (currentKey.current !== requestKey) return;
    if (failure) setError('Não foi possível consultar o histórico.');
    else setHistory((data ?? []).map(r => r.snapshot as MinutesRow));
  }
  async function compare() {
    const requestKey = key;
    const { data, error: failure } = await supabase.from('vertice_minutes_drafts').select('*').eq('institution_id', institutionId).eq('id', selected).single();
    if (currentKey.current !== requestKey) return;
    if (failure) setError('Não foi possível consultar a versão atual.'); else setServer(data as MinutesRow);
  }
  return <section className="minutes-drafts" aria-label="Atas em elaboração">
    <header><p className="minutes-kicker">Repositório · documentos em elaboração</p><h3>Atas do colegiado</h3><p>Preencha a ata e acompanhe as decisões do curso. Cada salvamento conserva uma versão.</p></header>
    <p className="minutes-notice">Rascunho não assinado e sem aprovação acadêmica. Este formulário não é um template homologado. Salvar não atende pendências nem altera a cobertura dos indicadores.</p>
    <p>Use funções ou identificações institucionais necessárias. Não inclua CPF, dados sensíveis de estudantes ou links com acesso restrito.</p>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Carregando rascunhos…</p> : <>
      <div className="minutes-create"><label>Curso<select value={course} onChange={e => setCourse(e.target.value)}><option value="">Selecione</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Referência da biblioteca nesta IES<select value={source} onChange={e => setSource(e.target.value)}><option value="">Selecione a versão</option>{sources.map(s => <option key={s.id} value={s.id}>{s.code} · {s.version}</option>)}</select></label>
        <button className="corp-button" disabled={!canCreate || !course || !source} onClick={create}>Criar rascunho</button>
        <button className="corp-button secondary" onClick={() => setReload(x => x + 1)}>Atualizar lista</button></div>
      {!canCreate && <p>Seu papel permite consulta. Edição depende da autorização institucional.</p>}
      {!sources.length && <p>Nenhuma referência de ata do colegiado está disponível nesta IES.</p>}
      <div className="minutes-list" aria-label="Rascunhos salvos">{shown.map(r => <button key={r.id} onClick={() => open(r)} aria-pressed={selected === r.id}><strong>{r.title}</strong><span>{courses.find(c => c.id === r.course_id)?.name} · {r.version ? `v${r.version}` : 'Novo'} · Não assinado</span>{minutesStore.dirty(minutesStore.get(prefix + r.id)) && <span>Há alterações ou gravação a confirmar nesta sessão</span>}</button>)}</div>
      {!shown.length && <p>Ainda não há atas em elaboração. Os últimos 500 rascunhos salvos serão listados aqui.</p>}
    </>}
    {row && session && <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="minutes-editor-heading"><h4>{row.title}</h4><span>{row.version ? `Versão ${row.version}` : 'Ainda não salvo'} · Não assinado</span></div>
      <p>Curso: {courses.find(c => c.id === row.course_id)?.name}. Referência: {sources.find(s => s.id === row.source_library_id)?.version ?? row.source_library_id}.</p>
      <fieldset disabled={!!blocked}><legend>Identificação e conteúdo da reunião</legend><div className="minutes-fields">
        <label>Título<input required maxLength={250} value={row.title} onChange={e => minutesStore.edit(key, { ...row, title: e.target.value })} /></label>
        <label>Tipo de reunião<select value={row.body.meetingType} onChange={e => editBody({ meetingType: e.target.value as MinutesBody['meetingType'] })}><option value="ordinaria">Ordinária</option><option value="extraordinaria">Extraordinária</option></select></label>
        {bodyFields.map(([field, label, max, type]) => <label key={field} className={type === 'textarea' ? 'minutes-wide' : ''}>{label}{type === 'textarea' ? <textarea rows={4} maxLength={max} value={row.body[field]} onChange={e => editBody({ [field]: e.target.value })} /> : <input type={type ?? 'text'} maxLength={max} value={row.body[field]} onChange={e => editBody({ [field]: e.target.value })} />}</label>)}
      </div><h4>Acompanhamento das decisões</h4><p>Registre ações anteriores e novas. A referência textual de evidência não valida nem anexa um arquivo.</p>
      {row.body.actions.map((a, i) => <fieldset className="minutes-action" key={a.id}><legend>Encaminhamento {i + 1}</legend><div className="minutes-fields">
        {([['description', 'Ação / encaminhamento', 2000], ['owner', 'Responsável · função ou código', 200], ['origin', 'Ata de origem', 200], ['evidence', 'Referência da evidência', 1000], ['reason', 'Motivo / justificativa', 1000]] as const).map(([field, label, max]) => <label key={field}>{label}<textarea rows={2} maxLength={max} value={a[field]} onChange={e => editBody({ actions: row.body.actions.map(x => x.id === a.id ? { ...x, [field]: e.target.value } : x) })} /></label>)}
        <label>Prazo<input type="date" value={a.due} onChange={e => editBody({ actions: row.body.actions.map(x => x.id === a.id ? { ...x, due: e.target.value } : x) })} /></label>
        <label>Situação<select value={a.status} onChange={e => editBody({ actions: row.body.actions.map(x => x.id === a.id ? { ...x, status: e.target.value as typeof a.status } : x) })}>{ACTION_STATES.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label>
      </div><button type="button" className="corp-button secondary" onClick={() => editBody({ actions: row.body.actions.filter(x => x.id !== a.id) })}>Retirar encaminhamento {i + 1} do rascunho</button></fieldset>)}
      <button type="button" className="corp-button secondary" disabled={row.body.actions.length >= 100} onClick={() => editBody({ actions: [...row.body.actions, { id: crypto.randomUUID(), description: '', owner: '', due: '', status: 'pendente', evidence: '', origin: '', reason: '' }] })}>Adicionar encaminhamento</button></fieldset>
      <p role="status">{session.message || (minutesStore.dirty(session) ? 'Alterações ainda não salvas. Salve antes de fechar a página.' : 'Versão salva no repositório.')}</p>
      <div className="minutes-toolbar"><button className="corp-button" type="submit" disabled={!editable || session.pending || session.conflict || (!minutesStore.dirty(session))}>{session.pending ? 'Salvando…' : session.uncertain ? 'Verificar gravação' : 'Salvar rascunho'}</button>
        {!row.version && !session.pending && !session.uncertain && <button className="corp-button secondary" type="button" onClick={() => { minutesStore.forget(key); setSelected(''); }}>Descartar este rascunho ainda não salvo</button>}
        <button className="corp-button secondary" type="button" disabled={!row.version || session.pending} onClick={() => void versions()}>Consultar histórico</button>
        {session.conflict && <button className="corp-button secondary" type="button" onClick={() => void compare()}>Consultar versão atual do servidor</button>}</div>
      <p>A aprovação e a assinatura são etapas posteriores. Não há assinatura Gov.br ou ICP-Brasil neste formulário. O documento assinado deverá seguir o fluxo de envio e revisão do repositório.</p>
      {server && <details open><summary>Versão atual do servidor · v{server.version}</summary><pre>{JSON.stringify(server.body, null, 2)}</pre><p>Seu texto permanece acima para comparação. Copie as informações necessárias antes de carregar a versão atual.</p><button type="button" className="corp-button secondary" onClick={() => { minutesStore.forget(key); open(server); }}>Descartar minhas alterações e carregar esta versão</button></details>}
      {history && <div><h4>Histórico · últimas 100 versões</h4>{history.map(h => <details key={h.version}><summary>Versão {h.version} · {new Date(h.updated_at).toLocaleString('pt-BR')} · {h.title}</summary><pre>{JSON.stringify(h.body, null, 2)}</pre></details>)}</div>}
    </form>}
  </section>;
}
