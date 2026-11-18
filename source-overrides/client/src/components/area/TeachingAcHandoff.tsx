import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Props = { institutionId: string; courseId: string; activityId: string; enabled: boolean; onOpenAc?: () => void };
type Options = { student_name: string; categories: { id: string; label: string }[] };
type Receipt = { id: string; already_forwarded: boolean };

export default function TeachingAcHandoff({ institutionId, courseId, activityId, enabled, onOpenAc }: Props) {
  const [enrollment, setEnrollment] = useState("");
  const [options, setOptions] = useState<Options | null>(null);
  const [category, setCategory] = useState("");
  const [minutes, setMinutes] = useState("");
  const [role, setRole] = useState("participante");
  const [attested, setAttested] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const args = { p_institution: institutionId, p_course: courseId, p_activity: activityId, p_enrollment: enrollment.trim() };

  async function perform(action: () => Promise<void>) {
    if (running.current || !enabled) return;
    running.current = true;
    setPending(true);
    setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação."); }
    finally { running.current = false; setPending(false); }
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!args.p_enrollment) return;
    void perform(async () => {
      const { data, error } = await supabase.rpc("vertice_teaching_ac_options", args);
      if (error) throw new Error(error.code === "22023" || error.code === "42501" ? error.message : "Não foi possível conferir a matrícula e o regulamento.");
      if (!data || typeof data.student_name !== "string" || !Array.isArray(data.categories)) throw new Error("A matrícula ou as categorias não foram confirmadas.");
      setOptions(data);
      setCategory("");
      setAttested(false);
    });
  }

  function forward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options || !attested || !category || !Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 60000 || receipt) return;
    void perform(async () => {
      const { data, error } = await supabase.rpc("vertice_teaching_ac_forward", {
        ...args, p_category: category, p_participant_role: role, p_minutes: Number(minutes), p_attested: true,
      });
      if (error) throw new Error(error.code === "22023" || error.code === "42501" ? error.message : "Não foi possível encaminhar. Nenhum crédito foi lançado.");
      if (!data || typeof data.id !== "string") throw new Error("Encaminhamento não confirmado.");
      setReceipt(data);
    });
  }

  return <details>
    <summary>Encaminhar para Atividades Complementares</summary>
    {!enabled ? <p>Esta atividade está validada, mas não tem evidência vinculada. O encaminhamento para análise não está disponível.</p> :
      receipt ? <div role="status">
        <p>{receipt.already_forwarded ? "Esta atividade já foi encaminhada para esta matrícula; nenhum registro foi duplicado." : "Solicitação registrada na fila de Atividades Complementares."} Nenhum crédito foi lançado.</p>
        {onOpenAc && <button type="button" onClick={onOpenAc}>Abrir Atividades Complementares</button>}
        <button type="button" onClick={() => { setReceipt(null); setEnrollment(""); setOptions(null); setMinutes(""); setRole("participante"); setAttested(false); }}>Encaminhar outra matrícula</button>
      </div> :
      <>
        <p>A análise será separada do cadastro de ensino. Decisão e crédito para essa origem ainda não estão disponíveis no painel de AC.</p>
        <form onSubmit={check}>
          <label>Matrícula exata do curso
            <input required maxLength={100} value={enrollment} disabled={pending} onChange={(e) => { setEnrollment(e.target.value); setOptions(null); setAttested(false); }} />
          </label>
          <button type="submit" disabled={pending}>Conferir elegibilidade</button>
        </form>
        {options && <form onSubmit={forward} aria-label="Encaminhar evidência para AC">
          <p>Matrícula conferida: <strong>{options.student_name}</strong></p>
          {!options.categories.length && <p>Não há categorias cadastradas no regulamento identificado.</p>}
          <label>Categoria de AC
            <select required value={category} disabled={pending} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Selecione</option>
              {options.categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Papel na atividade
            <select value={role} disabled={pending} onChange={(e) => setRole(e.target.value)}>
              <option value="participante">Participante</option><option value="organizador">Organizador</option>
            </select>
          </label>
          <label>Carga comprovada (minutos)
            <input required type="number" min={1} max={60000} step={1} value={minutes} disabled={pending} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <label><input type="checkbox" checked={attested} disabled={pending} onChange={(e) => setAttested(e.target.checked)} /> Conferi na evidência a presença, o papel e a duração deste participante.</label>
          <button type="submit" disabled={pending || !attested || !category}>Encaminhar para análise</button>
        </form>}
        {error && <p role="alert">{error}</p>}
      </>}
  </details>;
}
