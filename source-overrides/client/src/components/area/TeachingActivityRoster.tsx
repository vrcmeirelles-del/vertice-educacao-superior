import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Scope = { institutionId: string; courseId: string; activityId: string | null };
type Row = {
  student_id: string;
  student_name: string;
  enrollment_code: string | null;
  editable?: boolean;
  participant_role: 'organizador' | 'participante' | null;
  minutes: number | null;
};
type Selected = Omit<Row, 'participant_role' | 'minutes'> & {
  participant_role: 'organizador' | 'participante';
  minutes: string;
};
export type RosterPayload = { student_id: string; participant_role: 'organizador' | 'participante'; minutes: number }[];
const roleLabel = (role: string) => role === 'organizador' ? 'Organização' : 'Participação';

async function roster(scope: Scope, query = '') {
  const { data, error } = await supabase.rpc('vertice_teaching_roster', {
    p_institution: scope.institutionId, p_course: scope.courseId, p_activity: scope.activityId, p_query: query,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export function toRosterPayload(rows: Selected[]): RosterPayload {
  if (rows.length > 500) throw new Error('O limite é de 500 estudantes por atividade.');
  return rows.map(row => {
    const minutes = Number(row.minutes);
    if (!row.minutes.trim() || !Number.isInteger(minutes) || minutes < 0 || minutes > 60000)
      throw new Error('Informe a carga individual de cada estudante, de 0 a 60.000 minutos.');
    return { student_id: row.student_id, participant_role: row.participant_role, minutes };
  });
}

export default function TeachingActivityRoster({ institutionId, courseId, activityId, onChange }: Scope & { onChange: (rows: RosterPayload | null, error: string) => void }) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [request, setRequest] = useState({ query: '', revision: 0 });
  const [loading, setLoading] = useState(!!activityId);
  const [initialized, setInitialized] = useState(!activityId);
  const initializedRef = useRef(!activityId);
  const [error, setError] = useState('');
  const [modified, setModified] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  useEffect(() => {
    if (!activityId && !request.revision) return;
    let current = true;
    const initial = !initializedRef.current;
    setLoading(true);
    setError('');
    void roster({ institutionId, courseId, activityId }, request.query).then(rows => {
      if (!current) return;
      if (initial) {
        setSelected(rows.filter((row): row is Row & { participant_role: NonNullable<Row['participant_role']> } => !!row.participant_role).map(row => ({
          ...row, minutes: row.minutes == null ? '' : String(row.minutes),
        })));
        initializedRef.current = true;
        setInitialized(true);
      }
      setSubmittedQuery(request.query);
      setResults(rows);
    }).catch(cause => {
      if (current) { setResults([]); setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a base do curso.'); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
    // This component is keyed by the draft; reloads must not replace unsaved selections.
  }, [institutionId, courseId, activityId, request]);

  function change(rows: Selected[]) {
    setModified(true);
    setSelected(rows);
    try { onChange(toRosterPayload(rows), ''); }
    catch (cause) { onChange(null, cause instanceof Error ? cause.message : 'Revise as horas.'); }
  }

  function search() {
    const term = query.trim();
    if (term.length < 2) { setError('Digite pelo menos dois caracteres do nome ou da matrícula.'); return; }
    setRequest(previous => ({ query: term, revision: previous.revision + 1 }));
  }

  const available = results.filter(row => !selected.some(s => s.student_id === row.student_id));
  return <div className="teaching-roster">
    <p>Busque na base institucional do curso. O papel e as horas registrados aqui não concedem crédito de Atividades Complementares.</p>
    <div className="teaching-roster-search">
      <label className="planning-field"><span>Nome ou matrícula</span><input type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); if (!loading) search(); }
      }} /></label>
      <button type="button" disabled={loading} onClick={search}>Buscar estudantes</button>
    </div>
    {loading && <p role="status">Consultando a base do curso…</p>}
    {error && <p role="alert">{error}{!initialized && <button type="button" onClick={() => setRequest({ query: '', revision: request.revision + 1 })}>Recarregar participantes</button>}</p>}
    {initialized && !loading && submittedQuery && available.length === 0 && !error && <p>Nenhum estudante disponível para adicionar nessa busca.</p>}
    {initialized && available.length > 0 && <ul className="teaching-pdi-list" aria-label="Estudantes encontrados">{available.map(row =>
      <li key={row.student_id} className="teaching-pdi-record teaching-roster-entry">
        <span><strong>{row.student_name}</strong>{row.enrollment_code ? ` · ${row.enrollment_code}` : ''}</span>
        <button type="button" disabled={selected.length >= 500 || loading} onClick={() => change([...selected, { ...row, participant_role: 'participante', minutes: '' }])}>Adicionar {row.student_name}</button>
      </li>
    )}</ul>}
    {initialized && <>
      <h4>Organizadores e participantes ({selected.length})</h4>
      {!selected.length && <p>Nenhum estudante vinculado.</p>}
      <ul className="teaching-pdi-list" aria-label="Estudantes selecionados">{selected.map(row =>
        <li key={row.student_id} className="teaching-pdi-record">
          <strong>{row.student_name}</strong>{row.enrollment_code ? ` · ${row.enrollment_code}` : ''}
          <div className="teaching-pdi-grid">
            <label className="planning-field"><span>Papel de {row.student_name}</span>
              <select disabled={!row.enrollment_code || row.editable === false} value={row.participant_role} onChange={event => change(selected.map(s => s.student_id === row.student_id ? { ...s, participant_role: event.target.value as Selected['participant_role'] } : s))}>
                <option value="participante">Participante</option><option value="organizador">Organizador</option>
              </select>
            </label>
            <label className="planning-field"><span>Minutos de {row.student_name}</span>
              <input disabled={!row.enrollment_code || row.editable === false} type="number" min="0" max="60000" step="1" value={row.minutes} onChange={event => change(selected.map(s => s.student_id === row.student_id ? { ...s, minutes: event.target.value } : s))} />
            </label>
          </div>
          <button type="button" onClick={() => change(selected.filter(s => s.student_id !== row.student_id))}>Remover {row.student_name}</button>
        </li>
      )}</ul>
    </>}
    {modified && <p className="teaching-pdi-meta" role="status">A lista será atualizada ao salvar o rascunho.</p>}
  </div>;
}

export function TeachingActivityRosterSummary({ institutionId, courseId, activityId }: Scope) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ rows: Row[]; failed: boolean }>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setState(undefined);
    void roster({ institutionId, courseId, activityId }).then(rows => {
      if (current) setState({ rows: rows.filter(row => row.participant_role), failed: false });
    }).catch(() => { if (current) setState({ rows: [], failed: true }); });
    return () => { current = false; };
  }, [institutionId, courseId, activityId, open, revision]);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Organizadores, participantes e horas</summary>
    {open && (!state ? <p role="status">Consultando participantes…</p> : state.failed ? <p role="alert">Não foi possível consultar participantes. <button type="button" onClick={() => setRevision(revision + 1)}>Tentar novamente</button></p> : state.rows.length ? <ul>{state.rows.map(row => <li key={row.student_id}>
      {row.student_name}{row.enrollment_code ? ` · ${row.enrollment_code}` : ''} · {roleLabel(row.participant_role ?? '')} · {row.minutes ?? 'Carga não registrada'}{row.minutes != null ? ' min' : ''}
    </li>)}</ul> : <p>Nenhum estudante vinculado.</p>)}
  </details>;
}
