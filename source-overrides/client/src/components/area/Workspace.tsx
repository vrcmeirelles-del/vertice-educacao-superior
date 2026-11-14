import { ContextHelp } from "@/components/ContextHelp";
import { MODULE_HELP } from "@/lib/module-help";
import { HelpLabel } from '@/components/ContextHelp';
import InstitutionSubTabs from "./InstitutionSubTabs";
import InstitutionTabs, { MACRO_TABS, macroTabFor, macroDestination, type MacroTab } from "./InstitutionTabs";
import {actionDraftKey,parseActionDraft,storeActionDraft,validateActionLinks,changeActionScope} from "@/lib/portal-integration";
import ActionCockpit from "./ActionCockpit";
import ActionKanban from "./ActionKanban";
import ActiveGovernance from "./ActiveGovernance";
import CnpjConnections from "./CnpjConnections";
import SourceUpload from "./SourceUpload";
import AcademicBackups from "./AcademicBackups";
import ApprovedSourcesBI from "./ApprovedSourcesBI";
import RegistryContacts from "./RegistryContacts";
import InstitutionAddress from "./InstitutionAddress";
import { courseClassification, useCourseFilters } from "./CourseFilters";
import {displayCourseRows} from '@/lib/course-labels';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  ACTION_STATUS, COURSE_STATUS, DEGREE, DIMENSIONS, DIRECTION, FINDING_STATUS, FREQUENCY, GOAL_STATUS, MODALITY, PRIORITY, ROLE_LABEL, TABLES, UF,
  can, deleteRow, explain, fmtDate, fmtNum, goalProgress, isLate, label, listByInstitution, saveRow, today,
  visibleTabs,
  type Field, type Role, type Row, type Tab,
} from "@/lib/area";
import RecordForm from "./RecordForm";
import GoalsDashboard, { GoalSignalBadge, GoalSignalBar } from "./GoalsDashboard";
import { goalSignals, summarizeGoalSignals, goalSignalDate, GOAL_SIGNALS, type GoalSignal } from "@/lib/goal-signals";
import RepositoryTab from "./RepositoryTab";
import PreValidationQueue from "./PreValidationQueue";
import EbitdaCalculator from "../EbitdaCalculator";
import InepLibrary from "./InepLibrary";
import AvaliacaoInstitucional from "./AvaliacaoInstitucional";
import NovoInstrumento from "./NovoInstrumento";
import Enade360 from "./Enade360";
import EnadeEligibility from "./EnadeEligibility";
import LearningConnected from "./LearningConnected";
import AuditoriaPermanenciaBI from "../bi/AuditoriaPermanenciaBI";
import ManagementReview from "./ManagementReview";
import DocumentAI from "./DocumentAI";
import OrganizationBase from "./OrganizationBase";
import BrandingPanel from "./BrandingPanel";
import {ThemeEditor} from "./ThemeEditor";
import EmecPanel from "./EmecPanel";
import {repositorySummary} from "@/lib/repository";
import {listRepository} from "@/lib/repository-data";
import { FIELD_HELP, TAB_FAQ, TAB_HELP, withHelp } from "@/lib/help";
import PainelEorbit from "../eorbit/PainelEorbit";
import ResultadoCursoBI from "../bi/ResultadoCursoBI";
import CostSimulator from "./CostSimulator";
import CostEvidence from "./CostEvidence";
import OneDriveEspelho from "./OneDriveEspelho";
import ConexoesDados from "./ConexoesDados";
import DocumentManager from "./DocumentManager";
import Enem360Escolar from "./Enem360Escolar";
import EgressosEscolar from "./EgressosEscolar";
import DireitoRaioX from "./DireitoRaioX";
const CourseRaioX = lazy(() => import("./CourseRaioX"));
const CourseShowcase = lazy(() => import("./CourseShowcase"));
const MODULE_LABELS: Record<string,string> = { tcc:'TCC', ac:'AC', estagio:'Estágio', extensao:'Extensão', cpa:'CPA', alumni:'Egressos', diagnostico:'Diagnóstico', meta:'Meta', acao:'Ação', ppc:'PPC', governanca:'Governança' };
function MiniKpi({ label, value, detail, bad }: { label: string; value: number; detail?: string; bad?: boolean }) {
  return <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.125rem', fontWeight: 700, color: bad ? '#ef4444' : value > 0 ? '#1e293b' : '#94a3b8' }}>{value}</div><div style={{ fontSize: '.6875rem', color: 'var(--vx-muted,#64748b)' }}>{label}</div>{detail && <div style={{ fontSize: '.625rem', color: bad ? '#ef4444' : '#94a3b8' }}>{detail}</div>}</div>;
}
const Tcc360 = lazy(() => import("./Tcc360"));
const AtividadesComplementares360 = lazy(() => import("./AtividadesComplementares360"));
const Estagio360 = lazy(() => import("./Estagio360"));
import Egressos360 from "./Egressos360";
import Governanca360 from "./Governanca360";
import Inclusao360 from "./Inclusao360";
import AcompanhamentoEspecial360 from "./AcompanhamentoEspecial360";
import SyncHealth from "./SyncHealth";
import Aquisicoes360 from "./Aquisicoes360";
import BillingPanel from "./BillingPanel";
import ContractView from "./ContractView";
import MinhaConta from "./MinhaConta";
import ModuleManager from "./ModuleManager";
import ModuleCatalogShowcase from "./ModuleCatalogShowcase";
import IntegrationSettings from "./IntegrationSettings";
import ModulePreview from "./ModulePreview";
import { getActiveTabs, isTabActive, getModuleCatalog, findModuleByTab, type CatalogModule } from "@/lib/modules";
import ModuleOffer from "./ModuleOffer";
const Extensao360 = lazy(() => import("./Extensao360"));
const CpaAutoavaliacao = lazy(() => import("./CpaAutoavaliacao"));
const ExtensaoDashboard = lazy(() => import("./ExtensaoDashboard"));
import "./area.css";
import "./module-offer.css";

const TAB_GROUPS: {label:string;subtitle:string;icon:string;tabs:Tab[];tier?:'superior'|'escolas'|'both'}[] = [
  {label:'Gestão',subtitle:'Planejamento, metas e governança',icon:'▦',tabs:['base','metas','plano','diagnostico','equipe','cpa-autoavaliacao'],tier:'both'},
  {label:'Regulação',subtitle:'Instrumentos e evidências MEC/INEP',icon:'◇',tabs:['emec','repositorio','validacao','enade','avaliacao','novo_instrumento','biblioteca'],tier:'superior'},
  {label:'Acadêmico',subtitle:'Cursos, estudantes e desempenho',icon:'▤',tabs:['geral','cadastro','visao','eorbit','backups','auditoria'],tier:'superior'},
  {label:'Inteligência',subtitle:'Análises, integrações e decisões',icon:'◎',tabs:['analise','ia','fontes','conexoes','reitor','resultado-curso','simulador','raio-x-direito','vitrine-curso','aprendizagem'],tier:'superior'},
  {label:'Egressos',subtitle:'Acompanhamento longitudinal e empregabilidade',icon:'🎓',tabs:['egressos'],tier:'superior'},
  {label:'Extensão',subtitle:'Projetos de extensão, participantes e cobertura',icon:'🤝',tabs:['extensao'],tier:'superior'},
  {label:'TCC e Pesquisa',subtitle:'Trabalhos, orientações, bancas, acervo e evidências PPC/ODS',icon:'📝',tabs:['tcc'],tier:'superior'},
  {label:'Atividades Complementares',subtitle:'Recebimento, análise, validação e contabilização de AC',icon:'📜',tabs:['atividades-complementares'],tier:'superior'},
  {label:'Estágio',subtitle:'Estágio obrigatório interno e externo com acompanhamento 360°',icon:'🏢',tabs:['estagio'],tier:'superior'},
  {label:'Governança',subtitle:'Órgãos colegiados, deliberações e fluxos',icon:'⚖',tabs:['governanca'],tier:'both'},
  {label:'Acompanhamento',subtitle:'Inclusão, PEI e regimes especiais',icon:'♿',tabs:['inclusao','acompanhamento-especial'],tier:'both'},
  {label:'Aquisições',subtitle:'Compras, fornecedores e ordens',icon:'🛒',tabs:['aquisicoes'],tier:'both'},
  {label:'ENEM & Vestibular',subtitle:'Simulados, desempenho por área e metas',icon:'🎯',tabs:['escola-enem'],tier:'escolas'},
  {label:'Egressos Escolar',subtitle:'Destino pós-escola e aprovações',icon:'🎓',tabs:['escola-egressos'],tier:'escolas'},
  {label:'Documentos',subtitle:'Gestão documental e análise por IA',icon:'📄',tabs:['documentos'],tier:'both'},
  {label:'Integrações',subtitle:'Saúde dos dados e sincronizações',icon:'⇄',tabs:['sync','integracao-ies'],tier:'both'},
  {label:'Financeiro',subtitle:'Contratos, faturamento e receita',icon:'💰',tabs:['conta','contrato','billing','modulos','catalogo']},
];

const TAB_DETAILS: Partial<Record<Tab,{icon:string;description:string}>> = {
  base:{icon:'⌂',description:'Estrutura e identificação institucional'},
  metas:{icon:'◎',description:'Metas, avanços e indicadores'},
  plano:{icon:'☷',description:'Ações, responsáveis e prazos'},
  diagnostico:{icon:'◈',description:'Achados e oportunidades de melhoria'},
  equipe:{icon:'♙',description:'Pessoas e atribuições'},
  emec:{icon:'▣',description:'Processos e registros regulatórios'},
  repositorio:{icon:'▤',description:'Documentos e validação das evidências'},
  biblioteca:{icon:'▥',description:'Acervo de referência regulatória'},
  avaliacao:{icon:'◇',description:'Instrumento institucional de 2017'},
  novo_instrumento:{icon:'✧',description:'Propostas e checklists de avaliação'},
  enade:{icon:'▦',description:'Indicadores e aprendizagem acadêmica'},
  geral:{icon:'▥',description:'Panorama dos cursos e matrículas'},
  visao:{icon:'↗',description:'Séries históricas e comparativos'},
  cadastro:{icon:'▧',description:'Oferta e dados cadastrais dos cursos'},
  eorbit:{icon:'⌘',description:'Dados acadêmicos espelhados'},
  backups:{icon:'▣',description:'Cópias e registros de origem'},
  auditoria:{icon:'▥',description:'Reprovações por curso e período'},
  fontes:{icon:'⇧',description:'Recebimento de extrações autorizadas'},
  conexoes:{icon:'⇄',description:'Vincular o banco ou sistema da IES'},
  ia:{icon:'✧',description:'Análise assistida dos documentos'},
  analise:{icon:'◫',description:'Diagnósticos para a gestão'},
  reitor:{icon:'◉',description:'Indicadores econômicos e financeiros da Direção'},
  'resultado-curso':{icon:'▤',description:'Resultado e desempenho por curso'},
  simulador:{icon:'▦',description:'Custos e cenários informados'},
  'raio-x-direito':{icon:'⌕',description:'Visão 360° do curso: matrículas, metas, ações, diagnóstico, extensão, CPA, egressos e inclusão'},
  'vitrine-curso':{icon:'🏆',description:'Vitrine do curso para avaliador MEC: pontos fortes organizados por dimensão do instrumento'},
  aprendizagem:{icon:'↔',description:'Acompanhamento da aprendizagem'},
  egressos:{icon:'🎓',description:'Egressos, empregabilidade e trajetória profissional'},
  extensao:{icon:'🤝',description:'Projetos de extensão, participantes, entregas e cobertura por curso'},
  governanca:{icon:'⚖',description:'NDE, Colegiado, reuniões, atas e deliberações'},
  inclusao:{icon:'♿',description:'Inclusão, PEI, acessibilidade e Núcleo de Apoio'},
  'acompanhamento-especial':{icon:'📋',description:'Regimes especiais, exercícios domiciliares e planos acadêmicos'},
  'cpa-autoavaliacao':{icon:'📊',description:'CPA: pesquisas, participação, resultados, planos e devolutivas'},
  tcc:{icon:'📝',description:'TCC e Produção Acadêmica: projetos, orientações, bancas, acervo, horas e evidências PPC/ODS'},
  'atividades-complementares':{icon:'📜',description:'Atividades complementares: regulamento, envio, análise IA, cálculo, validação, livro razão e secretaria'},
  estagio:{icon:'🏢',description:'Estágio obrigatório: concedentes, campos, planos, frequência, relatórios, avaliação e secretaria'},
  aquisicoes:{icon:'🛒',description:'Gestão de compras, fornecedores e ordens'},
  conta:{icon:'👤',description:'Pacote, faturas, módulos e dados do contrato'},
  contrato:{icon:'📜',description:'Termos, cláusulas e assinatura digital'},
  modulos:{icon:'⚙',description:'Ativar e desativar módulos por IES'},
  catalogo:{icon:'🛒',description:'Vitrine de módulos com preços e degustação'},
  'integracao-ies':{icon:'🔑',description:'Chave de API, dados autorizados e frequência de sincronização'},
  billing:{icon:'💰',description:'Contratos, faturas, MRR e pacotes comerciais'},
  'escola-enem':{icon:'🎯',description:'Histórico ENEM, simulados, competências, metas e ranking'},
  'escola-egressos':{icon:'🎓',description:'Para onde seus alunos foram: universidade, técnico, mercado'},
  validacao:{icon:'🤖',description:'Fila de pré-validação e espelhamento transversal de evidências'},
  documentos:{icon:'📄',description:'Upload, catalogação, vencimentos, conformidade e análise IA'},
  sync:{icon:'⇄',description:'Central de Sincronização e Integrações'},
};

const TABS: [Tab, string][] = [
  ["base", "Base da organização"],
  ["fontes", "Importar dados de sites"],
  ["conexoes", "Conexões de dados"],
  ["backups", "Backups Acadêmicos"],
  ["ia", "Análise Documental"],
  ["geral", "Visão geral"],
  ["analise", "Análise gerencial"],
  ["visao", "Matrículas"],
  ["cadastro", "Cadastro e cursos"],
  ["emec", "e-MEC · Regulação"],
  ["eorbit", "e-ORBIT · Espelho"],
  ["auditoria", "BI · Reprovações de Todos os Cursos"],
  ["metas", "Metas e indicadores"],
  ["repositorio", "Reconhecimento de Curso"],
  ["biblioteca", "Biblioteca INEP"],
  ["avaliacao", "Recredenciamento · Instrumento 2017"],
  ["novo_instrumento", "Novo Instrumento"],
  ["enade", "ENADE 360°"],
  ["aprendizagem", "Aprendizagem Conectada"],
  ["reitor", "Área da Direção · EBITDA"],
  ["resultado-curso", "Resultado por Curso"],
  ["simulador", "Simulador de Custo"],
  ["raio-x-direito", "Raio-X do Curso"],
  ["vitrine-curso", "Vitrine do Curso · Avaliador"],
  ["egressos", "Egressos 360°"],
  ["extensao", "Extensão 360°"],
  ["tcc", "TCC e Pesquisa 360°"],
  ["atividades-complementares", "Atividades Complementares 360°"],
  ["estagio", "Estágio Obrigatório 360°"],
  ["governanca", "Governança 360°"],
  ["cpa-autoavaliacao", "CPA e Autoavaliação"],
  ["inclusao", "Inclusão 360° · PEI"],
  ["acompanhamento-especial", "Acompanhamento Especial 360°"],
  ["aquisicoes", "Aquisições 360°"],
  ["conta", "Minha Conta"],
  ["contrato", "Meu Contrato"],
  ["modulos", "Gerenciar Módulos"],
  ["catalogo", "Catálogo de Módulos"],
  ["integracao-ies", "Configurar Integração"],
  ["billing", "Painel Financeiro"],
  ["escola-enem", "ENEM 360°"],
  ["escola-egressos", "Egressos Escolar"],
  ["validacao", "Validação Pendente"],
  ["documentos", "Gestão Documental"],
  ["sync", "Central de Sincronização"],
  ["plano", "Plano de ação 5W2H"],
  ["diagnostico", "Diagnóstico"],
  ["equipe", "Equipe"],
];

type Data = { courses: Row[]; goals: Row[]; measurements: Row[]; actions: Row[]; diagnosis: Row[]; requests:Row[]; files:Row[] };
const EMPTY: Data = { courses: [], goals: [], measurements: [], actions: [], diagnosis: [], requests:[], files:[] };

export default function Workspace({
  institution,
  role,
  overview,
  onBack,
  onChanged,
  stats,
}: {
  institution: Row;
  role: Role | null;
  overview: ReactNode;
  stats?: { enrolled: number; semester?: string };
  onBack: () => void;
  onChanged: () => void;
}) {
  const id = institution.id;
  const instTier = String((institution as any).tier || 'superior');
  const visibleGroups = TAB_GROUPS.filter(g => !g.tier || g.tier === 'both' || g.tier === instTier);
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("aba") as Tab | null;
    return t && TABS.some(([k]) => k === t) ? t : role === 'master' || role === 'gestor' ? 'base' : 'geral';
  });

  const [macroOverride, setMacroOverride] = useState<MacroTab | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [repositoryGoal,setRepositoryGoal]=useState("");
  const [instrumentUpload,setInstrumentUpload]=useState<{courseId:string;title:string;reference:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleSearch,setModuleSearch]=useState("");
  const [favoriteTabs,setFavoriteTabs]=useState<Tab[]>([]);
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [activeTabs,setActiveTabs]=useState<Set<string>>(new Set());
  const [moduleCatalog,setModuleCatalog]=useState<CatalogModule[]>([]);
  const [offerModule,setOfferModule]=useState<CatalogModule|null>(null);
  const [autoMeasures,setAutoMeasures]=useState<Map<string,{auto_current_value:number|null;progress_pct:number|null}>>(new Map());
  useEffect(()=>{
    getActiveTabs(id).then(setActiveTabs);
    getModuleCatalog(id).then(setModuleCatalog);
  },[id]);
  const reloadModules=()=>{getActiveTabs(id).then(setActiveTabs);getModuleCatalog(id).then(setModuleCatalog);};
  const toggleFavorite=(key:Tab)=>setFavoriteTabs(items=>items.includes(key)?items.filter(item=>item!==key):[...items,key]);


  const reload = useCallback(async () => {
    setError("");
    try {
      const [courses, goals, measurements, actions, diagnosis, requests, files] = await Promise.all([
        listByInstitution(TABLES.courses, id, "name"),
        listByInstitution(TABLES.goals, id),
        listByInstitution(TABLES.measurements, id, "measured_on"),
        listByInstitution(TABLES.actions, id, "due_date"),
        listByInstitution(TABLES.diagnosis, id),
        listRepository("vertice_repository_requests",id),
        listRepository("vertice_repository_files",id),
      ]);
      setData({ courses:displayCourseRows(courses,requests,goals), goals, measurements, actions, diagnosis, requests, files });
      // Load auto-measures for goals with automatic sources
      supabase.from('v_goals_with_auto_measure').select('id,auto_current_value,progress_pct').eq('institution_id', id).then(r => {
        if (r.data) { const m = new Map<string,{auto_current_value:number|null;progress_pct:number|null}>(); r.data.forEach((row: any) => m.set(row.id, { auto_current_value: row.auto_current_value, progress_pct: row.progress_pct })); setAutoMeasures(m); }
      });
    } catch {
      setError("Não foi possível carregar os dados de gestão. Atualize a página.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
    const timer=window.setInterval(()=>void reload(),30000);
    const focus=()=>void reload();window.addEventListener("focus",focus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus);};
  }, [reload]);

  const [moduleFocusRequest, setModuleFocusRequest] = useState(0);
  const moduleContentRef = useRef<HTMLDivElement>(null);
  const moduleNavigationRef = useRef<HTMLDivElement>(null);
  const revealModule = () => {
    if (role !== "master") return;
    setModuleFocusRequest(value => value + 1);
  };
  useEffect(() => {
    if (!moduleFocusRequest || role !== "master" || macroOverride) return;
    const frame = window.requestAnimationFrame(() => {
      const content = moduleContentRef.current;
      if (!content || content.hidden) return;
      content.focus({ preventScroll: true });
      moduleNavigationRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [moduleFocusRequest, role, macroOverride]);
  const edited = useRef(false);
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      if (params.get("instituicao") !== String(id)) return;
      const next = (params.get("aba") || (role === "master" || role === "gestor" ? "base" : "geral")) as Tab;
      if (next === tab || !TABS.some(([key]) => key === next)) return;
      if (edited.current && !window.confirm("Confira se salvou suas alterações antes de sair. Deseja continuar?")) {
        params.set("aba", tab);
        window.history.replaceState(null, "", "#" + params.toString());
        return;
      }
      edited.current = false;
      setMacroOverride(null);
      setTab(next);
      revealModule();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (edited.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [id, role, tab]);
  const confirmNavigation = () => !edited.current || window.confirm("Você editou campos nesta área. Confira se salvou suas alterações antes de sair. Deseja continuar?");
  const choose = (t: Tab) => {
    if (t === tab) { setMacroOverride(null); revealModule(); return true; }
    if (!confirmNavigation()) return false;
    setMacroOverride(null);
    edited.current = false;
    if (t !== "repositorio") setInstrumentUpload(null);
    setTab(t);
    revealModule();
    const p = new URLSearchParams(window.location.hash.slice(1));
    p.set("aba", t);
    p.set("instituicao", String(id));
    window.history.pushState(null, "", `#${p.toString()}`);
    return true;
  };

  const openInstrumentUpload = (courseId: string, title: string, reference: string) => {
    if (choose("repositorio")) {
      setRepositoryGoal("");
      setInstrumentUpload({courseId,title,reference});
    }
  };

  const recognitionRequests=data.requests.filter(r=>!["recredenciamento_2017","novo_instrumento_2026_institucional","novo_instrumento_2026_curso"].includes(String(r.repository_section??"")));
  const recognitionRequestIds=new Set(recognitionRequests.map(r=>String(r.id)));
  const recognitionFiles=data.files.filter(f=>recognitionRequestIds.has(String(f.request_id)));
  const documents=repositorySummary(recognitionRequests,recognitionFiles);
  const late = data.actions.filter(a => isLate(a.due_date, a.status)).length;
  const openFindings = data.diagnosis.filter(d => d.status !== "resolvido").length;
  const activeGoals = data.goals.filter(g => g.status === "ativa" || g.status === "planejada").length;
  const allowedTabs = visibleTabs(role);
  // Mostrar TODAS as tabs permitidas pelo role, incluindo bloqueadas (com badge)
  const visible = TABS.filter(([k]) => allowedTabs.includes(k));
  const availableWorkspaceTabs = visible.filter(([key]) => visibleGroups.some(group => group.tabs.includes(key)));
  const activeMacro = macroOverride ?? macroTabFor(tab);
  const activeMacroDefinition = MACRO_TABS.find(macro => macro.key === activeMacro)!;
  const selectMacro = (macro: MacroTab) => {
    const target = macroDestination(macro, availableWorkspaceTabs.map(([key]) => key), isLocked);
    if (target) {
      if (choose(target)) { setModuleSearch(""); setOnlyFavorites(false); }
    } else if (confirmNavigation()) {
      // Keep the original form mounted while presenting the existing activation controls.
      setMacroOverride(macro);
      setModuleSearch(""); setOnlyFavorites(false);
    }
  };
  const isLocked = (tabKey: string) => activeTabs.size > 0 && !activeTabs.has(tabKey);
  const isTasting = (tabKey: string) => {
    const mod = findModuleByTab(moduleCatalog, tabKey);
    return mod?.display_status === 'tasting';
  };

  const selectModule = (key: Tab) => {
    if (isLocked(key)) {
      const module = findModuleByTab(moduleCatalog, key);
      if (module) setOfferModule(module);
      return;
    }
    choose(key);
  };

  return (
    <section aria-labelledby="ws-title" className="area-ws">
      {role && tab !== "cadastro" && <RegistryContacts institutionId={id} courses={[]} manage={false} firstVisit/>}
      <p>
        <button className="corp-login-text-button" onClick={() => { if (confirmNavigation()) { edited.current = false; onBack(); } }}>
          ← Todas as instituições
        </button>
      </p>
      <div className="area-ws-head">
        <div>
          <h2 id="ws-title">
            {String(institution.name)}
            {institution.acronym ? <small> · {String(institution.acronym)}</small> : null}
          </h2>
          <p className="area-muted">
            Seu perfil nesta instituição: <strong>{role ? ROLE_LABEL[role] : "sem vínculo"}</strong>
            {institution.status === "arquivada" && <span className="badge gray"> Arquivada</span>}
          </p>
        </div>
        <a className="area-guide-link" href="/guia.html" target="_blank" rel="noopener">Guia e glossário ↗</a>
        {can.manageGoals(role)&&<button type="button" className="corp-button small" onClick={()=>{window.location.hash="governanca=1&instituicao="+encodeURIComponent(String(id));window.dispatchEvent(new HashChangeEvent("hashchange"));}}>Governança 360 · Auditar integrações ↗</button>}
        {(role !== "master" || activeMacro === "visao-geral") && <div className="area-kpis">
          <span className="kpi-neutral"><b>{data.courses.length}</b> cursos</span>
          <span className={activeGoals > 0 ? "kpi-info" : "kpi-neutral"}><b>{activeGoals}</b> metas em curso</span>
          <span className={documents.total > 0 && documents.validated === documents.total ? "kpi-success" : documents.total > 0 ? "kpi-warn" : "kpi-neutral"}><b>{documents.validated}/{documents.total}</b> documentos validados</span>
          <span className={late > 0 ? "kpi-danger" : "kpi-success"}><b>{late}</b> ações atrasadas</span>
          <span className={openFindings > 0 ? "kpi-warn" : "kpi-success"}><b>{openFindings}</b> achados abertos</span>
        </div>}
      </div>
      <Suspense fallback={null}>
        <ExtensaoDashboard institutionId={String(id)} onNavigate={() => { choose("extensao" as Tab); }} />
      </Suspense>
      <InstitutionTabs enabled={role === "master"} activeTab={tab} activeMacro={activeMacro} onSelectMacro={selectMacro} institutionName={String(institution.name)} availableMacros={MACRO_TABS.filter(m => m.tabs.some(key => availableWorkspaceTabs.some(([k]) => k === key))).map(m => m.key)}>
      <div ref={moduleNavigationRef} className="inst-module-workspace" onChangeCapture={e => { if ((e.target as HTMLElement).closest("input:not([type=search]), textarea, select")) edited.current = true; }}>
      {role === "master" && <InstitutionSubTabs
        macro={activeMacroDefinition}
        entries={availableWorkspaceTabs.filter(([key]) => macroTabFor(key) === activeMacro).map(([key, label]) => ({key, label, icon: TAB_DETAILS[key]?.icon, description: TAB_DETAILS[key]?.description, locked: isLocked(key), tasting: isTasting(key)}))}
        activeTab={macroOverride ? null : tab}
        onSelect={selectModule}
        query={moduleSearch} onQueryChange={setModuleSearch}
        favorites={favoriteTabs} onToggleFavorite={toggleFavorite}
        onlyFavorites={onlyFavorites} onToggleOnlyFavorites={() => setOnlyFavorites(value => !value)}
      />}
      {(role !== "master" || activeMacro === "visao-geral") && <>
      {id==="4224e2fc-6a96-4761-820f-6f8e809ca1c1" && (
        <div className="area-panel" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",borderLeft:"5px solid #298d87",background:"linear-gradient(100deg,#eaf7f4,#f7fbfd)"}}>
          <div>
            <strong style={{color:"#145b5f",fontSize:"1.08rem"}}>UNICALDAS · BI institucional e regulatório</strong>
            <p className="area-muted" style={{margin:"6px 0 0",maxWidth:720}}>Painel interativo com informações do cadastro e das consultas e-MEC já disponíveis. A cobertura regulatória é parcial; matrículas, notas, reprovações e evasão aguardam a restauração e validação do GIZ.</p>
          </div>
          <button type="button" className="corp-button" onClick={()=>choose("emec")}>Abrir BI da UNICALDAS →</button>
        </div>
      )}
      {data.courses.some(c=>c.registration_note)&&<p className="area-note">Há cadastros com o mesmo nome e código, mas com históricos próprios. Eles aparecem como Base 1 e Base 2, com suas quantidades de exigências e metas, para você escolher o acervo correto. Nenhum documento ou vínculo foi descartado.</p>}
      {can.manageGoals(role)&&Boolean(institution.cnpj)&&<CnpjConnections institutionId={id}/>}
      {(role==="master"||role==="gestor")&&
       <div className="area-panel" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div><strong>Agente de IA · Cruzamento de dados</strong><p className="area-muted" style={{margin:"4px 0 0"}}>Consulte divergências de matrículas, metas, documentos e vínculos autorizados por CNPJ.</p></div>
        <button type="button" className="corp-button" onClick={()=>{
          choose("base");
          const p=new URLSearchParams(window.location.hash.slice(1));p.set("assistente","1");
          window.history.replaceState(null,"","#"+p.toString());
          window.dispatchEvent(new Event("vertice-open-assistant"));
        }}>Abrir agente de IA</button>
       </div>}
      </>}
      {role !== "master" && <section className="vx-modules" aria-label="Central de Gestão Institucional">
        <header className="vx-modules-head">
          <div>
            <p className="vx-modules-eyebrow">VÉRTICE · MÓDULOS INSTITUCIONAIS</p>
            <h3>Central de Gestão Institucional</h3>
            <p>Escolha um módulo para consultar dados, documentos e ferramentas disponíveis à sua instituição.</p>
          </div>
          <div className="vx-modules-tools">
            <HelpLabel className="vx-modules-search">
              <span>Buscar módulo</span>
              <input type="search" value={moduleSearch} onChange={e=>setModuleSearch(e.target.value)} placeholder="Ex.: matrículas, recredenciamento..." aria-label="Buscar módulo" />
            </HelpLabel>
            <button type="button" className={onlyFavorites?"vx-modules-fav-filter selected":"vx-modules-fav-filter"} aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(value=>!value)}>
              {onlyFavorites?"★ Exibindo favoritos":"☆ Favoritos"}
            </button>
            {(moduleSearch||onlyFavorites)&&<button type="button" className="vx-modules-clear" onClick={()=>{setModuleSearch("");setOnlyFavorites(false);}}>Limpar</button>}
          </div>
        </header>
        <div className="vx-modules-grid" aria-label="Áreas da instituição">
          {visibleGroups.map(group => {
            const q=moduleSearch.trim().toLocaleLowerCase("pt-BR");
            const groupTabs = visible.filter(([k,l])=>group.tabs.includes(k)&&(!onlyFavorites||favoriteTabs.includes(k))&&(!q||[l,group.label,TAB_DETAILS[k]?.description??""].join(" ").toLocaleLowerCase("pt-BR").includes(q)));
            if(!groupTabs.length)return null;
            return <div className="vx-module-group" key={group.label}>
              <div className="vx-module-group-head">
                <span className="vx-module-group-icon" aria-hidden="true">{group.icon}</span>
                <div><h4>{group.label}</h4><p>{group.subtitle}</p></div>
                <span className="vx-module-counter">{groupTabs.length}</span>
              </div>
              <div className="vx-module-links">
                {groupTabs.map(([k,l])=>{
                  const active=tab===k,starred=favoriteTabs.includes(k),details=TAB_DETAILS[k];
                  const locked=isLocked(k), tasting=isTasting(k);
                  const handleClick=()=>{
                    if(locked){
                      const mod=findModuleByTab(moduleCatalog,k);
                      if(mod) setOfferModule(mod);
                      return;
                    }
                    choose(k);
                  };
                  return <div className={active?"vx-module-entry selected":locked?"vx-module-entry locked":"vx-module-entry"} key={k}>
                    <button type="button" aria-current={active ? "page" : undefined} className="vx-module-link" onClick={handleClick}>
                      <span className="vx-module-entry-icon" aria-hidden="true">{locked?"🔒":details?.icon??"◈"}</span>
                      <span className="vx-module-entry-copy"><strong>{l}</strong><small>{details?.description??"Abrir módulo institucional"}</small></span>
                      {locked && <span className="tab-locked-badge">Ativar</span>}
                      {tasting && <span className="tab-tasting-badge">Degustação</span>}
                      <span className="vx-module-arrow" aria-hidden="true">›</span>
                    </button>
                    <button type="button" className="vx-module-star" aria-label={(starred?"Remover ":"Adicionar ")+l+(starred?" dos favoritos":" aos favoritos")} aria-pressed={starred} title={starred?"Remover dos favoritos":"Adicionar aos favoritos"} onClick={()=>toggleFavorite(k)}>{starred?"★":"☆"}</button>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>
        {!visibleGroups.some(group=>visible.some(([k,l])=>group.tabs.includes(k)&&(!onlyFavorites||favoriteTabs.includes(k))&&(!moduleSearch.trim()||[l,group.label,TAB_DETAILS[k]?.description??""].join(" ").toLocaleLowerCase("pt-BR").includes(moduleSearch.trim().toLocaleLowerCase("pt-BR")))))&&
          <div className="vx-modules-empty"><strong>Nenhum módulo encontrado.</strong><p>Revise a pesquisa ou desative o filtro de favoritos. Os módulos exibidos respeitam seu perfil de acesso.</p></div>}
      </section>}
      {role === "master" && activeMacro === "historico" && <p className="area-note">Os registros disponíveis permanecem nos módulos desta área. Esta área não constitui um histórico consolidado de auditoria.</p>}
      {macroOverride && <p role="status" className="area-note">Os módulos desta área precisam ser ativados. Selecione um módulo acima para consultar as condições existentes.</p>}
      <div ref={moduleContentRef} hidden={Boolean(macroOverride)} tabIndex={-1} role="region" aria-labelledby={role === "master" ? "inst-active-module-title" : undefined} className={role === "master" ? "inst-active-module" : undefined}>
      {role === "master" && <header className="inst-active-module-head">
        <div><p>{activeMacroDefinition.label}</p><h3 id="inst-active-module-title">{TABS.find(([key]) => key === tab)?.[1] ?? "Painel institucional"}</h3></div>
      </header>}
      {tab === 'base' && <InstitutionAddress institutionId={id} manage={role==='master'}/>}
      {error && <p role="alert" className="area-error">{error}</p>}
      {MODULE_HELP.some(item=>item.key===tab) && <div className="vx-module-help"><span>Como usar esta área</span><ContextHelp title={TABS.find(([key])=>key===tab)?.[1] || "Módulo"} text={MODULE_HELP.find(item=>item.key===tab)?.text} /></div>}
      {TAB_HELP[tab] && tab!=="repositorio" && <TabHelp id={tab} />}
      {tab === "visao" ? (
        overview
      ) : loading ? (
        <p role="status">Carregando…</p>
      ) : tab === "fontes" ? (
        role==="master"||role==="gestor" ? <SourceUpload key={id} institutionId={id} institutionName={String(institution.name)} onBackups={()=>choose("backups")}/> : <p>O recebimento de extrações é restrito à gestão autorizada da IES.</p>
      ) : tab === "conexoes" ? (
        role==="master"||role==="gestor" ? <ConexoesDados key={"cx"+id} institutionId={id} institutionName={String(institution.name)} role={role}/> : <p>As conexões de dados são restritas à gestão da IES.</p>
      ) : tab === "backups" ? (
        role==="master"||role==="gestor" ? <AcademicBackups key={id} institutionId={id} institutionName={String(institution.name)}/> : <p>O acesso aos backups acadêmicos é restrito à gestão da instituição com segundo fator de autenticação.</p>
      ) : tab === "base" ? (
        role === 'master' || role === 'gestor' ? <><OrganizationBase key={id} institution={institution} data={data} dataError={!!error} onGo={choose}/><CostEvidence institutionId={id} onUpload={openInstrumentUpload} compact/><OneDriveEspelho key={"od"+id} institutionId={id} institutionName={String(institution.name)}/></> : <p>A Base da organização é reservada ao Master e ao Gestor.</p>
      ) : tab === "ia" ? (
        role !== "master" && role !== "gestor" ? <p role="alert">A análise por IA é restrita à alta gestão da instituição.</p> : error ? <p role="alert">Atualize os dados antes de iniciar uma análise.</p> : <DocumentAI key={id} institutionId={id} courses={data.courses} requests={recognitionRequests} files={recognitionFiles} onGo={choose}/>
      ) : tab === "analise" ? (
        error ? <p role="alert">Análise indisponível enquanto houver falha no carregamento. Atualize a página.</p> : <><ManagementReview key={id} data={data} courses={data.courses} institutionId={id} /><ApprovedSourcesBI institutionId={id}/></>
      ) : tab === "geral" ? (
        <OverviewTab data={data} stats={stats} onGo={choose} autoMeasures={autoMeasures} />
      ) : tab === "emec" ? (
        <EmecPanel key={id} institution={institution} role={role}/>
      ) : tab === "auditoria" ? (
        can.viewManagement(role) ? <AuditoriaPermanenciaBI key={id} institutionId={id} institutionName={String(institution.name)} /> : <p role="alert">A auditoria acadêmica é restrita à alta gestão autorizada.</p>
      ) : tab === "eorbit" ? (
        <PainelEorbit key={id} instituicaoId={id} instituicaoNome={String(institution.name)} />
      ) : tab === "cadastro" ? (
        <><RegistryTab institution={institution} role={role} courses={data.courses} reload={reload} onChanged={onChanged} />{(role==='master'||role==='gestor')&&<CostEvidence institutionId={id} onUpload={openInstrumentUpload}/>}</>
      ) : tab === "metas" ? (
        error ? <p role="alert">Painel de metas indisponível enquanto houver falha no carregamento. Atualize os dados.</p> : <GoalsTab key={id} institutionId={id} role={role} data={data} reload={reload} autoMeasures={autoMeasures} onRepository={goal=>{setRepositoryGoal(goal);choose("repositorio");}} />
      ) : tab === "repositorio" ? (
        <RepositoryTab institutionId={id} role={role} courses={data.courses} goals={data.goals} requests={data.requests.filter(r=>!["recredenciamento_2017","novo_instrumento_2026_institucional","novo_instrumento_2026_curso"].includes(String(r.repository_section??"")))} files={data.files.filter(f=>data.requests.some(r=>r.id===f.request_id&&!["recredenciamento_2017","novo_instrumento_2026_institucional","novo_instrumento_2026_curso"].includes(String(r.repository_section??""))))} reload={reload} goalFilter={repositoryGoal} setGoalFilter={setRepositoryGoal} initialCourseId={instrumentUpload?.courseId} initialUpload={!!instrumentUpload} initialDocumentTitle={instrumentUpload?.title} initialDocumentInstructions={instrumentUpload?.reference}/>
      ) : tab === "reitor" ? (
        role === "master" || role === "gestor" ? <EbitdaCalculator reserved={{institutionId:id,name:String(institution.name)}}/> : <p>Os dados financeiros são reservados ao Gestor da instituição e ao Master.</p>
      ) : tab === "aprendizagem" ? (
        <LearningConnected key={id} institutionId={id} courses={data.courses} role={role}/>
      ) : tab === "enade" ? (
        <><Enade360 key={id} institutionId={id} courses={data.courses} actions={data.actions} goals={data.goals} role={role} onPlan={()=>choose("plano")}/>
        <EnadeEligibility institutionId={id} courses={data.courses} role={role}/></>
      ) : tab === "novo_instrumento" ? (
        <NovoInstrumento institutionId={id} role={role} courses={data.courses} onUploadDocument={openInstrumentUpload} />
      ) : tab === "avaliacao" ? (
        <AvaliacaoInstitucional key={id} institutionId={id} role={role}/>
      ) : tab === "resultado-curso" ? (
        role === "master" || role === "gestor" ? <ResultadoCursoBI institutionId={id} institutionName={String(institution.name)}/> : <p>O módulo de resultado por curso é reservado ao Gestor da instituição e ao Master.</p>
      ) : tab === "simulador" ? (
        role === "master" || role === "gestor" ? <CostSimulator institutionId={id} onUploadDocument={openInstrumentUpload}/> : <p>O simulador de custo é reservado ao Gestor da instituição e ao Master.</p>
      ) : tab === "raio-x-direito" ? (
        <Suspense fallback={<p role="status">Carregando Raio-X…</p>}><CourseRaioX institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string, modality: c.modality as string, code: c.code as string }))} role={role||'master'} onNavigate={(t, cid) => { if (cid) { /* could set course filter */ } choose(t as Tab); }} /></Suspense>
      ) : tab === "vitrine-curso" ? (
        <Suspense fallback={<p role="status">Carregando Vitrine…</p>}><CourseShowcase institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string, modality: c.modality as string, code: c.code as string }))} role={role||'master'} onNavigate={(t) => choose(t as Tab)} /></Suspense>
      ) : tab === "egressos" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'egressos'); return <ModulePreview locked={isLocked('egressos')} tasting={isTasting('egressos')} tastingEnds={m?.tasting_ends} moduleCode="GEST_EGRESSOS" moduleName="Egressos 360°" moduleDescription="Acompanhamento longitudinal de egressos, empregabilidade e trajetória profissional." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1000} tier={m?.tier||'gestao'}><Egressos360 institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string, modality: c.modality as string }))} role={role as 'master' | 'gestor' | 'equipe'} /></ModulePreview>; })()
      ) : tab === "extensao" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'extensao'); return <ModulePreview locked={isLocked('extensao')} tasting={isTasting('extensao')} tastingEnds={m?.tasting_ends} moduleCode="ACAD_EXTENSAO" moduleName="Extensão 360°" moduleDescription="Repositório de projetos de extensão — participantes, entregas, cobertura por curso e dossiê regulatório." institutionId={id} estimatedFee={m?.estimated_monthly_fee||800} tier={m?.tier||'regulacao'}><Suspense fallback={<p role="status">Carregando Extensão 360°…</p>}><Extensao360 institutionId={id} role={role||'master'} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string }))} onBack={()=>choose('geral')} /></Suspense></ModulePreview>; })()
      ) : tab === "tcc" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'tcc'); return <ModulePreview locked={isLocked('tcc')} tasting={isTasting('tcc')} tastingEnds={m?.tasting_ends} moduleCode="ACAD_TCC" moduleName="TCC e Pesquisa 360°" moduleDescription="Acompanhamento de projetos, orientações, bancas, acervo, horas e evidências PPC/ODS." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1200} tier={m?.tier||'academico'}><Suspense fallback={<p role="status">Carregando TCC 360°…</p>}><Tcc360 institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string, modality: c.modality as string }))} role={role||'master'} onNavigate={(t) => choose(t as Tab)} /></Suspense></ModulePreview>; })()
      ) : tab === "atividades-complementares" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'atividades-complementares'); return <ModulePreview locked={isLocked('atividades-complementares')} tasting={isTasting('atividades-complementares')} tastingEnds={m?.tasting_ends} moduleCode="ACAD_AC" moduleName="Atividades Complementares 360°" moduleDescription="Recebimento, análise, validação e contabilização de atividades complementares com acesso discente." institutionId={id} estimatedFee={m?.estimated_monthly_fee||800} tier={m?.tier||'academico'}><Suspense fallback={<p role="status">Carregando AC 360°…</p>}><AtividadesComplementares360 institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string }))} role={role||'master'} onNavigate={(t) => choose(t as Tab)} /></Suspense></ModulePreview>; })()
      ) : tab === "estagio" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'estagio'); return <ModulePreview locked={isLocked('estagio')} tasting={isTasting('estagio')} tastingEnds={m?.tasting_ends} moduleCode="ACAD_ESTAGIO" moduleName="Estágio Obrigatório 360°" moduleDescription="Estágio obrigatório interno e externo com acompanhamento integral, frequência, avaliação e secretaria." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1200} tier={m?.tier||'academico'}><Suspense fallback={<p role="status">Carregando Estágio 360°…</p>}><Estagio360 institutionId={id} courses={data.courses.map((c: Row) => ({ id: c.id as string, name: c.name as string }))} role={role||'master'} onNavigate={(t) => choose(t as Tab)} /></Suspense></ModulePreview>; })()
      ) : tab === "governanca" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'governanca'); return <ModulePreview locked={isLocked('governanca')} tasting={isTasting('governanca')} tastingEnds={m?.tasting_ends} moduleCode="GEST_GOVERNANCA" moduleName="Governança 360°" moduleDescription="Órgãos colegiados, deliberações, atas e fluxos regulatórios." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1000} tier={m?.tier||'gestao'}><Governanca360 institutionId={id} role={role||'master'} /></ModulePreview>; })()
      ) : tab === "cpa-autoavaliacao" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'cpa-autoavaliacao'); return <ModulePreview locked={isLocked('cpa-autoavaliacao')} tasting={isTasting('cpa-autoavaliacao')} tastingEnds={m?.tasting_ends} moduleCode="GEST_CPA" moduleName="CPA e Autoavaliação" moduleDescription="Pesquisas, participação, resultados, planos, evidências e devolutivas à comunidade." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1500} tier={m?.tier||'gestao'}><Suspense fallback={<p role="status">Carregando CPA…</p>}><CpaAutoavaliacao institutionId={id} role={role as 'master'|'gestor'|'equipe'} /></Suspense></ModulePreview>; })()
      ) : tab === "inclusao" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'inclusao'); return <ModulePreview locked={isLocked('inclusao')} tasting={isTasting('inclusao')} tastingEnds={m?.tasting_ends} moduleCode="GEST_INCLUSAO" moduleName="Inclusão 360° · PEI" moduleDescription="Gestão de inclusão, acessibilidade, PEI e evidências regulatórias." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1000} tier={m?.tier||'gestao'}><Inclusao360 institutionId={id} role={role||'master'} /></ModulePreview>; })()
      ) : tab === "acompanhamento-especial" ? (
        (() => { const m=findModuleByTab(moduleCatalog,'acompanhamento-especial'); return <ModulePreview locked={isLocked('acompanhamento-especial')} tasting={isTasting('acompanhamento-especial')} tastingEnds={m?.tasting_ends} moduleCode="GEST_ACOMPANHAMENTO" moduleName="Acompanhamento Especial 360°" moduleDescription="Regimes especiais, exercícios domiciliares e planos acadêmicos." institutionId={id} estimatedFee={m?.estimated_monthly_fee||1000} tier={m?.tier||'gestao'}><AcompanhamentoEspecial360 institutionId={id} role={role||'master'} /></ModulePreview>; })()

      ) : tab === "aquisicoes" ? (
        (() => {
          const mod = findModuleByTab(moduleCatalog, 'aquisicoes');
          const locked = isLocked('aquisicoes');
          const tasting = isTasting('aquisicoes');
          return <ModulePreview locked={locked} tasting={tasting} tastingEnds={mod?.tasting_ends}
            moduleCode="GEST_AQUISICOES" moduleName="Aquisições 360°"
            moduleDescription="Gestão completa de compras, fornecedores, cotações e ordens de compra da sua IES."
            institutionId={id} estimatedFee={mod?.estimated_monthly_fee || 1000} tier={mod?.tier || 'gestao'}>
            <Aquisicoes360 institutionId={id} role={role || 'master'} />
          </ModulePreview>;
        })()
      ) : tab === "conta" ? (
        <MinhaConta institutionId={id} institutionName={String(institution.name)} />
      ) : tab === "modulos" ? (
        role === 'master' ? <ModuleManager /> : <p>Gerenciamento de módulos restrito ao administrador da plataforma.</p>
      ) : tab === "catalogo" ? (
        <ModuleCatalogShowcase institutionId={id} institutionTier={String((institution as any).tier || 'superior')} isMaster={role === 'master'} onActivated={() => { reloadModules(); }} />
      ) : tab === "integracao-ies" ? (
        <IntegrationSettings institutionId={id} institutionName={String(institution.name)} role={role} />
      ) : tab === "contrato" ? (
        <ContractView institutionId={id} institutionName={String(institution.name)} role={role||'master'} />
      ) : tab === "billing" ? (
        role === 'master' ? <BillingPanel /> : <p>Painel financeiro restrito ao administrador da plataforma.</p>
      ) : tab === "escola-enem" ? (
        <Enem360Escolar institutionId={id} isMaster={role === 'master'} courses={data.courses} role={role} />
      ) : tab === "escola-egressos" ? (
        <EgressosEscolar institutionId={id} isMaster={role === 'master'} />
      ) : tab === "validacao" ? (
        <PreValidationQueue institutionId={id} role={role ?? ''} />
      ) : tab === "documentos" ? (
        <DocumentManager institutionId={id} isMaster={role === 'master'} />
      ) : tab === "sync" ? (
        <SyncHealth institutionId={id} />
      ) : tab === "biblioteca" ? (
        <InepLibrary institutionId={id} />
      ) : tab === "plano" ? (
        error ? <p role="alert">Atualize os dados antes de preparar o plano.</p> : <ActionsTab key={id} institutionId={id} role={role} data={data} reload={reload} />
      ) : tab === "diagnostico" ? (
        <DiagnosisTab institutionId={id} role={role} data={data} reload={reload} onPlan={() => choose("plano")} />
      ) : (
        <><RegistryContacts institutionId={id} courses={data.courses} manage={can.manageTeam(role)}/><TeamTab institutionId={id} role={role} /></>
      )}
      {TAB_FAQ[tab] && <TabFaq id={tab} />}
      </div>
      </div>
      </InstitutionTabs>
      {offerModule && (
        <ModuleOffer
          module={{
            code: offerModule.code,
            name: offerModule.name,
            description: offerModule.description,
            tier: offerModule.tier,
            min_package: offerModule.min_package,
            estimated_fee: offerModule.addon_monthly_fee || offerModule.estimated_monthly_fee,
            tabs: offerModule.tabs,
          }}
          institutionId={id}
          currentPackage={moduleCatalog.find(m => m.display_status === 'active')?.min_package || 'essencial'}
          onClose={() => setOfferModule(null)}
          onActivated={() => { setOfferModule(null); reloadModules(); }}
        />
      )}
    </section>
  );
}

// ================================================================ utilidades de UI
function TabFaq({ id }: { id: string }) {
  const f = TAB_FAQ[id];
  return (
    <section className="area-faq" aria-labelledby={`faq-${id}`}>
      <h3 id={`faq-${id}`}>Perguntas frequentes · {f.label}</h3>
      {f.items.map(i => (
        <details key={i.q}>
          <summary>{i.q}</summary>
          <p>{i.a}</p>
        </details>
      ))}
      <p className="area-muted small">
        Não encontrou sua dúvida? <a href="/guia.html#perguntas-frequentes" target="_blank" rel="noopener">Veja o guia completo ↗</a>
      </p>
    </section>
  );
}
function TabHelp({ id }: { id: string }) {
  const h = TAB_HELP[id];
  const key = `vertice-help-${id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== "fechado"; } catch { return true; }
  });
  return (
    <details
      className="area-help"
      open={open}
      onToggle={e => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(o);
        try { localStorage.setItem(key, o ? "aberto" : "fechado"); } catch { /* sem armazenamento */ }
      }}
    >
      <summary>{h.title}</summary>
      {h.text.map(t => <p key={t}>{t}</p>)}
      <p><a href="/guia.html" target="_blank" rel="noopener">Ver o guia completo e o glossário ↗</a></p>
    </details>
  );
}

function useEditor<T = Row>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: (r: T | "new") => setEditing(r), close: () => setEditing(null) };
}

function RemoveButton({ onConfirm, label = "Remover", title }: { onConfirm: () => Promise<void>; label?: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="corp-login-text-button area-danger"
      disabled={busy}
      title={title}
      aria-label={title}
      onClick={async () => {
        if (!window.confirm("Remover este registro? A operação fica registrada na auditoria e não pode ser desfeita pela tela.")) return;
        setBusy(true);
        try {
          await onConfirm();
        } catch (e) {
          window.alert(explain(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </button>
  );
}

const courseOptions = (courses: Row[]): [string, string][] =>
  courses.map(c => [c.id, `${c.code ? `${c.code} · ` : ""}${c.display_name??c.name}`]);

// ================================================================ visão geral (estatísticas)
function Bar({ value, max = 100, tone = "" }: { value: number; max?: number; tone?: string }) {
  const p = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={`area-bar ${tone}`}><span style={{ width: `${p}%` }} /></div>;
}

function OverviewTab({ data, stats, onGo, autoMeasures }: { data: Data; stats?: { enrolled: number; semester?: string }; onGo: (t: Tab) => void; autoMeasures?: Map<string,{auto_current_value:number|null;progress_pct:number|null}> }) {
  const entries = goalSignals(data.goals, data.measurements, undefined, autoMeasures);
  const live = entries.filter(e => e.goal.status !== "cancelada");
  const acts = data.actions.filter(a => a.status !== "cancelada");
  const done = acts.filter(a => a.status === "concluida").length;
  const late = acts.filter(a => isLate(a.due_date, a.status));
  const soon = acts
    .filter(a => a.due_date && !isLate(a.due_date, a.status) && a.status !== "concluida")
    .filter(a => String(a.due_date) <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10))
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const byStatus = ACTION_STATUS.map(([k, l]) => ({ k, l, n: data.actions.filter(a => a.status === k).length }));
  const scored = data.diagnosis.filter(d => d.score !== null && d.score !== undefined && d.score !== "" && Number.isFinite(Number(d.score)));
  const avgScore = scored.length ? scored.reduce((s, d) => s + Number(d.score), 0) / scored.length : null;
  const dims = new Map<string, number[]>();
  for (const d of scored) {
    const k = String(d.dimension);
    if (!dims.has(k)) dims.set(k, []);
    dims.get(k)!.push(Number(d.score));
  }
  const highOpen = data.diagnosis.filter(d => d.priority === "alta" && d.status !== "resolvido").length;
  const recognition=data.requests.filter(r=>!["recredenciamento_2017","novo_instrumento_2026_institucional","novo_instrumento_2026_curso"].includes(String(r.repository_section??"")));
  const activeIds=new Set(recognition.map(r=>String(r.id)));
  const docs=repositorySummary(recognition,data.files.filter(f=>activeIds.has(String(f.request_id))));
  const activeCourses = data.courses.filter(c => (c.status ?? "ativo") === "ativo").length;
  const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <div className="area-executive">
      <header><small>ACOMPANHAMENTO INSTITUCIONAL</small><h3>Visão geral da gestão</h3><p>Acompanhe os resultados e abra cada área para tratar as pendências.</p></header>
      <div className="area-stat-grid">
        <article><small>Vida acadêmica</small><b>{stats ? stats.enrolled.toLocaleString("pt-BR") : "—"}</b><span>Matriculados{stats?.semester ? ` em ${stats.semester}` : ""} · {activeCourses} cursos ativos</span><button className="corp-login-text-button" onClick={() => onGo("visao")}>Ver matrículas →</button></article>
        <article className={docs.late ? "warn" : ""}><small>Evidências validadas</small><b>{docs.validated} / {docs.total}</b><span>{docs.pending} sem envio · {docs.late} em atraso · {docs.nsa} NSA</span><button className="corp-login-text-button" onClick={() => onGo("repositorio")}>Abrir Reconhecimento de Curso →</button></article>
        <article className={late.length ? "warn" : ""}><small>Execução do plano</small><b>{done} / {acts.length}</b><span>Ações concluídas · {late.length} atrasadas · {soon.length} a vencer em 30 dias</span><button className="corp-login-text-button" onClick={() => onGo("plano")}>Abrir plano →</button></article>
        <article className={highOpen ? "warn" : ""}><small>Diagnóstico institucional</small><b>{avgScore === null ? "—" : `${fmt1(avgScore)} / 5`}</b><span>{scored.length} critérios com nota · {highOpen} achados prioritários em aberto</span><button className="corp-login-text-button" onClick={() => onGo("diagnostico")}>Abrir diagnóstico →</button></article>
      </div>
      <div className="area-overview-grid">
        <section className="area-panel">
          <div className="area-panel-head"><h3>Semáforo das metas</h3><button className="corp-login-text-button" onClick={() => onGo("metas")}>Abrir metas →</button></div>
          <p>{live.length} metas em acompanhamento</p>
          <div className="area-executive-signals">{(["red", "amber", "green"] as const).map(signal => <div key={signal} data-tone={signal}><b>{entries.filter(e => e.signal === signal).length}</b><span>{GOAL_SIGNALS.find(item => item.key === signal)?.label}</span></div>)}</div>
        </section>

        <section className="area-panel">
          <div className="area-panel-head"><h3>Ações por situação</h3><button className="corp-login-text-button" onClick={() => onGo("plano")}>Abrir plano</button></div>
          {!data.actions.length ? <p className="area-muted">Nenhuma ação cadastrada.</p> : (
            <>
              <div className="area-stack" aria-label="Distribuição das ações por situação">
                {byStatus.filter(s => s.n).map(s => <span key={s.k} className={`st-${s.k}`} style={{ flex: s.n }} title={`${s.l}: ${s.n}`} />)}
              </div>
              <ul className="area-legend">
                {byStatus.map(s => <li key={s.k}><i className={`st-${s.k}`} />{s.l}<b>{s.n}</b></li>)}
              </ul>
            </>
          )}
          {(late.length > 0 || soon.length > 0) && (
            <>
              <h4 className="area-subhead">Prazos</h4>
              <ul className="area-deadlines">
                {late.slice(0, 5).map(a => <li key={a.id} className="warn"><span>{String(a.what)}</span><b>venceu {fmtDate(a.due_date)}</b></li>)}
                {soon.slice(0, 5).map(a => <li key={a.id}><span>{String(a.what)}</span><b>{fmtDate(a.due_date)}</b></li>)}
              </ul>
            </>
          )}
        </section>

        <section className="area-panel">
          <div className="area-panel-head"><h3>Diagnóstico por dimensão</h3><button className="corp-login-text-button" onClick={() => onGo("diagnostico")}>Abrir diagnóstico</button></div>
          {!dims.size ? <p className="area-muted">Nenhum critério com nota.</p> : [...dims.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([k, v]) => {
            const m = v.reduce((s, x) => s + x, 0) / v.length;
            return (
              <div key={k} className="area-ov-row">
                <div className="area-ov-label"><span>{k}</span><b>{fmt1(m)} / 5</b></div>
                <Bar value={m} max={5} tone={m < 3 ? "warn" : ""} />
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

// ================================================================ cadastro
export const INSTITUTION_FIELDS: Field[] = withHelp([
  { name: "name", label: "Nome da instituição", required: true, wide: true },
  { name: "acronym", label: "Sigla" },
  { name: "cnpj", label: "CNPJ completo (numérico ou alfanumérico)", placeholder: "00.000.000/0001-00" },
  { name: "emec_code", label: "Código e-MEC" },
  { name: "maintainer", label: "Mantenedora", wide: true },
  { name: "city", label: "Município" },
  { name: "state", label: "UF", type: "select", options: UF },
  { name: "status", label: "Situação", type: "select", required: true, options: [["ativa", "Ativa"], ["arquivada", "Arquivada"]] },
  { name: "notes", label: "Observações", type: "textarea" },
], FIELD_HELP.institution);
const COURSE_FIELDS: Field[] = withHelp([
  { name: "name", label: "Nome do curso", required: true, wide: true },
  { name: "code", label: "Código (e-MEC ou interno)" },
  { name: "degree", label: "Grau", type: "select", options: DEGREE },
  { name: "modality", label: "Modalidade", type: "select", options: MODALITY },
  { name: "status", label: "Situação", type: "select", required: true, options: COURSE_STATUS },
  { name: "vacancies", label: "Vagas autorizadas", type: "number", min: 0, step: "1" },
  { name: "coordinator", label: "Coordenação" },
], FIELD_HELP.course);

function RegistryTab({ institution, role, courses, reload, onChanged }: { institution: Row; role: Role | null; courses: Row[]; reload: () => Promise<void>; onChanged: () => void }) {
  const [editInst, setEditInst] = useState(false);
  const ed = useEditor();
  const [q, setQ] = useState("");
  const classification = useCourseFilters(courses);
  const list = courses.filter(classification.matches).filter(c => `${c.code ?? ""} ${c.display_name??c.name}`.toLowerCase().includes(q.toLowerCase()));
  const cnpj = institution.cnpj ? String(institution.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—";
  return (
    <>
      <RegistryContacts institutionId={institution.id} courses={courses} manage={role==="master"||role==="gestor"}/>
      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Dados da instituição</h3>
          {can.editInstitution(role) && !editInst && <button className="corp-login-text-button" onClick={() => setEditInst(true)}>Editar</button>}
        </div>
        {editInst ? (
          <RecordForm institutionId={String(institution.id)}
            title="Editar instituição"
            fields={INSTITUTION_FIELDS}
            initial={{ ...institution, status: institution.status ?? "ativa" }}
            onCancel={() => setEditInst(false)}
            onSubmit={async v => {
              await saveRow(TABLES.institutions, v, institution.id);
              setEditInst(false);
              onChanged();
            }}
          />
        ) : (
          <dl className="area-dl">
            <div><dt>Sigla</dt><dd>{String(institution.acronym ?? "—")}</dd></div>
            <div><dt>CNPJ<ContextHelp title="CNPJ" /></dt><dd>{cnpj}</dd></div>
            <div><dt>Código e-MEC<ContextHelp title="Código e-MEC" /></dt><dd>{String(institution.emec_code ?? "—")}</dd></div>
            <div><dt>Mantenedora</dt><dd>{String(institution.maintainer ?? "—")}</dd></div>
            <div><dt>Município/UF</dt><dd>{[institution.city, institution.state].filter(Boolean).join("/") || "—"}</dd></div>
            <div><dt>Situação</dt><dd>{institution.status === "arquivada" ? "Arquivada" : "Ativa"}</dd></div>
            {institution.notes ? <div className="wide"><dt>Observações</dt><dd>{String(institution.notes)}</dd></div> : null}
          </dl>
        )}
      </div>

          <BrandingPanel institution={institution} canEdit={can.editInstitution(role)} onChanged={onChanged} />
          {(role==='master'||role==='gestor') && <ThemeEditor institutionId={String(institution.id)} isMaster={role==='master'} />}

      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Cursos ({list.length} de {courses.length})</h3>
          {can.manageCourses(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Novo curso</button>}
        </div>
        {ed.editing && (
          <RecordForm institutionId={String(institution.id)}
            title={ed.editing === "new" ? "Novo curso" : "Editar curso"}
            fields={COURSE_FIELDS}
            initial={ed.editing === "new" ? { status: "ativo", modality: "presencial" } : ed.editing}
            onCancel={ed.close}
            onSubmit={async v => {
              await saveRow(TABLES.courses, ed.editing === "new" ? { ...v, institution_id: institution.id } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
              ed.close();
              await reload();
              onChanged();
            }}
          />
        )}
        <div className="area-inline">{classification.controls}</div>
        <HelpLabel className="area-search">Buscar curso <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome ou código" /></HelpLabel>
        {!courses.length ? (
          <p className="area-muted">Nenhum curso cadastrado.</p>
        ) : !list.length ? (
          <p className="area-muted">Nenhum curso corresponde aos filtros.</p>
        ) : (
          <div className="table-scroll">
            <table className="area-table">
              <thead><tr><th>Código</th><th>Curso<ContextHelp title="Curso" /></th><th>Grau</th><th>Modalidade<ContextHelp title="Modalidade" /></th><th>Situação</th><th>Vagas</th><th>Coordenação</th><th /></tr></thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id}>
                    <td>{String(c.code ?? "—")}</td>
                    <td>{String(c.display_name??c.name)}</td>
                    <td>{courseClassification(c, "degree")}</td>
                    <td>{courseClassification(c, "modality")}</td>
                    <td>{courseClassification(c, "status")}</td>
                    <td>{fmtNum(c.vacancies)}</td>
                    <td>{String(c.coordinator ?? "—")}</td>
                    <td className="area-row-actions">
                      {can.manageCourses(role) && <button className="corp-login-text-button" onClick={() => ed.open(c)}>Editar</button>}
                      {can.deleteCourse(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.courses, c.id); await reload(); onChanged(); }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="area-muted">Cursos com matrículas importadas não podem ser removidos; use a situação “Em extinção” ou “Extinto”.</p>
      </div>
    </>
  );
}

// ================================================================ metas
function goalFields(courses: Row[],members:{user_id:string;email:string}[]): Field[] {
  return withHelp([
    { name: "title", label: "Meta", required: true, wide: true, placeholder: "Ex.: Reduzir a evasão do 1º ano" },
    { name: "indicator", label: "Indicador", required: true, placeholder: "Ex.: Taxa de evasão anual" },
    { name: "course_id", label: "Curso (opcional)", type: "select", options: courseOptions(courses) },
    { name: "unit", label: "Unidade", placeholder: "%, alunos, nota…" },
    { name: "direction", label: "Sentido desejado", type: "select", required: true, options: DIRECTION },
    { name: "baseline", label: "Linha de base", type: "number" },
    { name: "baseline_date", label: "Data da linha de base", type: "date" },
    { name: "target", label: "Alvo", type: "number", required: true },
    { name: "due_date", label: "Prazo", type: "date" },
    { name: "frequency", label: "Periodicidade de medição", type: "select", options: FREQUENCY },
    { name: "owner_user_id", label: "Conta do coordenador / responsável", type:"select", options:members.map(m=>[m.user_id,m.email]) },
    { name: "owner_name", label: "Nome do responsável (opcional)" },
    { name: "status", label: "Situação", type: "select", required: true, options: GOAL_STATUS },
    { name: "source", label: "Fonte do dado", wide: true, placeholder: "Ex.: relatório e-ORBIT, CPA, secretaria" },
    { name: "formula", label: "Regra de cálculo", type: "textarea", placeholder: "Ex.: evadidos no ano ÷ matriculados no início do ano × 100" },
    { name: "notes", label: "Observações", type: "textarea" },
  ], FIELD_HELP.goal);
}
const MEASUREMENT_FIELDS: Field[] = withHelp([
  { name: "measured_on", label: "Data da medição", type: "date", required: true },
  { name: "value", label: "Valor medido", type: "number", required: true },
  { name: "source", label: "Fonte" },
  { name: "note", label: "Observação", type: "textarea" },
], FIELD_HELP.measurement);

function GoalsTab({ institutionId, role, data, reload, onRepository, autoMeasures }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void>; onRepository:(goalId:string)=>void; autoMeasures: Map<string,{auto_current_value:number|null;progress_pct:number|null}> }) {
  const [goalMembers,setGoalMembers]=useState<{user_id:string;email:string}[]>([]);
  useEffect(()=>{let active=true;if(can.manageGoals(role))Promise.all([supabase.rpc("vertice_team",{target:institutionId}),supabase.auth.getUser()]).then(([team,user])=>{if(!active)return;const rows=(team.data??[]) as {user_id:string;email:string;role:string}[];const allowed=rows.filter(m=>["gestor","equipe"].includes(m.role));if(user.data.user&&!allowed.some(m=>m.user_id===user.data.user!.id))allowed.unshift({user_id:user.data.user.id,email:user.data.user.email??"Minha conta",role:"master"});setGoalMembers(allowed);});return()=>{active=false;};},[institutionId,role]);
  const ed = useEditor();
  const [measuring, setMeasuring] = useState<Row | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [course, setCourse] = useState("");
  const [courseSearch,setCourseSearch]=useState("");
  const [coursePage,setCoursePage]=useState(0);
  const [signalFilter, setSignalFilter] = useState<GoalSignal | "">("");
  const [goalSearch, setGoalSearch] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ed.editing || measuring) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [ed.editing, measuring]);
  const referenceDate = goalSignalDate();
  useEffect(()=>setCoursePage(0),[courseSearch, course, signalFilter, goalSearch]);
  const entries = useMemo(() => goalSignals(data.goals, data.measurements, referenceDate, autoMeasures), [data.goals, data.measurements, referenceDate, autoMeasures]);
  const courseName = (cid: unknown) => data.courses.find(c => c.id === cid)?.display_name ?? data.courses.find(c => c.id === cid)?.name;
  const classification = useCourseFilters(data.courses, () => setCoursePage(0));
  const courseRows=data.courses.filter(classification.matches).filter(c=>`${c.display_name??c.name} ${c.code??""} ${c.modality??""}`.toLocaleLowerCase("pt-BR").includes(courseSearch.toLocaleLowerCase("pt-BR")));
  const selectedCourseIds = new Set(courseRows.map(c => c.id));
  const institutionIncluded = !courseSearch && !classification.active;
  const scopeEntries = entries.filter(e => course === "institution" ? !e.goal.course_id : course ? e.goal.course_id === course : e.goal.course_id ? selectedCourseIds.has(String(e.goal.course_id)) : institutionIncluded);
  const filteredEntries = scopeEntries.filter(e => (!signalFilter || e.signal === signalFilter) && (!course || `${e.goal.title} ${e.goal.indicator}`.toLocaleLowerCase("pt-BR").includes(goalSearch.toLocaleLowerCase("pt-BR"))));
  const entryMap = new Map(entries.map(e => [e.goal.id, e]));
  const groupedEntries = new Map<string, typeof entries>();
  for (const entry of scopeEntries) {
    const id = String(entry.goal.course_id || "institution");
    if (!groupedEntries.has(id)) groupedEntries.set(id, []);
    groupedEntries.get(id)!.push(entry);
  }
  const groups = [
    ...(institutionIncluded && groupedEntries.has("institution") ? [{ id: "institution", name: "Metas institucionais", code: "IES", modality: "" } as Row] : []),
    ...courseRows,
  ].map(c => {
    const rows = groupedEntries.get(c.id) ?? [];
    const stats = summarizeGoalSignals(rows);
    const signal: GoalSignal = stats.counts.red ? "red" : stats.counts.amber ? "amber" : stats.counts.green ? "green" : "gray";
    return { course: c, rows, stats, signal };
  }).filter(g => !signalFilter || g.stats.counts[signalFilter] > 0)
    .sort((a,b) => GOAL_SIGNALS.findIndex(s=>s.key===a.signal)-GOAL_SIGNALS.findIndex(s=>s.key===b.signal) || String(a.course.display_name??a.course.name).localeCompare(String(b.course.display_name??b.course.name),"pt-BR"));
  const goals = filteredEntries.slice().sort((a,b) => GOAL_SIGNALS.findIndex(s=>s.key===a.signal)-GOAL_SIGNALS.findIndex(s=>s.key===b.signal) || (a.daysLeft??Infinity)-(b.daysLeft??Infinity)).map(e => e.goal);
  const pageCount=Math.max(1,Math.ceil((course ? goals.length : groups.length)/12));
  const currentPage=Math.min(coursePage,pageCount-1);
  const chooseCourse = (id: string) => { setCourse(id); setGoalSearch(""); ed.close(); setMeasuring(null); setOpen(null); };

  return (
    <div className="area-panel goals-panel">
      <div className="area-panel-head">
        <div><p className="goals-eyebrow">PAINEL DE ACOMPANHAMENTO</p><h3>Metas e indicadores<ContextHelp title="Metas e indicadores" /></h3></div>
        <div className="area-inline">
          <select aria-label="Filtrar por curso" value={course} onChange={e => chooseCourse(e.target.value)}>
            <option value="">Toda a instituição</option>
            <option value="institution">Somente metas institucionais</option>
            {courseOptions(data.courses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {can.manageGoals(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Nova meta</button>}
        </div>
      </div>
      {!course && <div className="goals-toolbar"><div className="area-inline">{classification.controls}<HelpLabel className="area-search">Buscar curso<input value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} placeholder="Nome, código ou modalidade"/></HelpLabel></div></div>}
      {course && <p className="goals-back"><button className="corp-login-text-button" onClick={()=>{chooseCourse("");setSignalFilter("");}}>← Visão de todos os cursos</button></p>}
      <GoalsDashboard entries={scopeEntries} filter={signalFilter} onFilter={setSignalFilter} referenceDate={referenceDate} courseLabel={id=>id ? String(courseName(id)||"Curso vinculado") : "Institucional"} onOpen={entry=>{chooseCourse(String(entry.goal.course_id||"institution"));setSignalFilter("");setGoalSearch(String(entry.goal.title));}} />
      <div ref={formRef}>
      {ed.editing && (
        <RecordForm institutionId={institutionId}
          key={ed.editing === "new" ? `new-${course}` : ed.editing.id}
          title={ed.editing === "new" ? "Nova meta" : "Editar meta"}
          fields={goalFields(data.courses,goalMembers)}
          initial={ed.editing === "new" ? { direction: "aumentar", status: "ativa", course_id: course === "institution" ? "" : course } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            await saveRow(TABLES.goals, ed.editing === "new" ? { ...v, institution_id: institutionId } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {measuring && (
        <RecordForm institutionId={institutionId}
          key={measuring.id}
          title={`Registrar medição · ${String(measuring.indicator)}`}
          fields={MEASUREMENT_FIELDS}
          initial={{ measured_on: today(), source: measuring.source ?? "" }}
          submitLabel="Registrar"
          onCancel={() => setMeasuring(null)}
          onSubmit={async v => {
            await saveRow(TABLES.measurements, { ...v, goal_id: measuring.id, institution_id: institutionId });
            setOpen(measuring.id);
            setMeasuring(null);
            await reload();
          }}
        />
      )}
      </div>
      <div className="goals-list-heading"><h4>{course ? (course === "institution" ? "Metas institucionais" : String(courseName(course) || "Metas do curso")) : "Acompanhamento por curso"}</h4><span className="area-muted small">{course ? `${goals.length} meta(s)` : `${groups.length} grupo(s)`}{signalFilter ? ` · ${GOAL_SIGNALS.find(s=>s.key===signalFilter)!.label}` : ""}</span>{signalFilter && <button className="corp-login-text-button" onClick={()=>setSignalFilter("")}>Limpar filtro de alerta</button>}</div>
      {course && <HelpLabel className="area-search">Buscar meta ou indicador<input value={goalSearch} onChange={e=>setGoalSearch(e.target.value)} placeholder="Título ou indicador"/></HelpLabel>}
      {!course ? <>
        <p className="area-muted small">Cursos com alertas aparecem primeiro. “Planejada” indica proposta sujeita à pactuação; não significa atividade iniciada.</p>
        {!groups.length && <p className="goals-empty">Nenhum curso ou meta corresponde aos filtros.</p>}
        <div className="goals-course-grid">
          {groups.slice(currentPage*12,currentPage*12+12).map(({course:c,rows,stats,signal})=><article key={c.id} className={`goals-course-card ${signal}`}>
            <GoalSignalBadge signal={signal} label={stats.total ? undefined : "Sem metas"}/>
            <div><h4>{String(c.display_name??c.name)}</h4><small>{String(c.code??"Sem código")}{c.modality ? ` · ${label(MODALITY,c.modality)}` : ""}</small></div>
            <div className="goals-course-count"><strong>{stats.total}</strong><span>meta(s) cadastrada(s)</span></div>
            <GoalSignalBar entries={rows}/>
            <div className="goals-course-metrics"><span>{stats.counts.red} vencida(s)</span><span>{stats.counts.amber} em atenção</span><span>{stats.counts.green} em dia / concluída(s)</span>{stats.counts.gray>0&&<span>{stats.counts.gray} cancelada(s)</span>}</div>
            <div className="goals-course-meta"><span>{stats.measured}/{stats.active} abertas com medição</span><span>{stats.active-stats.owners} sem responsável</span></div>
            <button className="corp-login-text-button" onClick={()=>chooseCourse(c.id)} aria-label={`Ver metas de ${String(c.display_name??c.name)}`}>Ver metas →</button>
          </article>)}
        </div>
      </> : !goals.length ? (
        <p className="goals-empty">Nenhuma meta corresponde a este recorte.{can.manageGoals(role) && !scopeEntries.length ? " Cadastre uma meta para iniciar o acompanhamento." : ""}</p>
      ) : (
        <div className="area-cards">
          {goals.slice(currentPage*12,currentPage*12+12).map(g => {
            const entry = entryMap.get(g.id)!;
            const ms = entry.history;
            const last = entry.value;
            const p = entry.progress;
            const docs=repositorySummary(data.requests.filter(r=>r.goal_id===g.id),data.files);
            return (
              <article key={g.id} className={`area-card goals-goal-card ${entry.signal}`}>
                <div className="area-card-top">
                  <GoalSignalBadge signal={entry.signal}/>
                  <small>{label(GOAL_STATUS,g.status)}{g.course_id ? ` · ${String(courseName(g.course_id)||"Curso vinculado")}` : " · Institucional"}</small>
                </div>
                <h4>{String(g.title)}</h4>
                <p className="goals-alert-reason">{entry.reasons.join(" ")}</p>
                <p className="area-muted">Documentos: {docs.sent}/{docs.total} com envio · {docs.validated} validados · {docs.pending} pendentes · {docs.late} em atraso · {docs.nsa} NSA</p>
                <p className="area-muted">{String(g.indicator)}{g.owner_name||g.owner_email ? ` · ${String(g.owner_name||g.owner_email)}` : ""}</p>
                {(Boolean(g.formula)||Boolean(g.source)||Boolean(g.notes))&&<details className="area-goal-details"><summary>Plano e critérios da meta</summary>{Boolean(g.formula)&&<p><strong>Cálculo:</strong> {String(g.formula)}</p>}{Boolean(g.source)&&<p><strong>Fonte:<ContextHelp title="Fonte:" /></strong> {String(g.source)}</p>}{Boolean(g.notes)&&<p style={{whiteSpace:"pre-wrap"}}>{String(g.notes)}</p>}</details>}
                <div className="area-goal-numbers">
                  <div><small>Linha de base</small><b>{fmtNum(g.baseline, g.unit)}</b></div>
                  <div><small>Última medição</small><b>{fmtNum(last, g.unit)}</b></div>
                  <div><small>Alvo ({label(DIRECTION, g.direction).toLowerCase()})</small><b>{fmtNum(g.target, g.unit)}</b></div>
                  <div><small>Prazo</small><b>{fmtDate(g.due_date)}</b></div>
                </div>
                <div className="area-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p ?? undefined} aria-label={p === null ? "Progresso indisponível" : `Progresso ${p}%`}>
                  <span style={{ width: `${p ?? 0}%` }} />
                </div>
                <p className="area-muted small">{p === null ? "Progresso indisponível: confira medição, alvo e sentido." : g.direction === "manter" ? `${p}% · manutenção na faixa de ±5% do alvo (±0,5 para alvo zero).` : `${p}% do caminho entre a linha de base e o alvo.`}</p>
                <div className="area-row-actions">
                  <button className="corp-login-text-button" onClick={()=>onRepository(g.id)}>Documentos da meta ({docs.total})</button>
                  {can.record(role) && <button className="corp-login-text-button" onClick={() => setMeasuring(g)}>Registrar medição</button>}
                  <button className="corp-login-text-button" onClick={() => setOpen(open === g.id ? null : g.id)}>Histórico ({ms.length})</button>
                  {can.manageGoals(role) && <button className="corp-login-text-button" onClick={() => ed.open(g)}>Editar</button>}
                  {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.goals, g.id); await reload(); }} />}
                </div>
                {open === g.id && (
                  <div className="table-scroll">
                    {!ms.length ? <p className="area-muted">Sem medições.</p> : (
                      <table className="area-table compact">
                        <thead><tr><th>Data</th><th>Valor</th><th>Fonte<ContextHelp title="Fonte" /></th><th>Observação</th><th /></tr></thead>
                        <tbody>
                          {ms.slice().reverse().map(m => (
                            <tr key={m.id}>
                              <td>{fmtDate(m.measured_on)}</td><td>{fmtNum(m.value, g.unit)}</td><td>{String(m.source ?? "—")}</td><td>{String(m.note ?? "")}</td>
                              <td>{can.remove(role) && <RemoveButton label="✕" title="Remover medição" onConfirm={async () => { await deleteRow(TABLES.measurements, m.id); await reload(); }} />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {g.formula ? <p className="area-muted small">Regra de cálculo: {String(g.formula)}</p> : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {pageCount>1&&<div className="area-inline goals-pagination"><button className="corp-login-text-button" disabled={!currentPage} onClick={()=>setCoursePage(currentPage-1)}>Anterior</button><span>Página {currentPage+1} de {pageCount}</span><button className="corp-login-text-button" disabled={currentPage>=pageCount-1} onClick={()=>setCoursePage(currentPage+1)}>Próxima</button></div>}
    </div>
  );
}

// ================================================================ plano 5W2H
function actionFields(data: Data): Field[] {
  const scopeName=(id:unknown)=>String(data.courses.find(c=>c.id===id)?.display_name??data.courses.find(c=>c.id===id)?.name??"Institucional");
  return withHelp([
    { name: "what", label: "O quê (ação)", required: true, wide: true },
    { name: "why", label: "Por quê", type: "textarea" },
    { name: "goal_id", label: "Meta relacionada", type: "select", options: data.goals.map(g => [g.id, scopeName(g.course_id)+" · "+String(g.title)]) },
    { name: "finding_id", label: "Achado do diagnóstico", type: "select", options: data.diagnosis.map(d => [d.id, scopeName(d.course_id)+" · "+String(d.criterion)]) },
    { name: "course_id", label: "Curso", type: "select", options: courseOptions(data.courses) },
    { name: "who", label: "Quem (responsável)" },
    { name: "where_at", label: "Onde" },
    { name: "start_date", label: "Início", type: "date" },
    { name: "due_date", label: "Quando (prazo)", type: "date" },
    { name: "how", label: "Como", type: "textarea" },
    { name: "how_much", label: "Quanto custa" },
    { name: "status", label: "Situação", type: "select", required: true, options: ACTION_STATUS },
    { name: "progress", label: "Avanço (%)", type: "number", min: 0, max: 100, step: "5" },
    { name: "evidence", label: "Evidência de execução", type: "textarea", placeholder: "Ata, documento, link interno, registro…" },
  ], FIELD_HELP.action);
}

function ActionsTab({ institutionId, role, data, reload }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void> }) {
  const ed = useEditor();
  const [filter, setFilter] = useState("abertas");
  const [actionView,setActionView] = useState<"kanban"|"tabela">("kanban");
  const [actionSaveError,setActionSaveError] = useState("");
  const [prefill,setPrefill] = useState<Record<string,unknown>>(()=>parseActionDraft(sessionStorage.getItem(actionDraftKey(institutionId)),institutionId));
  useEffect(()=>{sessionStorage.removeItem(actionDraftKey(institutionId));sessionStorage.removeItem("vertice-action-prefill");if(Object.keys(prefill).length&&can.record(role))ed.open("new");},[]);
  const rows = data.actions.filter(a =>
    filter === "todas" ? true : filter === "atrasadas" ? isLate(a.due_date, a.status) : filter === "abertas" ? !["concluida", "cancelada"].includes(String(a.status)) : a.status === filter
  );
  const goalTitle = (gid: unknown) => data.goals.find(g => g.id === gid)?.title as string | undefined;
  const counts = Object.fromEntries(ACTION_STATUS.map(([k]) => [k, data.actions.filter(a => a.status === k).length]));
  return (
    <div className="area-panel">
      <ActionCockpit data={data} institutionId={institutionId} onDraft={can.record(role)?draft=>{setPrefill(draft);ed.open("new");}:undefined}/>
      <div className="area-inline" role="group" aria-label="Visualização das tarefas">
        <button type="button" className={actionView==="kanban"?"corp-button small":"corp-login-text-button"} aria-pressed={actionView==="kanban"} onClick={()=>setActionView("kanban")}>Kanban</button>
        <button type="button" className={actionView==="tabela"?"corp-button small":"corp-login-text-button"} aria-pressed={actionView==="tabela"} onClick={()=>setActionView("tabela")}>Tabela 5W2H</button>
      </div>
      {actionSaveError&&<p role="alert" className="area-error">{actionSaveError}</p>}
      <ActiveGovernance institutionId={institutionId} actions={data.actions} role={role} onChanged={reload}/>
      {actionView==="kanban"&&<ActionKanban actions={data.actions} goals={data.goals} canEdit={can.record(role)} onEdit={a=>ed.open(a)} onMove={async(a,status)=>{
        setActionSaveError("");
        try {await saveRow(TABLES.actions,{status},String(a.id));await reload();}
        catch(e){setActionSaveError(explain(e));throw e;}
      }}/>}


      <div className="area-panel-head">
        <h3>Plano de ação 5W2H ({data.actions.length})</h3>
        <div className="area-inline">
          <select aria-label="Filtrar ações" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="atrasadas">Atrasadas</option>
            {ACTION_STATUS.map(([k, l]) => <option key={k} value={k}>{l} ({counts[k]})</option>)}
            <option value="todas">Todas</option>
          </select>
          {can.record(role) && <button className="corp-button small" onClick={() => {setPrefill({});ed.open("new");}}>Nova ação</button>}
        </div>
      </div>
      {ed.editing && (
        <RecordForm institutionId={institutionId} key={(ed.editing === "new" ? "new" : (ed.editing as Row).id)+JSON.stringify(prefill)}
          title={ed.editing === "new" ? "Nova ação" : "Editar ação"}
          fields={actionFields(data)}
          onValueChange={(values,changed)=>changeActionScope(values,changed,data)}
          optionsFor={(field,values)=>{const rows=field.name==="goal_id"?data.goals:field.name==="finding_id"?data.diagnosis:null;return rows&&values.course_id?field.options?.filter(([id])=>{const linked=rows.find(r=>r.id===id);return linked&&(!linked.course_id||linked.course_id===values.course_id);}):field.options;}}
          initial={ed.editing === "new" ? { status: "nao_iniciada", progress: 0, ...prefill } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            v=validateActionLinks(v,data);
            await saveRow(TABLES.actions, ed.editing === "new" ? { ...v, progress: v.progress ?? 0, institution_id: institutionId } : { ...v, progress: v.progress ?? 0 }, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {actionView==="tabela"&&(!rows.length ? (
        <p className="area-muted">Nenhuma ação neste filtro.</p>
      ) : (
        <div className="table-scroll">
          <table className="area-table">
            <thead><tr><th>O quê</th><th>Quem</th><th>Quando</th><th>Situação</th><th>Avanço<ContextHelp title="Avanço" /></th><th>Meta<ContextHelp title="Meta" /></th><th>Origem</th><th>Evidência</th><th /></tr></thead>
            <tbody>
              {rows.map(a => {
                const late = isLate(a.due_date, a.status);
                return (
                  <tr key={a.id} className={late ? "late" : ""}>
                    <td><strong>{String(a.what)}</strong>{a.how ? <small className="area-block">{String(a.how)}</small> : null}</td>
                    <td>{String(a.who ?? "—")}</td>
                    <td>{fmtDate(a.due_date)}{late && <small className="area-block warn">atrasada</small>}</td>
                    <td><span className={`badge ${a.status === "concluida" ? "green" : a.status === "bloqueada" ? "red" : a.status === "em_andamento" ? "amber" : "gray"}`}>{label(ACTION_STATUS, a.status)}</span></td>
                    <td>{Number(a.progress ?? 0)}%</td>
                    <td>{goalTitle(a.goal_id) ?? "—"}</td>
                    <td>{a.origin_type ? <span className="badge" style={{ fontSize: '.6875rem' }} title={a.origin_label ? String(a.origin_label) : undefined}>{MODULE_LABELS[String(a.origin_type)] || String(a.origin_type)}</span> : <small className="area-muted">—</small>}</td>
                    <td>{a.evidence ? <small>{String(a.evidence)}</small> : <small className="area-muted">sem registro</small>}</td>
                    <td className="area-row-actions">
                      {can.record(role) && <button className="corp-login-text-button" onClick={() => ed.open(a)}>Atualizar</button>}
                      {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.actions, a.id); await reload(); }} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ================================================================ diagnóstico
function diagnosisFields(courses: Row[]): Field[] {
  return withHelp([
    { name: "dimension", label: "Dimensão", type: "select", required: true, options: DIMENSIONS.map(d => [d, d] as [string, string]) },
    { name: "course_id", label: "Curso (opcional)", type: "select", options: courseOptions(courses) },
    { name: "criterion", label: "Critério avaliado", required: true, wide: true, placeholder: "Ex.: PPC atualizado às DCNs vigentes" },
    { name: "reference", label: "Referência", placeholder: "Ex.: Instrumento INEP 1.1" },
    { name: "score", label: "Nota (1 a 5)", type: "number", min: 1, max: 5, step: "0.5" },
    { name: "priority", label: "Prioridade", type: "select", required: true, options: PRIORITY },
    { name: "status", label: "Situação", type: "select", required: true, options: FINDING_STATUS },
    { name: "assessed_on", label: "Data da avaliação", type: "date" },
    { name: "finding", label: "Achado", type: "textarea" },
    { name: "evidence", label: "Evidência consultada", type: "textarea" },
  ], FIELD_HELP.diagnosis);
}

function DiagnosisTab({ institutionId, role, data, reload, onPlan }: { institutionId: string; role: Role | null; data: Data; reload: () => Promise<void>; onPlan: () => void }) {
  const ed = useEditor();
  const [courseId,setCourseId]=useState("");
  const [moduleIndicators, setModuleIndicators] = useState<any[]>([]);
  useEffect(() => {
    if (!courseId) { setModuleIndicators([]); return; }
    supabase.from('v_diagnosis_with_modules').select('tcc_active,tcc_deposited,tcc_overdue,ac_submissions,ac_approved,ac_pending,estagio_placements,estagio_completed,extensao_projetos,egressos_total,orgaos_ativos,deliberacoes_executadas')
      .eq('institution_id', institutionId).eq('course_id', courseId).limit(1)
      .then(r => { if (r.data?.[0]) setModuleIndicators([r.data[0]]); else setModuleIndicators([]); });
  }, [institutionId, courseId]);
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const d of data.diagnosis.filter(d=>!courseId||d.course_id===courseId)) {
      const k = String(d.dimension);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [data.diagnosis,courseId]);
  const avg = (rows: Row[]) => {
    const s = rows.map(r => r.score).filter(v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))).map(Number);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  };
  const actionsFor = (fid: string) => data.actions.filter(a => a.finding_id === fid).length;
  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Diagnóstico ({data.diagnosis.length} critérios)</h3>
        {can.record(role) && <button className="corp-button small" onClick={() => ed.open("new")}>Novo critério</button>}
      </div>
      <HelpLabel>Curso do diagnóstico <select value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">Toda a instituição</option>{data.courses.map(c=><option key={c.id} value={c.id}>{String(c.display_name??c.name)}</option>)}</select></HelpLabel>
      {courseId && moduleIndicators.length > 0 && (() => { const m = moduleIndicators[0]; return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, margin: '8px 0', padding: 12, background: 'var(--bg-card, #f8fafc)', borderRadius: 8, border: '1px solid var(--vx-border, #e2e8f0)' }}>
          <MiniKpi label="TCC ativos" value={m.tcc_active} bad={m.tcc_overdue > 0} detail={m.tcc_overdue > 0 ? `${m.tcc_overdue} atrasados` : `${m.tcc_deposited} depositados`} />
          <MiniKpi label="AC submissões" value={m.ac_submissions} bad={m.ac_pending > 3} detail={`${m.ac_approved} aprovadas`} />
          <MiniKpi label="Estágio vínculos" value={m.estagio_placements} detail={`${m.estagio_completed} concluídos`} />
          <MiniKpi label="Extensão" value={m.extensao_projetos} detail="projetos" />
          <MiniKpi label="Egressos" value={m.egressos_total} />
          <MiniKpi label="Governança" value={m.orgaos_ativos} detail={`${m.deliberacoes_executadas} deliberações`} />
        </div>
      ); })()}
      {ed.editing && (
        <RecordForm institutionId={institutionId}
          title={ed.editing === "new" ? "Novo critério avaliado" : "Editar critério"}
          fields={diagnosisFields(data.courses)}
          initial={ed.editing === "new" ? { priority: "media", status: "aberto", assessed_on: today() } : ed.editing}
          onCancel={ed.close}
          onSubmit={async v => {
            await saveRow(TABLES.diagnosis, ed.editing === "new" ? { ...v, institution_id: institutionId } : v, ed.editing === "new" ? undefined : (ed.editing as Row).id);
            ed.close();
            await reload();
          }}
        />
      )}
      {!groups.length ? (
        <p className="area-muted">Nenhum critério avaliado. Registre cada critério com nota, achado e evidência; os achados podem gerar ações no plano 5W2H.</p>
      ) : (
        groups.map(([dim, rows]) => {
          const a = avg(rows), scored=rows.filter(r=>r.score!==null&&r.score!==undefined&&r.score!==""&&Number.isFinite(Number(r.score))),low=scored.filter(r=>Number(r.score)<3),open=rows.filter(r=>r.status!=="resolvido"),without=open.filter(r=>!data.actions.some(action=>action.finding_id===r.id&&!["concluida","cancelada"].includes(String(action.status))));
          return (
            <section key={dim} className="area-dim">
              <h4>{dim} <small>{a === null ? "sem nota" : `média ${a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`} · {rows.length} critério(s)</small></h4>
              <div className="dimension-summary"><span className={`badge ${low.length?"red":open.length?"amber":scored.length?"green":"gray"}`}>{low.length?"Prioridade de melhoria":open.length?"Acompanhar pendências":scored.length?"Sem achados abertos":"Avaliação pendente"}</span><strong>{scored.length}/{rows.length} critérios com nota</strong><p>{low.length?`${low.length} indicador(es) abaixo de 3: ${low.map(r=>String(r.criterion)).join(", ")}. Priorize os achados correspondentes e registre a evidência da melhoria.`:"Não há nota abaixo de 3 entre os critérios avaliados."} {without.length?`${without.length} achado(s) aberto(s) ainda sem ação ativa vinculada.`:"Os achados abertos possuem ações ativas, quando existentes."}</p><p className="area-muted">Síntese gerencial da dimensão: média simples dos critérios registrados, sem substituir o conceito oficial. Notas ausentes ficam fora da média. As causas e providências estão no detalhamento abaixo.</p></div>
              <details><summary>Ver indicadores, achados e providências ({rows.length})</summary><div className="table-scroll">
                <table className="area-table">
                  <thead><tr><th>Critério<ContextHelp title="Critério" /></th><th>Nota<ContextHelp title="Nota" /></th><th>Achado<ContextHelp title="Achado" /></th><th>Prioridade<ContextHelp title="Prioridade" /></th><th>Situação</th><th>Ações</th><th /></tr></thead>
                  <tbody>
                    {rows.map(d => (
                      <tr key={d.id}>
                        <td><strong>{String(d.criterion)}</strong>{d.reference ? <small className="area-block">{String(d.reference)}</small> : null}</td>
                        <td>{d.score === null || d.score === undefined ? "—" : Number(d.score).toLocaleString("pt-BR")}</td>
                        <td><small>{String(d.finding ?? "—")}</small></td>
                        <td><span className={`badge ${d.priority === "alta" ? "red" : d.priority === "media" ? "amber" : "gray"}`}>{label(PRIORITY, d.priority)}</span></td>
                        <td>{label(FINDING_STATUS, d.status)}</td>
                        <td>{actionsFor(d.id)}</td>
                        <td className="area-row-actions">
                          {can.record(role) && (
                            <button
                              className="corp-login-text-button"
                              onClick={() => {
                                storeActionDraft(institutionId,{ what: `Tratar: ${d.criterion}`, finding_id: d.id, course_id: d.course_id ?? "", why: d.finding ?? "" });
                                onPlan();
                              }}
                            >
                              Criar ação
                            </button>
                          )}
                          {can.record(role) && <button className="corp-login-text-button" onClick={() => ed.open(d)}>Editar</button>}
                          {can.remove(role) && <RemoveButton onConfirm={async () => { await deleteRow(TABLES.diagnosis, d.id); await reload(); }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></details>
            </section>
          );
        })
      )}
    </div>
  );
}

// ================================================================ equipe
type Member = { user_id: string; email: string; role: Role; created_at: string };

function TeamTab({ institutionId, role }: { institutionId: string; role: Role | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("equipe");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const roles: Role[] = role === "master" ? ["gestor", "equipe", "leitor"] : ["equipe", "leitor"];

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.rpc("vertice_team", { target: institutionId }),
      supabase.from(TABLES.invites).select("*").eq("institution_id", institutionId).is("accepted_at", null).order("created_at"),
    ]);
    if (!m.error) setMembers((m.data ?? []) as Member[]);
    if (!i.error) setInvites((i.data ?? []) as Row[]);
  }, [institutionId]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setInviteLink("");
    try {
      const mail = email.trim().toLowerCase();
      const { data, error } = await supabase.rpc("vertice_add_member", { target: institutionId, member_email: mail, member_role: newRole });
      if (error) throw error;
      if (data === "convite_pendente") {
        // Buscar o convite recém-criado para gerar o link
        const { data: inv } = await supabase.from(TABLES.invites).select("id").eq("institution_id", institutionId).eq("email", mail).is("accepted_at", null).order("created_at", { ascending: false }).limit(1);
        const inviteId = inv?.[0]?.id;
        const link = inviteId ? `${window.location.origin}/entrar?convite=${inviteId}` : "";
        // Tentar enviar e-mail, mas não depender dele
        const sent = await supabase.functions.invoke("vertice-convite", { body: { institution_id: institutionId, email: mail } }).catch(() => ({ error: true }));
        if (link) setInviteLink(link);
        setMsg(
          sent.error
            ? "Convite registrado! Copie o link abaixo e envie por WhatsApp para a pessoa criar a conta."
            : "Convite enviado por e-mail. Você também pode copiar o link abaixo e enviar por WhatsApp."
        );
      } else {
        setMsg("Conta existente vinculada a esta instituição.");
      }
      setEmail("");
      await load();
    } catch (err) {
      setMsg(explain(err));
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink).then(() => setMsg("Link copiado! Cole no WhatsApp e envie para a pessoa.")).catch(() => {});
    }
  }

  async function changeRole(m: Member, r: Role) {
    const { error, count } = await supabase.from(TABLES.memberships).update({ role: r }, { count: "exact" }).eq("user_id", m.user_id).eq("institution_id", institutionId);
    if (error || !count) window.alert(explain(error ?? { code: "42501" }));
    await load();
  }
  async function remove(m: Member) {
    if (!window.confirm(`Retirar o acesso de ${m.email} a esta instituição?`)) return;
    const { error, count } = await supabase.from(TABLES.memberships).delete({ count: "exact" }).eq("user_id", m.user_id).eq("institution_id", institutionId);
    if (error || !count) window.alert(explain(error ?? { code: "42501" }));
    await load();
  }
  const manageable = (m: Member) => role === "master" || (role === "gestor" && m.role !== "gestor");

  return (
    <div className="area-panel">
      <div className="area-panel-head"><h3>Equipe com acesso ({members.length})</h3></div>
      <form className="area-form area-inline-form" onSubmit={add}>
        <HelpLabel>E-mail <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@instituicao.edu.br" /></HelpLabel>
        <HelpLabel>Perfil
          <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </HelpLabel>
        <button className="corp-button small" disabled={busy}>{busy ? "Enviando…" : "Dar acesso"}</button>
      </form>
      <p className="area-field-help">Use o e-mail institucional da pessoa. Se ela ainda não tiver conta, será criado um convite por link.</p>
      {msg && <p role="status" className="area-note">{msg}</p>}
      {inviteLink && <div style={{display:'flex',gap:8,alignItems:'center',margin:'8px 0 12px',padding:12,background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8}}>
        <input readOnly value={inviteLink} style={{flex:1,padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,color:'#1e3a5f',background:'#fff'}} onClick={e=>(e.target as HTMLInputElement).select()} />
        <button type="button" className="corp-button small" onClick={copyLink} style={{whiteSpace:'nowrap',background:'#16a34a',borderColor:'#16a34a'}}>📋 Copiar link</button>
      </div>}
      <dl className="area-roles">
        <div><dt>Gestor<ContextHelp title="Gestor" /></dt><dd>cadastra cursos, define metas, gere a equipe (equipe e leitura) e remove registros.</dd></div>
        <div><dt>Equipe<ContextHelp title="Equipe" /></dt><dd>registra medições, ações 5W2H e critérios do diagnóstico; não altera metas nem remove registros.</dd></div>
        <div><dt>Leitura<ContextHelp title="Leitura" /></dt><dd>apenas consulta.</dd></div>
      </dl>
      <div className="table-scroll">
        <table className="area-table">
          <thead><tr><th>E-mail<ContextHelp title="E-mail" /></th><th>Perfil</th><th>Desde</th><th /></tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  {manageable(m) ? (
                    <select aria-label={`Perfil de ${m.email}`} value={m.role} onChange={e => changeRole(m, e.target.value as Role)}>
                      {(role === "master" ? ["gestor", "equipe", "leitor"] : ["equipe", "leitor"]).map(r => <option key={r} value={r}>{ROLE_LABEL[r as Role]}</option>)}
                    </select>
                  ) : ROLE_LABEL[m.role]}
                </td>
                <td>{fmtDate(m.created_at?.slice(0, 10))}</td>
                <td>{manageable(m) && <button className="corp-login-text-button area-danger" onClick={() => remove(m)}>Retirar acesso</button>}</td>
              </tr>
            ))}
            {invites.map(i => {
              const iLink = `${window.location.origin}/entrar?convite=${i.id}`;
              return <tr key={i.id} className="pending">
                <td>{String(i.email)}<br/><button type="button" style={{fontSize:10,color:'#16a34a',background:'none',border:0,cursor:'pointer',padding:'2px 0'}} onClick={()=>{navigator.clipboard.writeText(iLink).then(()=>setMsg(`Link copiado para ${i.email}!`)).catch(()=>{});}}>📋 Copiar link de convite</button></td>
                <td>{ROLE_LABEL[i.role as Role]} <small className="area-muted">(convite pendente)</small></td>
                <td>{fmtDate(String(i.created_at).slice(0, 10))}</td>
                <td>
                  {(role === "master" || i.role !== "gestor") && (
                    <RemoveButton label="Cancelar convite" onConfirm={async () => { await deleteRow(TABLES.invites, i.id); await load(); }} />
                  )}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="area-muted small">Masters da Vértice têm acesso a todas as instituições e não aparecem nesta lista.</p>
    </div>
  );
}
