import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
/**
 * Painel de Avaliação Simulada — integra no RepositoryTab como view "simulacao".
 *
 * Replica a lógica do documento DIR-AVS-X.XX para todos os indicadores:
 * conceito atual, conceito viável, parecer, lacunas, plano NDE, perguntas.
 * Calcula conceito por dimensão (média aritmética) e conceito do curso (CC).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { can, explain, type Role, type Row } from "@/lib/area";
import {
  AVS_TABLE,
  CONCEITOS,
  DIMENSOES,
  calcularResumo,
  carregarAvaliacoes,
  corConceito,
  faixaConceito,
  formatarConceito,
  listarIndicadores,
  salvarAvaliacao,
  type AvsRow,
} from "@/lib/avaliacao-simulada";
import { supabase } from "@/lib/supabase";
import { instrumentIndicators } from "@/lib/repository";
import indicatorNames from "@/lib/repository-indicators.json";
import { objetosDoIndicador2017, GRAU_COR, GRAU_LABEL } from "@/lib/instrumento-mapping";
import { OBJETOS_BASE, dimensao4 } from "@/lib/novo-instrumento";
import { camposAPreencher, rascunhoIndicador, RASCUNHO_VERSION, type Campos } from "@/lib/avaliacao-simulada-rascunho";

/** Conta documentos do repositório vinculados a um indicador. */
function contarDocumentos(requests: Row[], files: Row[], indicador: string) {
  const reqs = requests.filter(r => r.active !== false && instrumentIndicators(String(r.indicator ?? "")).includes(indicador));
  const reqIds = new Set(reqs.map(r => String(r.id)));
  const docs = files.filter(f => reqIds.has(String(f.request_id)));
  const validados = docs.filter(f => f.status === "validado").length;
  const enviados = docs.filter(f => f.status === "enviado").length;
  const pendentes = reqs.filter(r => !r.not_applicable && !docs.some(f => String(f.request_id) === String(r.id))).length;
  return { total: reqs.length, docs: docs.length, validados, enviados, pendentes };
}

// ================================================================ Donut SVG
type Parte = { value: number; color: string; label: string };

function Donut({ parts, center, caption, size = 96 }: { parts: Parte[]; center: string; caption: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  return (
    <svg className="avs-donut" viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={caption}>
      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e7ecf1" strokeWidth="5" />
      {total > 0 && parts.filter(p => p.value > 0).map(p => {
        const len = (p.value / total) * 100;
        const el = <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />;
        acc += len;
        return el;
      })}
      <text x="21" y="23" textAnchor="middle" className="avs-donut-text">{center}</text>
    </svg>
  );
}

// ================================================================ componente principal
type Props = {
  institutionId: string;
  courseId: string;
  role: Role | null;
  requests: Row[];
  files: Row[];
};

export default function AvaliacaoSimuladaPanel({ institutionId, courseId, role, requests, files }: Props) {
  const edit = can.record(role);
  const indicadores = useMemo(() => listarIndicadores(), []);
  const [rows, setRows] = useState<AvsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    try {
      setRows(await carregarAvaliacoes(institutionId, courseId));
      setError("");
    } catch (e) {
      setError(explain(e));
    } finally {
      setLoading(false);
    }
  }, [institutionId, courseId]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const byIndicador = useMemo(() => {
    const m = new Map<string, AvsRow>();
    for (const r of rows) m.set(String(r.indicador), r);
    return m;
  }, [rows]);

  const conceitos = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const ind of indicadores) {
      const r = byIndicador.get(ind.code);
      m.set(ind.code, r?.conceito_atual != null ? Number(r.conceito_atual) : null);
    }
    return m;
  }, [indicadores, byIndicador]);

  const resumo = useMemo(() => calcularResumo(conceitos, indicadores), [conceitos, indicadores]);

  async function gravar(indicador: string, dimensao: number, campo: string, valor: unknown) {
    setSaving(indicador);
    try {
      await salvarAvaliacao(institutionId, courseId, indicador, dimensao, { [campo]: valor } as any, userId);
      await load();
    } catch (e) {
      setError(explain(e));
    } finally {
      setSaving("");
    }
  }

  if (loading) return <p className="area-muted">Carregando avaliação simulada…</p>;

  const partesConceitoCurso: Parte[] = [
    { value: resumo.dimensoes.reduce((s, d) => s + (d.distribuicao[5] ?? 0), 0), color: "#2d6a4f", label: "Conceito 5" },
    { value: resumo.dimensoes.reduce((s, d) => s + (d.distribuicao[4] ?? 0), 0), color: "#4f9a76", label: "Conceito 4" },
    { value: resumo.dimensoes.reduce((s, d) => s + (d.distribuicao[3] ?? 0), 0), color: "#d1a54a", label: "Conceito 3" },
    { value: resumo.dimensoes.reduce((s, d) => s + (d.distribuicao[2] ?? 0), 0), color: "#e07850", label: "Conceito 2" },
    { value: resumo.dimensoes.reduce((s, d) => s + (d.distribuicao[1] ?? 0), 0), color: "#c0594f", label: "Conceito 1" },
    { value: resumo.totalIndicadores - resumo.totalAvaliados, color: "#a9b6c4", label: "Sem nota" },
  ];

  return (
    <div className="avs">
      {error && <p role="alert" className="area-error">{error}</p>}

      {/* ─── Resumo geral com donut grande ─── */}
      <section className="avs-resumo">
        <div className="avs-resumo-main">
          <Donut parts={partesConceitoCurso} center={formatarConceito(resumo.conceitoCurso)} caption="Conceito do Curso simulado" size={140} />
          <div>
            <strong className="avs-cc">{formatarConceito(resumo.conceitoCurso)} CC simulado</strong>
            <p className="area-muted avs-sub">{faixaConceito(resumo.conceitoCurso)}</p>
            <p className="area-muted avs-sub">{resumo.totalAvaliados} de {resumo.totalIndicadores} indicadores avaliados</p>
            <ul className="avs-legenda">
              {partesConceitoCurso.filter(p => p.value > 0).map(p => (
                <li key={p.label}><i style={{ background: p.color }} />{p.label} <b>{p.value}</b></li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Mini-donuts por dimensão ─── */}
        <div className="avs-dims">
          {resumo.dimensoes.map(d => {
            const pct = d.media !== null ? Math.round((d.media / 5) * 100) : 0;
            return (
              <article key={d.dimensao} className="avs-dim-card">
                <Donut
                  parts={[
                    { value: pct, color: corConceito(d.media), label: "nota" },
                    { value: 100 - pct, color: "#e7ecf1", label: "resto" },
                  ]}
                  center={d.media !== null ? d.media.toFixed(1) : "—"}
                  caption={`Dimensão ${d.dimensao}`}
                  size={64}
                />
                <div>
                  <strong>Dimensão {d.dimensao}</strong>
                  <p className="area-muted" style={{ margin: 0, fontSize: ".78rem" }}>
                    {d.nome}<br />
                    {d.avaliados}/{d.total} avaliados · média {d.media !== null ? d.media.toFixed(2) : "—"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="avs-aviso">
        Avaliação simulada interna. O CC é a média aritmética dos conceitos das três dimensões.
        O conceito de cada dimensão é a média dos indicadores avaliados. Notas são gravadas no Supabase.
      </p>

      {/* ─── Indicadores por dimensão ─── */}
      {DIMENSOES.map(([dim, nome]) => {
        const inds = indicadores.filter(i => i.dimension === dim);
        const dimResumo = resumo.dimensoes.find(d => d.dimensao === dim)!;
        return (
          <section key={dim} className="avs-dim-section">
            <header className="avs-dim-header">
              <h4>Dimensão {dim} — {nome}</h4>
              <span className="area-muted">
                {dimResumo.avaliados}/{dimResumo.total} · média {dimResumo.media !== null ? dimResumo.media.toFixed(2) : "—"}
              </span>
            </header>
            <div className="table-scroll">
              <table className="area-table avs-table">
                <thead>
                  <tr>
                    <th style={{ width: "5rem" }}>Indicador<ContextHelp title="Indicador" /></th>
                    <th>Nome</th>
                    <th style={{ width: "7rem" }}>Conceito atual</th>
                    <th style={{ width: "7rem" }}>Conceito viável</th>
                    <th style={{ width: "3rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {inds.map(ind => {
                    const row = byIndicador.get(ind.code);
                    const atual = row?.conceito_atual != null ? Number(row.conceito_atual) : null;
                    const viavel = row?.conceito_viavel != null ? Number(row.conceito_viavel) : null;
                    const aberto = open === ind.code;
                    const busy = saving === ind.code;
                    return (
                      <IndicadorRow
                        key={ind.code}
                        code={ind.code}
                        name={ind.name}
                        dimensao={dim}
                        atual={atual}
                        viavel={viavel}
                        row={row}
                        aberto={aberto}
                        edit={edit}
                        busy={busy}
                        onToggle={() => setOpen(aberto ? null : ind.code)}
                        onGravar={(campo, valor) => gravar(ind.code, dim, campo, valor)}
                        requests={requests}
                        files={files}
                        institutionId={institutionId}
                        courseId={courseId}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ================================================================ linha do indicador
function IndicadorRow({
  code, name, dimensao, atual, viavel, row, aberto, edit, busy, onToggle, onGravar,
  requests, files, institutionId, courseId,
}: {
  code: string; name: string; dimensao: number;
  atual: number | null; viavel: number | null;
  row: AvsRow | undefined; aberto: boolean; edit: boolean; busy: boolean;
  onToggle: () => void;
  onGravar: (campo: string, valor: unknown) => void;
  requests: Row[]; files: Row[]; institutionId: string; courseId: string;
}) {
  const docInfo = contarDocumentos(requests, files, code);
  return (
    <>
      <tr className={`avs-row ${aberto ? "aberto" : ""}`} style={{ borderLeft: `4px solid ${corConceito(atual)}` }}>
        <td><strong>{code}</strong></td>
        <td>
          <button type="button" className="avs-toggle" onClick={onToggle}>
            {name}
            <span className="avs-chevron">{aberto ? "▾" : "▸"}</span>
          </button>
        </td>
        <td>
          {edit ? (
            <select value={atual ?? ""} disabled={busy} onChange={e => onGravar("conceito_atual", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">—</option>
              {CONCEITOS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span className="avs-badge" style={{ background: corConceito(atual) }}>{atual ?? "—"}</span>
          )}
        </td>
        <td>
          {edit ? (
            <select value={viavel ?? ""} disabled={busy} onChange={e => onGravar("conceito_viavel", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">—</option>
              {CONCEITOS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <span className="avs-badge" style={{ background: corConceito(viavel) }}>{viavel ?? "—"}</span>
          )}
        </td>
        <td>
          <button type="button" className="avs-expand" onClick={onToggle} title={aberto ? "Fechar parecer" : "Abrir parecer"}>
            {aberto ? "−" : "+"}
          </button>
        </td>
      </tr>
      {aberto && (
        <tr className="avs-detail-row">
          <td colSpan={5}>
            <DetalheIndicador
              row={row} edit={edit} busy={busy} onGravar={onGravar}
              code={code} name={name} docInfo={docInfo}
              institutionId={institutionId} courseId={courseId}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ================================================================ detalhe expandido (parecer, lacunas, plano, perguntas + rascunho por algoritmo)
type DocInfo = { total: number; docs: number; validados: number; enviados: number; pendentes: number };

function DetalheIndicador({
  row, edit, busy, onGravar, code, name, docInfo, institutionId, courseId,
}: {
  row: AvsRow | undefined; edit: boolean; busy: boolean;
  onGravar: (campo: string, valor: unknown) => void;
  code: string; name: string; docInfo: DocInfo;
  institutionId: string; courseId: string;
}) {
  const [parecer, setParecer] = useState(String(row?.parecer ?? ""));
  const [lacunas, setLacunas] = useState(String(row?.lacunas ?? ""));
  const [plano, setPlano] = useState(String(row?.plano_nde ?? ""));
  const [perguntas, setPerguntas] = useState(String(row?.perguntas_comissao ?? ""));
  const [aviso, setAviso] = useState("");

  const campos: [string, string, string, (v: string) => void][] = [
    ["parecer", "Parecer do avaliador", parecer, setParecer],
    ["lacunas", "O que falta para conceito 5", lacunas, setLacunas],
    ["plano_nde", "Plano do consultor para o NDE", plano, setPlano],
    ["perguntas_comissao", "Perguntas prováveis da comissão", perguntas, setPerguntas],
  ];

  // Rascunho por algoritmo (sem IA): preenche só os campos vazios; o texto do avaliador nunca é sobrescrito.
  function gerarRascunho() {
    const eq = objetosDoIndicador2017(code);
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    const rascunho = rascunhoIndicador({ code, name, conceitoAtual: num(row?.conceito_atual), conceitoViavel: num(row?.conceito_viavel), docInfo,
      equivalencia: eq ? { objetos: eq.obj2026, grau: eq.grau } : null });
    const novos = camposAPreencher({ parecer, lacunas, plano_nde: plano, perguntas_comissao: perguntas }, rascunho);
    const set: Record<keyof Campos, (v: string) => void> = { parecer: setParecer, lacunas: setLacunas, plano_nde: setPlano, perguntas_comissao: setPerguntas };
    const chaves = Object.keys(novos) as (keyof Campos)[];
    for (const k of chaves) { set[k](novos[k]!); onGravar(k, novos[k]); }
    setAviso(chaves.length ? `Rascunho por algoritmo (${RASCUNHO_VERSION}) nos campos vazios; revise antes de usar.` : "Todos os campos já têm texto; nada foi alterado.");
  }

  return (
    <div className="avs-detalhe">
      {/* Cruzamento de dados — documentos do repositório */}
      <div className="avs-docs-info">
        <span className="avs-docs-badge" style={{ background: docInfo.pendentes > 0 ? "#c0594f" : docInfo.docs > 0 ? "#4f9a76" : "#a9b6c4" }}>
          {docInfo.docs} doc{docInfo.docs !== 1 ? "s" : ""}
        </span>
        <span className="area-muted" style={{ fontSize: ".8rem" }}>
          {docInfo.validados > 0 && <>{docInfo.validados} validado{docInfo.validados !== 1 ? "s" : ""} · </>}
          {docInfo.enviados > 0 && <>{docInfo.enviados} em análise · </>}
          {docInfo.pendentes > 0 ? <strong style={{ color: "#c0594f" }}>{docInfo.pendentes} pendência{docInfo.pendentes !== 1 ? "s" : ""}</strong> : "sem pendências"}
        </span>
        {edit && (
          <button
            type="button"
            className="avs-ai-btn"
            disabled={busy}
            onClick={gerarRascunho}
            title="Preencher os campos vazios com um rascunho a partir dos dados do repositório (sem IA)"
          >
            Gerar rascunho
          </button>
        )}
      </div>
      {aviso && <p role="status" className="area-muted" style={{ fontSize: ".8rem", margin: ".25rem 0" }}>{aviso}</p>}

      {/* ─── Espelhamento 2017↔2026 ─── */}
      {(() => {
        const mapping = objetosDoIndicador2017(code);
        if (!mapping) return null;
        const allObjs = [...OBJETOS_BASE, ...dimensao4("direito")];
        return (
          <div className="avs-espelhamento">
            <strong className="avs-espelhamento-title">🔗 Governança 360 — Novo Instrumento 2026</strong>
            <span className="avs-espelhamento-grau" style={{ color: GRAU_COR[mapping.grau] }}>
              {GRAU_LABEL[mapping.grau]}
            </span>
            <p className="avs-espelhamento-nota">{mapping.nota}</p>
            <div className="avs-espelhamento-objs">
              {mapping.obj2026.map(objCode => {
                const obj = allObjs.find(o => o.code === objCode);
                return (
                  <span key={objCode} className="avs-espelhamento-tag">
                    <b>{objCode}</b> {obj?.title ?? "Objeto"}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {campos.map(([campo, label, valor, set]) => (
        <div key={campo} className="avs-campo">
          <HelpLabel><strong>{label}</strong></HelpLabel>
          {edit ? (
            <textarea
              value={valor}
              disabled={busy}
              rows={3}
              onChange={e => set(e.target.value)}
              onBlur={() => onGravar(campo, valor)}
              placeholder={`${label}…`}
            />
          ) : (
            <p className="avs-texto">{valor || <em className="area-muted">Não preenchido</em>}</p>
          )}
        </div>
      ))}
      {row && Boolean(row.updated_at) && (
        <p className="area-muted avs-meta">
          Atualizado em {new Date(String(row.updated_at)).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}
