import { useMemo, useState } from "react";
import "./vertice-mobile-public.css";

type Tab = "visao" | "cursos" | "academico" | "documentos" | "alertas";
type CourseSample = { name: string; students: number; prior: number; reproval: number; coverage: number };
const COURSES: CourseSample[] = [
  { name: "Direito", students: 1420, prior: 1278, reproval: 8.4, coverage: 87 },
  { name: "Enfermagem", students: 1148, prior: 1196, reproval: 12.8, coverage: 68 },
  { name: "Pedagogia", students: 992, prior: 846, reproval: 6.2, coverage: 91 },
  { name: "Administração", students: 873, prior: 805, reproval: 7.1, coverage: 76 },
  { name: "Fonoaudiologia", students: 624, prior: 538, reproval: 9.6, coverage: 83 },
  { name: "Ciências Contábeis", students: 512, prior: 527, reproval: 10.9, coverage: 72 }
];
const fmt = new Intl.NumberFormat("pt-BR");
const percent = (n: number) => (n > 0 ? "+" : "") + n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const change = (now: number, before: number) => before ? (now / before - 1) * 100 : 0;
const all = COURSES.reduce((acc, c) => acc + c.students, 0);
const priorAll = COURSES.reduce((acc, c) => acc + c.prior, 0);
const lineChart = [49, 56, 53, 64, 61, 73, 69, 80, 76, 85, 91, 96];
const tabs: { tab: Tab; icon: string; title: string }[] = [
  { tab: "visao", icon: "◈", title: "Visão" },
  { tab: "cursos", icon: "▥", title: "Cursos" },
  { tab: "academico", icon: "▤", title: "Acadêmico" },
  { tab: "documentos", icon: "▣", title: "Documentos" },
  { tab: "alertas", icon: "♢", title: "Alertas" }
];
function Metric({ eyebrow, value, subtitle, color }: { eyebrow: string; value: string; subtitle: string; color: string }) {
  return <article className={"vmp-metric " + color}><span>{eyebrow}</span><strong>{value}</strong><small>{subtitle}</small></article>;
}
function PercentBar({ percent: v, positive = true }: { percent: number; positive?: boolean }) {
  return <div className="vmp-progress" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0,v))}>
    <span className={positive ? "vmp-progress-good" : "vmp-progress-warn"} style={{ width: Math.min(100, Math.max(0,v)) + "%" }} />
  </div>;
}
function Tag({ children, type = "neutral" }: { children: string; type?: "neutral" | "success" | "warn" | "danger" }) {
  return <span className={"vmp-tag vmp-tag-" + type}>{children}</span>;
}
export default function VerticeMobilePublicPreview() {
  const [tab, setTab] = useState<Tab>("visao");
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0].name);
  const [focus, setFocus] = useState<"2026/02" | "2026/01">("2026/02");
  const [query, setQuery] = useState("");
  const course = COURSES.find(item => item.name === selectedCourse) ?? COURSES[0];
  const sorted = useMemo(() => COURSES.filter(c => c.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [query]);
  return <div className="vmp-shell">
    <section className="vmp-head">
      <div className="vmp-head-inner">
        <div className="vmp-logo">V</div>
        <div className="vmp-brand"><strong>VÉRTICE <span>MOBILE</span></strong><small>Inteligência para a educação superior</small></div>
        <a className="vmp-toplink" href="/entrar?destino=mobile">Acesso institucional</a>
      </div>
      <div className="vmp-hero">
        <div className="vmp-kicker"><span className="vmp-sparkle">✦</span> COCKPIT EXECUTIVO</div>
        <h1>Uma instituição inteira,<br/><em>na palma da mão.</em></h1>
        <p>Matrículas, desempenho, regulação e oportunidades reunidos para decisões melhores.</p>
        <div className="vmp-demo-notice"><span>VISUALIZAÇÃO PÚBLICA</span><strong>Cenário ilustrativo · dados fictícios</strong><small>Nenhuma informação de instituição, aluno ou documento real é disponibilizada nesta demonstração.</small></div>
      </div>
    </section>
    <main className="vmp-main">
      <div className="vmp-filter">
        <label>Instituição <select value="Faculdade Exemplo — Demonstração" onChange={() => {}} aria-label="Instituição demonstrativa"><option>Faculdade Exemplo — Demonstração</option></select></label>
        <label>Semestre <select value={focus} onChange={event => setFocus(event.target.value as "2026/02" | "2026/01")} aria-label="Semestre demonstrativo"><option value="2026/02">2026/2</option><option value="2026/01">2026/1</option></select></label>
      </div>
      {tab === "visao" && <>
        <div className="vmp-section-head"><div><span>VISÃO INSTITUCIONAL</span><h2>Seu resumo executivo</h2></div><Tag type="success">Indicadores ilustrativos</Tag></div>
        <div className="vmp-metrics">
          <Metric eyebrow="MATRÍCULAS" value={fmt.format(focus === "2026/02" ? all : priorAll)} subtitle="Recorte demonstrativo" color="vmp-indigo"/>
          <Metric eyebrow="CRESCIMENTO ANUAL" value={percent(change(all, priorAll))} subtitle="Comparação ilustrativa" color="vmp-green"/>
          <Metric eyebrow="CURSOS EM ATENÇÃO" value="02" subtitle="Prioridades gerenciais" color="vmp-orange"/>
          <Metric eyebrow="COBERTURA DOCUMENTAL" value="79%" subtitle="Evidências vinculadas" color="vmp-purple"/>
        </div>
        <section className="vmp-panel vmp-health">
          <div><div className="vmp-eyebrow">ÍNDICE VÉRTICE · SIMULAÇÃO</div><h3>Saúde institucional</h3><p>Um olhar único sobre desempenho, documentos e evolução acadêmica.</p><Tag type="success">Cenário favorável</Tag></div>
          <div className="vmp-gauge"><div className="vmp-gauge-inside"><strong>84</strong><small>de 100</small></div></div>
        </section>
        <section className="vmp-panel">
          <div className="vmp-section-head inner"><div><span>TRAJETÓRIA</span><h3>Evolução institucional</h3></div><Tag type="success">+8,0%</Tag></div>
          <div className="vmp-spark-chart" aria-label="Série histórica fictícia em barras verticais">{lineChart.map((v,i) => <div key={i} className="vmp-spark-wrap"><span style={{height:v+"%"}}/><small>{i===0?"Jan":i===5?"Jun":i===11?"Dez":""}</small></div>)}</div>
          <div className="vmp-insight"><strong>✦ Leitura estratégica</strong><p>O crescimento agregado é positivo, mas a análise por curso revela comportamentos diferentes. Oportunidade de captação e permanência devem ser tratadas separadamente.</p></div>
        </section>
        <section className="vmp-panel">
          <div className="vmp-section-head inner"><div><span>PRIORIDADES</span><h3>O que merece sua atenção</h3></div><Tag type="warn">3 sinais</Tag></div>
          <div className="vmp-action"><span className="vmp-action-circle orange">1</span><div><strong>Retenção em cursos estratégicos</strong><small>Monitorar variação anual e identificar causas antes de projetar evasão.</small></div></div>
          <div className="vmp-action"><span className="vmp-action-circle purple">2</span><div><strong>Cobertura regulatória</strong><small>Priorizar evidências pendentes para curadoria humana.</small></div></div>
          <div className="vmp-action"><span className="vmp-action-circle blue">3</span><div><strong>Qualidade dos dados</strong><small>Conciliar as fontes antes de publicar indicadores executivos.</small></div></div>
        </section>
      </>}
      {tab === "cursos" && <>
        <div className="vmp-section-head"><div><span>ANÁLISE POR CURSO</span><h2>Desempenho e tendência</h2></div><Tag type="neutral">Exemplo</Tag></div>
        <section className="vmp-panel">
          <label className="vmp-search-label">Buscar curso<input placeholder="Digite um curso..." value={query} onChange={event => setQuery(event.target.value)}/></label>
          <div className="vmp-course-list">{sorted.length ? sorted.map(c=><button className={"vmp-course-item "+(c.name===selectedCourse?"selected":"")} key={c.name} onClick={()=>setSelectedCourse(c.name)}>
            <div><strong>{c.name}</strong><small>{fmt.format(c.students)} matrículas · demonstração</small></div><div><Tag type={c.students>=c.prior?"success":"warn"}>{percent(change(c.students,c.prior))}</Tag></div>
          </button>):<p>Nenhum curso encontrado neste exemplo.</p>}</div>
        </section>
        <section className="vmp-panel"><div className="vmp-eyebrow">CURSO SELECIONADO</div><h3>{course.name}</h3>
          <div className="vmp-metrics two"><Metric eyebrow="MATRÍCULAS" value={fmt.format(course.students)} subtitle="Cenário fictício" color="vmp-indigo"/><Metric eyebrow="EVOLUÇÃO" value={percent(change(course.students,course.prior))} subtitle="Mesmo período do ano anterior" color="vmp-green"/></div>
          <p className="vmp-data-caption">Cobertura documental simulada: {course.coverage}%</p><PercentBar percent={course.coverage}/>
          <div className="vmp-insight"><strong>✦ Sugestão gerencial</strong><p>Confronte a tendência de matrículas com desempenho acadêmico, oferta de turmas e documentação regulatória. Sem inferências automáticas sobre evasão.</p></div>
        </section>
      </>}
      {tab === "academico" && <>
        <div className="vmp-section-head"><div><span>INTELIGÊNCIA ACADÊMICA</span><h2>O que os indicadores contam</h2></div><Tag type="neutral">Exemplo</Tag></div>
        <div className="vmp-metrics">
          <Metric eyebrow="TAXA DE REPROVAÇÃO" value="9,8%" subtitle="Percentual ilustrativo" color="vmp-indigo"/>
          <Metric eyebrow="SITUAÇÕES CRÍTICAS" value="03" subtitle="Disciplinas simuladas" color="vmp-orange"/>
        </div>
        <section className="vmp-panel"><h3>Taxa de reprovação por curso</h3>{COURSES.map(c=><div className="vmp-bar-line" key={c.name}><div><span>{c.name}</span><strong>{c.reproval.toFixed(1).replace(".",",")}%</strong></div><PercentBar percent={c.reproval*5} positive={c.reproval<10}/></div>)}
          <div className="vmp-insight"><strong>✦ Leitura responsável</strong><p>Reprovações por nota e falta exigem bases e denominadores homologados. A taxa de disciplina não representa a proporção de estudantes únicos.</p></div>
        </section>
      </>}
      {tab === "documentos" && <>
        <div className="vmp-section-head"><div><span>REGULAÇÃO & EVIDÊNCIAS</span><h2>Governança documental</h2></div><Tag type="neutral">Exemplo</Tag></div>
        <div className="vmp-metrics"><Metric eyebrow="EXIGÊNCIAS" value="480" subtitle="Exemplo fictício" color="vmp-indigo"/><Metric eyebrow="COM EVIDÊNCIA" value="382" subtitle="79,6% de cobertura" color="vmp-green"/><Metric eyebrow="A VALIDAR" value="98" subtitle="Curadoria pendente" color="vmp-orange"/><Metric eyebrow="VALIDADOS" value="310" subtitle="Exemplo fictício" color="vmp-purple"/></div>
        <section className="vmp-panel"><h3>Cobertura por dimensão</h3>{[{name:"Dimensão 1 · Didático-pedagógica",pct:88},{name:"Dimensão 2 · Corpo docente",pct:73},{name:"Dimensão 3 · Infraestrutura",pct:65}].map(d=><div className="vmp-bar-line" key={d.name}><div><span>{d.name}</span><strong>{d.pct}%</strong></div><PercentBar percent={d.pct} positive={d.pct>=75}/></div>)}
          <div className="vmp-insight"><strong>✦ Ação regulatória</strong><p>É possível relacionar instrumento, indicador, curso, responsável e evidência. Um arquivo enviado só será considerado validado após a curadoria institucional.</p></div>
        </section>
      </>}
      {tab === "alertas" && <>
        <div className="vmp-section-head"><div><span>CENTRAL DE DECISÕES</span><h2>Alertas e oportunidades</h2></div><Tag type="warn">Cenário demonstrativo</Tag></div>
        <section className="vmp-panel">
          <div className="vmp-alert red"><strong>Prioridade alta · Evidências regulatórias</strong><p>Dimensionar lacunas documentais e encaminhar ao responsável pela curadoria.</p><Tag type="danger">Exige análise</Tag></div>
          <div className="vmp-alert orange"><strong>Atenção · Matrículas em retração</strong><p>Confrontar recortes anuais equivalentes e avaliar ações de permanência e captação.</p><Tag type="warn">Monitorar</Tag></div>
          <div className="vmp-alert green"><strong>Oportunidade · Cursos em crescimento</strong><p>Mapear práticas com bom resultado para orientar o planejamento de novas turmas.</p><Tag type="success">Oportunidade</Tag></div>
          <div className="vmp-insight"><strong>✦ Inteligência para agir</strong><p>O painel identifica sinais e sugere prioridades, mas a decisão gerencial e a validação documental permanecem sob responsabilidade da instituição.</p></div>
        </section>
      </>}
      <section className="vmp-footer-card"><div><span>QUER VER OS DADOS DA SUA INSTITUIÇÃO?</span><strong>Acesse o ambiente protegido</strong><p>O modo de demonstração não solicita senha. Para visualizar indicadores reais é necessário entrar com credenciais institucionais.</p></div><a href="/entrar?destino=mobile">Entrar no portal</a></section>
      <p className="vmp-legal">Vértice Educação Superior · Prévia pública de interface · Todos os números, cursos e índices acima são cenários ilustrativos e não representam resultados da UNITOP ou de qualquer outra IES.</p>
    </main>
    <nav className="vmp-bottom" aria-label="Navegação da demonstração do aplicativo">{tabs.map(t=><button type="button" key={t.tab} onClick={()=>{setTab(t.tab);window.scrollTo?.({top:0,behavior:"smooth"});}} className={t.tab===tab?"active":""} aria-current={t.tab===tab?"page":undefined}><span aria-hidden="true">{t.icon}</span><small>{t.title}</small></button>)}</nav>
  </div>;
}
