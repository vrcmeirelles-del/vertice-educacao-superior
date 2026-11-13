import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useState, type FormEvent } from "react";
import { type IesApi } from "@/lib/ies/api";
import { type Detail } from "@/lib/ies/contracts";
import { useTask } from "./useTask";
export default function Registration({
  api,
  institutionId,
  onBack,
  onChanged,
}: {
  api: IesApi;
  institutionId?: string;
  onBack(): void;
  onChanged(): void;
}) {
  const [name, setName] = useState(""),
    [emec, setEmec] = useState(""),
    [source, setSource] = useState(""),
    [review, setReview] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [ack, setAck] = useState(false),
    [message, setMessage] = useState("");
  const task = useTask();
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  useEffect(() => {
    if (institutionId)
      void task.run(() => api.detail(institutionId), setDetail);
  }, [institutionId, api]);
  function submit(e: FormEvent) {
    e.preventDefault();
    setReview(true);
  }
  async function saveDraft() {
    if (confirmedId) return;
    await task.run(
      () => api.register(name.trim(), emec.trim(), source.trim()),
      (id) => {
        setConfirmedId(id);
        setReview(false);
        setDetail(null);
        setAck(false);
        setMessage(
          "Rascunho registrado pelo servidor. ID: " +
            id +
            ". Consulte os dados confirmados antes de revisar; não é necessário registrar novamente.",
        );
      },
    );
  }
  function decide(approve: boolean) {
    if (!detail || !ack) return;
    void task.run(
      () => api.review(detail.institution_id, approve, detail.revision),
      () => {
        setMessage(
          approve
            ? "Revisão aprovada e consolidação confirmada pelo servidor."
            : "Revisão recusada pelo servidor.",
        );
        setDetail(null);
        setReview(false);
        setName("");
        setEmec("");
        setSource("");
        onChanged();
      },
    );
  }
  return (
    <section className="ies-card">
      <button onClick={onBack} disabled={task.busy}>
        Voltar à lista
      </button>
      <h2>{detail ? "Revisão do cadastro" : "Identificar instituição"}</h2>
      <p>
        Informe o código e-MEC e confira os dados antes de consolidar. Cadastro
        manual não verificado; uma URL informada não comprova validação oficial.
      </p>
      {message && <p role="status">{message}</p>}
      {task.error && <p role="alert">{task.error}</p>}
      {task.busy && <p role="status">Aguardando confirmação do servidor…</p>}
      {detail ? (
        <>
          <dl>
            <dt>Nome</dt>
            <dd>{detail.name}</dd>
            <dt>Código e-MEC<ContextHelp title="Código e-MEC" /></dt>
            <dd>{detail.emec_code}</dd>
            <dt>Referência informada, não verificada</dt>
            <dd>{detail.source_reference || "Não informada"}</dd>
            <dt>Origem</dt>
            <dd>Manual não verificada</dd>
            <dt>Revisão</dt>
            <dd>
              {detail.revision} ·{" "}
              {detail.status === "pending_review"
                ? "Pendente"
                : detail.status === "reviewed"
                  ? "Aprovada"
                  : "Recusada"}
            </dd>
          </dl>
          {detail.status === "pending_review" ? (
            <>
              <HelpLabel className="ies-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Revisei os dados acima e compreendo que a aprovação consolida a
                instituição, sem afirmar verificação oficial no e-MEC.
              </HelpLabel>
              <div className="ies-actions">
                <button
                  disabled={!ack || task.busy}
                  onClick={() => decide(true)}
                >
                  Aprovar e consolidar
                </button>
                <button
                  disabled={!ack || task.busy}
                  onClick={() => decide(false)}
                >
                  Recusar cadastro
                </button>
                <button
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(
                      () => api.detail(detail.institution_id),
                      (d) => {
                        setDetail(d);
                        setAck(false);
                      },
                    )
                  }
                >
                  Recarregar revisão
                </button>
              </div>
            </>
          ) : detail.status === "rejected" && detail.public_institution_id ? (
            <button
              disabled={task.busy}
              onClick={() =>
                void task.run(
                  () => api.reopen(detail.institution_id, detail.revision),
                  (revision) => {
                    setConfirmedId(detail.institution_id);
                    setMessage(
                      "Reabertura confirmada pelo servidor. Revisão " +
                        revision +
                        ". Consulte o cadastro atualizado antes de decidir.",
                    );
                    setDetail(null);
                    setAck(false);
                  },
                )
              }
            >
              Reabrir revisão da instituição existente
            </button>
          ) : (
            <p>Não há decisão pendente para este cadastro.</p>
          )}
        </>
      ) : confirmedId ? (
        <section>
          <p>
            A escrita foi confirmada. ID: {confirmedId}. A consulta posterior
            pode ser retomada sem repetir o cadastro ou a reabertura.
          </p>
          <button
            disabled={task.busy}
            onClick={() =>
              void task.run(() => api.detail(confirmedId), setDetail)
            }
          >
            Consultar cadastro confirmado
          </button>
        </section>
      ) : institutionId ? (
        <p>Consulte novamente os dados da instituição para revisar.</p>
      ) : review ? (
        <>
          <h3>Confira antes de registrar o rascunho</h3>
          <dl>
            <dt>Nome</dt>
            <dd>{name}</dd>
            <dt>Código e-MEC<ContextHelp title="Código e-MEC" /></dt>
            <dd>{emec}</dd>
            <dt>Referência não verificada</dt>
            <dd>{source || "Não informada"}</dd>
          </dl>
          <p>
            Esta etapa salva um rascunho para revisão. A consolidação exige uma
            decisão posterior explícita.
          </p>
          <div className="ies-actions">
            <button disabled={task.busy} onClick={() => setReview(false)}>
              Corrigir dados
            </button>
            <button disabled={task.busy} onClick={() => void saveDraft()}>
              Registrar rascunho
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <HelpLabel>
            Nome da instituição
            <input
              required
              minLength={3}
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </HelpLabel>
          <HelpLabel>
            Código e-MEC
            <input
              required
              inputMode="numeric"
              pattern="[1-9][0-9]{0,11}"
              maxLength={12}
              value={emec}
              onChange={(e) => setEmec(e.target.value)}
            />
          </HelpLabel>
          <HelpLabel>
            Referência consultada (opcional)
            <input
              maxLength={1000}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </HelpLabel>
          <button disabled={task.busy}>Revisar dados</button>
        </form>
      )}
    </section>
  );
}
