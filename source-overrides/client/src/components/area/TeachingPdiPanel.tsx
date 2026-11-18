import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isFullAccess, visibleTabs, GOAL_STATUS, DIRECTION, type Role } from '@/lib/area';
import './planning/planning.css';
import './teaching-pdi.css';
import TeachingFatoOrdem from './TeachingFatoOrdem';
import TeachingAcHandoff from './TeachingAcHandoff';

type Course = { id: string; name: string; degree?: string | null };
type Props = {
  institutionId: string;
  courses: Course[];
  role: string | null;
  mode: 'gestao' | 'academico';
  onNavigate?: (tab: string) => void;
};

const TYPES = [
  ['evento', 'Evento formativo: palestra, seminário ou minicurso'],
  ['pratica', 'Prática, oficina ou laboratório'],
  ['monitoria', 'Monitoria, tutoria ou grupo de estudos'],
  ['visita', 'Visita técnica'],
  ['avaliacao', 'Simulado ou resolução de questões'],
  ['estudo', 'Estudo de caso, projeto ou produção acadêmica'],
  ['outra', 'Outra atividade de ensino'],
] as const;
const ORGANIZERS = [
  ['docente', 'Docente'], ['discente', 'Estudantes'], ['coordenacao', 'Coordenação'], ['outro', 'Outro'],
] as const;
const EXAMS = [
  ['enade', 'ENADE'], ['oab', 'OAB'], ['enamed', 'ENAMED'], ['cfc', 'CFC'],
  ['residencia-medica', 'Residência Médica'], ['carreiras-juridicas', 'Carreiras Jurídicas'], ['outro', 'Outro exame ou carreira'],
] as const;
const ODS = [
  'Erradicação da pobreza', 'Fome zero e agricultura sustentável', 'Saúde e bem-estar',
  'Educação de qualidade', 'Igualdade de gênero', 'Água potável e saneamento',
  'Energia limpa e acessível', 'Trabalho decente e crescimento econômico',
  'Indústria, inovação e infraestrutura', 'Redução das desigualdades',
  'Cidades e comunidades sustentáveis', 'Consumo e produção responsáveis',
  'Ação contra a mudança global do clima', 'Vida na água', 'Vida terrestre',
  'Paz, justiça e instituições eficazes', 'Parcerias e meios de implementação',
];
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="planning-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

function displayDate(date?: string | null) {
  return date ? date.split('-').reverse().join('/') : 'Não informado';
}

function browserDate() {
  const now = new Date();
  return [
    now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function TeachingPdiPanel(props: Props) {
  // Reset selection and drafts before rendering a different institution or module.
  return <ScopedPanel key={`${props.institutionId}:${props.mode}:${props.role ?? ''}`} {...props} />;
}

type PdiProgram = { id: string; title: string; description: string | null };
type PdiGoal = {
  id: string; title: string; pdi_program_id: string | null; indicator: string;
  target: number; unit: string | null; owner_name: string | null; due_date: string | null;
  direction: string; status: string; pdi_expected_result: string | null;
};
type Activity = {
  id: string; course_id: string; title: string; category: string; description: string;
  activity_date: string; organizer_role: string; goal_id: string | null;
  evidence_doc_id: string | null; ods_goal: number | null; ods_rationale: string | null;
  status: string; updated_at: string; exam_module: string | null; created_by: string | null;
};
type Evidence = { id: string; title: string };
const TABLE = { programs: 'vertice_pdi_programs', goals: 'vertice_goals', activities: 'vertice_teaching_activities' };
const emptyProgram = { id: '', title: '', description: '' };
const emptyGoal = { id: '', pdi_program_id: '', title: '', indicator: '', target: '', unit: '', owner_name: '', due_date: '', direction: 'aumentar', status: 'planejada', pdi_expected_result: '' };
const newActivity = () => ({
  id: '', updated_at: '', title: '', category: 'evento', description: '', activity_date: browserDate(), organizer_role: 'docente', exam_module: '',
  goal_id: '', evidence_doc_id: '', ods_goal: '', ods_rationale: '',
});
const activityStatus = (status: string) => ({ rascunho: 'Rascunho', validada: 'Validada', cancelada: 'Cancelada' }[status] ?? status);
const GOAL_FIELDS = 'id,title,pdi_program_id,indicator,target,unit,owner_name,due_date,direction,status,pdi_expected_result';
const ACTIVITY_FIELDS = 'id,course_id,title,category,description,activity_date,organizer_role,goal_id,evidence_doc_id,ods_goal,ods_rationale,status,updated_at,exam_module,created_by';

function parseError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível concluir a operação.';
}

function ScopeNavigation({ mode, onNavigate, role }: Pick<Props, 'mode' | 'onNavigate' | 'role'>) {
  if (!onNavigate) return null;
  const visible = visibleTabs(role as Role | null);
  return <nav aria-label="Áreas relacionadas" className="teaching-pdi-actions">
    {mode === 'gestao' && <>
      <button type="button" className="btn-secondary" onClick={() => onNavigate('metas')}>Metas e medições</button>
      <button type="button" className="btn-secondary" onClick={() => onNavigate('atividades-ensino')}>Atividades de Ensino</button>
    </>}
    {mode === 'academico' && visible.includes('programas-pdi') && <button type="button" className="btn-secondary" onClick={() => onNavigate('programas-pdi')}>Programas e metas do PDI</button>}
    {mode === 'academico' && visible.includes('documentos') && <button type="button" className="btn-secondary" onClick={() => onNavigate('documentos')}>Mesa Digital</button>}
  </nav>;
}

async function evidenceOptions(institutionId: string, courseId: string, query?: string, documentId?: string): Promise<Evidence[]> {
  const { data, error } = await supabase.rpc('vertice_teaching_evidence_options', {
    p_institution: institutionId, p_course: courseId,
    ...(query ? { p_query: query } : {}), ...(documentId ? { p_document: documentId } : {}),
  });
  if (error) throw error;
  return (data ?? []) as Evidence[];
}

function ContributionEvidence({ institutionId, row }: { institutionId: string; row: Activity }) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  async function show() {
    if (busy || attempted || !row.evidence_doc_id) return;
    setBusy(true);
    try {
      const options = await evidenceOptions(institutionId, row.course_id, undefined, row.evidence_doc_id);
      setLabel(options.find(document => document.id === row.evidence_doc_id)?.title ?? 'Documento vinculado indisponível para consulta.');
    } catch {
      setLabel('Não foi possível consultar o documento vinculado neste curso.');
    } finally {
      setBusy(false);
      setAttempted(true);
    }
  }
  return <details onToggle={e => { if (e.currentTarget.open) void show(); }}>
    <summary>Evidência da Mesa Digital vinculada</summary>
    {busy ? <p role="status">Consultando evidência do curso…</p> : label && <p>{label}</p>}
  </details>;
}

function FatoOrdemSection({ institutionId, courseId }: { institutionId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="card" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Desempenho do Fato &amp; Ordem</summary>
    {open && <TeachingFatoOrdem institutionId={institutionId} courseId={courseId} />}
  </details>;
}

async function scopedList<T>(
  mode: 'programs' | 'goals' | 'activities',
  institutionId: string,
  fields: string,
  options?: { courseId?: string; contributionsOnly?: boolean },
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    let query = supabase.from(TABLE[mode]).select(fields).eq('institution_id', institutionId);
    if (mode === 'goals') query = query.is('course_id', null).not('pdi_program_id', 'is', null);
    if (mode === 'activities' && options?.courseId) query = query.eq('course_id', options.courseId);
    if (mode === 'activities' && options?.contributionsOnly) query = query.not('goal_id', 'is', null);
    const column = mode === 'activities' ? 'activity_date' : 'title';
    const { data, error } = await query.order(column, { ascending: mode !== 'activities' }).order('id').range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < pageSize) return rows;
  }
}

async function writeRow(
  kind: keyof typeof TABLE,
  institutionId: string,
  row: Record<string, unknown>,
  existing?: { id: string; courseId?: string; updatedAt?: string; fromStatus?: string },
) {
  let request = existing
    ? supabase.from(TABLE[kind]).update(row).eq('institution_id', institutionId).eq('id', existing.id)
    : supabase.from(TABLE[kind]).insert({ ...row, institution_id: institutionId });
  if (existing?.courseId) request = request.eq('course_id', existing.courseId);
  if (existing?.updatedAt) request = request.eq('updated_at', existing.updatedAt);
  if (existing?.fromStatus) request = request.eq('status', existing.fromStatus);
  const { data, error } = await request.select('id').single();
  if (error || !data?.id) throw new Error(
    error?.code === 'PGRST116'
      ? 'Não foi possível confirmar a alteração. Recarregue os dados e verifique o acesso ou a versão atual.'
      : parseError(error),
  );
}

function ScopedPanel({ institutionId, courses, role, mode, onNavigate }: Props) {
  const management = isFullAccess(role as Role | null);
  const canEditActivity = management || role === 'coordenador' || role === 'equipe';
  const canValidate = management || role === 'coordenador';
  const canOpenAc = !!onNavigate && visibleTabs(role as Role | null).includes('atividades-complementares');
  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [course, setCourse] = useState('');
  const courseId = courseOptions.some(c => c.id === course) ? course : '';
  const [courseLoading, setCourseLoading] = useState(mode === 'academico');
  const [courseError, setCourseError] = useState('');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [courseRevision, setCourseRevision] = useState(0);
  const [programs, setPrograms] = useState<PdiProgram[]>([]);
  const [goals, setGoals] = useState<PdiGoal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [knownEvidence, setKnownEvidence] = useState<Evidence[]>([]);
  const [filterProgram, setFilterProgram] = useState('');
  const [programDraft, setProgramDraft] = useState(emptyProgram);
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [activityDraft, setActivityDraft] = useState(newActivity);
  const [loading, setLoading] = useState(true);
  const [evidenceReady, setEvidenceReady] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const programForm = useRef<HTMLFormElement>(null);
  const goalForm = useRef<HTMLFormElement>(null);
  const activityForm = useRef<HTMLFormElement>(null);
  const busyGuard = useRef(false);
  const evidenceScope = useRef(courseId);
  useEffect(() => { evidenceScope.current = courseId; }, [courseId]);
  const [confirmActivity, setConfirmActivity] = useState<Activity | null>(null);
  const title = mode === 'gestao' ? 'Programas e metas do PDI' : 'Atividades de Ensino';

  useEffect(() => {
    if (mode !== 'academico') return;
    let current = true;
    setCourseLoading(true);
    setCourseError('');
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('vertice_teaching_course_options', { p_institution: institutionId });
        if (error) throw error;
        if (!current) return;
        const choices = (data ?? []) as Course[];
        if (role === 'equipe') {
          const { data: profile } = await supabase.auth.getUser();
          if (!current) return;
          setStaffId(profile.user?.id ?? null);
        }
        setCourseOptions(choices);
        setCourse(previous => choices.some(c => c.id === previous) ? previous : (choices.length === 1 ? choices[0].id : ''));
      } catch (error) {
        if (current) { setCourseOptions([]); setCourseError(parseError(error)); }
      } finally {
        if (current) setCourseLoading(false);
      }
    })();
    return () => { current = false; };
  }, [institutionId, mode, role, courseRevision]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    setActivities([]);
    const load = async () => {
      try {
        const [nextPrograms, nextGoals, nextActivities] = await Promise.all([
          scopedList<PdiProgram>('programs', institutionId, 'id,title,description'),
          scopedList<PdiGoal>('goals', institutionId, GOAL_FIELDS),
          mode === 'gestao' || courseId
            ? scopedList<Activity>('activities', institutionId, ACTIVITY_FIELDS, {
              courseId: mode === 'academico' ? courseId : undefined,
              contributionsOnly: mode === 'gestao',
            })
            : Promise.resolve([]),
        ]);
        if (!current) return;
        setPrograms(nextPrograms);
        setGoals(nextGoals);
        setActivities(nextActivities);
      } catch (error) {
        if (current) { setPrograms([]); setGoals([]); setLoadError(parseError(error)); }
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => { current = false; };
  }, [institutionId, courseId, mode, revision]);

  useEffect(() => {
    if (mode !== 'academico' || !courseId) return;
    let current = true;
    setEvidenceError('');
    setEvidenceReady(false);
    void (async () => {
      try {
        const options = await evidenceOptions(institutionId, courseId, evidenceQuery);
        if (!current) return;
        setEvidence(options);
        setKnownEvidence(previous => [...new Map([...previous, ...options].map(document => [document.id, document])).values()]);
        setEvidenceReady(true);
      } catch (error) {
        if (current) setEvidenceError(parseError(error));
      }
    })();
    return () => { current = false; };
  }, [institutionId, courseId, mode, revision, evidenceQuery]);

  function chooseCourse(value: string) {
    if (busyGuard.current) return;
    evidenceScope.current = value;
    setCourse(value);
    setLoading(true);
    setActivities([]);
    setEvidence([]);
    setKnownEvidence([]);
    setEvidenceSearch('');
    setEvidenceQuery('');
    setEvidenceReady(false);
    setActionError('');
    setNotice('');
    setActivityDraft(newActivity());
    setConfirmActivity(null);
  }

  async function run(action: () => Promise<void>, success: string, reset?: () => void) {
    if (busyGuard.current || loading || loadError) return;
    busyGuard.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await action();
      reset?.();
      setNotice(success);
      setLoading(true);
      setRevision(v => v + 1);
    } catch (error) {
      setActionError(parseError(error));
    } finally {
      busyGuard.current = false;
      setBusy(false);
    }
  }

  function saveProgram() {
    if (!management) return;
    const draft = programDraft;
    if (!draft.title.trim()) { setActionError('Informe o nome do programa.'); return; }
    void run(
      () => writeRow('programs', institutionId, {
        title: draft.title.trim(), description: draft.description.trim() || null,
      }, draft.id ? { id: draft.id } : undefined),
      'Programa salvo.',
      () => setProgramDraft(emptyProgram),
    );
  }

  function saveGoal() {
    if (!management) return;
    const draft = goalDraft;
    const target = Number(draft.target);
    if (!programs.some(p => p.id === draft.pdi_program_id) || !draft.title.trim() || !draft.indicator.trim()
      || !draft.owner_name.trim() || !draft.due_date || !draft.pdi_expected_result.trim()
      || draft.target.trim() === '' || !Number.isFinite(target)) {
      setActionError('Informe programa, meta, indicador, valor-alvo, prazo, responsável e resultado esperado.');
      return;
    }
    void run(
      () => writeRow('goals', institutionId, {
        course_id: null, pdi_program_id: draft.pdi_program_id, title: draft.title.trim(), indicator: draft.indicator.trim(),
        target, unit: draft.unit.trim() || null, owner_name: draft.owner_name.trim(), due_date: draft.due_date,
        direction: draft.direction, pdi_expected_result: draft.pdi_expected_result.trim(),
        ...(draft.id ? {} : { status: 'planejada' }),
      }, draft.id ? { id: draft.id } : undefined),
      'Meta do PDI salva. O resultado só avança mediante medições.',
      () => setGoalDraft(emptyGoal),
    );
  }

  function saveActivity() {
    if (!canEditActivity || !courseId) return;
    const draft = activityDraft;
    if (!draft.title.trim() || !draft.description.trim() || !draft.activity_date) {
      setActionError('Informe título, descrição e data da atividade.'); return;
    }
    if (draft.ods_goal && !draft.ods_rationale.trim()) {
      setActionError('Justifique a relação com o ODS selecionado.'); return;
    }
    if (draft.goal_id && !goals.some(g => g.id === draft.goal_id)) {
      setActionError('Selecione uma meta do PDI disponível para esta instituição.'); return;
    }
    if (draft.evidence_doc_id && !knownEvidence.some(d => d.id === draft.evidence_doc_id)) {
      setActionError('Selecione uma evidência disponível na Mesa Digital deste curso ou remova o vínculo.'); return;
    }
    void run(
      () => writeRow('activities', institutionId, {
        ...(draft.id ? {} : { course_id: courseId }), title: draft.title.trim(), category: draft.category, description: draft.description.trim(),
        activity_date: draft.activity_date, organizer_role: draft.organizer_role, exam_module: draft.category === 'avaliacao' ? draft.exam_module || null : null, goal_id: draft.goal_id || null,
        evidence_doc_id: draft.evidence_doc_id || null, ods_goal: draft.ods_goal ? Number(draft.ods_goal) : null,
        ods_rationale: draft.ods_goal ? draft.ods_rationale.trim() : null,
      }, draft.id ? { id: draft.id, courseId, updatedAt: draft.updated_at, fromStatus: 'rascunho' } : undefined),
      'Atividade salva como rascunho. Nenhuma hora foi creditada.',
      () => setActivityDraft(newActivity()),
    );
  }

  function editActivity(row: Activity) {
    activityForm.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    setActivityDraft({
      ...row, exam_module: row.exam_module ?? '', goal_id: row.goal_id ?? '', evidence_doc_id: row.evidence_doc_id ?? '',
      ods_goal: row.ods_goal ? String(row.ods_goal) : '', ods_rationale: row.ods_rationale ?? '',
    });
    if (row.evidence_doc_id && !knownEvidence.some(d => d.id === row.evidence_doc_id)) {
      const scopedId = courseId;
      void evidenceOptions(institutionId, scopedId, undefined, row.evidence_doc_id).then(options => {
        if (options.length && evidenceScope.current === scopedId) setKnownEvidence(previous => [...new Map([...previous, ...options].map(document => [document.id, document])).values()]);
      }).catch(() => undefined);
    }
  }

  function validateActivity(row: Activity) {
    if (!canValidate || row.status !== 'rascunho' || row.course_id !== courseId) return;
    void run(
      () => writeRow('activities', institutionId, { status: 'validada' }, { id: row.id, courseId, updatedAt: row.updated_at, fromStatus: 'rascunho' }),
      'Atividade validada. Não houve crédito de horas nem medição automática da meta.',
      () => { setConfirmActivity(null); if (activityDraft.id === row.id) setActivityDraft(newActivity()); },
    );
  }

  const availableGoals = goals.filter(goal => goal.status !== 'cancelada' || goal.id === activityDraft.goal_id);
  const displayedActivities = activities.filter(row => mode === 'gestao' || row.course_id === courseId);
  const nameOfCourse = (courseId: string) => courses.find(c => c.id === courseId)?.name ?? 'Curso vinculado';
  const nameOfProgram = (programId: string | null) => programs.find(p => p.id === programId)?.title ?? 'Programa do PDI';
  const labelOfEvidence = (id: string) => knownEvidence.find(d => d.id === id)?.title ?? 'Documento vinculado';
  const busyLoading = busy || loading || courseLoading;

  return <section className="course-planning teaching-pdi" aria-label={title} aria-busy={busyLoading}>
    <h2>{title}</h2>
    <p className="teaching-pdi-intro">{mode === 'gestao'
      ? 'Organize os programas institucionais e acompanhe quais atividades contribuem para cada meta. Contribuição e evidência de execução não substituem medição de resultado.'
      : 'Registre atividades formativas da graduação ou pós-graduação. Vincule metas do PDI, ODS e documentos da Mesa Digital quando houver relação direta.'}</p>
    <ScopeNavigation mode={mode} role={role} onNavigate={onNavigate} />
    {mode === 'academico' && <Field label="Curso">
      <select value={courseId} disabled={busy || courseLoading || !!courseError} onChange={e => chooseCourse(e.target.value)}>
        <option value="">Selecione um curso</option>
        {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}{c.degree ? ` · ${c.degree}` : ''}</option>)}
      </select>
    </Field>}
    {notice && <p role="status" className="planning-success">{notice}</p>}
    {actionError && <p role="alert" className="planning-error">{actionError}</p>}
    {(loading || courseLoading) && <p role="status">Carregando registros…</p>}
    {courseError && <div role="alert" className="planning-error">
      <p>Não foi possível consultar os cursos do perfil. {courseError}</p>
      <button type="button" className="btn-secondary" onClick={() => setCourseRevision(v => v + 1)}>Recarregar cursos</button>
    </div>}
    {loadError && <div role="alert" className="planning-error">
      <p>Não foi possível carregar os registros. {loadError}</p>
      <button type="button" className="btn-secondary" onClick={() => setRevision(v => v + 1)}>Tentar novamente</button>
    </div>}
    {!loading && !loadError && mode === 'gestao' && <>
      {management && <div className="teaching-pdi-grid">
        <form ref={programForm} className="card" onSubmit={e => { e.preventDefault(); saveProgram(); }}>
          <fieldset disabled={busy}><legend>{programDraft.id ? 'Editar programa institucional' : 'Novo programa institucional'}</legend>
            <Field label="Nome do programa"><input required maxLength={250} value={programDraft.title} onChange={e => setProgramDraft({ ...programDraft, title: e.target.value })} /></Field>
            <Field label="Descrição do programa" help="Por exemplo: sustentabilidade, acessibilidade ou responsabilidade social."><textarea maxLength={4000} value={programDraft.description} onChange={e => setProgramDraft({ ...programDraft, description: e.target.value })} /></Field>
            <div className="teaching-pdi-actions">
              <button type="submit" className="planning-primary">Salvar programa</button>
              {programDraft.id && <button type="button" className="btn-secondary" onClick={() => setProgramDraft(emptyProgram)}>Cancelar edição do programa</button>}
            </div>
          </fieldset>
        </form>
        <form ref={goalForm} className="card" onSubmit={e => { e.preventDefault(); saveGoal(); }}>
          <fieldset disabled={busy || !programs.length}><legend>{goalDraft.id ? 'Editar meta do PDI' : 'Nova meta do PDI'}</legend>
            {!programs.length && <p>Cadastre primeiro um programa institucional.</p>}
            <Field label="Programa da meta"><select required value={goalDraft.pdi_program_id} onChange={e => setGoalDraft({ ...goalDraft, pdi_program_id: e.target.value })}>
              <option value="">Selecione um programa</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select></Field>
            <Field label="Título da meta"><input required maxLength={250} value={goalDraft.title} onChange={e => setGoalDraft({ ...goalDraft, title: e.target.value })} /></Field>
            <Field label="Indicador"><input required maxLength={250} value={goalDraft.indicator} onChange={e => setGoalDraft({ ...goalDraft, indicator: e.target.value })} /></Field>
            <div className="teaching-pdi-grid">
              <Field label="Direção desejada"><select value={goalDraft.direction} onChange={e => setGoalDraft({ ...goalDraft, direction: e.target.value })}>
                {DIRECTION.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></Field>
              <Field label="Valor-alvo"><input required type="number" step="any" value={goalDraft.target} onChange={e => setGoalDraft({ ...goalDraft, target: e.target.value })} /></Field>
              <Field label="Unidade"><input maxLength={30} placeholder="%, kg, participantes…" value={goalDraft.unit} onChange={e => setGoalDraft({ ...goalDraft, unit: e.target.value })} /></Field>
              <Field label="Prazo"><input required type="date" value={goalDraft.due_date} onChange={e => setGoalDraft({ ...goalDraft, due_date: e.target.value })} /></Field>
            </div>
            <Field label="Responsável"><input required maxLength={250} value={goalDraft.owner_name} onChange={e => setGoalDraft({ ...goalDraft, owner_name: e.target.value })} /></Field>
            <Field label="Resultado esperado"><textarea required maxLength={4000} value={goalDraft.pdi_expected_result} onChange={e => setGoalDraft({ ...goalDraft, pdi_expected_result: e.target.value })} /></Field>
            <div className="teaching-pdi-actions">
              <button type="submit" className="planning-primary">Salvar meta</button>
              {goalDraft.id && <button type="button" className="btn-secondary" onClick={() => setGoalDraft(emptyGoal)}>Cancelar edição da meta</button>}
            </div>
          </fieldset>
        </form>
      </div>}
      <h3>Programas institucionais</h3>
      {programs.length ? <ul className="teaching-pdi-list">{programs.map(program => <li key={program.id} className="teaching-pdi-record">
        <h4>{program.title}</h4>{program.description && <p className="teaching-pdi-description">{program.description}</p>}
        {management && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setProgramDraft({ id: program.id, title: program.title, description: program.description ?? '' }); programForm.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }}>Editar programa</button>}
      </li>)}</ul> : <p>Nenhum programa cadastrado.</p>}
      <h3>Metas e contribuições de ensino</h3>
      {programs.length > 0 && <Field label="Filtrar por programa"><select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
        <option value="">Todos os programas</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select></Field>}
      {goals.filter(goal => !filterProgram || goal.pdi_program_id === filterProgram).length ? <ul className="teaching-pdi-list">
        {goals.filter(goal => !filterProgram || goal.pdi_program_id === filterProgram).map(goal => {
          const linked = displayedActivities.filter(row => row.goal_id === goal.id);
          return <li key={goal.id} className="teaching-pdi-record">
            <h4>{goal.title}</h4><p>{nameOfProgram(goal.pdi_program_id)} · {GOAL_STATUS.find(([value]) => value === goal.status)?.[1] ?? goal.status}</p>
            <p><strong>Indicador:</strong> {goal.indicator} · <strong>Valor-alvo:</strong> {Number(goal.target).toLocaleString('pt-BR')}{goal.unit ? ` ${goal.unit}` : ''}</p>
            <p><strong>Prazo:</strong> {displayDate(goal.due_date)} · <strong>Responsável:</strong> {goal.owner_name ?? 'Não informado'}</p>
            {goal.pdi_expected_result && <p className="teaching-pdi-description"><strong>Resultado esperado:</strong> {goal.pdi_expected_result}</p>}
            <details>
              <summary>Contribuições de ensino: {linked.filter(row => row.status === 'validada').length} validadas de {linked.length} vinculadas</summary>
              {linked.length ? <ul>{linked.map(row => <li key={row.id}>
                {row.title} · {nameOfCourse(row.course_id)} · {displayDate(row.activity_date)} · {activityStatus(row.status)}
                {row.evidence_doc_id && <ContributionEvidence key={row.evidence_doc_id} institutionId={institutionId} row={row} />}
              </li>)}</ul> : <p>Nenhuma atividade vinculada a esta meta.</p>}
              <p className="teaching-pdi-meta">As contribuições não alteram o indicador, o resultado nem o percentual de avanço da meta.</p>
            </details>
            {management && <div className="teaching-pdi-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => { setGoalDraft({
              ...emptyGoal, id: goal.id, pdi_program_id: goal.pdi_program_id ?? '', title: goal.title, indicator: goal.indicator,
              target: String(goal.target), unit: goal.unit ?? '', owner_name: goal.owner_name ?? '', due_date: goal.due_date ?? '',
              direction: goal.direction, status: goal.status, pdi_expected_result: goal.pdi_expected_result ?? '',
            }); goalForm.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }}>Editar meta</button></div>}
          </li>;
        })}
      </ul> : <p>Nenhuma meta do PDI neste filtro.</p>}
    </>}
    {!loading && !courseLoading && !loadError && !courseError && mode === 'academico' && !courseId && <p>{courseOptions.length ? 'Selecione um curso para consultar as atividades.' : 'Nenhum curso disponível para o seu perfil.'}</p>}
    {!loading && !courseLoading && !loadError && !courseError && mode === 'academico' && courseId && <>
      <p className="teaching-pdi-meta">Este registro não é Extensão. Horas complementares elegíveis devem ser avaliadas conforme o regulamento do curso; não são creditadas por este cadastro.</p>
      {canEditActivity && <form ref={activityForm} className="card" onSubmit={e => { e.preventDefault(); saveActivity(); }}>
        <fieldset disabled={busy}><legend>{activityDraft.id ? 'Editar rascunho' : 'Nova atividade de ensino'}</legend>
          <Field label="Título da atividade"><input required maxLength={250} value={activityDraft.title} onChange={e => setActivityDraft({ ...activityDraft, title: e.target.value })} /></Field>
          <div className="teaching-pdi-grid">
            <Field label="Tipo de atividade"><select value={activityDraft.category} onChange={e => setActivityDraft({ ...activityDraft, category: e.target.value, exam_module: e.target.value === 'avaliacao' ? activityDraft.exam_module : '' })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Quem organizou"><select value={activityDraft.organizer_role} onChange={e => setActivityDraft({ ...activityDraft, organizer_role: e.target.value })}>{ORGANIZERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Data da atividade"><input required type="date" value={activityDraft.activity_date} onChange={e => setActivityDraft({ ...activityDraft, activity_date: e.target.value })} /></Field>
          </div>
          {activityDraft.category === 'avaliacao' && <Field label="Exame ou carreira (opcional)" help="É uma referência informada no cadastro, não uma sincronização de resultados com o Fato & Ordem.">
            <select value={activityDraft.exam_module} onChange={e => setActivityDraft({ ...activityDraft, exam_module: e.target.value })}>
              <option value="">Sem exame identificado</option>{EXAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>}
          <Field label="Descrição do que foi feito" help={activityDraft.category === 'avaliacao' ? 'Para simulados ou questões do Fato & Ordem, identifique o exame ou carreira e descreva a atividade. Não inclua dados pessoais de estudantes.' : 'Descreva objetivos, formato e entregas. Não inclua dados pessoais de estudantes.'}>
            <textarea required maxLength={4000} value={activityDraft.description} onChange={e => setActivityDraft({ ...activityDraft, description: e.target.value })} />
          </Field>
          <div className="teaching-pdi-grid">
            <Field label="Meta do PDI (opcional)"><select value={activityDraft.goal_id} onChange={e => setActivityDraft({ ...activityDraft, goal_id: e.target.value })}>
              <option value="">Sem vínculo com meta</option>
              {availableGoals.map(g => <option key={g.id} value={g.id}>{g.title} · {nameOfProgram(g.pdi_program_id)}</option>)}
            </select></Field>
            <div>
              <Field label="Buscar documento pelo título"><input maxLength={120} value={evidenceSearch} onChange={e => setEvidenceSearch(e.target.value)} /></Field>
              <button type="button" className="btn-secondary" onClick={() => setEvidenceQuery(evidenceSearch.trim())}>Buscar evidências</button>
            </div>
            <Field label="Evidência da Mesa Digital (opcional)" help="Apenas documentos disponíveis neste curso. Nenhum arquivo será copiado.">
              <select value={activityDraft.evidence_doc_id} disabled={!evidenceReady && !activityDraft.evidence_doc_id} onChange={e => setActivityDraft({ ...activityDraft, evidence_doc_id: e.target.value })}>
                <option value="">{evidenceReady ? 'Sem evidência vinculada' : 'Evidências não carregadas'}</option>
                {activityDraft.evidence_doc_id && !evidence.some(d => d.id === activityDraft.evidence_doc_id) && <option value={activityDraft.evidence_doc_id}>{labelOfEvidence(activityDraft.evidence_doc_id)} (vínculo atual)</option>}
                {evidence.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </Field>
            <Field label="ODS (opcional)"><select value={activityDraft.ods_goal} onChange={e => setActivityDraft({ ...activityDraft, ods_goal: e.target.value, ods_rationale: e.target.value ? activityDraft.ods_rationale : '' })}>
              <option value="">Sem relação direta com ODS</option>{ODS.map((name, i) => <option key={i} value={i + 1}>{i + 1}. {name}</option>)}
            </select></Field>
          </div>
          {evidenceError && <p role="status" className="teaching-pdi-meta">Não foi possível listar as evidências do curso. {evidenceError} <button type="button" className="btn-secondary" onClick={() => setRevision(v => v + 1)}>Recarregar evidências</button></p>}
          {activityDraft.ods_goal && <Field label="Justificativa do vínculo com o ODS"><textarea required maxLength={1500} value={activityDraft.ods_rationale} onChange={e => setActivityDraft({ ...activityDraft, ods_rationale: e.target.value })} /></Field>}
          <div className="teaching-pdi-actions">
            <button type="submit" className="planning-primary">Salvar rascunho</button>
            {activityDraft.id && <button type="button" className="btn-secondary" onClick={() => setActivityDraft(newActivity())}>Cancelar edição da atividade</button>}
          </div>
        </fieldset>
      </form>}
      <FatoOrdemSection key={courseId} institutionId={institutionId} courseId={courseId} />
      <h3>Atividades do curso</h3>
      {displayedActivities.length ? <ul className="teaching-pdi-list">{displayedActivities.map(row => <li className="teaching-pdi-record" key={row.id}>
        <h4>{row.title}</h4>
        <p className="teaching-pdi-meta">{displayDate(row.activity_date)} · {TYPES.find(([value]) => value === row.category)?.[1] ?? row.category} · {activityStatus(row.status)} · Organização: {ORGANIZERS.find(([value]) => value === row.organizer_role)?.[1] ?? row.organizer_role}</p>
        <p className="teaching-pdi-description">{row.description}</p>
        {row.exam_module && <p><strong>Exame ou carreira:</strong> {EXAMS.find(([value]) => value === row.exam_module)?.[1] ?? row.exam_module}</p>}
        {row.goal_id && <p><strong>Meta do PDI:</strong> {goals.find(g => g.id === row.goal_id)?.title ?? 'Meta vinculada'}</p>}
        {row.evidence_doc_id && <ContributionEvidence key={row.evidence_doc_id} institutionId={institutionId} row={row} />}
        {row.ods_goal && <p><strong>ODS {row.ods_goal}: {ODS[row.ods_goal - 1]}</strong> · {row.ods_rationale}</p>}
        {row.status === 'validada' && canValidate && <TeachingAcHandoff
          institutionId={institutionId} courseId={row.course_id} activityId={row.id}
          enabled={!!row.evidence_doc_id}
          onOpenAc={canOpenAc ? () => onNavigate?.('atividades-complementares') : undefined}
        />}
        {row.status === 'rascunho' && (canValidate || (role === 'equipe' && !!staffId && row.created_by === staffId)) && <div className="teaching-pdi-actions">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => editActivity(row)}>Editar rascunho</button>
          {canValidate && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmActivity(row)}>Revisar validação</button>}
        </div>}
        {confirmActivity?.id === row.id && row.status === 'rascunho' && canValidate && <div className="card">
          <p>Confirme o registro de execução da atividade. A validação encerra a edição, não comprova o resultado da meta e não credita horas complementares.</p>
          {!row.evidence_doc_id && <p>Sem evidência vinculada, esta atividade não poderá ser encaminhada para análise de horas complementares. Se precisar disso, cancele a validação e vincule o documento no rascunho.</p>}
          <div className="teaching-pdi-actions">
            <button type="button" className="planning-primary" disabled={busy} onClick={() => validateActivity(row)}>Confirmar validação</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmActivity(null)}>Cancelar validação</button>
          </div>
        </div>}
      </li>)}</ul> : <p>Nenhuma atividade registrada para este curso.</p>}
    </>}
  </section>;
}
