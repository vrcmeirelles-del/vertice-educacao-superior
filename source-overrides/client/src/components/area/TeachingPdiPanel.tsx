import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, CircleCheck, Clock3, Download, GraduationCap, Info, Link2, Paperclip, Save, Target, Upload, UsersRound } from 'lucide-react';
import PortalPageHeader from '../PortalPageHeader';
import { supabase } from '@/lib/supabase';
import { isFullAccess, visibleTabs, GOAL_STATUS, DIRECTION, type Role } from '@/lib/area';
import './planning/planning.css';
import './teaching-pdi.css';
import TeachingFatoOrdem from './TeachingFatoOrdem';
import TeachingAcHandoff from './TeachingAcHandoff';
import TeachingActivityRoster, { TeachingActivityRosterSummary, type RosterPayload } from './TeachingActivityRoster';

type Course = { id: string; name: string; degree?: string | null };
type Props = {
  institutionId: string;
  courses: Course[];
  role: string | null;
  mode: 'gestao' | 'academico';
  onNavigate?: (tab: string) => void;
  showHeader?: boolean;
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
  status: string; updated_at: string; exam_module: string | null; created_by: string | null; total_minutes: number | null;
  /* Projeto */
  unit_name: string | null; courses_involved: string | null; teachers_involved: string | null;
  technicians: string | null; activity_time: string | null; location: string | null;
  schedule_detail: string | null; qty_students: number | null; qty_technicians: number | null;
  qty_teachers: number | null; partnerships: string | null; attendance_method: string | null;
  proposed_budget: number | null; approved_budget: number | null;
  general_objective: string | null; specific_objectives: string | null;
  infrastructure: string | null; evaluation_methods: string | null;
  target_audience: string | null; marketing_scope: string | null; marketing_channels: string | null;
  students_involved_desc: string | null;
  /* Relatório */
  report_phase: 'projeto' | 'relatorio' | 'finalizado';
  report_presentation: string | null; report_results: string | null;
  report_engagement: string | null; report_budget_staff: number | null;
  report_budget_materials: number | null; report_materials_desc: string | null;
  report_dissemination: string | null; report_thanks: string | null;
  report_opened_at: string | null; report_submitted_at: string | null;
  /* Considerações finais e anexos */
  final_remarks: string | null;
  evidence_photos: { path: string; name: string; uploaded_at?: string }[];
  evidence_attendance: { path: string; name: string }[];
  evidence_clippings: { path: string; name: string }[];
  roster_spreadsheet_path: string | null; roster_spreadsheet_name: string | null;
};
type Evidence = { id: string; title: string };
const TABLE = { programs: 'vertice_pdi_programs', goals: 'vertice_goals', activities: 'vertice_teaching_activities' };
const emptyProgram = { id: '', title: '', description: '' };
const emptyGoal = { id: '', pdi_program_id: '', title: '', indicator: '', target: '', unit: '', owner_name: '', due_date: '', direction: 'aumentar', status: 'planejada', pdi_expected_result: '' };
const newActivity = () => ({
  id: '', updated_at: '', title: '', category: 'evento', description: '', activity_date: browserDate(), organizer_role: 'docente', exam_module: '',
  goal_id: '', evidence_doc_id: '', ods_goal: '', ods_rationale: '', total_minutes: '',
  /* Projeto */
  unit_name: '', courses_involved: '', teachers_involved: '', technicians: '', activity_time: '', location: '',
  schedule_detail: '', qty_students: '', qty_technicians: '', qty_teachers: '', partnerships: '',
  attendance_method: '', proposed_budget: '', approved_budget: '', general_objective: '', specific_objectives: '',
  infrastructure: '', evaluation_methods: '', target_audience: '', marketing_scope: '', marketing_channels: '',
  students_involved_desc: '',
  /* Relatório */
  report_phase: 'projeto' as Activity['report_phase'],
  report_presentation: '', report_results: '', report_engagement: '',
  report_budget_staff: '', report_budget_materials: '', report_materials_desc: '',
  report_dissemination: '', report_thanks: '',
  /* Considerações finais e anexos */
  final_remarks: '',
  evidence_photos: [] as { path: string; name: string; uploaded_at?: string }[],
  evidence_attendance: [] as { path: string; name: string }[],
  evidence_clippings: [] as { path: string; name: string }[],
  roster_spreadsheet_path: '', roster_spreadsheet_name: '',
});
const activityStatus = (status: string) => ({ rascunho: 'Rascunho', validada: 'Validada', cancelada: 'Cancelada' }[status] ?? status);
const GOAL_FIELDS = 'id,title,pdi_program_id,indicator,target,unit,owner_name,due_date,direction,status,pdi_expected_result';
const ACTIVITY_FIELDS = 'id,course_id,title,category,description,activity_date,organizer_role,goal_id,evidence_doc_id,ods_goal,ods_rationale,status,updated_at,exam_module,created_by,total_minutes,unit_name,courses_involved,teachers_involved,technicians,activity_time,location,schedule_detail,qty_students,qty_technicians,qty_teachers,partnerships,attendance_method,proposed_budget,approved_budget,general_objective,specific_objectives,infrastructure,evaluation_methods,target_audience,marketing_scope,marketing_channels,students_involved_desc,report_phase,report_presentation,report_results,report_engagement,report_budget_staff,report_budget_materials,report_materials_desc,report_dissemination,report_thanks,report_opened_at,report_submitted_at,final_remarks,evidence_photos,evidence_attendance,evidence_clippings,roster_spreadsheet_path,roster_spreadsheet_name';

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

const EVIDENCE_BUCKET = 'vertice-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv'];

async function uploadTeachingFile(institutionId: string, courseId: string, file: File, folder: string): Promise<{ path: string; name: string }> {
  if (file.size > MAX_FILE_SIZE) throw new Error(`Arquivo ${file.name} excede 10 MB.`);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Sessão expirada.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `teaching/${institutionId}/${courseId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name };
}

function ScopedPanel({ institutionId, courses, role, mode, onNavigate, showHeader = true }: Props) {
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
  const [draftRevision, setDraftRevision] = useState(0);
  const [studentsDraft, setStudentsDraft] = useState<{ rows: RosterPayload | null; error: string }>({ rows: null, error: '' });
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

  function resetActivityDraft() {
    setActivityDraft(newActivity());
    setDraftRevision(value => value + 1);
    setStudentsDraft({ rows: null, error: '' });
  }
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
    resetActivityDraft();
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
    const totalMinutes = draft.total_minutes.trim() === '' ? null : Number(draft.total_minutes);
    if (totalMinutes !== null && (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes > 60000)) {
      setActionError('Informe uma carga total inteira entre 0 e 60.000 minutos ou deixe o campo vazio.'); return;
    }
    if (studentsDraft.error) { setActionError(studentsDraft.error); return; }
    void run(
      async () => {
        const { data, error } = await supabase.rpc('vertice_teaching_save_activity', {
          p_institution: institutionId, p_course: courseId, p_activity: draft.id || null,
          p_fields: {
            title: draft.title.trim(), category: draft.category, description: draft.description.trim(),
            activity_date: draft.activity_date, organizer_role: draft.organizer_role, total_minutes: totalMinutes,
            exam_module: draft.category === 'avaliacao' ? draft.exam_module || null : null, goal_id: draft.goal_id || null,
            evidence_doc_id: draft.evidence_doc_id || null, ods_goal: draft.ods_goal ? Number(draft.ods_goal) : null,
            ods_rationale: draft.ods_goal ? draft.ods_rationale.trim() : null,
            /* Projeto */
            unit_name: draft.unit_name.trim() || null, courses_involved: draft.courses_involved.trim() || null,
            teachers_involved: draft.teachers_involved.trim() || null, technicians: draft.technicians.trim() || null,
            activity_time: draft.activity_time.trim() || null, location: draft.location.trim() || null,
            schedule_detail: draft.schedule_detail.trim() || null,
            qty_students: draft.qty_students ? Number(draft.qty_students) : null,
            qty_technicians: draft.qty_technicians ? Number(draft.qty_technicians) : null,
            qty_teachers: draft.qty_teachers ? Number(draft.qty_teachers) : null,
            partnerships: draft.partnerships.trim() || null, attendance_method: draft.attendance_method.trim() || null,
            proposed_budget: draft.proposed_budget ? Number(draft.proposed_budget) : null,
            approved_budget: draft.approved_budget ? Number(draft.approved_budget) : null,
            general_objective: draft.general_objective.trim() || null, specific_objectives: draft.specific_objectives.trim() || null,
            infrastructure: draft.infrastructure.trim() || null, evaluation_methods: draft.evaluation_methods.trim() || null,
            target_audience: draft.target_audience.trim() || null, marketing_scope: draft.marketing_scope.trim() || null,
            marketing_channels: draft.marketing_channels.trim() || null, students_involved_desc: draft.students_involved_desc.trim() || null,
            /* Relatório */
            report_phase: draft.report_phase,
            report_presentation: draft.report_presentation.trim() || null, report_results: draft.report_results.trim() || null,
            report_engagement: draft.report_engagement.trim() || null,
            report_budget_staff: draft.report_budget_staff ? Number(draft.report_budget_staff) : null,
            report_budget_materials: draft.report_budget_materials ? Number(draft.report_budget_materials) : null,
            report_materials_desc: draft.report_materials_desc.trim() || null,
            report_dissemination: draft.report_dissemination.trim() || null, report_thanks: draft.report_thanks.trim() || null,
            final_remarks: draft.final_remarks.trim() || null,
            evidence_photos: draft.evidence_photos.length ? draft.evidence_photos : [],
            evidence_attendance: draft.evidence_attendance.length ? draft.evidence_attendance : [],
            evidence_clippings: draft.evidence_clippings.length ? draft.evidence_clippings : [],
            roster_spreadsheet_path: draft.roster_spreadsheet_path || null,
            roster_spreadsheet_name: draft.roster_spreadsheet_name || null,
            ...(draft.id ? { updated_at: draft.updated_at } : {}),
          },
          p_students: studentsDraft.rows,
        });
        const record = Array.isArray(data) ? data[0] : data;
        if (error) throw error;
        if (!record?.id) throw new Error('Não foi possível confirmar o rascunho salvo.');
      },
      'Atividade salva como rascunho. Nenhuma hora foi creditada.',
      resetActivityDraft,
    );
  }

  function editActivity(row: Activity) {
    setDraftRevision(value => value + 1);
    setStudentsDraft({ rows: null, error: '' });
    activityForm.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    setActivityDraft({
      ...row, exam_module: row.exam_module ?? '', goal_id: row.goal_id ?? '', evidence_doc_id: row.evidence_doc_id ?? '',
      ods_goal: row.ods_goal ? String(row.ods_goal) : '', ods_rationale: row.ods_rationale ?? '',
      total_minutes: row.total_minutes == null ? '' : String(row.total_minutes),
      /* Campos do projeto */
      unit_name: row.unit_name ?? '', courses_involved: row.courses_involved ?? '',
      teachers_involved: row.teachers_involved ?? '', technicians: row.technicians ?? '',
      activity_time: row.activity_time ?? '', location: row.location ?? '',
      schedule_detail: row.schedule_detail ?? '', qty_students: row.qty_students == null ? '' : String(row.qty_students),
      qty_technicians: row.qty_technicians == null ? '' : String(row.qty_technicians),
      qty_teachers: row.qty_teachers == null ? '' : String(row.qty_teachers),
      partnerships: row.partnerships ?? '', attendance_method: row.attendance_method ?? '',
      proposed_budget: row.proposed_budget == null ? '' : String(row.proposed_budget),
      approved_budget: row.approved_budget == null ? '' : String(row.approved_budget),
      general_objective: row.general_objective ?? '', specific_objectives: row.specific_objectives ?? '',
      infrastructure: row.infrastructure ?? '', evaluation_methods: row.evaluation_methods ?? '',
      target_audience: row.target_audience ?? '', marketing_scope: row.marketing_scope ?? '',
      marketing_channels: row.marketing_channels ?? '', students_involved_desc: row.students_involved_desc ?? '',
      report_phase: row.report_phase ?? 'projeto',
      report_presentation: row.report_presentation ?? '', report_results: row.report_results ?? '',
      report_engagement: row.report_engagement ?? '', report_budget_staff: row.report_budget_staff == null ? '' : String(row.report_budget_staff),
      report_budget_materials: row.report_budget_materials == null ? '' : String(row.report_budget_materials),
      report_materials_desc: row.report_materials_desc ?? '', report_dissemination: row.report_dissemination ?? '',
      report_thanks: row.report_thanks ?? '',
      final_remarks: row.final_remarks ?? '',
      evidence_photos: Array.isArray(row.evidence_photos) ? row.evidence_photos : [],
      evidence_attendance: Array.isArray(row.evidence_attendance) ? row.evidence_attendance : [],
      evidence_clippings: Array.isArray(row.evidence_clippings) ? row.evidence_clippings : [],
      roster_spreadsheet_path: row.roster_spreadsheet_path ?? '', roster_spreadsheet_name: row.roster_spreadsheet_name ?? '',
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
      () => { setConfirmActivity(null); if (activityDraft.id === row.id) resetActivityDraft(); },
    );
  }

  async function exportPdf(row: Activity) {
    if (busyGuard.current) return;
    busyGuard.current = true; setBusy(true); setActionError(''); setNotice('');
    try {
      const { buildTeachingPdf } = await import('@/lib/teaching-pdf');
      const rosterResult = await supabase.rpc('vertice_teaching_roster', {
        p_institution: institutionId, p_course: row.course_id, p_activity: row.id, p_query: '',
      });
      const students = ((rosterResult.data ?? []) as { student_name: string; enrollment_code: string | null; participant_role: string | null; minutes: number | null }[])
        .filter(s => s.participant_role);
      const goalName = row.goal_id ? goals.find(g => g.id === row.goal_id)?.title : undefined;
      const evidenceName = row.evidence_doc_id ? knownEvidence.find(d => d.id === row.evidence_doc_id)?.title : undefined;
      const crsName = courses.find(c => c.id === row.course_id)?.name ?? 'Curso';
      const { data: instRow } = await supabase.from('vertice_institutions').select('name').eq('id', institutionId).maybeSingle();
      const { data: userData } = await supabase.auth.getUser();
      // Busca logo da IES do Storage (convenção: {id}.png no bucket vertice-institution-logos)
      let logoBytes: Uint8Array | null = null;
      try {
        const { data: logoData } = await supabase.storage.from('vertice-institution-logos').download(`${institutionId}.png`);
        if (logoData) logoBytes = new Uint8Array(await logoData.arrayBuffer());
      } catch { /* sem logo, continua sem */ }
      const bytes = await buildTeachingPdf({
        activity: row, institutionName: instRow?.name ?? 'Instituição', courseName: crsName,
        students, goalTitle: goalName, evidenceTitle: evidenceName, author: userData.user?.email ?? 'Não identificado',
        logoBytes,
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `atividade-ensino-${row.title?.replace(/\s+/g, '-').slice(0, 40) || row.id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setNotice('PDF gerado e baixado.');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Erro ao gerar PDF.'); }
    finally { busyGuard.current = false; setBusy(false); }
  }

  const availableGoals = goals.filter(goal => goal.status !== 'cancelada' || goal.id === activityDraft.goal_id);
  const displayedActivities = activities.filter(row => mode === 'gestao' || row.course_id === courseId);
  const nameOfCourse = (courseId: string) => courses.find(c => c.id === courseId)?.name ?? 'Curso vinculado';
  const nameOfProgram = (programId: string | null) => programs.find(p => p.id === programId)?.title ?? 'Programa do PDI';
  const labelOfEvidence = (id: string) => knownEvidence.find(d => d.id === id)?.title ?? 'Documento vinculado';
  const busyLoading = busy || loading || courseLoading;

  return <section className={`course-planning teaching-pdi${mode === 'academico' ? ' teaching-pdi--academic' : ' teaching-pdi--management'}`} aria-label={title} aria-busy={busyLoading}>
    {showHeader && <PortalPageHeader title={title} eyebrow={mode === 'academico' ? 'Gestão acadêmica' : 'Gestão institucional'}
      icon={mode === 'academico' ? GraduationCap : Target}
      description={mode === 'academico' ? 'Registre atividades da graduação e da pós-graduação, com participantes, carga horária e evidências.' : 'Organize os programas institucionais e acompanhe quais atividades contribuem para cada meta. Contribuição e evidência de execução não substituem medição de resultado.'} />}
    {!showHeader && mode === 'gestao' && <p className="teaching-pdi-intro">Contribuição e evidência de execução não substituem medição de resultado.</p>}
    <ScopeNavigation mode={mode} role={role} onNavigate={onNavigate} />
    {mode === 'academico' && <div className="teaching-course-bar"><Field label="Curso">
      <select value={courseId} disabled={busy || courseLoading || !!courseError} onChange={e => chooseCourse(e.target.value)}>
        <option value="">Selecione um curso</option>
        {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}{c.degree ? ` · ${c.degree}` : ''}</option>)}
      </select>
    </Field>
      {!!courseId && !loading && !courseLoading && !loadError && <div className="teaching-course-stats" aria-label="Resumo das atividades">
        <span><Clock3 size={16} aria-hidden="true" /> <strong>{displayedActivities.filter(row => row.status === 'rascunho').length}</strong> rascunhos</span>
        <span><CircleCheck size={16} aria-hidden="true" /> <strong>{displayedActivities.filter(row => row.status === 'validada').length}</strong> validadas</span>
      </div>}
    </div>}
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
      <dl className="pdi-overview" aria-label="Resumo do PDI">
        <div><dt>Programas institucionais</dt><dd>{programs.length.toLocaleString('pt-BR')}</dd></div>
        <div><dt>Metas do PDI</dt><dd>{goals.length.toLocaleString('pt-BR')}</dd></div>
        <div><dt>Atividades vinculadas</dt><dd>{activities.length.toLocaleString('pt-BR')}</dd></div>
      </dl>
      {management && <div className="teaching-pdi-grid pdi-editor-layout">
        <form ref={programForm} className="card pdi-program-editor" onSubmit={e => { e.preventDefault(); saveProgram(); }}>
          <fieldset disabled={busy}><legend>{programDraft.id ? 'Editar programa institucional' : 'Novo programa institucional'}</legend>
            <div className="pdi-program-fields">
            <Field label="Nome do programa"><input required maxLength={250} value={programDraft.title} onChange={e => setProgramDraft({ ...programDraft, title: e.target.value })} /></Field>
            <Field label="Descrição do programa" help="Por exemplo: sustentabilidade, acessibilidade ou responsabilidade social."><textarea maxLength={4000} value={programDraft.description} onChange={e => setProgramDraft({ ...programDraft, description: e.target.value })} /></Field>
            </div>
            <div className="teaching-pdi-actions">
              <button type="submit" className="planning-primary">Salvar programa</button>
              {programDraft.id && <button type="button" className="btn-secondary" onClick={() => setProgramDraft(emptyProgram)}>Cancelar edição do programa</button>}
            </div>
          </fieldset>
        </form>
        <form ref={goalForm} className="card pdi-goal-editor" onSubmit={e => { e.preventDefault(); saveGoal(); }}>
          <fieldset disabled={busy || !programs.length}><legend>{goalDraft.id ? 'Editar meta do PDI' : 'Nova meta do PDI'}</legend>
            {!programs.length && <p className="pdi-form-note"><Info size={17} aria-hidden="true" />Cadastre primeiro um programa institucional.</p>}
            <div className="pdi-field-pair">
            <Field label="Programa da meta"><select required value={goalDraft.pdi_program_id} onChange={e => setGoalDraft({ ...goalDraft, pdi_program_id: e.target.value })}>
              <option value="">Selecione um programa</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select></Field>
            <Field label="Título da meta"><input required maxLength={250} value={goalDraft.title} onChange={e => setGoalDraft({ ...goalDraft, title: e.target.value })} /></Field>
            <Field label="Indicador"><input required maxLength={250} value={goalDraft.indicator} onChange={e => setGoalDraft({ ...goalDraft, indicator: e.target.value })} /></Field>
            <Field label="Responsável"><input required maxLength={250} value={goalDraft.owner_name} onChange={e => setGoalDraft({ ...goalDraft, owner_name: e.target.value })} /></Field>
            </div>
            <div className="teaching-pdi-grid pdi-target-fields">
              <Field label="Direção desejada"><select value={goalDraft.direction} onChange={e => setGoalDraft({ ...goalDraft, direction: e.target.value })}>
                {DIRECTION.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></Field>
              <Field label="Valor-alvo"><input required type="number" step="any" value={goalDraft.target} onChange={e => setGoalDraft({ ...goalDraft, target: e.target.value })} /></Field>
              <Field label="Unidade"><input maxLength={30} placeholder="%, kg, participantes…" value={goalDraft.unit} onChange={e => setGoalDraft({ ...goalDraft, unit: e.target.value })} /></Field>
              <Field label="Prazo"><input required type="date" value={goalDraft.due_date} onChange={e => setGoalDraft({ ...goalDraft, due_date: e.target.value })} /></Field>
            </div>
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
      </li>)}</ul> : <p className="pdi-empty">Nenhum programa cadastrado.</p>}
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
      </ul> : <p className="pdi-empty">Nenhuma meta do PDI neste filtro.</p>}
    </>}
    {!loading && !courseLoading && !loadError && !courseError && mode === 'academico' && !courseId && <p>{courseOptions.length ? 'Selecione um curso para consultar as atividades.' : 'Nenhum curso disponível para o seu perfil.'}</p>}
    {!loading && !courseLoading && !loadError && !courseError && mode === 'academico' && courseId && <>
      <p className="teaching-scope-note"><Info size={17} aria-hidden="true" /><span>Este registro não é Extensão. Horas complementares, quando elegíveis, passam por análise conforme as regras do curso.</span></p>
      {canEditActivity && <form ref={activityForm} className="card teaching-editor" onSubmit={e => { e.preventDefault(); saveActivity(); }}>
        <fieldset disabled={busy}>
          <legend className="teaching-editor-title">{activityDraft.id ? 'Editar rascunho' : 'Nova atividade de ensino'}</legend>
          <div className="teaching-editor-guide">
            <span><BookOpen size={15} aria-hidden="true" /> Dados da atividade</span>
            <span><UsersRound size={15} aria-hidden="true" /> Participantes</span>
            <span><Link2 size={15} aria-hidden="true" /> Vínculos</span>
          </div>
          <section className="teaching-form-step" aria-label="Identificação e planejamento">
            <h4><span aria-hidden="true">1</span> Identificação e planejamento</h4>
            <p>Defina o tipo, quem organiza e a data. Use a descrição para registrar propósito, metodologia e entregas, sem dados pessoais.</p>
          <Field label="Título da atividade"><input required maxLength={250} value={activityDraft.title} onChange={e => setActivityDraft({ ...activityDraft, title: e.target.value })} /></Field>
          <div className="teaching-pdi-grid">
            <Field label="Tipo de atividade"><select value={activityDraft.category} onChange={e => setActivityDraft({ ...activityDraft, category: e.target.value, exam_module: e.target.value === 'avaliacao' ? activityDraft.exam_module : '' })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Quem organizou"><select value={activityDraft.organizer_role} onChange={e => setActivityDraft({ ...activityDraft, organizer_role: e.target.value })}>{ORGANIZERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Data da atividade"><input required type="date" value={activityDraft.activity_date} onChange={e => setActivityDraft({ ...activityDraft, activity_date: e.target.value })} /></Field>
            <Field label="Carga total da atividade (minutos)" help="Opcional. Duração da atividade, independente dos minutos registrados por estudante.">
              <input type="number" min="0" max="60000" step="1" value={activityDraft.total_minutes} onChange={e => setActivityDraft({ ...activityDraft, total_minutes: e.target.value })} />
            </Field>
          </div>
          {activityDraft.category === 'avaliacao' && <Field label="Exame ou carreira (opcional)" help="É uma referência informada no cadastro, não uma sincronização de resultados com o Fato & Ordem.">
            <select value={activityDraft.exam_module} onChange={e => setActivityDraft({ ...activityDraft, exam_module: e.target.value })}>
              <option value="">Sem exame identificado</option>{EXAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>}
          <Field label="Descrição do que foi feito" help={activityDraft.category === 'avaliacao' ? 'Para simulados ou questões do Fato & Ordem, identifique o exame ou carreira e descreva a atividade. Não inclua dados pessoais de estudantes.' : 'Descreva objetivos, formato e entregas. Não inclua dados pessoais de estudantes.'}>
            <textarea required maxLength={4000} value={activityDraft.description} onChange={e => setActivityDraft({ ...activityDraft, description: e.target.value })} />
          </Field>
          </section>
          <section className="teaching-form-step" aria-label="Dados do projeto">
            <h4><span aria-hidden="true">1b</span> Dados do projeto</h4>
            <p>Preencha os dados de planejamento da atividade.</p>
            <div className="teaching-pdi-grid">
              <Field label="Unidade"><input maxLength={120} value={activityDraft.unit_name} onChange={e => setActivityDraft({ ...activityDraft, unit_name: e.target.value })} placeholder="Ex: Palmas" /></Field>
              <Field label="Curso(s) proponente(s)"><input maxLength={500} value={activityDraft.courses_involved} onChange={e => setActivityDraft({ ...activityDraft, courses_involved: e.target.value })} placeholder="Ex: Direito" /></Field>
              <Field label="Horário da atividade"><input maxLength={120} value={activityDraft.activity_time} onChange={e => setActivityDraft({ ...activityDraft, activity_time: e.target.value })} placeholder="Ex: 9h (mat) e 19h (not)" /></Field>
              <Field label="Local"><input maxLength={250} value={activityDraft.location} onChange={e => setActivityDraft({ ...activityDraft, location: e.target.value })} placeholder="Ex: Auditório, Teams" /></Field>
            </div>
            <Field label="Docente(s) participante(s)" help="Nome, telefone e e-mail de cada docente.">
              <textarea maxLength={4000} value={activityDraft.teachers_involved} onChange={e => setActivityDraft({ ...activityDraft, teachers_involved: e.target.value })} />
            </Field>
            <Field label="Técnico(s) envolvido(s)">
              <input maxLength={500} value={activityDraft.technicians} onChange={e => setActivityDraft({ ...activityDraft, technicians: e.target.value })} placeholder="Pessoal de apoio" />
            </Field>
            <Field label="Alunos envolvidos (períodos)" help="Ex: Alunos matriculados nos 5º e 6º períodos">
              <input maxLength={500} value={activityDraft.students_involved_desc} onChange={e => setActivityDraft({ ...activityDraft, students_involved_desc: e.target.value })} />
            </Field>
            <Field label="Programação detalhada">
              <textarea maxLength={8000} rows={4} value={activityDraft.schedule_detail} onChange={e => setActivityDraft({ ...activityDraft, schedule_detail: e.target.value })} />
            </Field>
            <div className="teaching-pdi-grid">
              <Field label="Qtd. alunos"><input type="number" min="0" value={activityDraft.qty_students} onChange={e => setActivityDraft({ ...activityDraft, qty_students: e.target.value })} /></Field>
              <Field label="Qtd. técnicos"><input type="number" min="0" value={activityDraft.qty_technicians} onChange={e => setActivityDraft({ ...activityDraft, qty_technicians: e.target.value })} /></Field>
              <Field label="Qtd. professores"><input type="number" min="0" value={activityDraft.qty_teachers} onChange={e => setActivityDraft({ ...activityDraft, qty_teachers: e.target.value })} /></Field>
            </div>
            <Field label="Parcerias e forma de apoio"><textarea maxLength={2000} value={activityDraft.partnerships} onChange={e => setActivityDraft({ ...activityDraft, partnerships: e.target.value })} /></Field>
            <Field label="Modo de confirmação de presença"><input maxLength={250} value={activityDraft.attendance_method} onChange={e => setActivityDraft({ ...activityDraft, attendance_method: e.target.value })} placeholder="Ex: Lista de presença, chamada" /></Field>
            <div className="teaching-pdi-grid">
              <Field label="Valor proposto (R$)"><input type="number" min="0" step="0.01" value={activityDraft.proposed_budget} onChange={e => setActivityDraft({ ...activityDraft, proposed_budget: e.target.value })} /></Field>
              <Field label="Valor aprovado (R$)"><input type="number" min="0" step="0.01" value={activityDraft.approved_budget} onChange={e => setActivityDraft({ ...activityDraft, approved_budget: e.target.value })} /></Field>
            </div>
            <Field label="Objetivo geral"><textarea required maxLength={4000} value={activityDraft.general_objective} onChange={e => setActivityDraft({ ...activityDraft, general_objective: e.target.value })} /></Field>
            <Field label="Objetivos específicos"><textarea maxLength={8000} rows={4} value={activityDraft.specific_objectives} onChange={e => setActivityDraft({ ...activityDraft, specific_objectives: e.target.value })} /></Field>
            <Field label="Infraestrutura" help="Auditório, sala/bloco, pátio e necessidades."><textarea maxLength={2000} value={activityDraft.infrastructure} onChange={e => setActivityDraft({ ...activityDraft, infrastructure: e.target.value })} placeholder="Ex: (X) Auditório · Necessidades: projetor, som" /></Field>
            <Field label="Formas de avaliação"><textarea maxLength={4000} value={activityDraft.evaluation_methods} onChange={e => setActivityDraft({ ...activityDraft, evaluation_methods: e.target.value })} /></Field>
            <Field label="Público-alvo (área de conhecimento)"><input maxLength={500} value={activityDraft.target_audience} onChange={e => setActivityDraft({ ...activityDraft, target_audience: e.target.value })} placeholder="Ex: Ciências Humanas" /></Field>
            <div className="teaching-pdi-grid">
              <Field label="Divulgação: alcance"><input maxLength={250} value={activityDraft.marketing_scope} onChange={e => setActivityDraft({ ...activityDraft, marketing_scope: e.target.value })} placeholder="Ex: Interno, Mídias Sociais" /></Field>
              <Field label="Divulgação: canais"><input maxLength={250} value={activityDraft.marketing_channels} onChange={e => setActivityDraft({ ...activityDraft, marketing_channels: e.target.value })} placeholder="Ex: Mídias Sociais, E-mail" /></Field>
            </div>
          </section>
          {(activityDraft.report_phase === 'relatorio' || activityDraft.report_phase === 'finalizado') && <section className="teaching-form-step" aria-label="Relatório final">
            <h4><span aria-hidden="true">1c</span> Relatório final</h4>
            <p>Campos exclusivos do relatório pós-evento. Os dados do projeto acima podem ser corrigidos se necessário.</p>
            <Field label="Apresentação do projeto executado" help="Mínimo 500 caracteres. Descreva justificativa e objetivos alcançados.">
              <textarea required minLength={500} maxLength={16000} rows={6} value={activityDraft.report_presentation} onChange={e => setActivityDraft({ ...activityDraft, report_presentation: e.target.value })} />
            </Field>
            <Field label="Resultados alcançados"><textarea maxLength={8000} rows={4} value={activityDraft.report_results} onChange={e => setActivityDraft({ ...activityDraft, report_results: e.target.value })} /></Field>
            <Field label="Envolvimento dos participantes" help="Descreva o envolvimento sócio-cidadão."><textarea maxLength={8000} rows={4} value={activityDraft.report_engagement} onChange={e => setActivityDraft({ ...activityDraft, report_engagement: e.target.value })} /></Field>
            <div className="teaching-pdi-grid">
              <Field label="Valor investido: pessoal (R$)"><input type="number" min="0" step="0.01" value={activityDraft.report_budget_staff} onChange={e => setActivityDraft({ ...activityDraft, report_budget_staff: e.target.value })} /></Field>
              <Field label="Valor investido: materiais (R$)"><input type="number" min="0" step="0.01" value={activityDraft.report_budget_materials} onChange={e => setActivityDraft({ ...activityDraft, report_budget_materials: e.target.value })} /></Field>
            </div>
            <Field label="Descrição dos materiais"><input maxLength={1000} value={activityDraft.report_materials_desc} onChange={e => setActivityDraft({ ...activityDraft, report_materials_desc: e.target.value })} placeholder="Ex: Material impresso e recursos multimídia" /></Field>
            <Field label="Divulgação efetiva"><input maxLength={1000} value={activityDraft.report_dissemination} onChange={e => setActivityDraft({ ...activityDraft, report_dissemination: e.target.value })} placeholder="Ex: Grupos de WhatsApp e redes sociais" /></Field>
            <Field label="Agradecimentos"><textarea maxLength={4000} rows={3} value={activityDraft.report_thanks} onChange={e => setActivityDraft({ ...activityDraft, report_thanks: e.target.value })} /></Field>
            <Field label="Considerações finais"><textarea maxLength={8000} rows={4} value={activityDraft.final_remarks} onChange={e => setActivityDraft({ ...activityDraft, final_remarks: e.target.value })} /></Field>

            <h4 style={{marginTop: 24}}><Paperclip size={17} aria-hidden="true" /> Anexos e evidências</h4>
            {activityDraft.evidence_doc_id && <p className="teaching-pdi-meta">✓ Evidência da Mesa Digital já vinculada na seção de vínculos — será incluída no relatório.</p>}

            <Field label="Registro fotográfico (até 3 fotos)" help="JPEG, PNG ou WebP. Máximo 10 MB cada.">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || activityDraft.evidence_photos.length >= 3}
                onChange={async e => {
                  const files = e.target.files; if (!files?.length) return;
                  setBusy(true); setActionError('');
                  try {
                    const uploads = [...activityDraft.evidence_photos];
                    for (const file of Array.from(files).slice(0, 3 - uploads.length)) {
                      const result = await uploadTeachingFile(institutionId, courseId, file, 'fotos');
                      uploads.push({ ...result, uploaded_at: new Date().toISOString() });
                    }
                    setActivityDraft({ ...activityDraft, evidence_photos: uploads });
                  } catch (err) { setActionError(err instanceof Error ? err.message : 'Erro no upload.'); }
                  finally { setBusy(false); e.target.value = ''; }
                }} />
              {activityDraft.evidence_photos.length > 0 && <ul>{activityDraft.evidence_photos.map((f, i) =>
                <li key={f.path}>{f.name} <button type="button" className="teaching-roster-remove" onClick={() => setActivityDraft({ ...activityDraft, evidence_photos: activityDraft.evidence_photos.filter((_, j) => j !== i) })}>Remover</button></li>
              )}</ul>}
            </Field>

            <Field label="Listas de frequência (PDF)" help="Listas de participação assinadas.">
              <input type="file" accept="application/pdf" multiple disabled={busy}
                onChange={async e => {
                  const files = e.target.files; if (!files?.length) return;
                  setBusy(true); setActionError('');
                  try {
                    const uploads = [...activityDraft.evidence_attendance];
                    for (const file of Array.from(files)) {
                      uploads.push(await uploadTeachingFile(institutionId, courseId, file, 'frequencia'));
                    }
                    setActivityDraft({ ...activityDraft, evidence_attendance: uploads });
                  } catch (err) { setActionError(err instanceof Error ? err.message : 'Erro no upload.'); }
                  finally { setBusy(false); e.target.value = ''; }
                }} />
              {activityDraft.evidence_attendance.length > 0 && <ul>{activityDraft.evidence_attendance.map((f, i) =>
                <li key={f.path}>{f.name} <button type="button" className="teaching-roster-remove" onClick={() => setActivityDraft({ ...activityDraft, evidence_attendance: activityDraft.evidence_attendance.filter((_, j) => j !== i) })}>Remover</button></li>
              )}</ul>}
            </Field>

            <Field label="Clipagens e matérias (PDF ou imagem)">
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple disabled={busy}
                onChange={async e => {
                  const files = e.target.files; if (!files?.length) return;
                  setBusy(true); setActionError('');
                  try {
                    const uploads = [...activityDraft.evidence_clippings];
                    for (const file of Array.from(files)) {
                      uploads.push(await uploadTeachingFile(institutionId, courseId, file, 'clipagens'));
                    }
                    setActivityDraft({ ...activityDraft, evidence_clippings: uploads });
                  } catch (err) { setActionError(err instanceof Error ? err.message : 'Erro no upload.'); }
                  finally { setBusy(false); e.target.value = ''; }
                }} />
              {activityDraft.evidence_clippings.length > 0 && <ul>{activityDraft.evidence_clippings.map((f, i) =>
                <li key={f.path}>{f.name} <button type="button" className="teaching-roster-remove" onClick={() => setActivityDraft({ ...activityDraft, evidence_clippings: activityDraft.evidence_clippings.filter((_, j) => j !== i) })}>Remover</button></li>
              )}</ul>}
            </Field>

            <Field label="Planilha de conciliação (nome + matrícula)" help="Excel ou CSV com nome e matrícula dos alunos para conciliar com Atividades Complementares.">
              <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" disabled={busy}
                onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setBusy(true); setActionError('');
                  try {
                    const result = await uploadTeachingFile(institutionId, courseId, file, 'conciliacao');
                    setActivityDraft({ ...activityDraft, roster_spreadsheet_path: result.path, roster_spreadsheet_name: result.name });
                  } catch (err) { setActionError(err instanceof Error ? err.message : 'Erro no upload.'); }
                  finally { setBusy(false); e.target.value = ''; }
                }} />
              {activityDraft.roster_spreadsheet_name && <p>📎 {activityDraft.roster_spreadsheet_name} <button type="button" className="teaching-roster-remove" onClick={() => setActivityDraft({ ...activityDraft, roster_spreadsheet_path: '', roster_spreadsheet_name: '' })}>Remover</button></p>}
            </Field>
          </section>}
          {activityDraft.report_phase === 'projeto' && activityDraft.id && canValidate && <div className="card">
            <p>Quando a atividade for executada, abra a fase de relatório para registrar os resultados.</p>
            <button type="button" className="btn-secondary" onClick={() => setActivityDraft({ ...activityDraft, report_phase: 'relatorio' })}>Abrir relatório para edição</button>
          </div>}
          <section className="teaching-form-step" aria-label="Alunos, papéis e carga por pessoa">
            <h4><span aria-hidden="true">2</span> Alunos, papéis e carga por pessoa</h4>
            <TeachingActivityRoster key={`${courseId}:${activityDraft.id || 'novo'}:${draftRevision}`}
              institutionId={institutionId} courseId={courseId} activityId={activityDraft.id || null}
              onChange={(rows, error) => setStudentsDraft({ rows, error })} />
          </section>
          <section className="teaching-form-step" aria-label="Vínculos e comprovação">
            <h4><span aria-hidden="true">3</span> Vínculos e comprovação</h4>
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
          </section>
          <div className="teaching-pdi-actions teaching-save-bar">
            <span>Um rascunho pode ser revisado antes da validação.</span>
            <button type="submit" className="planning-primary"><Save size={17} aria-hidden="true" />Salvar rascunho</button>
            {activityDraft.id && <button type="button" className="btn-secondary" onClick={resetActivityDraft}>Cancelar edição da atividade</button>}
          </div>
        </fieldset>
      </form>}
      <FatoOrdemSection key={courseId} institutionId={institutionId} courseId={courseId} />
      <div className="teaching-register-heading"><h3>Atividades do curso</h3><span>{displayedActivities.length} {displayedActivities.length === 1 ? 'registro' : 'registros'}</span></div>
      {displayedActivities.length ? <ul className="teaching-pdi-list">{displayedActivities.map(row => <li className="teaching-pdi-record teaching-activity-card" key={row.id}>
        <div className="teaching-record-heading"><h4>{row.title}</h4><span className="teaching-activity-state" data-state={row.status}>{activityStatus(row.status)}</span></div>
        <p className="teaching-pdi-meta">{displayDate(row.activity_date)} · {TYPES.find(([value]) => value === row.category)?.[1] ?? row.category} · Organização: {ORGANIZERS.find(([value]) => value === row.organizer_role)?.[1] ?? row.organizer_role}</p>
        <p className="teaching-pdi-description">{row.description}</p>
        {row.total_minutes != null && <p><strong>Carga total da atividade:</strong> {row.total_minutes.toLocaleString('pt-BR')} min</p>}
        {row.exam_module && <p><strong>Exame ou carreira:</strong> {EXAMS.find(([value]) => value === row.exam_module)?.[1] ?? row.exam_module}</p>}
        {row.goal_id && <p><strong>Meta do PDI:</strong> {goals.find(g => g.id === row.goal_id)?.title ?? 'Meta vinculada'}</p>}
        {row.evidence_doc_id && <ContributionEvidence key={row.evidence_doc_id} institutionId={institutionId} row={row} />}
        {row.ods_goal && <p><strong>ODS {row.ods_goal}: {ODS[row.ods_goal - 1]}</strong> · {row.ods_rationale}</p>}
        {row.general_objective && <p><strong>Objetivo geral:</strong> {row.general_objective}</p>}
        {row.location && <p><strong>Local:</strong> {row.location}{row.activity_time ? ` · ${row.activity_time}` : ''}</p>}
        {row.teachers_involved && <details><summary>Docentes envolvidos</summary><p style={{whiteSpace:'pre-wrap'}}>{row.teachers_involved}</p></details>}
        {row.schedule_detail && <details><summary>Programação detalhada</summary><p style={{whiteSpace:'pre-wrap'}}>{row.schedule_detail}</p></details>}
        <p className="teaching-pdi-meta"><strong>Fase:</strong> {row.report_phase === 'projeto' ? '📋 Projeto' : row.report_phase === 'relatorio' ? '📝 Relatório em edição' : '✅ Finalizado'}</p>
        {row.report_phase !== 'projeto' && row.report_presentation && <details><summary>Relatório: apresentação</summary><p style={{whiteSpace:'pre-wrap'}}>{row.report_presentation}</p></details>}
        {row.report_phase !== 'projeto' && row.report_results && <details><summary>Relatório: resultados</summary><p style={{whiteSpace:'pre-wrap'}}>{row.report_results}</p></details>}
        {canEditActivity && <TeachingActivityRosterSummary key={`${row.id}:${row.updated_at}`} institutionId={institutionId} courseId={row.course_id} activityId={row.id} />}
        {row.status === 'validada' && canValidate && <TeachingAcHandoff
          institutionId={institutionId} courseId={row.course_id} activityId={row.id}
          enabled={!!row.evidence_doc_id}
          onOpenAc={canOpenAc ? () => onNavigate?.('atividades-complementares') : undefined}
        />}
        {canEditActivity && <div className="teaching-pdi-actions">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => exportPdf(row)}><Download size={15} aria-hidden="true" /> Exportar PDF</button>
          {row.status === 'rascunho' && (canValidate || (role === 'equipe' && !!staffId && row.created_by === staffId)) && <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => editActivity(row)}>Editar rascunho</button>
            {canValidate && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmActivity(row)}>Revisar validação</button>}
          </>}
        </div>}
        {confirmActivity?.id === row.id && row.status === 'rascunho' && canValidate && <div className="card">
          <p>Confirme o registro de execução da atividade. A validação encerra a edição, não comprova o resultado da meta e não credita horas complementares.</p>
          {!row.evidence_doc_id && <p>Sem evidência vinculada, esta atividade não poderá ser encaminhada para análise de horas complementares. Se precisar disso, cancele a validação e vincule o documento no rascunho.</p>}
          <div className="teaching-pdi-actions">
            <button type="button" className="planning-primary" disabled={busy} onClick={() => validateActivity(row)}>Confirmar validação</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmActivity(null)}>Cancelar validação</button>
          </div>
        </div>}
      </li>)}</ul> : <p className="teaching-empty">Nenhuma atividade registrada para este curso.</p>}
    </>}
  </section>;
}
