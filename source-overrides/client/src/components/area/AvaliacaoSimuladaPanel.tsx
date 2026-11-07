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
};

export default function AvaliacaoSimuladaPanel({ institutionId, courseId, role }: Props) {
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
                    <th style={{ width: "5rem" }}>Indicador</th>
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
}: {
  code: string; name: string; dimensao: number;
  atual: number | null; viavel: number | null;
  row: AvsRow | undefined; aberto: boolean; edit: boolean; busy: boolean;
  onToggle: () => void;
  onGravar: (campo: string, valor: unknown) => void;
}) {
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
            <DetalheIndicador row={row} edit={edit} busy={busy} onGravar={onGravar} />
          </td>
        </tr>
      )}
    </>
  );
}

// ================================================================ detalhe expandido (parecer, lacunas, plano, perguntas)
function DetalheIndicador({
  row, edit, busy, onGravar,
}: {
  row: AvsRow | undefined; edit: boolean; busy: boolean;
  onGravar: (campo: string, valor: unknown) => void;
}) {
  const [parecer, setParecer] = useState(String(row?.parecer ?? ""));
  const [lacunas, setLacunas] = useState(String(row?.lacunas ?? ""));
  const [plano, setPlano] = useState(String(row?.plano_nde ?? ""));
  const [perguntas, setPerguntas] = useState(String(row?.perguntas_comissao ?? ""));

  const campos: [string, string, string, (v: string) => void][] = [
    ["parecer", "Parecer do avaliador", parecer, setParecer],
    ["lacunas", "O que falta para conceito 5", lacunas, setLacunas],
    ["plano_nde", "Plano do consultor para o NDE", plano, setPlano],
    ["perguntas_comissao", "Perguntas prováveis da comissão", perguntas, setPerguntas],
  ];

  return (
    <div className="avs-detalhe">
      {campos.map(([campo, label, valor, set]) => (
        <div key={campo} className="avs-campo">
          <label><strong>{label}</strong></label>
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
      {row?.updated_at && (
        <p className="area-muted avs-meta">
          Atualizado em {new Date(String(row.updated_at)).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}
