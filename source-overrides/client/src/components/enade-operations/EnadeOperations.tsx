import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardCheck,
  Download,
  History,
  Search,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import { loadOperations, saveOperation } from "./api";
import {
  blank,
  CHECKS,
  CHECK_LABELS,
  ENVIRONMENTS,
  FRONTS,
  LEVELS,
  merge,
  safeUrl,
  STATUSES,
  validation,
  type Entry,
  type Payload,
  type Scope,
} from "./model";
import { SOURCES } from "./baseline";
import "./operations.css";
type Props = {
  institutions: { id: string; name: string; acronym?: string | null }[];
  courses: { id: string; name: string; institution_id: string }[];
};
const PAGES = [
  ["overview", "Visão geral"],
  ["fronts", "Frentes e evidências"],
  ["documents", "Documentos e OCR"],
  ["reports", "Relatórios R2–R6"],
  ["checklists", "Checklists"],
  ["risks", "Bloqueios e decisões"],
  ["history", "Validações e aprovações"],
  ["comparison", "Antes e agora"],
];
const day = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(s));
function Link({
  url,
  label = "Abrir evidência",
}: {
  url: string;
  label?: string;
}) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label} <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  ) : (
    <span className="eop-muted">Não informado</span>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "eop-badge " +
        (status === "bloqueado"
          ? "is-blocked"
          : status === "homologado"
            ? "is-approved"
            : "")
      }
    >
      {status}
    </span>
  );
}
export default function EnadeOperations({ institutions, courses }: Props) {
  const [scope, setScope] = useState<Scope>({
    institution_id: null,
    course_id: null,
    environment: "Homologação",
  });
  const [page, setPage] = useState("overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]),
    [current, setCurrent] = useState<Entry[]>([]),
    [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [fetched, setFetched] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<Payload | null>(null),
    [kind, setKind] = useState<Entry["kind"]>("revision"),
    [formError, setFormError] = useState("");
  const [requestId, setRequestId] = useState(""),
    [expected, setExpected] = useState(0);
  const detail = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef(0),
    previousFocus = useRef<HTMLElement | null>(null);
  const scopeName = scope.institution_id
    ? institutions.find((i) => i.id === scope.institution_id)?.name ||
      "Instituição"
    : "Núcleo genérico · todos os bacharelados";
  const courseName = scope.course_id
    ? courses.find((c) => c.id === scope.course_id)?.name
    : "Escopo institucional";
  async function refresh() {
    const id = ++request.current;
    setLoading(true);
    setError("");
    setEntries([]);
    setCurrent([]);
    setCursor(null);
    setFetched("");
    try {
      const data = await loadOperations(scope);
      if (id === request.current) {
        setEntries(data.entries);
        setCurrent(data.current);
        setCursor(data.next_before);
        setFetched(data.fetched_at);
      }
    } catch (e) {
      if (id === request.current)
        setError((e as Error).message || "Consulta indisponível.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [scope.institution_id, scope.course_id, scope.environment]);
  useEffect(() => {
    if (draft) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [!!draft]);
  useEffect(() => {
    if (selected && page !== "checklists" && !draft)
      detail.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [selected, page, !!draft]);
  const rows = FRONTS.map(([id, name, summary]) => ({
    id,
    name,
    summary,
    entry: current.find((e) => e.front === id),
  }));
  const displayed = rows.filter(
    (r) =>
      (!query ||
        `${r.name} ${r.summary} ${r.entry?.payload.version || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR"))) &&
      (!filter || (r.entry?.payload.status || "não confirmado") === filter),
  );
  const limited =
    page === "documents"
      ? displayed.filter((r) =>
          [
            "extraction",
            "ocr",
            "classification",
            "index",
            "sapiens",
            "planning",
          ].includes(r.id),
        )
      : page === "reports"
        ? displayed.filter((r) => /^r[2-6]$/.test(r.id))
        : displayed;
  const blockers = rows.filter(
    (r) =>
      r.entry?.payload.status === "bloqueado" ||
      r.entry?.payload.failure ||
      r.entry?.payload.dependencies,
  );
  const proven = rows.filter(
    (r) =>
      r.entry?.payload.status === "comprovadamente funcional" ||
      r.entry?.payload.status === "homologado",
  );
  const journal = merge(current, entries).filter((e) => e.front === selected);
  const active = rows.find((r) => r.id === selected);
  function start(front: string, mode: Entry["kind"] = "revision") {
    const row = current.find((e) => e.front === front);
    setSelected(front);
    setKind(mode);
    setFormError("");
    setNotice("");
    setExpected(row?.seq ?? 0);
    setRequestId(crypto.randomUUID());
    setDraft(
      mode === "revision"
        ? { ...(row?.payload || blank()), confirmHuman: false }
        : {
            ...blank(),
            action: "merge",
            version: row?.payload.version || "",
            target: "",
            approvalReference: "",
          },
    );
  }
  function patch<K extends keyof Payload>(key: K, value: Payload[K]) {
    setDraft((d) => {
      if (!d) return d;
      const reset =
        key === "version" && value !== d.version
          ? {
              tests: blank().tests,
              checks: blank().checks,
              confirmHuman: false,
            }
          : {};
      return { ...d, ...reset, [key]: value };
    });
  }
  function close() {
    if (!busy) {
      setDraft(null);
      setFormError("");
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !selected || busy) return;
    const issue =
      kind === "revision"
        ? validation(draft, scope.environment)
        : !draft.confirmHuman ||
            !draft.version.trim() ||
            !draft.target?.trim() ||
            !safeUrl(draft.approvalReference || "") ||
            draft.note.trim().length < 5
          ? "A aprovação exige confirmação explícita, versão, alvo exato, justificativa e URL do aceite."
          : "";
    if (issue) {
      setFormError(issue);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const saved = await saveOperation(
        scope,
        selected,
        kind,
        draft,
        requestId,
        expected,
      );
      setEntries((p) => merge([saved], p));
      if (kind === "revision")
        setCurrent((p) => [...p.filter((r) => r.front !== selected), saved]);
      setDraft(null);
      setNotice(
        "Registro salvo. Nenhum merge, migração, publicação ou aprovação acadêmica foi executado.",
      );
    } catch (e) {
      setFormError(
        (e as Error).message ||
          "Falha ao salvar. Confira o histórico antes de repetir.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!cursor || busy) return;
    setBusy(true);
    const id = request.current;
    try {
      const data = await loadOperations(scope, cursor);
      if (id === request.current) {
        setEntries((p) => merge(p, data.entries));
        setCursor(data.next_before);
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const a = document.createElement("a"),
      u = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                scope,
                current,
                entries,
                history_has_more: !!cursor,
                fetched_at: fetched,
                exported_at: new Date().toISOString(),
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
    a.href = u;
    a.download = "enade360-acompanhamento.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  function field(
    key: keyof Payload,
    label: string,
    multiline = false,
    help = "",
  ) {
    return (
      <label key={key} className={multiline ? "eop-wide" : ""}>
        {label}
        {multiline ? (
          <textarea
            name={key}
            rows={3}
            maxLength={4000}
            value={String(draft?.[key] ?? "")}
            onChange={(e) => patch(key, e.target.value as never)}
          />
        ) : (
          <input
            name={key}
            maxLength={2400}
            type={["url", "approvalReference"].includes(key) ? "url" : "text"}
            value={String(draft?.[key] ?? "")}
            onChange={(e) => patch(key, e.target.value as never)}
          />
        )}{" "}
        {help && <small>{help}</small>}
      </label>
    );
  }
  function cards() {
    return (
      <div className="eop-fronts">
        {limited.map((r) => (
          <article className="eop-front" key={r.id}>
            <div className="eop-front-top">
              <span className="eop-front-id">{r.id.toUpperCase()}</span>
              <Badge status={r.entry?.payload.status || "não confirmado"} />
            </div>
            <h3>{r.name}</h3>
            <p>{r.summary}</p>
            <dl>
              <div>
                <dt>Versão</dt>
                <dd>{r.entry?.payload.version || "Não informada"}</dd>
              </div>
              <div>
                <dt>Testes validados</dt>
                <dd>
                  {r.entry?.payload.tests.filter((t) => t.validated).length ||
                    0}{" "}
                  / 4 níveis
                </dd>
              </div>
            </dl>
            <p className="eop-muted">
              {r.entry
                ? "Registro humano · " + day(r.entry.created_at)
                : "Sem validação registrada neste ambiente e escopo."}
            </p>
            <button type="button" onClick={() => setSelected(r.id)}>
              Examinar frente <ArrowUpRight size={15} />
            </button>
          </article>
        ))}
      </div>
    );
  }
  function tests(p: Payload) {
    return (
      <div className="eop-table">
        <table>
          <thead>
            <tr>
              <th>Nível do teste</th>
              <th>Executado</th>
              <th>Validado</th>
              <th>Resultado</th>
              <th>Evidência</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((level) => {
              const t = p.tests.find((t) => t.level === level);
              return (
                <tr key={level}>
                  <th>{level}</th>
                  <td>{t?.executed ? "Sim" : "Não confirmado"}</td>
                  <td>{t?.validated ? "Sim" : "Pendente"}</td>
                  <td>
                    {t?.outcome || "não executado"} ·{" "}
                    {t?.result || "Não informado"}
                  </td>
                  <td>
                    <Link url={t?.evidence || ""} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  function checklists(p: Payload, front: string) {
    return (
      <div className="eop-checks">
        {Object.entries(CHECKS).map(([name, keys]) => (
          <section className="eop-panel" key={name}>
            <header>
              <h3>{name}</h3>
              <span>
                {
                  keys.filter(
                    (key) =>
                      p.checks.find((c) => c.key === key)?.result ===
                      "atendido",
                  ).length
                }{" "}
                / {keys.length}
              </span>
            </header>
            {keys.map((key) => {
              const c = p.checks.find((c) => c.key === key);
              return (
                <div className="eop-check" key={key}>
                  <ClipboardCheck size={18} />
                  <div>
                    <strong>{CHECK_LABELS[key]}</strong>
                    <p>{c?.note || "Evidência e validação pendentes."}</p>
                    {c?.evidence && <Link url={c.evidence} />}
                  </div>
                  <Badge status={c?.result || "pendente"} />
                </div>
              );
            })}
            <button
              type="button"
              disabled={!!error || loading}
              onClick={() => start(front)}
            >
              Registrar checklist
            </button>
          </section>
        ))}
      </div>
    );
  }
  return (
    <section
      className="eop"
      aria-label="Conclusão operacional do ENADE 360 graus"
    >
      <div className="eop-breadcrumb">
        <a href="/master">
          <ArrowLeft size={14} /> Master
        </a>
        <span>/</span>
        <a href="/master#homologacao=1">Central de Homologação</a>
        <span>/</span>
        <span>ENADE 360°</span>
      </div>
      <header className="eop-heading">
        <div>
          <p className="eop-eyebrow">
            GOVERNANÇA • EVIDÊNCIAS • DECISÃO HUMANA
          </p>
          <h2>
            Da implementação
            <br />à comprovação.
          </h2>
          <p>
            Conclusão operacional e validação científica do ENADE 360°.
            <br />
            Uma visão das frentes, no ambiente existente da Vértice.
          </p>
        </div>
        <div className="eop-head-actions">
          <span className="eop-private">
            <ShieldCheck size={15} /> Master · MFA obrigatório
          </span>
          <button
            type="button"
            onClick={exportData}
            disabled={loading || !!error}
          >
            <Download size={15} /> Exportar registros
          </button>
        </div>
      </header>
      <div className="eop-guard">
        <ShieldCheck size={21} />
        <div>
          <strong>Homologação exige evidência e aceite explícito.</strong>
          <p>
            Código integrado, publicação e funcionamento real têm registros
            próprios. Esta central acompanha decisões; ações externas e
            aprovação de documentos ou indicadores permanecem nos fluxos
            autorizados.
          </p>
        </div>
      </div>
      <div className="eop-scope">
        <label>
          Instituição
          <select
            disabled={busy}
            value={scope.institution_id || ""}
            onChange={(e) => {
              setSelected(null);
              setScope((s) => ({
                ...s,
                institution_id: e.target.value || null,
                course_id: null,
              }));
            }}
          >
            <option value="">Núcleo genérico · bacharelados</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.acronym || i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Curso
          <select
            disabled={!scope.institution_id || busy}
            value={scope.course_id || ""}
            onChange={(e) => {
              setSelected(null);
              setScope((s) => ({ ...s, course_id: e.target.value || null }));
            }}
          >
            <option value="">Escopo institucional</option>
            {courses
              .filter((c) => c.institution_id === scope.institution_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ambiente
          <select
            disabled={busy}
            value={scope.environment}
            onChange={(e) => {
              setSelected(null);
              setScope((s) => ({ ...s, environment: e.target.value }));
            }}
          >
            {ENVIRONMENTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>
      <nav className="eop-tabs" aria-label="Áreas do acompanhamento">
        {PAGES.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={page === id ? "page" : undefined}
            onClick={() => {
              setPage(id);
              setSelected(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {notice && (
        <p className="eop-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Consultando registros protegidos…</p>
      ) : error ? (
        <div className="eop-error" role="alert">
          <AlertTriangle />
          <div>
            <strong>Registros operacionais indisponíveis</strong>
            <p>{error}</p>
            <p>
              Confirme a sessão Master com MFA e a disponibilidade da migração
              autorizada. Não foi presumido estado, homologação ou
              funcionamento.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="eop-context">
            {scopeName} {scope.institution_id ? " / " + courseName : ""} ·{" "}
            {scope.environment} · Consulta:{" "}
            {fetched ? day(fetched) : "não confirmada"}
          </p>
          {page === "overview" && (
            <>
              <div className="eop-metrics">
                <article>
                  <span>Frentes acompanhadas</span>
                  <strong>{rows.length.toString().padStart(2, "0")}</strong>
                  <small>{current.length} com registro neste recorte</small>
                </article>
                <article>
                  <span>Bloqueios registrados</span>
                  <strong>{blockers.length.toString().padStart(2, "0")}</strong>
                  <small>Falha, dependência ou impedimento</small>
                </article>
                <article>
                  <span>Funcionamento comprovado</span>
                  <strong>{proven.length.toString().padStart(2, "0")}</strong>
                  <small>Conforme evidência e declaração humana</small>
                </article>
                <article>
                  <span>Homologação registrada</span>
                  <strong>
                    {rows
                      .filter((r) => r.entry?.payload.status === "homologado")
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>Por frente, versão, escopo e ambiente</small>
                </article>
              </div>
              <div className="eop-overview">
                <section className="eop-panel">
                  <header>
                    <h3>Próximos passos</h3>
                    <GitBranch size={20} />
                  </header>
                  {(blockers.length
                    ? blockers
                    : rows.filter((r) => !r.entry).slice(0, 4)
                  ).map((r) => (
                    <button
                      className="eop-next"
                      type="button"
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                    >
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          {r.entry?.payload.next ||
                            "Registrar versão, evidências e dependências antes do aceite."}
                        </small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </section>
                <section className="eop-panel eop-blue">
                  <p className="eop-eyebrow">REGRA DE LEITURA</p>
                  <h3>
                    Publicado é uma etapa.
                    <br />
                    Comprovado é outra.
                  </h3>
                  <p>
                    Os testes locais e sintéticos sustentam a revisão técnica.
                    Sessões autenticadas e dados reais demonstram o
                    comportamento no ambiente identificado.
                  </p>
                  <button type="button" onClick={() => setPage("comparison")}>
                    Consultar evolução documental <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
              <div className="eop-section-title">
                <h3>Mapa das frentes</h3>
                <button type="button" onClick={() => setPage("fronts")}>
                  Ver todas as frentes
                </button>
              </div>
              {cards()}
            </>
          )}
          {["fronts", "documents", "reports"].includes(page) && (
            <>
              <div className="eop-section-title">
                <div>
                  <h3>
                    {page === "documents"
                      ? "Documentos, rastreabilidade e vínculos"
                      : page === "reports"
                        ? "R2–R6 · da fonte ao aceite científico"
                        : "Frentes operacionais"}
                  </h3>
                  <p>
                    {page === "reports"
                      ? "Não atribuir reprodução científica a contratos sintéticos."
                      : page === "documents"
                        ? "OCR parcial, limite de CPU e erro de IA exigem pendência explícita até verificação."
                        : "Registros manuais com fontes. GitHub, Supabase e Render não são consultados automaticamente."}
                  </p>
                </div>
              </div>
              <div className="eop-filters">
                <label>
                  <Search size={16} />{" "}
                  <input
                    type="search"
                    aria-label="Buscar frente"
                    placeholder="Buscar frente ou versão…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Todos os status</option>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {cards()}
              {!limited.length && <p>Nenhuma frente neste filtro.</p>}
            </>
          )}
          {page === "checklists" && (
            <>
              <h3>Checklists separados por etapa</h3>
              <p>
                Os resultados pertencem a uma frente, versão, ambiente e escopo.
                Nova versão reinicia os testes e checklists.
              </p>
              <label className="eop-pick">
                Frente
                <select
                  value={selected || "core"}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {FRONTS.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {checklists(
                current.find((r) => r.front === (selected || "core"))
                  ?.payload || blank(),
                selected || "core",
              )}
            </>
          )}
          {page === "risks" && (
            <>
              <h3>Bloqueios, riscos e decisões</h3>
              <p>
                Sem registro não significa sem risco. Verifique também as
                frentes não confirmadas e as referências documentais.
              </p>
              {rows
                .filter(
                  (r) =>
                    r.entry &&
                    (r.entry.payload.failure ||
                      r.entry.payload.dependencies ||
                      r.entry.payload.risks ||
                      r.entry.payload.decisions ||
                      r.entry.payload.status === "bloqueado"),
                )
                .map((r) => (
                  <section className="eop-panel" key={r.id}>
                    <header>
                      <h3>{r.name}</h3>
                      <Badge status={r.entry!.payload.status} />
                    </header>
                    <dl className="eop-details">
                      {[
                        ["failure", "Falhas"],
                        ["cause", "Causa provável · hipótese"],
                        ["correction", "Correção aplicada"],
                        ["dependencies", "Dependências / pendências"],
                        ["risks", "Riscos"],
                        ["decisions", "Decisões necessárias"],
                        ["next", "Próximo passo"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>
                            {String(
                              r.entry!.payload[key as keyof Payload] ||
                                "Não informado",
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <button type="button" onClick={() => start(r.id)}>
                      Atualizar registro
                    </button>
                  </section>
                ))}
            </>
          )}
          {page === "history" && (
            <>
              <h3>Histórico de validações e aprovações</h3>
              <p>
                Registros cumulativos. Uma aprovação registrada não executa a
                ação nem homologa documentos ou indicadores.
              </p>
              {entries.length ? (
                entries.map((e) => (
                  <article className="eop-history" key={e.id}>
                    <History size={18} />
                    <div>
                      <small>
                        {day(e.created_at)} · #{e.seq} · {e.environment}
                      </small>
                      <h4>
                        {FRONTS.find((f) => f[0] === e.front)?.[1]} ·{" "}
                        {e.kind === "approval"
                          ? "aprovação explícita registrada"
                          : "validação / revisão registrada"}
                      </h4>
                      <p>{e.payload.note}</p>
                      <p>
                        Versão: {e.payload.version || "não informada"}{" "}
                        {e.kind === "approval"
                          ? " · " + e.payload.action + " · " + e.payload.target
                          : ""}
                      </p>
                      {e.kind === "approval" ? (
                        <Link
                          url={e.payload.approvalReference || ""}
                          label="Documento do aceite"
                        />
                      ) : (
                        <Badge status={e.payload.status} />
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p>Nenhuma validação ou aprovação registrada neste recorte.</p>
              )}
              {cursor && (
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => void older()}
                >
                  Carregar histórico anterior
                </button>
              )}
            </>
          )}
        </>
      )}
      {page === "comparison" && (
        <>
          <h3>Estado anterior × registro posterior</h3>
          <p className="eop-note">
            Referências documentais consultadas em 17/11/2026. Não são uma
            consulta atual ao banco ou uma homologação deste escopo. As
            divergências cronológicas ficam explícitas.
          </p>
          {SOURCES.map((s) => (
            <article className="eop-panel" key={s.url}>
              <header>
                <h3>{s.title}</h3>
                <Link url={s.url} label="Fonte" />
              </header>
              <div className="eop-comparison">
                <div>
                  <small>ANTERIOR · DOCUMENTADO</small>
                  <p>{s.before}</p>
                </div>
                <div>
                  <small>POSTERIOR · DOCUMENTADO</small>
                  <p>{s.now}</p>
                </div>
              </div>
            </article>
          ))}
        </>
      )}
      {active && !draft && page !== "checklists" && !error && !loading && (
        <section
          ref={detail}
          className="eop-panel eop-detail"
          aria-label="Detalhes da frente"
        >
          <header>
            <div>
              <small>
                {scope.environment} · {scopeName}
              </small>
              <h3>{active.name}</h3>
            </div>
            <button
              aria-label="Fechar detalhes"
              type="button"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="eop-detail-body">
            <Badge status={active.entry?.payload.status || "não confirmado"} />
            <p>
              {active.entry?.payload.note ||
                "Sem registro atual para este recorte. Consulte as referências documentais antes de registrar."}
            </p>
            <dl className="eop-details">
              {[
                ["version", "Versão / commit"],
                ["branch", "Branch"],
                ["migration", "Migração relacionada"],
                ["provenance", "SHA-256, páginas, células e cobertura"],
                ["failure", "Falha observada"],
                ["cause", "Causa provável · hipótese"],
                ["correction", "Correção aplicada"],
                [
                  "dependencies",
                  "Autenticação, MFA, OCR, CPU, IA ou ação manual",
                ],
                ["risks", "Riscos"],
                ["decisions", "Decisões necessárias"],
                ["next", "Próximos passos"],
              ].map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {String(
                      active.entry?.payload[key as keyof Payload] ||
                        "Não confirmado",
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <Link url={active.entry?.payload.url || ""} />
            {tests(active.entry?.payload || blank())}
            <div className="eop-actions">
              <button type="button" onClick={() => start(active.id)}>
                <Plus size={15} /> Registrar validação
              </button>
              <button
                type="button"
                onClick={() => start(active.id, "approval")}
              >
                <ShieldCheck size={15} /> Registrar aprovação explícita
              </button>
            </div>
            <h4>Comparação das revisões carregadas</h4>
            {journal
              .filter((e) => e.kind === "revision")
              .slice(0, 2)
              .map((e, i) => (
                <p key={e.id}>
                  {i === 0 ? "Atual" : "Anterior"}: {e.payload.status} ·{" "}
                  {e.payload.version || "sem versão"} · {day(e.created_at)}
                  <br />
                  {e.payload.note}
                </p>
              ))}
            {journal.filter((e) => e.kind === "revision").length < 2 && (
              <p>
                Revisão anterior não carregada ou inexistente. Consulte o
                histórico completo.
              </p>
            )}
          </div>
        </section>
      )}
      <footer className="eop-footer">
        <span>VÉRTICE EDUCAÇÃO SUPERIOR / ENADE 360°</span>
        <span>Rastreabilidade antes do aceite.</span>
      </footer>
      <dialog
        className="eop-dialog"
        ref={dialog}
        aria-labelledby="eop-form-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {draft && (
          <form onSubmit={submit}>
            <header>
              <div>
                <small>
                  {scope.environment} · {scopeName}
                </small>
                <h3 id="eop-form-title">
                  {kind === "revision"
                    ? "Registrar validação"
                    : "Registrar aprovação explícita"}{" "}
                  · {active?.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Fechar formulário"
                disabled={busy}
                onClick={close}
              >
                <X size={19} />
              </button>
            </header>
            <div className="eop-form">
              <p className="eop-note eop-wide">
                Use apenas metadados e links autorizados. Não inclua dados
                pessoais, tokens, senhas ou conteúdo institucional restrito. O
                servidor registra a identidade autenticada e a data.
              </p>
              {kind === "revision" ? (
                <>
                  <label>
                    Status
                    <select
                      value={draft.status}
                      onChange={(e) => patch("status", e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  {field(
                    "version",
                    "Versão / commit",
                    false,
                    "Ao alterar a versão, testes e checklists serão reiniciados.",
                  )}
                  {field("branch", "Branch")}
                  {field("url", "URL da fonte / ambiente")}
                  {field("migration", "Migração relacionada")}
                  {field(
                    "provenance",
                    "SHA-256, páginas, células e cobertura parcial",
                    true,
                    "Identifique arquivos por hash e fonte, sem transcrever conteúdo restrito.",
                  )}
                  {field("note", "Resultado observado / justificativa *", true)}
                  {field("failure", "Falhas observadas", true)}
                  {field(
                    "cause",
                    "Causa provável · hipótese a verificar",
                    true,
                  )}
                  {field("correction", "Correção aplicada", true)}
                  {field(
                    "dependencies",
                    "Dependências e pendências",
                    true,
                    "OCR, limite de CPU, erro de IA, sessão, MFA, autorização ou lote real pendentes devem ser registrados aqui.",
                  )}
                  {field("risks", "Riscos", true)}
                  {field("decisions", "Decisões necessárias", true)}
                  {field("next", "Próximos passos", true)}
                  <fieldset className="eop-wide">
                    <legend>Testes desta versão · {scope.environment}</legend>
                    {draft.tests.map((t, i) => (
                      <div className="eop-test-edit" key={t.level}>
                        <strong>{t.level}</strong>
                        <label>
                          <input
                            type="checkbox"
                            checked={t.executed}
                            onChange={(e) =>
                              patch(
                                "tests",
                                draft.tests.map((v, j) =>
                                  j === i
                                    ? {
                                        ...v,
                                        executed: e.target.checked,
                                        validated: e.target.checked
                                          ? v.validated
                                          : false,
                                        outcome: e.target.checked
                                          ? v.outcome
                                          : "não executado",
                                      }
                                    : v,
                                ),
                              )
                            }
                          />{" "}
                          Executado
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={t.validated}
                            onChange={(e) =>
                              patch(
                                "tests",
                                draft.tests.map((v, j) =>
                                  j === i
                                    ? { ...v, validated: e.target.checked }
                                    : v,
                                ),
                              )
                            }
                          />{" "}
                          Validado
                        </label>
                        <label>
                          URL da evidência
                          <input
                            type="url"
                            value={t.evidence}
                            onChange={(e) =>
                              patch(
                                "tests",
                                draft.tests.map((v, j) =>
                                  j === i
                                    ? { ...v, evidence: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Resultado do teste
                          <select
                            value={t.outcome}
                            onChange={(e) =>
                              patch(
                                "tests",
                                draft.tests.map((v, j) =>
                                  j === i
                                    ? {
                                        ...v,
                                        outcome: e.target
                                          .value as typeof t.outcome,
                                      }
                                    : v,
                                ),
                              )
                            }
                          >
                            {[
                              "não executado",
                              "passou",
                              "falhou",
                              "parcial",
                            ].map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Resultado observado
                          <input
                            value={t.result}
                            maxLength={2000}
                            onChange={(e) =>
                              patch(
                                "tests",
                                draft.tests.map((v, j) =>
                                  j === i
                                    ? { ...v, result: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </fieldset>
                  {Object.entries(CHECKS).map(([stage, keys]) => (
                    <fieldset className="eop-wide" key={stage}>
                      <legend>Checklist · {stage}</legend>
                      {keys.map((key) => {
                        const c = draft.checks.find((c) => c.key === key)!;
                        const change = (data: Partial<typeof c>) =>
                          patch(
                            "checks",
                            draft.checks.map((v) =>
                              v.key === key ? { ...v, ...data } : v,
                            ),
                          );
                        return (
                          <div className="eop-check-edit" key={key}>
                            <strong>{CHECK_LABELS[key]}</strong>
                            <label>
                              Resultado
                              <select
                                value={c.result}
                                onChange={(e) =>
                                  change({
                                    result: e.target.value as typeof c.result,
                                  })
                                }
                              >
                                <option>pendente</option>
                                <option>atendido</option>
                                <option>não aplicável</option>
                              </select>
                            </label>
                            <label>
                              URL da evidência
                              <input
                                type="url"
                                value={c.evidence}
                                onChange={(e) =>
                                  change({ evidence: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Justificativa
                              <input
                                maxLength={2000}
                                value={c.note}
                                onChange={(e) =>
                                  change({ note: e.target.value })
                                }
                              />
                            </label>
                          </div>
                        );
                      })}
                    </fieldset>
                  ))}
                  <label className="eop-confirm eop-wide">
                    <input
                      type="checkbox"
                      checked={draft.confirmHuman}
                      onChange={(e) => patch("confirmHuman", e.target.checked)}
                    />{" "}
                    Confirmo o aceite humano desta frente, versão, ambiente e
                    escopo. Obrigatório para “homologado”; não aprova documentos
                    nem indicadores oficiais.
                  </label>
                </>
              ) : (
                <>
                  <p className="eop-note eop-wide">
                    Registre somente uma autorização já concedida. Esse registro
                    não dispara operações externas e não substitui a conferência
                    do alvo antes da execução.
                  </p>
                  <label>
                    Ação autorizada
                    <select
                      value={draft.action}
                      onChange={(e) => patch("action", e.target.value)}
                    >
                      {[
                        "merge",
                        "migração",
                        "alteração de banco",
                        "publicação",
                        "mudança de produção",
                      ].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  {field("version", "Versão / commit autorizado *")}
                  {field(
                    "target",
                    "Alvo exato: PR, migração, serviço ou mudança *",
                  )}
                  {field(
                    "approvalReference",
                    "URL do documento de autorização *",
                  )}
                  {field(
                    "note",
                    "Escopo, condições e justificativa do aceite *",
                    true,
                  )}
                  <label className="eop-confirm eop-wide">
                    <input
                      type="checkbox"
                      checked={draft.confirmHuman}
                      onChange={(e) => patch("confirmHuman", e.target.checked)}
                    />{" "}
                    Confirmo que existe aprovação explícita para a ação, o alvo
                    e a versão acima no ambiente {scope.environment}.
                  </label>
                </>
              )}
              {formError && (
                <p className="eop-error eop-wide" role="alert">
                  {formError}
                </p>
              )}
            </div>
            <footer>
              <button type="button" disabled={busy} onClick={close}>
                Cancelar
              </button>
              <button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar registro"}
              </button>
            </footer>
          </form>
        )}
      </dialog>
    </section>
  );
}
