import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { can, deleteRow, explain, fmtDate, saveRow, today, type Role, type Row } from "@/lib/area";
import { supabase } from "@/lib/supabase";
import {
  ANDAMENTO, ANDAMENTO_BADGE, ANDAMENTO_COR, CICLO_BASE, CONFORMIDADE, CONFORMIDADE_BADGE, CONFORMIDADE_COR, DIMENSOES_INSTRUMENTO,
  EIXOS_INSTITUCIONAL, OBJETOS_INSTITUCIONAL, TIPOS_INSTRUMENTO,
  FASES, ITENS_CPA, MARCOS, NI_TABLES, PERFIL_ROTULO, TEMAS, VAZIO, carregarInstrumento, cicloRotulo, garantirLinhaChecklist,
  mesmoEscopo, objetosDoEscopo, perfilArea, resumir, semearChecklist, semearCiclo, semearCpa, statusValido, urlSegura, usuarioAtual,
  type AndamentoStatus, type Conformidade, type DadosInstrumento, type ObjetoInstrumento, type Tema, type TipoInstrumento,
} from "@/lib/novo-instrumento";
import "./novo-instrumento.css";
import CorrespondenciasInstitucionais, { type DocumentoVinculado } from "./CorrespondenciasInstitucionais";
import {useNovoInstrumentoDocs2026,NovoDocumentosResumo2026,NovoObjetoDocumentos2026} from "./NovoInstrumentoDocumental2026";
import { indicadoresDoObjeto2026, GRAU_COR, GRAU_LABEL } from "@/lib/instrumento-mapping";
import indicatorNames from "@/lib/repository-indicators.json";

type Sub = "checklist" | "evidencias" | "cronograma" | "cpa";
const SUBS: [Sub, string][] = [
  ["checklist", "Checklist"],
  ["evidencias", "Evidências"],
  ["cronograma", "Cronograma"],
  ["cpa", "CPA"],
];

type Props = { institutionId: string; role: Role | null; courses: Row[]; onUploadDocument?: (courseId:string,title:string,reference:string)=>void };
type Shared = {
  institutionId: string;
  role: Role | null;
  data: DadosInstrumento;
  reload: () => Promise<void>;
  fail: (e: unknown) => void;
};

export default function NovoInstrumento({ institutionId, role, courses, onUploadDocument }: Props) {
  const [sub, setSub] = useState<Sub>("checklist");
  const [data, setData] = useState<DadosInstrumento>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tipo, setTipo] = useState<TipoInstrumento>(() => new URLSearchParams(window.location.hash.slice(1)).get("instrumento") === "institucional" ? "institucional" : "curso");

  const reload = useCallback(async () => {
    try {
      setData(await carregarInstrumento(institutionId));
      setError("");
    } catch {
      setError("Não foi possível carregar o Novo Instrumento. Atualize a página.");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);
  useEffect(() => {
    setLoading(true);
    setData(VAZIO);
    setCourseId("");
    void reload();
  }, [reload]);

  const fail = useCallback((e: unknown) => setError(explain(e)), []);
  const course = courses.find(c => c.id === courseId) ?? null;
  const shared: Shared = { institutionId, role, data, reload, fail };

  return (
    <div className="ni">
      <div className="area-panel ni-instrument-picker">
        <div><strong>Instrumentos de avaliação · preparação regulatória</strong><p className="area-muted small">Selecione o instrumento específico. A proposta de recredenciamento de 2026 é preliminar; a versão histórica de 2017 permanece disponível em outra aba.</p></div>
        <label className="area-search ni-scope">Instrumento
          <select aria-label="Selecionar instrumento" value={tipo} onChange={e => {
            const next = e.target.value as TipoInstrumento;
            setTipo(next);
            const hash = new URLSearchParams(window.location.hash.slice(1));
            if (next === "institucional") hash.set("instrumento", "institucional"); else hash.delete("instrumento");
            window.history.replaceState(null, "", "#" + hash.toString());
          }}>
            {TIPOS_INSTRUMENTO.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        {tipo === "curso" && <button className="corp-button" type="button" onClick={() => {
          setTipo("institucional");
          const hash = new URLSearchParams(window.location.hash.slice(1));
          hash.set("instrumento", "institucional");
          window.history.replaceState(null, "", "#" + hash.toString());
        }}>Abrir proposta de Recredenciamento 2026</button>}
        {tipo === "curso" && <label className="area-search ni-scope">Curso para o envio
          <select aria-label="Curso para o envio de documento" value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">Selecione o curso…</option>
            {courses.map(c=><option key={c.id} value={String(c.id)}>{String(c.display_name??c.name)}</option>)}
          </select>
        </label>}
        {onUploadDocument && can.record(role) && <button type="button" className="corp-button" disabled={tipo==="curso"&&!course} title={tipo==="curso"&&!course?"Selecione um curso antes de enviar":undefined} onClick={()=>{
          if(tipo==="institucional")onUploadDocument("institucional","Evidência · Proposta de Recredenciamento 2026","Proposta preliminar de Recredenciamento Institucional 2026 · escopo institucional; vínculo e conformidade dependem de validação.");
          else if(course)onUploadDocument(String(course.id),`Evidência · Novo Instrumento 2026 · ${String(course.name)}`,`Novo Instrumento de Avaliação de Curso 2026 · curso ${String(course.name)}. Identifique o objeto específico na descrição do documento.`);
        }}>Enviar arquivo de evidência</button>}
      </div>
      {tipo === "curso" && <div role="tablist" aria-label="Novo Instrumento INEP" className="area-tabs ni-subtabs">
        {SUBS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? "active" : ""} onClick={() => setSub(k)}>
            {l}
          </button>
        ))}
      </div>}
      {!can.record(role) && tipo === "curso" && <p className="area-note">Seu perfil é de leitura: você acompanha o diagnóstico, mas não altera os registros.</p>}
      {error && <p role="alert" className="area-error">{error}</p>}
      {tipo === "institucional" ? (
        <InstitucionalPanel institutionId={institutionId} role={role} onUploadDocument={onUploadDocument} />
      ) : loading ? (
        <p role="status" className="area-muted">Carregando o Novo Instrumento…</p>
      ) : sub === "checklist" ? (
        <ChecklistPanel {...shared} courses={courses} course={course} onCourse={setCourseId} onUploadDocument={onUploadDocument} />
      ) : sub === "evidencias" ? (
        <EvidenciasPanel {...shared} courses={courses} course={course} onCourse={setCourseId} />
      ) : sub === "cronograma" ? (
        <CronogramaPanel {...shared} />
      ) : (
        <CpaPanel {...shared} />
      )}
      <p className="area-field-help">
        O roteiro de verificação é uma orientação do Vértice para organizar as evidências. Confira os títulos e os critérios no instrumento
        publicado pelo INEP. O diagnóstico registra a avaliação interna e não substitui a avaliação oficial.
      </p>
    </div>
  );
}

// ================================================================ painel institucional (recredenciamento — 5 eixos)
function InstitucionalPanel({ institutionId, role, onUploadDocument }: { institutionId: string; role: Role | null; onUploadDocument?: Props["onUploadDocument"] }) {
  const [linkedDocs, setLinkedDocs] = useState<DocumentoVinculado[]>([]);
  const documents=useNovoInstrumentoDocs2026(institutionId,role,"institucional",null);
  const [filtroEixo, setFiltroEixo] = useState(0);
  const [filtroTema, setFiltroTema] = useState("");
  const [busca, setBusca] = useState("");
  const objetos = useMemo(() => {
    let list = OBJETOS_INSTITUCIONAL;
    if (filtroEixo) list = list.filter(o => o.eixo === filtroEixo);
    if (filtroTema) list = list.filter(o => o.temas.includes(filtroTema as Tema));
    if (busca) { const q = busca.toLowerCase(); list = list.filter(o => o.code.includes(q) || o.title.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q)); }
    return list;
  }, [filtroEixo, filtroTema, busca]);

  return (
    <div className="ni-inst-panel">
      <p className="area-note" style={{marginBottom:12}}>
        <strong>[Não verificado]</strong> Instrumento institucional de recredenciamento em fase de consulta pública.
        Os eixos e objetos abaixo são baseados no parecer CONIF/FDE (jul/2026) e na ata da 211ª reunião da CONAES.
        Serão atualizados quando a versão definitiva for publicada pelo INEP.
      </p>
      <NovoDocumentosResumo2026 state={documents}/>
      <CorrespondenciasInstitucionais institutionId={institutionId} role={role} onLinksUpdated={setLinkedDocs} />
      <div className="ni-inst-eixos">
        {EIXOS_INSTITUCIONAL.map(([n, title]) => {
          const count = OBJETOS_INSTITUCIONAL.filter(o => o.eixo === n).length;
          return (
            <button type="button" key={n} aria-pressed={filtroEixo === n} className={`ni-inst-eixo-card ${filtroEixo === n ? 'active' : ''}`} onClick={() => setFiltroEixo(filtroEixo === n ? 0 : n)}>
              <span className="ni-inst-eixo-num">Eixo {n}</span>
              <strong>{title}</strong>
              <span className="area-muted">{count} objeto{count !== 1 ? 's' : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="ni-filters" style={{marginTop:12}}>
        <label className="area-search"><input placeholder="Buscar objeto" value={busca} onChange={e => setBusca(e.target.value)} /></label>
        <label className="area-search">Tema transversal <select value={filtroTema} onChange={e => setFiltroTema(e.target.value)}><option value="">Todos</option>{TEMAS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <p className="area-muted" style={{marginTop:8}}>{objetos.length} objeto(s) exibido(s)</p>
      <div className="ni-obj-list">
        {objetos.map(o => (
          <details key={o.code} className="ni-obj-row">
            <summary>
              <span className="ni-obj-code">{o.code}</span>
              <span className="ni-obj-title">{o.title}{o.provisorio ? <small className="badge gray">título a confirmar</small> : null}</span>
            </summary>
            <div className="ni-obj-body">
              <p className="area-muted"><strong>Roteiro de verificação (Vértice):</strong> {o.hint}</p>
              <NovoObjetoDocumentos2026 state={documents} role={role} object={{code:o.code,title:o.title,hint:o.hint}}/>
              <div className="ni-linked-evidence"><strong>Documentos reutilizados do instrumento vigente</strong>
                {linkedDocs.filter(d=>d.object_code===o.code).length ? <ul>{linkedDocs.filter(d=>d.object_code===o.code).map(d=><li key={d.source_file_id}>{d.file_name} <small>· vínculo confirmado; conformidade ainda sujeita à avaliação</small></li>)}</ul> : <p className="area-muted small">Nenhum vínculo documental confirmado para este objeto.</p>}
              </div>
              {o.temas.length > 0 && <p className="area-muted">Temas: {o.temas.map(t => TEMAS.find(([k])=>k===t)?.[1] ?? t).join(", ")}</p>}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

// ================================================================ componentes gráficos
type Parte = { value: number; color: string; label: string };

function Donut({ parts, center, caption, size = 96 }: { parts: Parte[]; center: string; caption: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  return (
    <svg className="ni-donut" viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={caption}>
      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e7ecf1" strokeWidth="5" />
      {total > 0 &&
        parts
          .filter(p => p.value > 0)
          .map(p => {
            const len = (p.value / total) * 100;
            const el = (
              <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />
            );
            acc += len;
            return el;
          })}
      <text x="21" y="23" textAnchor="middle" className="ni-donut-text">{center}</text>
    </svg>
  );
}

function Legenda({ parts }: { parts: Parte[] }) {
  return (
    <ul className="area-legend ni-legend">
      {parts.map(p => (
        <li key={p.label}>
          <i style={{ background: p.color }} />
          {p.label}
          <b>{p.value}</b>
        </li>
      ))}
    </ul>
  );
}

function partesConformidade(r: ReturnType<typeof resumir>): Parte[] {
  return CONFORMIDADE.map(([k, l]) => ({ value: r[k], color: CONFORMIDADE_COR[k], label: l }));
}

function Barra({ pct, warn }: { pct: number; warn?: boolean }) {
  return (
    <div className={`area-bar ${warn ? "warn" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function SeletorEscopo({ courses, value, onChange }: { courses: Row[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="area-search ni-scope">
      Escopo da avaliação
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Institucional (dimensões 1 a 3)</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>
            {String(c.name)}
            {perfilArea(c) ? "" : " (sem dimensão 4 catalogada)"}
          </option>
        ))}
      </select>
    </label>
  );
}

// ================================================================ checklist
function ChecklistPanel({ institutionId, role, data, reload, fail, courses, course, onCourse, onUploadDocument }: Shared & { courses: Row[]; course: Row | null; onCourse: (id: string) => void; onUploadDocument?: Props["onUploadDocument"] }) {
  const documents=useNovoInstrumentoDocs2026(institutionId,role,"curso",course?String(course.id):null);
  const courseId = course ? String(course.id) : null;
  const edit = can.record(role);
  const objetos = useMemo(() => objetosDoEscopo(course), [course]);
  const rows = useMemo(() => data.checklist.filter(r => mesmoEscopo(r, courseId)), [data.checklist, courseId]);
  const byCode = useMemo(() => new Map(rows.map(r => [String(r.object_code), r])), [rows]);
  const evCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.evidencias) m.set(String(e.checklist_id), (m.get(String(e.checklist_id)) ?? 0) + 1);
    return m;
  }, [data.evidencias]);

  // Primeira abertura do escopo: cria os objetos que faltam. Cada escopo é tentado uma vez por sessão da tela.
  const tentados = useRef(new Set<string>());
  useEffect(() => {
    const key = `${institutionId}|${courseId ?? ""}`;
    if (!edit || tentados.current.has(key) || objetos.every(o => byCode.has(o.code))) return;
    tentados.current.add(key);
    semearChecklist(institutionId, courseId, objetos, data.checklist).then(n => (n ? reload() : undefined), fail);
  }, [edit, institutionId, courseId, objetos, byCode, data.checklist, reload, fail]);

  const [dim, setDim] = useState(""), [st, setSt] = useState(""), [tema, setTema] = useState(""), [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  const itens = objetos.map(o => {
    const row = byCode.get(o.code);
    return { o, row, status: statusValido(row?.status) };
  });
  const geral = resumir(itens.map(i => i.status));
  // A dimensão específica permanece visível no painel institucional, sem computar ausência de escopo como nota zero.
  const porDim = DIMENSOES_INSTRUMENTO.map(([d, nome]) => ({ d, nome, r: resumir(itens.filter(i => i.o.dimension === d).map(i => i.status)) }));
  const cursosDim4 = courses.filter(c => perfilArea(c) !== null);
  const primeiroCursoDim4 = cursosDim4[0];
  function abrirDim4() {
    if (primeiroCursoDim4) {
      onCourse(String(primeiroCursoDim4.id));
      setDim("4");
    }
  }
  const porTema = TEMAS.map(([t, nome]) => ({ t, nome, r: resumir(itens.filter(i => i.o.temas.includes(t)).map(i => i.status)) }));
  const semEvidencia = itens.filter(i => i.status === "conforme" && !(i.row && evCount.get(String(i.row.id)))).length;

  const filtrados = itens.filter(
    i =>
      (!dim || String(i.o.dimension) === dim) &&
      (!st || i.status === st) &&
      (!tema || i.o.temas.includes(tema as Tema)) &&
      (!q || `${i.o.code} ${i.o.title} ${i.o.group}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function gravar(o: ObjetoInstrumento, row: Row | undefined, patch: Record<string, unknown>) {
    setBusy(o.code);
    try {
      if (row) await saveRow(NI_TABLES.checklist, patch, String(row.id));
      else await saveRow(NI_TABLES.checklist, { institution_id: institutionId, course_id: courseId, dimension: o.dimension, object_code: o.code, ...patch });
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Checklist diagnóstico · {objetos.length} objetos de avaliação</h3>
          <SeletorEscopo courses={courses} value={courseId ?? ""} onChange={onCourse} />
        </div>
        {course && !perfilArea(course) && (
          <p className="area-note">A dimensão 4 está catalogada para a Área 04 (Negócios, Administração e Direito). Este curso é avaliado nas dimensões 1 a 3.</p>
        )}
        {course && perfilArea(course) && <p className="area-muted small">Perfil da dimensão 4: {PERFIL_ROTULO[perfilArea(course)!]}.</p>}
        {!course && <p className="area-note">Visão institucional: as dimensões 1 a 3 compõem este diagnóstico. A dimensão 4 é específica do curso e aparece abaixo como <strong>seleção necessária</strong>, sem nota zero ou resultado institucional artificial. Selecione um curso para consultar e registrar seus objetos.</p>}
        <div className="ni-summary">
          <div className="ni-summary-main">
            <Donut parts={partesConformidade(geral)} center={`${geral.pctConforme}%`} caption={`${geral.pctConforme}% dos objetos conformes`} size={132} />
            <div>
              <strong>{geral.pctConforme}% conforme</strong>
              <p className="area-muted small">{geral.pctAvaliado}% dos objetos já foram avaliados</p>
              <Legenda parts={partesConformidade(geral)} />
              {semEvidencia > 0 && <p className="ni-warn small">{semEvidencia} objeto(s) conforme(s) sem evidência anexada.</p>}
            </div>
          </div>
          <div className="ni-dims">
            {porDim.map(({ d, nome, r }) => (
              <article key={d} className="ni-dim-card">
                {r.total > 0 ? (
                  <Donut parts={partesConformidade(r)} center={`${r.pctConforme}%`} caption={`Dimensão ${d}: ${r.pctConforme}% conforme`} size={64} />
                ) : (
                  <div className="ni-donut" style={{ width: 64, height: 64, display: "grid", placeItems: "center", border: "5px solid #e7ecf1", borderRadius: "50%", boxSizing: "border-box" }} aria-label={`Dimensão ${d}: sem avaliação neste escopo`}>
                    <strong style={{ fontSize: 12 }}>N/A</strong>
                  </div>
                )}
                <div>
                  <small>Dimensão {d}</small>
                  <b>{nome}</b>
                  <span className="area-muted small">
                    {r.total > 0 ? `${r.conforme} conformes de ${r.total} · ${r.pctAvaliado}% avaliado` : d === 4 ? "Selecione um curso para avaliar" : "Sem objetos neste escopo"}
                  </span>
                  {d === 4 && !course && primeiroCursoDim4 && (
                    <button type="button" className="corp-login-text-button" onClick={abrirDim4}>
                      Abrir dimensão 4 por curso
                    </button>
                  )}
                  {d === 4 && !course && !primeiroCursoDim4 && <span className="area-muted small">Nenhum curso com perfil específico identificado</span>}
                </div>
              </article>
            ))}
          </div>
        </div>
        <h4 className="area-subhead">Temas transversais</h4>
        <div className="ni-temas">
          {porTema.map(({ t, nome, r }) => (
            <div key={t} className="area-ov-row">
              <div className="area-ov-label">
                <span>{nome}</span>
                <b>
                  {r.conforme}/{r.total} conformes · {r.pctConforme}%
                </b>
              </div>
              <Barra pct={r.pctConforme} />
            </div>
          ))}
        </div>
      </div>

      <div className="area-panel">
        <div className="area-inline ni-filters">
          <label className="area-search">
            Buscar objeto
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Código ou nome" />
          </label>
          <label className="area-search">
            Dimensão
            <select value={dim} onChange={e => setDim(e.target.value)}>
              <option value="">Todas</option>
              {porDim.map(({ d, nome }) => (
                <option key={d} value={d}>
                  {d} · {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="area-search">
            Situação
            <select value={st} onChange={e => setSt(e.target.value)}>
              <option value="">Todas</option>
              {CONFORMIDADE.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>
          <label className="area-search">
            Tema transversal
            <select value={tema} onChange={e => setTema(e.target.value)}>
              <option value="">Todos</option>
              {TEMAS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        {dim === "4" && !course && (
          <p className="area-note">A dimensão 4 não possui pontuação institucional. {primeiroCursoDim4 ? "Escolha um curso no seletor acima ou abra diretamente a avaliação específica." : "Nenhum curso com perfil específico identificado; confira o cadastro e a classificação dos cursos."} {primeiroCursoDim4 && <button type="button" className="corp-login-text-button" onClick={abrirDim4}>Selecionar curso</button>}</p>
        )}
        {dim === "4" && course && !perfilArea(course) && <p className="area-note">A dimensão 4 não está catalogada para este curso. Confira a classificação regulatória antes de cadastrar objetos específicos.</p>}
        <p aria-live="polite" className="area-muted small">{filtrados.length} objeto(s) exibido(s)</p>
        <NovoDocumentosResumo2026 state={documents}/>
        {porDim.map(({ d, nome }) => {
          const lista = filtrados.filter(i => i.o.dimension === d);
          if (!lista.length) return null;
          return (
            <section key={d} className="area-dim">
              <h4>
                Dimensão {d} · {nome} <small>{lista.length} objeto(s)</small>
              </h4>
              <div className="table-scroll">
                <table className="area-table ni-table">
                  <thead>
                    <tr><th>Código</th><th>Objeto de avaliação</th><th>Situação</th><th>Responsável</th><th>Evidências</th><th /></tr>
                  </thead>
                  <tbody>
                    {lista.map(({ o, row, status }) => {
                      const ev = row ? evCount.get(String(row.id)) ?? 0 : 0;
                      const aberto = open === o.code;
                      return (
                        <ObjetoLinhas key={o.code} o={o} row={row} status={status} ev={ev} aberto={aberto} edit={edit} ocupado={busy === o.code}
                          onToggle={() => setOpen(aberto ? null : o.code)}
                          onStatus={v => gravar(o, row, { status: v })}
                          onSalvar={(notes, responsible) => gravar(o, row, { notes: notes || null, responsible: responsible || null })}
                          onUpload={undefined} onDocumentPanel={course? <NovoObjetoDocumentos2026 state={documents} role={role} object={{code:o.code,title:o.title,hint:o.hint}}/>:null} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ObjetoLinhas({ o, row, status, ev, aberto, edit, ocupado, onToggle, onStatus, onSalvar, onUpload, onDocumentPanel }: {
  o: ObjetoInstrumento; row?: Row; status: Conformidade; ev: number; aberto: boolean; edit: boolean; ocupado: boolean;
  onToggle: () => void; onStatus: (v: Conformidade) => void; onSalvar: (notes: string, responsible: string) => void; onUpload?: () => void; onDocumentPanel?: ReactNode;
}) {
  const [notes, setNotes] = useState(String(row?.notes ?? ""));
  const [resp, setResp] = useState(String(row?.responsible ?? ""));
  useEffect(() => {
    setNotes(String(row?.notes ?? ""));
    setResp(String(row?.responsible ?? ""));
  }, [row?.notes, row?.responsible]);
  return (
    <>
      <tr>
        <td><strong>{o.code}</strong></td>
        <td>
          <strong>{o.title}</strong>
          {o.provisorio && <span className="badge gray ni-chip" title="Título inferido pelo agrupamento do levantamento; confirmar no instrumento publicado.">título a confirmar</span>}
          <small className="area-block">{o.group}</small>
          {o.requisito && <small className="area-block warn">{o.requisito}</small>}
          <span className="ni-tags">
            {o.temas.map(t => (
              <span key={t} className="ni-tag">{TEMAS.find(([k]) => k === t)?.[1]}</span>
            ))}
          </span>
        </td>
        <td>
          {edit ? (
            <select value={status} disabled={ocupado} aria-label={`Situação do objeto ${o.code}`} onChange={e => onStatus(e.target.value as Conformidade)}>
              {CONFORMIDADE.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          ) : (
            <span className={`badge ${CONFORMIDADE_BADGE[status]}`}>{CONFORMIDADE.find(([k]) => k === status)?.[1]}</span>
          )}
        </td>
        <td><small>{String(row?.responsible ?? "—")}</small></td>
        <td>
          {ev}
          {status === "conforme" && !ev && <small className="area-block ni-warn">sem evidência</small>}
        </td>
        <td className="area-row-actions">
          <button className="corp-login-text-button" aria-expanded={aberto} onClick={onToggle}>
            {aberto ? "Fechar" : "Detalhes"}
          </button>
        </td>
      </tr>
      {aberto && (
        <tr className="ni-detail">
          <td />
          <td colSpan={5}>
            <p className="area-muted small"><strong>Roteiro de verificação:</strong> {o.hint}</p>
            {onUpload && <button type="button" className="corp-button small" onClick={onUpload}>Enviar arquivo deste objeto</button>}
            {onDocumentPanel}
            {(() => {
              const fontes = indicadoresDoObjeto2026(o.code);
              if (!fontes.length) return null;
              const names = indicatorNames as Record<string, string>;
              return (
                <div className="ni-espelhamento">
                  <strong>🔗 Instrumento 2017 — Reconhecimento</strong>
                  {fontes.map(f => (
                    <div key={f.ind} className="ni-espelhamento-item">
                      <span className="ni-espelhamento-tag" style={{ borderColor: GRAU_COR[f.grau] }}>
                        <b>{f.ind}</b> {names[f.ind] ?? "Indicador"}
                      </span>
                      <span className="ni-espelhamento-grau" style={{ color: GRAU_COR[f.grau] }}>{GRAU_LABEL[f.grau]}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="area-form-grid">
              <label>
                Responsável
                <input value={resp} maxLength={200} disabled={!edit} onChange={e => setResp(e.target.value)} />
              </label>
              <label className="wide">
                Observações e achados
                <textarea rows={3} maxLength={4000} value={notes} disabled={!edit} onChange={e => setNotes(e.target.value)} />
              </label>
            </div>
            {edit && (
              <div className="area-form-actions">
                <button className="corp-button small" disabled={ocupado} onClick={() => onSalvar(notes.trim(), resp.trim())}>
                  {ocupado ? "Salvando…" : "Salvar detalhes"}
                </button>
              </div>
            )}
            {row?.updated_at ? <p className="area-muted small">Última atualização em {fmtDate(String(row.updated_at).slice(0, 10))}.</p> : null}
          </td>
        </tr>
      )}
    </>
  );
}

// ================================================================ evidências
function EvidenciasPanel({ institutionId, role, data, reload, fail, courses, course, onCourse }: Shared & { courses: Row[]; course: Row | null; onCourse: (id: string) => void }) {
  const courseId = course ? String(course.id) : null;
  const edit = can.record(role);
  const objetos = useMemo(() => objetosDoEscopo(course), [course]);
  const rows = useMemo(() => data.checklist.filter(r => mesmoEscopo(r, courseId)), [data.checklist, courseId]);
  const byCode = useMemo(() => new Map(rows.map(r => [String(r.object_code), r])), [rows]);
  const idParaCodigo = useMemo(() => new Map(rows.map(r => [String(r.id), String(r.object_code)])), [rows]);
  const lista = data.evidencias.filter(e => idParaCodigo.has(String(e.checklist_id)));
  const comEvidencia = new Set(lista.map(e => idParaCodigo.get(String(e.checklist_id))!));
  const sem = objetos.filter(o => !comEvidencia.has(o.code));

  const [code, setCode] = useState(""), [nome, setNome] = useState(""), [url, setUrl] = useState(""), [desc, setDesc] = useState("");
  const [filtro, setFiltro] = useState(""), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const objeto = objetos.find(o => o.code === code);
    if (!objeto) return setMsg("Escolha o objeto de avaliação.");
    const link = url.trim() ? urlSegura(url) : null;
    if (url.trim() && !link) return setMsg("Informe um endereço completo iniciado por https://.");
    setBusy(true);
    try {
      const checklistId = await garantirLinhaChecklist(institutionId, courseId, objeto, byCode.get(code));
      const by = await usuarioAtual();
      const { error } = await supabase.from(NI_TABLES.evidencias).insert({
        checklist_id: checklistId, institution_id: institutionId, file_name: nome.trim(), file_url: link, description: desc.trim() || null, uploaded_by: by,
      });
      if (error) throw error;
      setNome(""); setUrl(""); setDesc("");
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const exibidas = lista.filter(e => !filtro || idParaCodigo.get(String(e.checklist_id)) === filtro);
  return (
    <>
      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Repositório de evidências</h3>
          <SeletorEscopo courses={courses} value={courseId ?? ""} onChange={onCourse} />
        </div>
        <div className="area-stat-grid">
          <article><small>Evidências registradas</small><b>{lista.length}</b></article>
          <article><small>Objetos com evidência</small><b>{comEvidencia.size}/{objetos.length}</b></article>
          <article className={sem.length ? "warn" : ""}><small>Objetos sem evidência</small><b>{sem.length}</b></article>
        </div>
        {edit && (
          <form className="area-form" onSubmit={enviar}>
            <h3>Registrar evidência</h3>
            <div className="area-form-grid">
              <label>
                Objeto de avaliação <em>*</em>
                <select required value={code} onChange={e => setCode(e.target.value)}>
                  <option value="">Selecione…</option>
                  {objetos.map(o => (
                    <option key={o.code} value={o.code}>{o.code} · {o.title}</option>
                  ))}
                </select>
              </label>
              <label>
                Nome do documento <em>*</em>
                <input required maxLength={250} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Portaria do NDE 2026" />
              </label>
              <label>
                Link do documento
                <input type="url" maxLength={2000} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
                <small>Endereço do arquivo no repositório da IES ou em nuvem. Aceita somente https.</small>
              </label>
              <label className="wide">
                Descrição
                <textarea rows={2} maxLength={2000} value={desc} onChange={e => setDesc(e.target.value)} />
              </label>
            </div>
            {msg && <p role="alert" className="area-error">{msg}</p>}
            <div className="area-form-actions">
              <button className="corp-button small" disabled={busy}>{busy ? "Registrando…" : "Registrar evidência"}</button>
            </div>
          </form>
        )}
        {sem.length > 0 && (
          <details className="ni-sem">
            <summary>{sem.length} objeto(s) ainda sem evidência</summary>
            <p className="ni-chips">
              {sem.map(o => (
                <button key={o.code} type="button" className="ni-chip-btn" disabled={!edit} title={o.title} onClick={() => setCode(o.code)}>
                  {o.code}
                </button>
              ))}
            </p>
          </details>
        )}
      </div>
      <div className="area-panel">
        <div className="area-panel-head">
          <h3>Evidências do escopo</h3>
          <label className="area-search">
            Filtrar por objeto
            <select value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="">Todos</option>
              {objetos.filter(o => comEvidencia.has(o.code)).map(o => (
                <option key={o.code} value={o.code}>{o.code} · {o.title}</option>
              ))}
            </select>
          </label>
        </div>
        {!exibidas.length ? (
          <p className="area-muted">Nenhuma evidência registrada neste escopo.</p>
        ) : (
          <div className="table-scroll">
            <table className="area-table">
              <thead><tr><th>Objeto</th><th>Documento</th><th>Descrição</th><th>Registrado em</th><th /></tr></thead>
              <tbody>
                {exibidas.map(ev => {
                  const c = idParaCodigo.get(String(ev.checklist_id))!;
                  const link = ev.file_url ? urlSegura(String(ev.file_url)) : null;
                  return (
                    <tr key={ev.id}>
                      <td><strong>{c}</strong><small className="area-block">{objetos.find(o => o.code === c)?.title}</small></td>
                      <td>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{String(ev.file_name)} ↗</a> : String(ev.file_name)}</td>
                      <td><small>{String(ev.description ?? "—")}</small></td>
                      <td>{fmtDate(String(ev.uploaded_at).slice(0, 10))}</td>
                      <td className="area-row-actions">
                        {can.remove(role) && (
                          <button
                            className="corp-login-text-button area-danger"
                            onClick={async () => {
                              if (!window.confirm("Remover esta evidência? A operação fica registrada na auditoria.")) return;
                              try { await deleteRow(NI_TABLES.evidencias, String(ev.id)); await reload(); } catch (err) { fail(err); }
                            }}
                          >
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ================================================================ cronograma
function statusDaFase(rows: Row[]): AndamentoStatus {
  if (rows.length && rows.every(r => r.status === "concluido")) return "concluido";
  return rows.some(r => r.status !== "pendente") ? "em_andamento" : "pendente";
}

function CronogramaPanel({ institutionId, role, data, reload, fail }: Shared) {
  const edit = can.record(role);
  const [ciclo, setCiclo] = useState(1);
  const rows = data.ciclo.filter(r => Number(r.cycle_number) === ciclo);
  const byCode = new Map(rows.map(r => [String(r.milestone), r]));
  const inicio = CICLO_BASE[ciclo];
  const anoAtual = new Date().getFullYear();

  const tentados = useRef(new Set<number>());
  useEffect(() => {
    if (!edit || tentados.current.has(ciclo) || MARCOS.every(m => byCode.has(m.code))) return;
    tentados.current.add(ciclo);
    semearCiclo(institutionId, ciclo, data.ciclo).then(n => (n ? reload() : undefined), fail);
  }, [edit, ciclo, institutionId, byCode, data.ciclo, reload, fail]);

  const fases = FASES.map(f => {
    const marcos = MARCOS.filter(m => m.fase === f.fase).map(m => ({ m, row: byCode.get(m.code) }));
    const existentes = marcos.map(x => x.row).filter((r): r is Row => Boolean(r));
    const feitos = marcos.filter(x => x.row?.status === "concluido").length;
    return { ...f, ano: inicio + f.offset, marcos, status: statusDaFase(existentes.length === marcos.length ? existentes : []), feitos, pct: Math.round((feitos / marcos.length) * 100) };
  });
  const totalFeitos = fases.reduce((s, f) => s + f.feitos, 0);
  const pctGeral = Math.round((totalFeitos / MARCOS.length) * 100);

  async function mudar(m: (typeof MARCOS)[number], row: Row | undefined, patch: Record<string, unknown>) {
    try {
      if (row) await saveRow(NI_TABLES.ciclo, patch, String(row.id));
      else await saveRow(NI_TABLES.ciclo, { institution_id: institutionId, cycle_number: ciclo, milestone: m.code, target_year: inicio + m.offset, ...patch });
      await reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Cronograma do ciclo trienal</h3>
        <label className="area-search">
          Ciclo
          <select value={ciclo} onChange={e => setCiclo(Number(e.target.value))}>
            {Object.keys(CICLO_BASE).map(n => (
              <option key={n} value={n}>{cicloRotulo(Number(n))}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="ni-timeline-wrap">
        <svg className="ni-timeline" viewBox="0 0 600 130" role="img" aria-label={`Linha do tempo do ciclo ${inicio} a ${inicio + 2}: ${fases.map(f => `${f.title}, ${f.pct}% concluído`).join("; ")}`}>
          <line x1="100" y1="42" x2="500" y2="42" stroke="#dfe5ec" strokeWidth="4" />
          {fases.map((f, i) => (
            <g key={f.fase}>
              {i > 0 && <line x1={100 + (i - 1) * 200} y1="42" x2={100 + i * 200} y2="42" stroke={fases[i - 1].status === "concluido" ? ANDAMENTO_COR.concluido : "#dfe5ec"} strokeWidth="4" />}
              <circle cx={100 + i * 200} cy="42" r="20" fill={ANDAMENTO_COR[f.status]} stroke={f.ano === anoAtual ? "#243653" : "#fff"} strokeWidth="3" />
              <text x={100 + i * 200} y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">{i + 1}</text>
              <text x={100 + i * 200} y="85" textAnchor="middle" fontSize="14" fontWeight="700" fill="#243653">{f.fase === "enade" ? "ENADE" : f.fase === "cpa" ? "Autoavaliação (CPA)" : "Visita in loco"}</text>
              <text x={100 + i * 200} y="104" textAnchor="middle" fontSize="13" fill="#627184">{f.ano}{f.ano === anoAtual ? " · ano corrente" : ""}</text>
              <text x={100 + i * 200} y="122" textAnchor="middle" fontSize="12" fill="#627184">{f.pct}% concluído</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="area-muted small">Marcos concluídos no ciclo: <strong>{totalFeitos}/{MARCOS.length}</strong> ({pctGeral}%). O marco principal de cada ano encerra a respectiva etapa.</p>
      <Barra pct={pctGeral} />
      <div className="ni-fases">
        {fases.map(f => (
          <section key={f.fase} className="area-card ni-fase">
            <div className="area-card-top">
              <h4>{f.title}</h4>
              <span className={`badge ${ANDAMENTO_BADGE[f.status]}`}>{ANDAMENTO.find(([k]) => k === f.status)?.[1]}</span>
            </div>
            <small className="area-muted">{f.subtitle} · meta em {f.ano}</small>
            <Barra pct={f.pct} />
            <ul className="ni-marcos">
              {f.marcos.map(({ m, row }) => {
                const s = (row?.status as AndamentoStatus) ?? "pendente";
                const atrasado = s !== "concluido" && inicio + m.offset < anoAtual;
                return (
                  <li key={m.code} className={m.principal ? "principal" : ""}>
                    <div className="ni-marco-top">
                      <span>{m.title}{atrasado && <b className="ni-warn"> · atrasado</b>}</span>
                      {edit ? (
                        <select value={s} aria-label={m.title} onChange={e => mudar(m, row, { status: e.target.value })}>
                          {ANDAMENTO.map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${ANDAMENTO_BADGE[s]}`}>{ANDAMENTO.find(([k]) => k === s)?.[1]}</span>
                      )}
                    </div>
                    <CampoTexto valor={String(row?.notes ?? "")} rotulo={`Observações: ${m.title}`} placeholder="Observações do marco" desabilitado={!edit} onSalvar={v => mudar(m, row, { notes: v || null })} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Campo de texto que grava ao sair do campo, somente se o valor mudou. */
function CampoTexto({ valor, rotulo, placeholder, desabilitado, onSalvar, tipo = "text" }: {
  valor: string; rotulo: string; placeholder?: string; desabilitado?: boolean; onSalvar: (v: string) => void; tipo?: "text" | "date";
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input
      type={tipo}
      className="ni-inline-input"
      aria-label={rotulo}
      placeholder={placeholder}
      maxLength={tipo === "text" ? 4000 : undefined}
      value={v}
      disabled={desabilitado}
      onChange={e => setV(e.target.value)}
      onBlur={() => v.trim() !== valor && onSalvar(v.trim())}
    />
  );
}

// ================================================================ CPA
function CpaPanel({ institutionId, role, data, reload, fail }: Shared) {
  const edit = can.record(role);
  const rows = data.cpa;
  const refDe = new Map(ITENS_CPA.map(i => [i.item, i.ref]));

  const tentou = useRef(false);
  useEffect(() => {
    if (!edit || tentou.current || ITENS_CPA.every(i => rows.some(r => r.item === i.item))) return;
    tentou.current = true;
    semearCpa(institutionId, rows).then(n => (n ? reload() : undefined), fail);
  }, [edit, institutionId, rows, reload, fail]);

  const [novo, setNovo] = useState("");
  const total = rows.length;
  const concl = rows.filter(r => r.status === "concluido").length;
  const andam = rows.filter(r => r.status === "em_andamento").length;
  const atrasados = rows.filter(r => r.status !== "concluido" && r.deadline && String(r.deadline) < today()).length;
  const pct = total ? Math.round((concl / total) * 100) : 0;
  const partes: Parte[] = [
    { value: concl, color: ANDAMENTO_COR.concluido, label: "Concluído" },
    { value: andam, color: ANDAMENTO_COR.em_andamento, label: "Em andamento" },
    { value: total - concl - andam, color: ANDAMENTO_COR.pendente, label: "Pendente" },
  ];

  async function mudar(row: Row, patch: Record<string, unknown>) {
    try {
      await saveRow(NI_TABLES.cpa, patch, String(row.id));
      await reload();
    } catch (e) {
      fail(e);
    }
  }
  async function adicionar(e: FormEvent) {
    e.preventDefault();
    try {
      await saveRow(NI_TABLES.cpa, { institution_id: institutionId, item: novo.trim(), status: "pendente" });
      setNovo("");
      await reload();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Prontidão da CPA para o novo instrumento</h3>
      </div>
      <div className="ni-summary-main">
        <Donut parts={partes} center={`${pct}%`} caption={`${pct}% dos itens da CPA concluídos`} size={120} />
        <div>
          <strong>{concl} de {total} itens concluídos</strong>
          <Legenda parts={partes} />
          {atrasados > 0 && <p className="ni-warn small">{atrasados} item(ns) com prazo vencido.</p>}
        </div>
      </div>
      <div className="table-scroll">
        <table className="area-table ni-table">
          <thead><tr><th>Item de prontidão</th><th>Situação</th><th>Responsável</th><th>Prazo</th><th>Observações</th><th /></tr></thead>
          <tbody>
            {rows.map(r => {
              const s = (r.status as AndamentoStatus) ?? "pendente";
              const venc = s !== "concluido" && r.deadline && String(r.deadline) < today();
              return (
                <tr key={r.id} className={venc ? "late" : ""}>
                  <td>
                    <strong>{String(r.item)}</strong>
                    {refDe.get(String(r.item)) && <small className="area-block">{refDe.get(String(r.item))}</small>}
                  </td>
                  <td>
                    {edit ? (
                      <select value={s} aria-label={`Situação: ${String(r.item)}`} onChange={e => mudar(r, { status: e.target.value })}>
                        {ANDAMENTO.map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`badge ${ANDAMENTO_BADGE[s]}`}>{ANDAMENTO.find(([k]) => k === s)?.[1]}</span>
                    )}
                  </td>
                  <td><CampoTexto valor={String(r.responsible ?? "")} rotulo={`Responsável: ${String(r.item)}`} desabilitado={!edit} onSalvar={v => mudar(r, { responsible: v || null })} /></td>
                  <td><CampoTexto tipo="date" valor={String(r.deadline ?? "")} rotulo={`Prazo: ${String(r.item)}`} desabilitado={!edit} onSalvar={v => mudar(r, { deadline: v || null })} />{venc ? <small className="ni-warn area-block">vencido</small> : null}</td>
                  <td><CampoTexto valor={String(r.notes ?? "")} rotulo={`Observações: ${String(r.item)}`} desabilitado={!edit} onSalvar={v => mudar(r, { notes: v || null })} /></td>
                  <td className="area-row-actions">
                    {can.remove(role) && (
                      <button
                        className="corp-login-text-button area-danger"
                        onClick={async () => {
                          if (!window.confirm("Remover este item? A operação fica registrada na auditoria.")) return;
                          try { await deleteRow(NI_TABLES.cpa, String(r.id)); await reload(); } catch (err) { fail(err); }
                        }}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="area-muted">Nenhum item registrado.</p>}
      {edit && (
        <form className="area-inline-form ni-add" onSubmit={adicionar}>
          <label>
            Novo item de prontidão
            <input required maxLength={300} value={novo} onChange={e => setNovo(e.target.value)} placeholder="Descreva o item" />
          </label>
          <button className="corp-button small">Adicionar item</button>
        </form>
      )}
    </div>
  );
}
