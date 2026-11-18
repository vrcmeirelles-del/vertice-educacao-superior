import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
// Extensao360.tsx — Repositório de Projetos de Extensão (v3 — Impacto integrado)
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import "./extensao360.css";
import type { ProjectSource } from '@/lib/extension-forms/project-data';
import ExtensaoFormularios from "./ExtensaoFormularios";
import ExtensaoHourLedger from "./ExtensaoHourLedger";
import ExtensaoODS from "./ExtensaoODS";
import ExtensaoGovernanca from "./ExtensaoGovernanca";
import ExtensaoAtividades from "./ExtensaoAtividades";
import ExtensaoEvidencias from "./ExtensaoEvidencias";
import ExtensaoParceiros from "./ExtensaoParceiros";
import ExtensaoCompetencias from "./ExtensaoCompetencias";
import ExtensaoAchados from "./ExtensaoAchados";
import ExtensaoIA from "./ExtensaoIA";
import ExtensaoPerfis from "./ExtensaoPerfis";
import ExtensaoImportacao from "./ExtensaoImportacao";
import ExtensaoRelatorios from "./ExtensaoRelatorios";
import ExtensaoProjectWorkflow from "./ExtensaoProjectWorkflow";
import ExtensaoConformidade from "./ExtensaoConformidade";
import ExtensaoNotificacoes from "./ExtensaoNotificacoes";

type View = 'formularios' | 'projetos' | 'equipe' | 'alunos' | 'entregas' | 'cobertura' | 'revisoes' | 'ods' | 'governanca' | 'atividades' | 'evidencias' | 'parceiros' | 'competencias' | 'achados' | 'ia' | 'perfis' | 'importacao' | 'relatorios' | 'conformidade';

const PRIMARY_VIEWS: View[] = ['projetos','formularios','equipe','alunos','entregas','atividades','evidencias','revisoes'];
const OTHER_VIEWS: View[] = ['competencias','parceiros','achados','conformidade','cobertura','ods','governanca','ia','perfis','importacao','relatorios'];

interface ExtProject extends ProjectSource {
  id: string; title: string; code: string; project_type: string; description: string;
  target_community: string; target_audience_count: number; coordinator_name: string; coordinator_email: string;
  status: string; review_status: string; start_date: string; end_date: string; total_hours: number;
  semester: string; course_ids: string[]; partner_institutions: string[];
  ods_goals: string[]; budget_estimated: number; budget_executed: number;
  axis_id: string; ai_suggested_axis_id: string; ai_axis_note: string; created_at: string;
}
interface TeamMember {
  id: string; project_id: string; role_type: string; full_name: string;
  email: string; cpf: string; lattes_url: string; hours_assigned: number; is_active: boolean;
}
interface Student {
  id: string; project_id: string; full_name: string; email: string; phone: string;
  registration_number: string; cpf: string; course_id: string;
  hours_assigned: number; hours_completed: number; is_scholarship: boolean; status: string;
}
interface Deliverable {
  id: string; project_id: string; title: string; deliverable_type: string;
  description: string; delivered_at: string; url: string;
}
interface Axis { id: string; name: string; description: string; ods_alignment: string[]; suggested_by_ai: boolean; }
interface Review {
  id: string; project_id: string; review_stage: string; reviewer_name: string;
  reviewer_email: string; reviewer_role: string; status: string;
  comment: string; adjustment_request: string; reviewed_at: string;
}
interface Coverage { course_id: string; semester: string; total_projects: number; total_students: number; total_student_hours: number; }

const STATUS_COLORS: Record<string, string> = {
  planejamento: '#6b7280', em_aprovacao: '#f59e0b', aprovado: '#3b82f6',
  em_execucao: '#8b5cf6', concluido: '#22c55e', cancelado: '#ef4444', suspenso: '#9ca3af',
  ativo: '#22c55e', desligado: '#ef4444', trancado: '#6b7280',
  pendente: '#f59e0b', em_analise: '#3b82f6', ajuste_solicitado: '#ef4444', rejeitado: '#991b1b',
};
const STATUS_LABELS: Record<string, string> = {
  planejamento: 'Planejamento', em_aprovacao: 'Em Aprovação', aprovado: 'Aprovado',
  em_execucao: 'Em Execução', concluido: 'Concluído', cancelado: 'Cancelado', suspenso: 'Suspenso',
  ativo: 'Ativo', desligado: 'Desligado', trancado: 'Trancado',
  rascunho: 'Rascunho', submetido: 'Submetido', pendente_ajustes: 'Pendente de ajustes',
  pendente: 'Pendente', em_analise: 'Em Análise', ajuste_solicitado: 'Ajuste Solicitado', rejeitado: 'Rejeitado',
};
const TYPE_LABELS: Record<string, string> = {
  projeto: 'Projeto', programa: 'Programa', curso_extensao: 'Curso de Extensão',
  evento: 'Evento', prestacao_servico: 'Prestação de Serviço',
};
const DELIV_LABELS: Record<string, string> = {
  relatorio_parcial: 'Relatório Parcial', relatorio_final: 'Relatório Final',
  artigo: 'Artigo', publicacao: 'Publicação', evento_realizado: 'Evento Realizado',
  produto: 'Produto', certificado: 'Certificado', outro: 'Outro',
};
const REVIEW_LABELS: Record<string, string> = { acompanhamento: 'Acompanhamento da Extensão', regulacao: 'Regulação' };

function Badge({ status }: { status: string }) {
  return <span className="ext-badge" style={{ background: (STATUS_COLORS[status] || '#888') + '18', color: STATUS_COLORS[status] || '#888' }}>
    {STATUS_LABELS[status] || status}
  </span>;
}
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—'; }

export default function Extensao360({ institutionId, role, courses = [], onBack }: {
  institutionId: string; role: string;
  courses?: { id: string; name: string }[];
  onBack?: () => void;
}) {
  const [view, setView] = useState<View>('projetos');
  const [showProjectInvites,setShowProjectInvites]=useState(false);
  const [targetForm,setTargetForm] = useState<string>();
  const [showDeleted,setShowDeleted] = useState(false);
  const [projectQuery,setProjectQuery] = useState('');
  const [projectError,setProjectError] = useState('');
  const [actor,setActor] = useState({id:'',email:''});
  const [archiving,setArchiving] = useState(false);
  const [deletedProjects,setDeletedProjects] = useState<ExtProject[]>([]);
  const [formsVisited, setFormsVisited] = useState(false);
  useEffect(() => { if (view === 'formularios') setFormsVisited(true); }, [view]);
  const [projects, setProjects] = useState<ExtProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourLedger, setHourLedger] = useState<{ participantId: string; participantName: string; projectId: string } | null>(null);
  const [odsPanel, setOdsPanel] = useState<{ projectId: string; projectTitle: string } | null>(null);
  const [activityPanel, setActivityPanel] = useState<{ projectId: string; projectTitle: string } | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [evidencePanel, setEvidencePanel] = useState<{ projectId: string; projectTitle: string } | null>(null);
  const [workflowPanel, setWorkflowPanel] = useState<{ projectId: string; projectTitle: string; reviewStatus: string } | null>(null);
  const [discardableIds, setDiscardableIds] = useState<string[]|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [studentError,setStudentError]=useState('');
  const [savingStudent,setSavingStudent]=useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formType, setFormType] = useState<'project' | 'team' | 'student' | 'deliverable' | 'axis' | 'review'>('project');
  const registrationHeading = useRef<HTMLHeadingElement>(null);
  const projectFormOpen = showForm && formType === 'project' && view === 'projetos';
  useEffect(() => {
    if(projectFormOpen) registrationHeading.current?.focus();
  },[projectFormOpen]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [staffList, setStaffList] = useState<{full_name:string;email:string|null;source:string}[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, t, s, del, ax, rev, cov, staff, discardable] = await Promise.all([
      supabase.from('vertice_extension_projects').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('vertice_extension_team').select('*').eq('institution_id', institutionId).order('full_name'),
      supabase.from('vertice_extension_students').select('*').eq('institution_id', institutionId).order('full_name'),
      supabase.from('vertice_extension_deliverables').select('*').eq('institution_id', institutionId).order('delivered_at', { ascending: false }),
      supabase.from('vertice_extension_axes').select('*').eq('institution_id', institutionId).order('name'),
      supabase.from('vertice_extension_reviews').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
      supabase.from('v_extension_coverage').select('*').eq('institution_id', institutionId),
      supabase.rpc('get_institution_staff', { p_institution_id: institutionId }),
      supabase.rpc('vertice_extension_discardable_projects', { p_institution: institutionId }),
    ]);
    const all=(p.data || []) as ExtProject[];
    setDiscardableIds(discardable.error?null:discardable.data||[]);
    setProjects(all.filter(row=>!row.deleted_at));
    setDeletedProjects(all.filter(row=>row.deleted_at));
    setProjectError(p.error?.message||'');
    setTeam((t.data || []) as TeamMember[]);
    setStudents((s.data || []) as Student[]);
    setDeliverables((del.data || []) as Deliverable[]);
    setAxes((ax.data || []) as Axis[]);
    setReviews((rev.data || []) as Review[]);
    setCoverage((cov.data || []) as Coverage[]);
    setStaffList((staff.data || []) as {full_name:string;email:string|null;source:string}[]);
    setLoading(false);
  }, [institutionId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    void supabase.auth.getUser().then(({data})=>setActor({id:data.user?.id||'',email:data.user?.email||''}));
  }, [institutionId]);

  const canEdit = role === 'master' || role === 'gestor';

  // KPIs
  const emExecucao = projects.filter(p => p.status === 'em_execucao').length;
  const concluidos = projects.filter(p => p.status === 'concluido').length;
  const totalStudents = students.filter(s => s.status === 'ativo').length;
  const totalDocentes = team.filter(t => t.role_type === 'professor' || t.role_type === 'coordenador').length;
  const totalComunidade = projects.reduce((s, p) => s + (p.target_audience_count || 0), 0);
  const horasDiscentes = students.reduce((s, st) => s + (st.hours_completed || 0), 0);
  const cursosComExtensao = new Set(projects.flatMap(p => p.course_ids || [])).size;
  const totalCursos = courses?.length || 0;
  const pctCobertura = totalCursos > 0 ? Math.round((cursosComExtensao / totalCursos) * 100) : 0;
  const pendentesRevisao = projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').length;

  const filteredProjects = (showDeleted ? deletedProjects : projects).filter(p =>
    (!showDeleted || canManage(p)) && (showDeleted || filterStatus === 'todos' || p.status === filterStatus) &&
    [p.title,p.code,p.coordinator_name,...(p.course_ids||[]).map(courseName)].some(v=>v?.toLocaleLowerCase('pt-BR').includes(projectQuery.trim().toLocaleLowerCase('pt-BR')))
  );
  function canManage(p:ProjectSource) { return canEdit || (!!actor.id && role==='equipe' && (p.owner_id===actor.id||(!p.owner_id&&!!actor.email&&p.coordinator_email?.toLowerCase()===actor.email.toLowerCase()))); }
  function openReport(id:string,invites=false) { setTargetForm(id);setShowProjectInvites(invites);setView('formularios'); }
  async function discardProject(p:ProjectSource,deleted:boolean) {
    if(deleted&&!confirm(`Excluir “${p.title}”? Você poderá recuperar o projeto na lista de projetos excluídos.`))return;
    setArchiving(true);setProjectError('');
    try {
      const {error}=await supabase.rpc('vertice_extension_draft_visibility',{p_project:p.id,p_deleted:deleted});
      if(error)throw error;
      setShowForm(false);setFormData({});
      await load();
    }catch(e){setProjectError((e as Error).message);}
    finally{setArchiving(false);}
  }

  function courseName(id: string) { return courses?.find(c => c.id === id)?.name || id.slice(0, 8); }

  async function generateCode() {
    const { data } = await supabase.rpc('generate_extension_code', { p_institution_id: institutionId });
    return data as string || '';
  }
  function axisName(id: string) { return axes.find(a => a.id === id)?.name || ''; }

  // === SAVES ===
  async function saveProject() {
    const payload: any = {
      ...formData, institution_id: institutionId,
      code: formData.code,
      course_ids: formData.course_ids || [],
      partner_institutions: formData.partner_institutions_text ? formData.partner_institutions_text.split(',').map((s: string) => s.trim()) : (formData.partner_institutions || []),
      ods_goals: formData.ods_goals_text ? formData.ods_goals_text.split(',').map((s: string) => s.trim()) : (formData.ods_goals || []),
    };
    delete payload.partner_institutions_text; delete payload.ods_goals_text; delete payload.evidence_files; delete payload.coordinator_name_manual;
    if (!payload.axis_ids) payload.axis_ids = payload.axis_id ? [payload.axis_id] : [];
    // Se está concluindo, marcar como pendente para revisão do Acompanhamento
    if (payload.status === 'concluido' && (!formData.id || projects.find(p => p.id === formData.id)?.status !== 'concluido')) {
      payload.review_status = 'pendente';
    }
    delete payload.owner_id;delete payload.first_submitted_at;delete payload.deleted_at;
    if(!payload.title?.trim()){setProjectError('Informe o título do projeto.');return;}
    let result;
    if (payload.id) {
      if(payload.status!=='concluido'||projects.find(p=>p.id===payload.id)?.status==='concluido')delete payload.review_status;
      payload.updated_at = new Date().toISOString();
      result=await supabase.from('vertice_extension_projects').update(payload).eq('id', payload.id);
    } else {
      delete payload.id;
      result=await supabase.from('vertice_extension_projects').insert(payload);
    }
    if(result.error){setProjectError(result.error.message);return;}
    setShowForm(false); setFormData({}); load();
  }

  async function saveTeamMember() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_team').update(payload).eq('id', payload.id);
    } else { delete payload.id; await supabase.from('vertice_extension_team').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function saveStudent() {
    const projectId=projects.find(project=>project.id===formData.project_id)?.id;
    if(!projectId||!formData.full_name?.trim()){
      setStudentError('Selecione o projeto e informe o nome completo do aluno.');
      return;
    }
    const email=formData.email?.trim().toLowerCase()||null;
    const registration=formData.registration_number?.trim()||null;
    const duplicate=students.some(student=>student.project_id===projectId&&student.id!==formData.id&&(
      (registration&&student.registration_number?.trim().toUpperCase()===registration.toUpperCase())||
      (email&&student.email?.trim().toLowerCase()===email)
    ));
    if(duplicate){setStudentError('Este aluno já está vinculado ao projeto selecionado.');return;}
    const payload={
      institution_id:institutionId,project_id:projectId,full_name:formData.full_name.trim(),
      email,registration_number:registration,phone:formData.phone?.trim()||null,
      cpf:formData.cpf?.trim()||null,course_id:formData.course_id||null,
      hours_assigned:formData.hours_assigned??0,hours_completed:formData.hours_completed??0,
      is_scholarship:formData.is_scholarship??false,status:formData.status||'ativo',
    };
    setSavingStudent(true);setStudentError('');
    try{
      const result=formData.id
        ? await supabase.from('vertice_extension_students').update(payload)
            .eq('id',formData.id).eq('institution_id',institutionId).eq('project_id',projectId).select('id').single()
        : await supabase.from('vertice_extension_students').insert(payload).select('id').single();
      if(result.error)throw result.error;
      setSelectedProject(projectId);setShowForm(false);setFormData({});
      await load();
    }catch(e){setStudentError((e as Error).message);}
    finally{setSavingStudent(false);}
  }

  async function saveDeliverable() {
    const payload = { ...formData, institution_id: institutionId, project_id: selectedProject };
    if (payload.id) {
      await supabase.from('vertice_extension_deliverables').update(payload).eq('id', payload.id);
    } else { delete payload.id; await supabase.from('vertice_extension_deliverables').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function saveAxis() {
    const payload = { ...formData, institution_id: institutionId,
      ods_alignment: formData.ods_text ? formData.ods_text.split(',').map((s: string) => s.trim()) : (formData.ods_alignment || []),
    };
    delete payload.ods_text;
    if (payload.id) { await supabase.from('vertice_extension_axes').update(payload).eq('id', payload.id); }
    else { delete payload.id; await supabase.from('vertice_extension_axes').insert(payload); }
    setShowForm(false); setFormData({}); load();
  }

  async function submitReview(projectId: string, stage: string, status: string, comment: string, adjustment?: string) {
    await supabase.from('vertice_extension_reviews').insert({
      institution_id: institutionId, project_id: projectId, review_stage: stage,
      reviewer_name: '', reviewer_role: stage, status, comment,
      adjustment_request: adjustment || null, reviewed_at: new Date().toISOString(),
    });
    // Atualizar review_status do projeto
    const newStatus = status === 'aprovado' && stage === 'acompanhamento' ? 'pendente' // vai pra Regulação
      : status === 'aprovado' && stage === 'regulacao' ? 'aprovado'
      : status;
    await supabase.from('vertice_extension_projects').update({ review_status: newStatus }).eq('id', projectId);
    load();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteBusy(true); setInviteMsg(''); setInviteLink('');
    try {
      const mail = inviteEmail.trim().toLowerCase();
      // 1. Criar conta + membership via edge function (admin API)
      await supabase.functions.invoke('vertice-convite-simples', {
        body: { email: mail, institution_id: institutionId, role: 'equipe', name: inviteName || undefined }
      }).catch(() => {});
      // 2. Registrar convite via RPC (para gerar o invite record)
      await Promise.resolve(supabase.rpc('vertice_add_member', { target: institutionId, member_email: mail, member_role: 'equipe' })).then(r => r).catch(() => {});
      // 3. Buscar o convite gerado para montar o link
      const { data: inv } = await supabase.from('vertice_invites').select('id').eq('institution_id', institutionId).eq('email', mail).is('accepted_at', null).order('created_at', { ascending: false }).limit(1);
      const invId = inv?.[0]?.id;
      const link = `${window.location.origin}/extensao-convite${invId ? '?convite=' + invId : ''}`;
      setInviteLink(link);
      setInviteMsg(`✅ Convite registrado para ${mail}. Copie o link e envie por WhatsApp.`);
      setInviteEmail(''); setInviteName('');
    } catch (err) {
      setInviteMsg(`Erro: ${(err as Error).message}`);
    } finally { setInviteBusy(false); }
  }

  function generateEvidencePDF(project: ExtProject) {
    const pTeam = team.filter(t => t.project_id === project.id);
    const pStudents = students.filter(s => s.project_id === project.id);
    const pDeliverables = deliverables.filter(d => d.project_id === project.id);
    const pAxis = axes.find(a => a.id === project.axis_id);
    const pCourses = courses.filter(c => (project.course_ids || []).includes(c.id));
    const p = project as any;

    const escape = (value: unknown) => {
      const node = document.createElement('span');
      node.textContent = String(value ?? '');
      return node.innerHTML;
    };
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para gerar o PDF'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Evidências — ${escape(project.title)}</title>
<style>
@media print{@page{margin:18mm;size:A4}body{-webkit-print-color-adjust:exact}}
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1e293b;margin:0;padding:30px}
h1{font-size:16pt;color:#0b4f6c;text-align:center;margin:0 0 4px}
h2{font-size:12pt;color:#0b4f6c;border-bottom:2px solid #0b9185;padding-bottom:3px;margin:18px 0 8px}
h3{font-size:11pt;color:#334155;margin:12px 0 4px}
.meta{text-align:center;font-size:9pt;color:#64748b;margin-bottom:18px}
table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:10pt}
th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left}
th{background:#f1f5f9;font-weight:600;color:#0f172a}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9pt;font-weight:600}
.footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px}
.section{margin-bottom:6px}
.label{font-weight:600;color:#475569;min-width:160px;display:inline-block}
</style></head><body>
<h1>📋 Relatório de Evidências — Projeto de Extensão</h1>
<p class="meta">Plataforma Vértice Educação Superior · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>

<h2>1. Dados do Projeto</h2>
<table>
<tr><th>Título</th><td>${escape(project.title)}</td></tr>
<tr><th>Código</th><td>${escape(project.code)}</td></tr>
<tr><th>Tipo</th><td>${escape(project.project_type)}</td></tr>
${p.category ? `<tr><th>Categoria</th><td>${escape(p.category)}${p.category_detail ? ' — ' + escape(p.category_detail) : ''}</td></tr>` : ''}
${p.thematic_area ? `<tr><th>Área temática</th><td>${escape(p.thematic_area)}</td></tr>` : ''}
${p.modality ? `<tr><th>Modalidade</th><td>${escape(p.modality)}</td></tr>` : ''}
<tr><th>Coordenador</th><td>${escape(project.coordinator_name)} (${escape(project.coordinator_email)})</td></tr>
${p.unit_name ? `<tr><th>Unidade</th><td>${escape(p.unit_name)}</td></tr>` : ''}
<tr><th>Cursos</th><td>${escape(pCourses.map(c => c.name).join(', ') || '—')}</td></tr>
<tr><th>Eixo temático</th><td>${escape(pAxis?.name || '—')}</td></tr>
<tr><th>Período</th><td>${escape(project.start_date || '—')} a ${escape(project.end_date || '—')}</td></tr>
<tr><th>Semestre</th><td>${escape(project.semester || '—')}</td></tr>
<tr><th>Carga horária</th><td>${escape(project.total_hours ?? '—')}h</td></tr>
<tr><th>Comunidade atendida</th><td>${escape(project.target_community || '—')}</td></tr>
<tr><th>Público estimado</th><td>${escape(project.target_audience_count ?? '—')}</td></tr>
${p.activity_location ? `<tr><th>Local</th><td>${escape(p.activity_location)}</td></tr>` : ''}
<tr><th>ODS</th><td>${escape((project.ods_goals || []).join(', ') || '—')}</td></tr>
<tr><th>Parceiros</th><td>${escape((project.partner_institutions || []).join(', ') || '—')}</td></tr>
<tr><th>Status</th><td>${escape(project.status)}</td></tr>
</table>

${p.general_objective ? `<h2>2. Objetivo Geral</h2><p>${escape(p.general_objective)}</p>` : ''}
${(p.specific_objectives || []).length > 0 ? `<h2>3. Objetivos Específicos</h2><ul>${p.specific_objectives.map((o: string) => `<li>${escape(o)}</li>`).join('')}</ul>` : ''}
${p.methodology ? `<h2>4. Metodologia</h2><p>${escape(p.methodology)}</p>` : ''}
${p.detailed_program ? `<h2>5. Programação Detalhada</h2><p>${escape(p.detailed_program).replace(/\n/g, '<br/>')}</p>` : ''}
${p.description ? `<h2>6. Descrição</h2><p>${escape(p.description)}</p>` : ''}

<h2>7. Equipe Docente</h2>
${pTeam.length > 0 ? `<table><tr><th>Nome</th><th>Função</th><th>E-mail</th><th>Horas</th></tr>
${pTeam.map(t => `<tr><td>${escape(t.full_name)}</td><td>${escape(t.role_type)}</td><td>${escape(t.email)}</td><td>${escape(t.hours_assigned)}h</td></tr>`).join('')}
</table>` : '<p>Nenhum docente vinculado.</p>'}

<h2>8. Alunos Participantes</h2>
${pStudents.length > 0 ? `<table><tr><th>Nome</th><th>Matrícula</th><th>Horas atribuídas</th><th>Horas cumpridas</th><th>Bolsista</th></tr>
${pStudents.map(s => `<tr><td>${escape(s.full_name)}</td><td>${escape(s.registration_number)}</td><td>${escape(s.hours_assigned)}h</td><td>${escape(s.hours_completed)}h</td><td>${s.is_scholarship ? 'Sim' : 'Não'}</td></tr>`).join('')}
</table>` : '<p>Nenhum aluno vinculado.</p>'}

<h2>9. Entregas e Evidências</h2>
${pDeliverables.length > 0 ? `<table><tr><th>Título</th><th>Tipo</th><th>Data</th><th>Descrição</th></tr>
${pDeliverables.map(d => `<tr><td>${escape(d.title)}</td><td>${escape(d.deliverable_type)}</td><td>${d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('pt-BR') : '—'}</td><td>${escape(d.description || '—')}</td></tr>`).join('')}
</table>` : '<p>Nenhuma entrega registrada.</p>'}

${p.evaluation_method ? `<h2>10. Formas de Avaliação</h2><p>${escape(p.evaluation_method)}</p>` : ''}
${(p.expected_results || []).length > 0 ? `<h2>11. Resultados Esperados</h2><ul>${p.expected_results.map((r: string) => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}
${p.infrastructure_needs ? `<h2>12. Infraestrutura Utilizada</h2><p>${escape(p.infrastructure_needs)}</p>` : ''}

<h2>13. Aprovação</h2>
<table>
<tr><td style="height:60px"><strong>Coordenador do Projeto:</strong><br/>${escape(project.coordinator_name)}</td><td style="height:60px"><strong>Data:</strong> ____/____/________</td></tr>
<tr><td style="height:60px"><strong>Pró-Reitor / Coordenador de Extensão:</strong></td><td style="height:60px"><strong>Data:</strong> ____/____/________</td></tr>
</table>

<p class="footer">Documento gerado automaticamente pela Plataforma Vértice Educação Superior © ${new Date().getFullYear()}<br/>
Este documento constitui evidência para fins de avaliação institucional (INEP/MEC) — Dimensão 5: Políticas Acadêmicas (Extensão)</p>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  const projTeam = selectedProject ? team.filter(t => t.project_id === selectedProject) : [];
  const projStudents = selectedProject ? students.filter(s => s.project_id === selectedProject) : [];
  const projDeliverables = selectedProject ? deliverables.filter(d => d.project_id === selectedProject) : [];

  const viewButton=(v:View)=>(
    <button key={v} className={view === v ? 'active' : ''} aria-current={view===v?'page':undefined} onClick={() => {if(v==='formularios'&&view!=='formularios'){setTargetForm(undefined);setShowProjectInvites(false);}if(v==='evidencias')setEvidencePanel(null);setView(v);}}>
            {v === 'projetos' ? `Projetos (${projects.length})` :
             v === 'formularios' ? 'Formulários e PDF' :
             v === 'equipe' ? `Equipe (${team.length})` :
             v === 'alunos' ? `Alunos (${students.length})` :
             v === 'entregas' ? `Entregas (${deliverables.length})` :
             v === 'atividades' ? '📅 Atividades' :
             v === 'evidencias' ? '📁 Evidências' :
             v === 'competencias' ? '🎯 Competências' :
             v === 'parceiros' ? '🤝 Parceiros' :
             v === 'achados' ? '🔍 Achados' :
             v === 'conformidade' ? '⚖️ Conformidade' :
             v === 'cobertura' ? 'Cobertura por Curso' :
             v === 'revisoes' ? `Revisões (${pendentesRevisao})` :
             v === 'ods' ? '🌍 ODS' :
             v === 'ia' ? '🤖 IA' :
             v === 'perfis' ? '🔐 Perfis' :
             v === 'importacao' ? '📥 Importação' :
             v === 'relatorios' ? '📊 Relatórios' :
             '📊 Governança'}
          </button>
  );

  return (
    <div className="ext-container">
      {onBack && <button type="button" className="ext-back" onClick={onBack}>← Voltar aos módulos</button>}
      <div className="ext-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <h2 style={{ margin: 0 }}>🤝 Extensão 360°<ContextHelp title="🤝 Extensão 360°" /></h2>
            <ExtensaoNotificacoes institutionId={institutionId} />
          </div>
          <p>Pró-Reitoria de Extensão · DCNs: mínimo 10% da carga horária</p>
        </div>
        {canEdit && view === 'projetos' && (
          <div className="ext-header-actions">
            <button className="ext-btn-secondary" onClick={() => { setFormType('axis'); setFormData({}); setShowForm(true); }}>+ Eixo temático</button>
            <button className="ext-btn-primary" onClick={async () => { const code = await generateCode(); setFormType('project'); setFormData({ status: 'planejamento', review_status: 'rascunho', project_type: 'projeto', course_ids: [], code }); setShowForm(true); }}>+ Novo projeto</button>
          </div>
        )}
      </div>

      {/* Convite simplificado */}
      {role === 'master' && <div style={{padding:'14px 18px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,marginBottom:16}}>
        <strong style={{fontSize:13,color:'#166534'}}>📩 Convidar professor para a Extensão</strong>
        <form onSubmit={sendInvite} style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap',marginTop:8}}>
          <label style={{display:'grid',gap:4,fontSize:12,flex:1,minWidth:160}}>Nome<input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Prof. João Silva" style={{padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}}/></label>
          <label style={{display:'grid',gap:4,fontSize:12,flex:1,minWidth:200}}>E-mail *<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="professor@email.com" style={{padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13}}/></label>
          <button type="submit" disabled={inviteBusy} style={{padding:'7px 14px',background:'#16a34a',color:'#fff',border:0,borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{inviteBusy?'Enviando…':'Enviar convite'}</button>
        </form>
        {inviteMsg&&<p style={{fontSize:12,margin:'8px 0 0',color:inviteMsg.startsWith('✅')?'#166534':inviteMsg.startsWith('⚠')?'#92400e':'#991b1b'}}>{inviteMsg}</p>}
        {inviteLink&&<div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <input readOnly value={inviteLink} style={{flex:1,padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:11,background:'#fff'}} onClick={e=>(e.target as HTMLInputElement).select()}/>
          <button type="button" onClick={()=>navigator.clipboard.writeText(inviteLink).then(()=>setInviteMsg('📋 Link copiado! Cole no WhatsApp.')).catch(()=>{})} style={{padding:'7px 12px',background:'#16a34a',color:'#fff',border:0,borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>📋 Copiar</button>
        </div>}
        <p style={{fontSize:10,color:'#6b7280',marginTop:6}}>O professor acessa pelo link do convite, sem precisar de senha.</p>
      </div>}

      {/* KPIs */}
      <div className="ext-kpis">
        <div className="ext-kpi"><strong>{projects.length}</strong><span>Projetos registrados</span></div>
        <div className="ext-kpi info"><strong>{emExecucao}</strong><span>Em execução</span></div>
        <div className="ext-kpi success"><strong>{concluidos}</strong><span>Concluídos</span></div>
        <div className="ext-kpi"><strong>{totalStudents}</strong><span>Discentes envolvidos</span></div>
        <div className="ext-kpi"><strong>{totalDocentes}</strong><span>Docentes</span></div>
        <div className="ext-kpi"><strong>{totalComunidade}</strong><span>Comunidade</span></div>
        <div className="ext-kpi"><strong>{horasDiscentes}h</strong><span>Horas discentes cumpridas</span></div>
        <div className="ext-kpi" style={pctCobertura < 50 ? {borderLeft:'3px solid #ef4444'} : {}}><strong style={pctCobertura < 50 ? {color:'#ef4444'} : {}}>{cursosComExtensao}/{totalCursos}</strong><span>Cursos com extensão ({pctCobertura}%)</span></div>
      </div>

      {/* Tabs de navegação */}
      <nav aria-label="Áreas de Extensão" className="ext-module-navigation">
        <div className="ext-tabs">{PRIMARY_VIEWS.map(viewButton)}</div>
        <details open={OTHER_VIEWS.includes(view)}>
          <summary>Mais áreas de Extensão</summary>
          <div className="ext-tabs">{OTHER_VIEWS.map(viewButton)}</div>
        </details>
      </nav>

      {(formsVisited || view === 'formularios') && <div hidden={view !== 'formularios'}><ExtensaoFormularios key={`${institutionId}:${targetForm||''}:${showProjectInvites}`} institutionId={institutionId} role={role} courses={courses || []} projects={[...projects,...deletedProjects]} targetId={targetForm} startWithInvites={showProjectInvites} evidenceRevision={evidenceRevision} onBack={()=>{setView('projetos');setTargetForm(undefined);}} onChanged={() => { void load(); }} /></div>}

      {loading ? <p className="ext-loading">Carregando dados de extensão...</p> : (
        <>
          {/* ===== PROJETOS ===== */}
          {view === 'projetos' && (
            <div className="ext-section">
              <div className="ext-project-list-tools">
                <div><h3>Projetos de Extensão</h3><p>Abra um projeto para acompanhar a tramitação e o relatório.</p></div>
                {canEdit||role==='equipe'?<button className="ext-btn-secondary" aria-pressed={showDeleted} onClick={()=>setShowDeleted(!showDeleted)}>
                  {showDeleted?'Projetos ativos':`Projetos excluídos (${deletedProjects.filter(canManage).length})`}
                </button>:null}
              </div>
              {projectError&&<p className="ext-project-error" role="alert">{projectError}</p>}
              <div className="ext-filter-row">
                <input type="search" aria-label="Buscar projetos" placeholder="Buscar por título, código, responsável ou curso" value={projectQuery} onChange={e=>setProjectQuery(e.target.value)}/>
                <select value={filterStatus} aria-label="Filtrar por status" disabled={showDeleted} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="todos">Todos os status</option>
                  {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado','pendente','em_analise','ajuste_solicitado','rejeitado'].includes(k)).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {axes.length > 0 && <span className="ext-axes-count">{axes.length} eixo(s) temático(s) · {axes.filter(a => a.suggested_by_ai).length} sugerido(s) por IA</span>}
              </div>

              {/* Form: Eixo temático */}
              {showForm && formType === 'axis' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Novo'} Eixo Temático</h3>
                  <div className="ext-form-grid">
                    <HelpLabel>Nome do eixo<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Direitos Humanos e Cidadania" /></HelpLabel>
                    <HelpLabel>ODS vinculados<input value={formData.ods_text ?? (formData.ods_alignment || []).join(', ')} onChange={e => setFormData({ ...formData, ods_text: e.target.value })} placeholder="ODS4, ODS10, ODS16" /></HelpLabel>
                  </div>
                  <HelpLabel className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></HelpLabel>
                  {/* Eixos pré-cadastrados por ODS */}
                  {!formData.id && axes.length > 0 && (
                    <div style={{marginTop:'.75rem'}}>
                      <p style={{fontSize:'.82rem',color:'var(--text-secondary,#6b7280)',marginBottom:'.5rem'}}>💡 Eixos já cadastrados (clique para editar):</p>
                      <div className="ext-course-chips">
                        {axes.map(a => <button key={a.id} type="button" className="ext-chip" onClick={() => setFormData({...a, ods_text: a.ods_alignment.join(', ')})}>
                          {a.suggested_by_ai && '🤖 '}{a.name} · {a.ods_alignment.join(', ')}
                        </button>)}
                      </div>
                    </div>
                  )}
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveAxis}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Form: Projeto completo */}
              {showForm && formType === 'project' && (
                <section className="ext-form ext-registration" aria-labelledby="ext-registration-heading">
                  <header className="ext-registration-hero">
                    <div><h3 id="ext-registration-heading" ref={registrationHeading} tabIndex={-1}>{formData.id ? 'Editar projeto de extensão' : 'Novo projeto de extensão'}</h3>
                      <p>{formData.id ? formData.title : 'Informe o título para salvar o rascunho e completar as demais informações depois.'}</p>
                    </div>
                    <button type="button" className="ext-btn-secondary" onClick={()=>setShowForm(false)}>Voltar aos projetos</button>
                  </header>
                  <section className="ext-registration-panel" aria-labelledby="ext-identification-heading">
                  <h4 id="ext-identification-heading">Identificação</h4>
                  <div className="ext-form-grid">
                    <HelpLabel className="ext-registration-title">Título<input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></HelpLabel>
                    <HelpLabel>Código<input value={formData.code || ''} readOnly style={{background:'var(--bg-card,#f3f4f6)',cursor:'default',fontFamily:'monospace',fontWeight:600}} title="Gerado automaticamente" /></HelpLabel>
                    <HelpLabel>Tipo
                      <select value={formData.project_type || 'projeto'} onChange={e => setFormData({ ...formData, project_type: e.target.value })}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </HelpLabel>
                    <div style={{gridColumn:'1 / -1'}}>
                      <strong style={{fontSize:'.8rem',display:'block',marginBottom:'.35rem'}}>Eixos temáticos vinculados (selecione um ou mais):</strong>
                      <div className="ext-course-chips">
                        {axes.map(a => {
                          const ids = formData.axis_ids || (formData.axis_id ? [formData.axis_id] : []);
                          const sel = ids.includes(a.id);
                          return <button key={a.id} type="button" className={`ext-chip ${sel ? 'selected' : ''}`} onClick={() => {
                            setFormData({ ...formData, axis_ids: sel ? ids.filter((x:string) => x !== a.id) : [...ids, a.id], axis_id: null });
                          }}>{a.suggested_by_ai ? '🤖 ' : ''}{a.name} · {(a.ods_alignment||[]).join(', ')}</button>;
                        })}
                      </div>
                    </div>
                    <HelpLabel>Coordenador
                      <select value={formData.coordinator_name || ''} onChange={e => {
                        const staff = staffList.find(s => s.full_name === e.target.value);
                        setFormData({ ...formData, coordinator_name: e.target.value, coordinator_email: staff?.email || formData.coordinator_email || '' });
                      }}>
                        <option value="">— Selecionar coordenador —</option>
                        {staffList.map((s, i) => <option key={i} value={s.full_name}>{s.full_name}{s.email ? ` (${s.email})` : ''} · {s.source === 'coordenador_curso' ? 'Coord. Curso' : s.source === 'governanca' ? 'Governança' : 'Extensão'}</option>)}
                        <option value="__outro">Outro (digitar manualmente)</option>
                      </select>
                    </HelpLabel>
                    {formData.coordinator_name === '__outro' && <HelpLabel>Nome do coordenador<input value={formData.coordinator_name_manual || ''} onChange={e => setFormData({ ...formData, coordinator_name: e.target.value })} placeholder="Nome completo" /></HelpLabel>}
                    <HelpLabel>E-mail coordenador<input type="email" value={formData.coordinator_email || ''} onChange={e => setFormData({ ...formData, coordinator_email: e.target.value })} /></HelpLabel>
                    <HelpLabel>Comunidade atendida<input value={formData.target_community || ''} onChange={e => setFormData({ ...formData, target_community: e.target.value })} placeholder="Ex: moradores do Jardim Aureny" /></HelpLabel>
                    <HelpLabel>Público estimado<input type="number" value={formData.target_audience_count || ''} onChange={e => setFormData({ ...formData, target_audience_count: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Semestre<input value={formData.semester || ''} onChange={e => setFormData({ ...formData, semester: e.target.value })} placeholder="2026/01" /></HelpLabel>
                    <HelpLabel>Carga horária total<input type="number" value={formData.total_hours || ''} onChange={e => setFormData({ ...formData, total_hours: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Início<input type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></HelpLabel>
                    <HelpLabel>Término<input type="date" value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></HelpLabel>
                    <HelpLabel>Status
                      <select value={formData.status || 'planejamento'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        {Object.entries(STATUS_LABELS).filter(([k]) => !['ativo','desligado','trancado','pendente','em_analise','ajuste_solicitado','rejeitado'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </HelpLabel>
                    <HelpLabel>Orçamento estimado<input type="number" step="0.01" value={formData.budget_estimated || ''} onChange={e => setFormData({ ...formData, budget_estimated: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Parceiros<input value={formData.partner_institutions_text ?? (formData.partner_institutions || []).join(', ')} onChange={e => setFormData({ ...formData, partner_institutions_text: e.target.value })} placeholder="OAB, Defensoria, CRAS" /></HelpLabel>
                    <HelpLabel>ODS<input value={formData.ods_goals_text ?? (formData.ods_goals || []).join(', ')} onChange={e => setFormData({ ...formData, ods_goals_text: e.target.value })} placeholder="ODS4, ODS16" /></HelpLabel>
                  </div>
                  <HelpLabel className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></HelpLabel>

                  </section>
                  <details className="ext-registration-panel">
                    <summary>Planejamento e impacto</summary>
                    <HelpLabel className="ext-form-full">Problema social identificado
                      <textarea value={formData.social_problem || ''} onChange={e => setFormData({ ...formData, social_problem: e.target.value })} rows={2} placeholder="Qual problema social o projeto visa resolver?" />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Objetivo geral
                      <textarea value={formData.general_objective || ''} onChange={e => setFormData({ ...formData, general_objective: e.target.value })} rows={2} placeholder="Objetivo geral do projeto" />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Objetivos específicos (um por linha)
                      <textarea value={(formData.specific_objectives || []).join('\n')} onChange={e => setFormData({ ...formData, specific_objectives: e.target.value.split('\n').filter((s: string) => s.trim()) })} rows={3} placeholder="Um objetivo por linha" />
                    </HelpLabel>
                    <div className="ext-form-grid">
                      <HelpLabel>Perfil do público beneficiário
                        <input value={formData.beneficiary_profile || ''} onChange={e => setFormData({ ...formData, beneficiary_profile: e.target.value })} placeholder="Ex: famílias em vulnerabilidade" />
                      </HelpLabel>
                      <HelpLabel>Comunidade externa envolvida
                        <input value={formData.external_community || ''} onChange={e => setFormData({ ...formData, external_community: e.target.value })} placeholder="Instituições, associações, ONGs..." />
                      </HelpLabel>
                    </div>
                    <HelpLabel className="ext-form-full">Metodologia
                      <textarea value={formData.methodology || ''} onChange={e => setFormData({ ...formData, methodology: e.target.value })} rows={3} placeholder="Como o projeto será executado" />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Recursos necessários
                      <textarea value={formData.required_resources || ''} onChange={e => setFormData({ ...formData, required_resources: e.target.value })} rows={2} placeholder="Materiais, infraestrutura, transporte..." />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Resultados esperados (um por linha)
                      <textarea value={(formData.expected_results || []).join('\n')} onChange={e => setFormData({ ...formData, expected_results: e.target.value.split('\n').filter((s: string) => s.trim()) })} rows={2} placeholder="Um resultado por linha" />
                    </HelpLabel>

                  </details>
                  <details className="ext-registration-panel">
                    <summary>Dados institucionais da atividade</summary>
                    <div className="ext-form-grid">
                      <HelpLabel>Categoria
                        <select value={formData.category || 'evento'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                          <option value="curso">Curso</option>
                          <option value="evento">Evento</option>
                          <option value="prestacao_servico">Prestação de Serviço</option>
                        </select>
                      </HelpLabel>
                      <HelpLabel>Detalhe da categoria
                        <select value={formData.category_detail || ''} onChange={e => setFormData({ ...formData, category_detail: e.target.value })}>
                          <option value="">— Selecionar —</option>
                          <option value="congresso">Congresso</option>
                          <option value="seminario">Seminário</option>
                          <option value="ciclo_debates">Ciclo de Debates</option>
                          <option value="exposicao">Exposição</option>
                          <option value="espetaculo">Espetáculo</option>
                          <option value="evento_esportivo">Evento Esportivo</option>
                          <option value="festival">Festival</option>
                          <option value="atendimento_juridico">Atendimento Jurídico</option>
                          <option value="atendimento_psicopedagogico">Atendimento Psicopedagógico</option>
                          <option value="outro">Outro</option>
                        </select>
                      </HelpLabel>
                      <HelpLabel>Área temática
                        <select value={formData.thematic_area || ''} onChange={e => setFormData({ ...formData, thematic_area: e.target.value })}>
                          <option value="">— Selecionar —</option>
                          <option value="desenvolvimento_economico">Desenvolvimento econômico</option>
                          <option value="educacao_inclusiva">Educação inclusiva</option>
                          <option value="saude">Saúde</option>
                          <option value="direitos_humanos">Direitos humanos</option>
                          <option value="educacao_ambiental">Educação ambiental</option>
                          <option value="memoria_cultural">Valorização da memória cultural</option>
                          <option value="atendimento_juridico">Atendimento jurídico</option>
                          <option value="solidariedade">Solidariedade</option>
                          <option value="diversidade">Valorização da diversidade</option>
                          <option value="relacoes_etnico_raciais">Relações étnico-raciais</option>
                          <option value="outro">Outro</option>
                        </select>
                      </HelpLabel>
                      <HelpLabel>Modalidade
                        <select value={formData.modality || 'presencial'} onChange={e => setFormData({ ...formData, modality: e.target.value })}>
                          <option value="presencial">Presencial</option>
                          <option value="a_distancia">A distância</option>
                          <option value="hibrido">Híbrido</option>
                        </select>
                      </HelpLabel>
                      <HelpLabel>Unidade<input value={formData.unit_name || ''} onChange={e => setFormData({ ...formData, unit_name: e.target.value })} placeholder="Ex: UNITOP Palmas" /></HelpLabel>
                      <HelpLabel>Tipo de atividade<input value={formData.activity_type || ''} onChange={e => setFormData({ ...formData, activity_type: e.target.value })} placeholder="Ex: Ciclo de Debates Digitais" /></HelpLabel>
                      <HelpLabel>Horário da atividade<input value={formData.activity_schedule || ''} onChange={e => setFormData({ ...formData, activity_schedule: e.target.value })} placeholder="Ex: semanal, às sextas" /></HelpLabel>
                      <HelpLabel>Local<input value={formData.activity_location || ''} onChange={e => setFormData({ ...formData, activity_location: e.target.value })} placeholder="Ex: Auditório, Ambiente digital" /></HelpLabel>
                    </div>
                    <HelpLabel className="ext-form-full">Programação detalhada
                      <textarea value={formData.detailed_program || ''} onChange={e => setFormData({ ...formData, detailed_program: e.target.value })} rows={4} placeholder="Etapas, cronograma, atividades previstas..." />
                    </HelpLabel>
                    <div className="ext-form-grid">
                      <HelpLabel>Público-alvo
                        <select value={formData.target_audience_type || 'externo_interno'} onChange={e => setFormData({ ...formData, target_audience_type: e.target.value })}>
                          <option value="externo">Externo</option>
                          <option value="externo_interno">Externo e Interno</option>
                          <option value="interno">Interno</option>
                        </select>
                      </HelpLabel>
                      <HelpLabel>Confirmação de presença
                        <select value={formData.attendance_confirmation || 'lista_presenca'} onChange={e => setFormData({ ...formData, attendance_confirmation: e.target.value })}>
                          <option value="lista_presenca">Lista de presença</option>
                          <option value="chamada_digital">Chamada digital</option>
                          <option value="qr_code">QR Code</option>
                          <option value="certificado">Certificado</option>
                          <option value="outro">Outro</option>
                        </select>
                      </HelpLabel>
                    </div>
                    <HelpLabel className="ext-form-full">Detalhamento do público-alvo
                      <textarea value={formData.target_audience_detail || ''} onChange={e => setFormData({ ...formData, target_audience_detail: e.target.value })} rows={2} placeholder="Alunos de graduação, comunidade externa..." />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Infraestrutura necessária
                      <textarea value={formData.infrastructure_needs || ''} onChange={e => setFormData({ ...formData, infrastructure_needs: e.target.value })} rows={2} placeholder="Auditório, projetor, transporte, equipamentos..." />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Formas de avaliação
                      <textarea value={formData.evaluation_method || ''} onChange={e => setFormData({ ...formData, evaluation_method: e.target.value })} rows={2} placeholder="Relatórios, questionários, métricas de engajamento..." />
                    </HelpLabel>
                    <HelpLabel className="ext-form-full">Parcerias e formas de apoio
                      <textarea value={formData.partnerships_detail || ''} onChange={e => setFormData({ ...formData, partnerships_detail: e.target.value })} rows={2} placeholder="Instituições parceiras, apoio logístico..." />
                    </HelpLabel>
                  </details>
                  {formData.id&&<section className="ext-registration-panel ext-registration-tramitation">
                      <div><strong>Tramitação</strong><p>{STATUS_LABELS[formData.review_status]||formData.review_status||'Rascunho'}</p>
                        {formData.id&&<button type="button" className="ext-btn-secondary" onClick={()=>setWorkflowPanel({projectId:formData.id,projectTitle:formData.title,reviewStatus:formData.review_status})}>Abrir tramitação</button>}
                      </div>
                  </section>}

                  {/* Cursos vinculados */}
                  {courses && courses.length > 0 && (
                    <details className="ext-registration-panel">
                      <summary>Cursos vinculados ({formData.course_ids?.length||0})</summary>
                      <div className="ext-course-chips">
                        {courses.map(c => {
                          const selected = (formData.course_ids || []).includes(c.id);
                          return <button key={c.id} type="button" className={`ext-chip ${selected ? 'selected' : ''}`}
                            onClick={() => { const ids = formData.course_ids || []; setFormData({ ...formData, course_ids: selected ? ids.filter((i: string) => i !== c.id) : [...ids, c.id] }); }}>{c.name}</button>;
                        })}
                      </div>
                    </details>
                  )}

                  {formData.id&&<details className="ext-registration-panel ext-ai-panel">
                    <summary>Pré-análise da Pró-Reitoria de Extensão</summary>
                    <p style={{fontSize:'.82rem',color:'var(--text-secondary,#6b7280)',margin:'0 0 .75rem'}}>
                      Vinculação automática às dimensões e indicadores do Instrumento de Avaliação INEP/MEC.
                    </p>
                    {formData.axis_id && formData.ai_suggested_axis_id && formData.axis_id !== formData.ai_suggested_axis_id && (
                      <div className="ext-info" style={{marginBottom:'.75rem'}}>
                        ⚠️ <strong>Sugestão da IA:</strong> {formData.ai_axis_note || 'O eixo vinculado pode não ser o mais adequado ao escopo deste projeto.'} Eixo sugerido: <strong>{axisName(formData.ai_suggested_axis_id)}</strong>
                      </div>
                    )}
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 2 — Corpo Docente e Tutorial</span><span className={`dim-score ${team.filter(t=>t.project_id===formData.id).length>0?'high':'low'}`}>{team.filter(t=>t.project_id===formData.id).length>0?'Docentes vinculados':'Sem vínculo'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 3 — Infraestrutura</span><span className="dim-score medium">Verificar</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Dimensão 5 — Políticas Acadêmicas (Extensão)</span><span className={`dim-score ${formData.course_ids?.length>0?'high':'low'}`}>{formData.course_ids?.length>0?'Cursos vinculados':'Sem cursos'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Indicador 5.3 — Atividades de extensão</span><span className={`dim-score ${formData.description?.length>50?'high':'medium'}`}>{formData.description?.length>50?'Descrito':'Insuficiente'}</span></div>
                    <div className="ext-ai-dim"><span className="dim-name">Indicador 5.4 — Integração com a comunidade</span><span className={`dim-score ${formData.target_community?'high':'low'}`}>{formData.target_community?'Comunidade identificada':'Sem identificação'}</span></div>
                    <p style={{fontSize:'.75rem',color:'var(--text-secondary,#999)',marginTop:'.5rem',fontStyle:'italic'}}>
                      A análise será refinada com base nas evidências e no relatório final. Itens sem comprovação ficam como "Sem vínculo".
                    </p>
                  </details>}

                  <footer className="ext-form-actions ext-registration-footer">
                    <button className="ext-btn-save" onClick={saveProject}>{formData.id?'Salvar alterações':'Salvar rascunho'}</button>
                    {formData.id&&canManage(formData)&&discardableIds?.includes(formData.id)&&<button className="ext-btn-danger" disabled={archiving} onClick={()=>void discardProject(formData,true)}>Excluir projeto</button>}
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </footer>
                </section>
              )}

              {/* Cards de projetos */}
              {!projectFormOpen && (filteredProjects.length === 0 ? <p className="ext-empty">{showDeleted?'Nenhum projeto excluído encontrado.':'Nenhum projeto encontrado.'}</p> : (
                <div className="ext-project-grid">
                  {filteredProjects.map(p => {
                    const pTeam = team.filter(t => t.project_id === p.id);
                    const pStudents = students.filter(s => s.project_id === p.id);
                    const pDel = deliverables.filter(d => d.project_id === p.id);
                    return (
                      <div key={p.id} className="ext-project-card ext-project-discovery">
                        <div className="ext-card-top">
                          <span className="ext-card-type">{TYPE_LABELS[p.project_type] || p.project_type}</span>
                          <div style={{display:'flex',gap:'.35rem'}}><Badge status={p.status} /><Badge status={p.review_status} /></div>
                        </div>
                        <h4>{p.title}</h4>
                        {p.code && <span className="ext-card-code">{p.code}</span>}
                        {p.coordinator_name && <p className="ext-card-coord">👤 {p.coordinator_name}</p>}
                        {((p as any).axis_ids?.length > 0 || p.axis_id) && <p className="ext-card-coord">📌 {((p as any).axis_ids || (p.axis_id ? [p.axis_id] : [])).map((id:string) => axisName(id)).filter(Boolean).join(' · ')}</p>}
                        {p.target_community && <p className="ext-card-community ext-community-preview">🏘 {p.target_community}{(p as any).beneficiary_profile ? ` · ${(p as any).beneficiary_profile}` : ''}</p>}
                        {(p as any).social_problem && <p style={{fontSize:'.8rem',color:'#6b7280',margin:'.2rem 0'}}>💡 {String((p as any).social_problem).slice(0, 80)}{String((p as any).social_problem).length > 80 ? '…' : ''}</p>}
                        <div className="ext-card-meta">
                          <span>⏱ {p.total_hours || 0}h</span>
                          <span>👨‍🏫 {pTeam.length} equipe</span>
                          <span>🎓 {pStudents.length} alunos</span>
                          <span>📄 {pDel.length} entregas</span>
                          {p.semester && <span>📅 {p.semester}</span>}
                        </div>
                        {/* Completude Impacto */}
                        {(() => {
                          const fields = ['social_problem','general_objective','methodology','target_community','beneficiary_profile'] as const;
                          const filled = fields.filter(f => (p as any)[f] && String((p as any)[f]).trim().length >= 10).length;
                          const pct = Math.round((filled / fields.length) * 100);
                          return (
                            <div style={{marginTop:'.35rem',display:'flex',alignItems:'center',gap:'.5rem'}}>
                              <div style={{flex:1,height:'4px',background:'var(--border,#e5e7eb)',borderRadius:'2px',overflow:'hidden'}}>
                                <div style={{width:`${pct}%`,height:'100%',background:pct===100?'#22c55e':pct>=60?'#f59e0b':'#ef4444',transition:'width .3s'}}/>
                              </div>
                              <span style={{fontSize:'.7rem',color:'#6b7280',whiteSpace:'nowrap'}}>{pct}% Impacto</span>
                            </div>
                          );
                        })()}
                        {(p.course_ids || []).length > 0 && (
                          <div className="ext-card-courses">
                            {(p.course_ids || []).slice(0, 3).map(cid => <span key={cid} className="ext-course-tag">{courseName(cid)}</span>)}
                            {(p.course_ids || []).length > 3 && <span className="ext-course-tag">+{p.course_ids.length - 3}</span>}
                          </div>
                        )}
                        <div style={{display:'flex',gap:'.5rem',alignItems:'center',marginTop:'.5rem',flexWrap:'wrap'}}>
                          <span className="ext-ai-badge">🤝 Pré-análise Extensão</span>
                          {pDel.length > 0 && <span className="ext-ai-badge">📎 {pDel.length} evidência{pDel.length>1?'s':''}</span>}
                          {p.review_status === 'ajuste_solicitado' && <span className="ext-ai-badge" style={{color:'#ef4444',background:'rgba(239,68,68,.1)'}}>⚠ Ajuste solicitado</span>}
                        </div>
                        {showDeleted?<div className="ext-card-actions"><button disabled={archiving} onClick={()=>void discardProject(p,false)}>Recuperar projeto</button></div>:<>
                          <div className="ext-project-main-actions">
                            <button className="ext-btn-primary" onClick={()=>openReport(p.id)}>Relatório Final</button>
                            {canManage(p)&&<button className="ext-btn-secondary" onClick={()=>{setFormType('project');setFormData({...p,partner_institutions_text:(p.partner_institutions||[]).join(', '),ods_goals_text:(p.ods_goals||[]).join(', ')});setShowForm(true);}}>Editar projeto</button>}
                            {canManage(p)&&discardableIds?.includes(p.id)&&<button className="ext-btn-danger" disabled={archiving} onClick={()=>void discardProject(p,true)}>Excluir projeto</button>}
                            {canManage(p)&&p.status==='cancelado'&&discardableIds&&!discardableIds.includes(p.id)&&<small className="ext-project-retention">Histórico de tramitação ou encerramento preservado.</small>}
                          </div>
                        {canManage(p) && (
                          <div className="ext-card-actions"  onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setSelectedProject(p.id); setView('equipe'); }}>Equipe</button>
                            <button onClick={() => openReport(p.id,true)}>Alunos e convites</button>
                            <button onClick={() => { setSelectedProject(p.id); setView('entregas'); }}>Entregas</button>
                            <button onClick={() => { setActivityPanel({ projectId: p.id, projectTitle: p.title }); setView('atividades'); }}>Atividades</button>
                            <button onClick={() => { setEvidencePanel({ projectId: p.id, projectTitle: p.title }); setView('evidencias'); }}>Evidências</button>
                            <button onClick={() => { setWorkflowPanel({ projectId: p.id, projectTitle: p.title, reviewStatus: p.review_status }); }}>📋 Workflow</button>
                            {(p.status === 'concluido' || p.review_status === 'concluido') && (
                              <button style={{background:'#7c3aed',color:'#fff',fontWeight:600}} onClick={() => generateEvidencePDF(p)}>📄 PDF Evidências</button>
                            )}
                          </div>
                        )}</>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ===== EQUIPE (Professores/Coordenadores) ===== */}
          {view === 'equipe' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" style={{marginBottom:'1rem'}} onClick={() => { setFormType('team'); setFormData({ role_type: 'professor', is_active: true }); setShowForm(true); }}>+ Vincular professor/coordenador</button>}
              {showForm && formType === 'team' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Vincular'} Professor / Coordenador</h3>
                  <div className="ext-form-grid">
                    <HelpLabel>Nome completo<input value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} /></HelpLabel>
                    <HelpLabel>Função <select value={formData.role_type || 'professor'} onChange={e => setFormData({ ...formData, role_type: e.target.value })}>
                      <option value="coordenador">Coordenador</option><option value="professor">Professor</option><option value="tutor">Tutor</option><option value="supervisor">Supervisor</option>
                    </select></HelpLabel>
                    <HelpLabel>E-mail<input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></HelpLabel>
                    <HelpLabel>CPF<input value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" /></HelpLabel>
                    <HelpLabel>Horas atribuídas<input type="number" value={formData.hours_assigned || ''} onChange={e => setFormData({ ...formData, hours_assigned: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Lattes<input value={formData.lattes_url || ''} onChange={e => setFormData({ ...formData, lattes_url: e.target.value })} placeholder="http://lattes.cnpq.br/..." /></HelpLabel>
                  </div>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveTeamMember}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projTeam : team).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhum membro vinculado.' : 'Selecione um projeto.'}</p> : (
                <table className="ext-table"><thead><tr><th>Nome</th><th>Função</th><th>E-mail<ContextHelp title="E-mail" /></th><th>CPF</th><th>Horas</th><th>Ativo</th></tr></thead>
                <tbody>{(selectedProject ? projTeam : team).map(t => (
                  <tr key={t.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('team');setFormData(t);setSelectedProject(t.project_id);setShowForm(true);} }}>
                    <td><strong>{t.full_name}</strong></td><td>{t.role_type}</td><td>{t.email||'—'}</td><td className="mono">{t.cpf||'—'}</td><td className="num">{t.hours_assigned||0}h</td><td>{t.is_active?'✅':'❌'}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== ALUNOS ===== */}
          {view === 'alunos' && (
            <div className="ext-section">
              <div className="ext-project-list-tools">
                <h3>Alunos por projeto</h3>
                {canEdit&&projects.length>0&&<button className="ext-btn-primary" onClick={()=>{
                  setFormType('student');setFormData({status:'ativo',project_id:selectedProject||''});
                  setStudentError('');setShowForm(true);
                }}>+ Vincular aluno</button>}
              </div>
              <div className="ext-filter-row">
                <label>Filtrar alunos por projeto <select value={selectedProject||''} onChange={e=>setSelectedProject(e.target.value||null)}>
                  <option value="">Todos os projetos</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.title} · {STATUS_LABELS[p.status]||p.status}</option>)}
                </select></label>
              </div>
              {showForm && formType === 'student' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar vínculo' : 'Vincular aluno ao projeto'}</h3>
                  {studentError&&<p className="ext-project-error" role="alert">{studentError}</p>}
                  <fieldset className="ext-form-grid" disabled={savingStudent} style={{border:0,padding:0}}>
                    <HelpLabel>Projeto <select value={formData.project_id||''} disabled={!!formData.id} onChange={e=>setFormData({...formData,project_id:e.target.value})}>
                      <option value="">Selecione o projeto</option>
                      {projects.map(p=><option key={p.id} value={p.id}>{p.title} · {STATUS_LABELS[p.status]||p.status}</option>)}
                    </select></HelpLabel>
                    {!formData.id&&students.some(s=>s.project_id!==formData.project_id)&&<HelpLabel>Usar cadastro de outro projeto
                      <select value={formData.source_student_id||''} onChange={e=>{
                        const student=students.find(s=>s.id===e.target.value);
                        setFormData({
                          ...formData,source_student_id:student?.id||'',full_name:student?.full_name||'',
                          email:student?.email||'',phone:student?.phone||'',cpf:student?.cpf||'',
                          course_id:student?.course_id||null,registration_number:student?.registration_number||'',
                        });
                      }}>
                        <option value="">Preencher manualmente</option>
                        {students.filter(s=>s.project_id!==formData.project_id).map(s=><option key={s.id} value={s.id}>
                          {s.full_name} · {projects.find(p=>p.id===s.project_id)?.title||'Projeto anterior'}
                        </option>)}
                      </select>
                    </HelpLabel>}
                    <HelpLabel>Nome completo<input value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} /></HelpLabel>
                    <HelpLabel>E-mail<input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></HelpLabel>
                    <HelpLabel>Telefone / WhatsApp<input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(63) 99999-0000" /></HelpLabel>
                    <HelpLabel>Matrícula<input value={formData.registration_number || ''} onChange={e => setFormData({ ...formData, registration_number: e.target.value })} /></HelpLabel>
                    <HelpLabel>CPF<input value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" /></HelpLabel>
                    <HelpLabel>Curso <select value={formData.course_id || ''} onChange={e => setFormData({ ...formData, course_id: e.target.value || null })}>
                      <option value="">— Selecionar —</option>
                      {courses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></HelpLabel>
                    <HelpLabel>Horas atribuídas<input type="number" value={formData.hours_assigned || ''} onChange={e => setFormData({ ...formData, hours_assigned: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Horas cumpridas<input type="number" value={formData.hours_completed || ''} onChange={e => setFormData({ ...formData, hours_completed: +e.target.value })} /></HelpLabel>
                    <HelpLabel>Bolsista? <select value={formData.is_scholarship?'sim':'nao'} onChange={e => setFormData({ ...formData, is_scholarship: e.target.value==='sim' })}>
                      <option value="nao">Não</option><option value="sim">Sim</option>
                    </select></HelpLabel>
                  </fieldset>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" disabled={savingStudent} onClick={saveStudent}>{savingStudent?'Salvando…':formData.id?'Salvar alterações':'Salvar vínculo'}</button>
                    <button className="ext-btn-cancel" disabled={savingStudent} onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projStudents : students).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhum aluno vinculado a este projeto.' : 'Nenhum aluno vinculado aos projetos.'}</p> : (
                <table className="ext-table"><thead><tr><th>Nome</th><th>Projeto</th><th>E-mail<ContextHelp title="E-mail" /></th><th>WhatsApp</th><th>Matrícula</th><th>Horas</th><th>Bolsista</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>{(selectedProject ? projStudents : students).map(s => (
                  <tr key={s.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('student');setFormData(s);setStudentError('');setSelectedProject(s.project_id);setShowForm(true);} }}>
                    <td><strong>{s.full_name}</strong></td><td>{projects.find(p=>p.id===s.project_id)?.title||'—'}</td><td>{s.email||'—'}</td><td>{s.phone||'—'}</td><td className="mono">{s.registration_number||'—'}</td><td className="num">{s.hours_completed||0}/{s.hours_assigned||0}h</td><td>{s.is_scholarship?'✅':'—'}</td><td><Badge status={s.status}/></td>
                    <td><button className="ext-btn-small" onClick={(e) => { e.stopPropagation(); setHourLedger({ participantId: s.id, participantName: s.full_name, projectId: s.project_id }); }}>📒 Horas</button></td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== ENTREGAS ===== */}
          {view === 'entregas' && (
            <div className="ext-section">
              {selectedProject && <p className="ext-filter-label">Projeto: <strong>{projects.find(p => p.id === selectedProject)?.title}</strong> <button className="ext-clear" onClick={() => setSelectedProject(null)}>✕</button></p>}
              {canEdit && selectedProject && <button className="ext-btn-primary" style={{marginBottom:'1rem'}} onClick={() => { setFormType('deliverable'); setFormData({ deliverable_type: 'relatorio_final' }); setShowForm(true); }}>+ Nova entrega</button>}
              {showForm && formType === 'deliverable' && (
                <div className="ext-form">
                  <h3>{formData.id ? 'Editar' : 'Nova'} Entrega</h3>
                  <div className="ext-form-grid">
                    <HelpLabel>Título<input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></HelpLabel>
                    <HelpLabel>Tipo <select value={formData.deliverable_type || 'relatorio_final'} onChange={e => setFormData({ ...formData, deliverable_type: e.target.value })}>
                      {Object.entries(DELIV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select></HelpLabel>
                    <HelpLabel>Data de entrega<input type="date" value={formData.delivered_at || ''} onChange={e => setFormData({ ...formData, delivered_at: e.target.value })} /></HelpLabel>
                    <HelpLabel>URL do documento<input value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="Link do arquivo ou repositório" /></HelpLabel>
                  </div>
                  <HelpLabel className="ext-form-full">Descrição<textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></HelpLabel>
                  <div className="ext-form-actions">
                    <button className="ext-btn-save" onClick={saveDeliverable}>Salvar</button>
                    <button className="ext-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              {(selectedProject ? projDeliverables : deliverables).length === 0 ? <p className="ext-empty">{selectedProject ? 'Nenhuma entrega registrada.' : 'Selecione um projeto.'}</p> : (
                <table className="ext-table"><thead><tr><th>Título</th><th>Tipo</th><th>Data</th><th>Projeto</th></tr></thead>
                <tbody>{(selectedProject ? projDeliverables : deliverables).map(d => (
                  <tr key={d.id} className={canEdit?'clickable':''} onClick={() => { if(canEdit){setFormType('deliverable');setFormData(d);setSelectedProject(d.project_id);setShowForm(true);} }}>
                    <td><strong>{d.title}</strong></td><td>{DELIV_LABELS[d.deliverable_type]||d.deliverable_type}</td><td>{fmtDate(d.delivered_at)}</td><td>{projects.find(p=>p.id===d.project_id)?.title||'—'}</td>
                  </tr>
                ))}</tbody></table>
              )}
            </div>
          )}

          {/* ===== COBERTURA POR CURSO ===== */}
          {view === 'cobertura' && (
            <div className="ext-section">
              <div className="ext-info">📊 Cobertura extensionista por curso. DCNs exigem pelo menos 10% da carga horária total em atividades de extensão.</div>
              <table className="ext-table"><thead><tr><th>Curso<ContextHelp title="Curso" /></th><th>Projetos</th><th>Alunos</th><th>Horas discentes</th></tr></thead>
              <tbody>
                {courses?.map(c => {
                  const cov = coverage.filter(cv => cv.course_id === c.id);
                  const tp = cov.reduce((s, cv) => s + cv.total_projects, 0);
                  const ts = cov.reduce((s, cv) => s + cv.total_students, 0);
                  const th = cov.reduce((s, cv) => s + cv.total_student_hours, 0);
                  return <tr key={c.id}><td><strong>{c.name}</strong></td><td className="num">{tp}</td><td className="num">{ts}</td><td className="num">{th}h</td></tr>;
                })}
              </tbody></table>
            </div>
          )}

          {/* ===== REVISÕES / FLUXO DE APROVAÇÃO ===== */}
          {view === 'revisoes' && (
            <div className="ext-section">
              <div className="ext-info">
                🔄 <strong>Fluxo de governança:</strong> Projeto concluído → Acompanhamento da Extensão analisa → Aprovado → Regulação valida → BI institucional.
                O setor de Acompanhamento pode solicitar ajustes antes de encaminhar à Regulação.
              </div>

              {/* Projetos pendentes de revisão */}
              {projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').length === 0 ? (
                <p className="ext-empty">Nenhum projeto pendente de revisão.</p>
              ) : (
                projects.filter(p => p.review_status === 'pendente' || p.review_status === 'ajuste_solicitado').map(p => (
                  <div key={p.id} className="ext-project-card" style={{cursor:'default',marginBottom:'1rem'}}>
                    <div className="ext-card-top">
                      <span className="ext-card-type">{p.code}</span>
                      <div style={{display:'flex',gap:'.35rem'}}><Badge status={p.status} /><Badge status={p.review_status} /></div>
                    </div>
                    <h4>{p.title}</h4>
                    {p.coordinator_name && <p className="ext-card-coord">👤 {p.coordinator_name}</p>}
                    <div className="ext-card-meta">
                      <span>🎓 {students.filter(s=>s.project_id===p.id).length} alunos</span>
                      <span>👨‍🏫 {team.filter(t=>t.project_id===p.id).length} equipe</span>
                      <span>📄 {deliverables.filter(d=>d.project_id===p.id).length} entregas</span>
                    </div>

                    {/* Histórico de revisões deste projeto */}
                    {reviews.filter(r => r.project_id === p.id).length > 0 && (
                      <div style={{marginTop:'.75rem',fontSize:'.82rem'}}>
                        <strong>Histórico:</strong>
                        {reviews.filter(r => r.project_id === p.id).map(r => (
                          <div key={r.id} style={{padding:'.35rem 0',borderBottom:'1px solid var(--border,#e5e7eb)'}}>
                            <span>{REVIEW_LABELS[r.review_stage]||r.review_stage}</span> · <Badge status={r.status} /> · {fmtDate(r.reviewed_at)}
                            {r.comment && <p style={{margin:'.25rem 0 0',color:'var(--text-secondary,#6b7280)'}}>{r.comment}</p>}
                            {r.adjustment_request && <p style={{margin:'.25rem 0 0',color:'#ef4444'}}>⚠ Ajuste: {r.adjustment_request}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ações de revisão */}
                    {canEdit && (
                      <div style={{display:'flex',gap:'.5rem',marginTop:'1rem',flexWrap:'wrap'}}>
                        <button className="ext-btn-primary" onClick={() => {
                          const stage = p.review_status === 'pendente' ? 'acompanhamento' : 'regulacao';
                          submitReview(p.id, stage, 'aprovado', 'Projeto aprovado pelo ' + REVIEW_LABELS[stage]);
                        }}>✅ Aprovar</button>
                        <button className="ext-btn-secondary" onClick={() => {
                          const adj = prompt('Descreva o ajuste necessário:');
                          if (adj) {
                            const stage = p.review_status === 'pendente' ? 'acompanhamento' : 'regulacao';
                            submitReview(p.id, stage, 'ajuste_solicitado', 'Ajuste solicitado', adj);
                          }
                        }}>⚠ Solicitar ajuste</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {/* ===== ODS ===== */}
          {view === 'ods' && (
            <div className="ext-section">
              {odsPanel ? (
                <ExtensaoODS
                  institutionId={institutionId}
                  projectId={odsPanel.projectId}
                  projectTitle={odsPanel.projectTitle}
                  canEdit={canEdit}
                  onClose={() => setOdsPanel(null)}
                />
              ) : (
                <>
                  <div className="ext-info">🌍 Selecione um projeto para vincular metas ODS com fundamentação.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.75rem' }}>
                    {projects.map(p => (
                      <div key={p.id} className="ext-project-card" onClick={() => setOdsPanel({ projectId: p.id, projectTitle: p.title })}>
                        <span className="ext-card-type">{p.code}</span>
                        <h4>{p.title}</h4>
                        {p.ods_goals?.length > 0 && <p style={{ fontSize: '.82rem' }}>ODS: {p.ods_goals.join(', ')}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== ATIVIDADES ===== */}
          {view === 'atividades' && (
            activityPanel ? (
              <ExtensaoAtividades
                institutionId={institutionId}
                projectId={activityPanel.projectId}
                projectTitle={activityPanel.projectTitle}
                canEdit={canEdit}
                onClose={() => setActivityPanel(null)}
              />
            ) : (
              <div>
                <h3>📅 Selecione um projeto para ver atividades</h3>
                <div style={{ display: 'grid', gap: '.5rem' }}>
                  {projects.map(p => (
                    <button key={p.id} className="ext-btn-secondary" onClick={() => setActivityPanel({ projectId: p.id, projectTitle: p.title })}>
                      {p.code} — {p.title}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ===== EVIDÊNCIAS ===== */}
          {view === 'evidencias' && (
            <ExtensaoEvidencias
              key={`${institutionId}:${evidencePanel?.projectId || ''}`}
              institutionId={institutionId}
              projectId={evidencePanel?.projectId}
              projectTitle={evidencePanel?.projectTitle}
              canEdit={canEdit}
              linkableProjects={projects.filter(canManage)}
              onLinked={() => setEvidenceRevision(revision => revision + 1)}
              onClose={() => { setEvidencePanel(null); setView('projetos'); }}
            />
          )}

          {/* ===== COMPETÊNCIAS ===== */}
          {view === 'competencias' && (
            <ExtensaoCompetencias
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== PARCEIROS ===== */}
          {view === 'parceiros' && (
            <ExtensaoParceiros
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== CONFORMIDADE ===== */}
          {view === 'conformidade' && (
            <ExtensaoConformidade
              institutionId={institutionId}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== ACHADOS / 5W2H ===== */}
          {view === 'achados' && (
            <ExtensaoAchados
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== IA ===== */}
          {view === 'ia' && (
            <ExtensaoIA
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== IMPORTAÇÃO ===== */}
          {view === 'importacao' && (
            <ExtensaoImportacao
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== RELATÓRIOS ===== */}
          {view === 'relatorios' && (
            <ExtensaoRelatorios
              institutionId={institutionId}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== PERFIS ===== */}
          {view === 'perfis' && (
            <ExtensaoPerfis
              institutionId={institutionId}
              canEdit={canEdit}
              onClose={() => setView('projetos')}
            />
          )}

          {/* ===== GOVERNANÇA ===== */}
          {view === 'governanca' && (
            <ExtensaoGovernanca institutionId={institutionId} canEdit={canEdit} />
          )}

          {/* ===== WORKFLOW (modal inline) ===== */}
          {workflowPanel && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: 'var(--bg, #fff)', borderRadius: '.75rem', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem' }}>
                <ExtensaoProjectWorkflow
                  institutionId={institutionId}
                  projectId={workflowPanel.projectId}
                  projectTitle={workflowPanel.projectTitle}
                  currentStatus={workflowPanel.reviewStatus}
                  canEdit={!!projects.find(p=>p.id===workflowPanel.projectId&&canManage(p))}
                  onStatusChange={() => { load(); setWorkflowPanel(null); }}
                  onClose={() => setWorkflowPanel(null)}
                />
              </div>
            </div>
          )}

          {/* ===== LIVRO-RAZÃO (modal inline) ===== */}
          {hourLedger && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: 'var(--bg, #fff)', borderRadius: '.75rem', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem' }}>
                <ExtensaoHourLedger
                  institutionId={institutionId}
                  projectId={hourLedger.projectId}
                  participantId={hourLedger.participantId}
                  participantName={hourLedger.participantName}
                  canEdit={canEdit}
                  onClose={() => setHourLedger(null)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
