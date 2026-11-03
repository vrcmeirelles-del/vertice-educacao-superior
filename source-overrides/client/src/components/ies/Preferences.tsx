import { useEffect, useState, type FormEvent } from "react";
import { type IesApi } from "@/lib/ies/api";
import {
  type Preferences as PreferenceValues,
  type Notice,
  type Institution,
  type Course,
  type Policy,
} from "@/lib/ies/contracts";
import { useTask } from "./useTask";
export default function Preferences({
  api,
  initial,
  notice,
  onSaved,
}: {
  api: IesApi;
  initial: PreferenceValues;
  notice?: Notice;
  onSaved(p: PreferenceValues): void;
}) {
  const [values, setValues] = useState(initial),
    [message, setMessage] = useState("");
  const task = useTask();
  const fields = [
    ["optional_news_email", "Novidades por e-mail"],
    ["optional_news_whatsapp", "Novidades por WhatsApp"],
    ["optional_learning_email", "Conteúdos de aprendizagem por e-mail"],
    ["optional_learning_whatsapp", "Conteúdos de aprendizagem por WhatsApp"],
  ] as const;
  function save(e: FormEvent) {
    e.preventDefault();
    if (!notice) return;
    setMessage("");
    void task.run(
      () => api.preferences(values, notice.version),
      () => {
        onSaved({ ...values, notice_version: notice.version });
        setMessage("Preferências confirmadas pelo servidor.");
      },
    );
  }
  return (
    <section className="ies-card">
      <h2>Preferências de comunicação</h2>
      <h3>Avisos essenciais</h3>
      <p>
        Avisos de segurança e execução do serviço são separados das escolhas
        opcionais abaixo.
      </p>
      {notice ? (
        <>
          <p>{notice.body}</p>
          <small>Versão do aviso: {notice.version}</small>
          <form onSubmit={save}>
            <fieldset disabled={task.busy}>
              <legend>Escolhas opcionais por finalidade e canal</legend>
              {fields.map(([key, label]) => (
                <label className="ies-check" key={key}>
                  <input
                    type="checkbox"
                    checked={values[key]}
                    onChange={(e) =>
                      setValues({ ...values, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button disabled={task.busy}>Salvar preferências</button>
          </form>
        </>
      ) : (
        <p role="alert">
          O aviso vigente não está disponível. Não é possível alterar
          preferências.
        </p>
      )}
      {task.error && <p role="alert">{task.error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function ReviewPolicy({
  api,
  institution,
  notice,
  onBack,
}: {
  api: IesApi;
  institution: Institution;
  notice?: Notice;
  onBack(): void;
}) {
  const [courses, setCourses] = useState<Course[]>([]),
    [course, setCourse] = useState(""),
    [policy, setPolicy] = useState<Policy | null>(null),
    [required, setRequired] = useState(true),
    [ack, setAck] = useState(false),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState("");
  const task = useTask();
  useEffect(() => {
    void task.run(() => api.courses(institution.institution_id), setCourses);
  }, [api, institution.institution_id]);
  function load() {
    setPolicy(null);
    setAck(false);
    setConfirm(false);
    setMessage("");
    void task.run(
      () => api.policy(institution.institution_id, course || null),
      (p) => {
        setPolicy(p);
        setRequired(p.required);
      },
    );
  }
  function save() {
    if (!policy || !notice || !confirm || (!required && !ack)) return;
    void task.run(
      () =>
        api.setPolicy(
          institution.institution_id,
          course || null,
          required,
          notice.version,
          ack,
          policy.revision,
        ),
      () => {
        setMessage(
          "Decisão registrada pelo servidor. Ela não ativa nem protege os fluxos documentais legados.",
        );
        setPolicy(null);
        setAck(false);
        setConfirm(false);
      },
    );
  }
  return (
    <section className="ies-card">
      <button onClick={onBack} disabled={task.busy}>
        Voltar à lista
      </button>
      <h2>Dupla checagem · {institution.name}</h2>
      <aside className="ies-note">
        Integração documental indisponível. Esta decisão registra uma política
        futura; não ativa fluxos documentais nem oferece proteção efetiva ao
        legado.
      </aside>
      {notice ? (
        <>
          <p>{notice.body}</p>
          <small>Versão do aviso: {notice.version}</small>
        </>
      ) : (
        <p role="alert">Aviso vigente indisponível.</p>
      )}
      <p>
        O padrão institucional vale quando não há política específica para o
        curso. Reativar este padrão não remove dispensas específicas já
        registradas por curso.
      </p>
      <label>
        Escopo explícito
        <select
          aria-label="Escopo explícito"
          disabled={task.busy}
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setPolicy(null);
            setAck(false);
            setConfirm(false);
          }}
        >
          <option value="">Padrão institucional</option>
          {courses.map((c) => (
            <option value={c.course_id} key={c.course_id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {courses.length === 100 && (
        <p>
          Lista limitada a 100 cursos. Não altere política de um curso que não
          esteja disponível nesta lista.
        </p>
      )}
      <button disabled={task.busy} onClick={load}>
        Consultar política deste escopo
      </button>
      {policy && (
        <>
          <p>
            Revisão do escopo: {policy.revision}. Política efetiva:{" "}
            {policy.required
              ? "dupla checagem exigida"
              : "dupla checagem dispensada"}
            {policy.effective_course_id === null && course
              ? " (herdada da instituição)"
              : ""}
            .
          </p>
          <label className="ies-check">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => {
                setRequired(e.target.checked);
                setConfirm(false);
                setAck(false);
              }}
            />
            Exigir dupla checagem
          </label>
          {!required && (
            <label className="ies-check">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              Compreendo o aumento do risco documental ao dispensar revisão
              superior neste escopo.
            </label>
          )}
          <label className="ies-check">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Confirmo conscientemente a decisão para{" "}
            {course
              ? courses.find((c) => c.course_id === course)?.name
              : `padrão institucional de ${institution.name}`}
            .
          </label>
          <button
            disabled={task.busy || !notice || !confirm || (!required && !ack)}
            onClick={save}
          >
            {required
              ? "Registrar exigência de dupla checagem"
              : "Registrar dispensa neste escopo"}
          </button>
        </>
      )}
      {task.error && <p role="alert">{task.error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
