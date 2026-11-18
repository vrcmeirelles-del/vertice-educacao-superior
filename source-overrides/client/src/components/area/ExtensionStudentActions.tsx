import { useRef, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
export type StudentLifecycleRow = {
  id: string;
  project_id: string;
  full_name: string;
  status: string;
  lifecycle_version?: number;
  removed_at?: string | null;
  deleted_at?: string | null;
};
const LABELS = {
  desativar: "Desativar aluno",
  reativar: "Reativar aluno",
  retirar: "Retirar do projeto",
  reintegrar: "Reintegrar ao projeto",
  excluir: "Excluir cadastro",
  restaurar: "Restaurar cadastro",
};
type Action = keyof typeof LABELS;
export function studentLifecycleActions(s: StudentLifecycleRow): Action[] {
  return s.deleted_at
    ? ["restaurar"]
    : s.removed_at
      ? ["reintegrar", "excluir"]
      : s.status === "inativo"
        ? ["reativar", "retirar", "excluir"]
        : ["desativar", "retirar", "excluir"];
}
export default function ExtensionStudentActions({
  student,
  projectTitle,
  onChanged,
}: {
  student: StudentLifecycleRow;
  projectTitle: string;
  onChanged: () => Promise<void> | void;
}) {
  const [action, setAction] = useState<Action | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (action) {
      previous.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previous.current?.focus();
    }
  }, [action]);
  const recovering = action === "restaurar" || action === "reintegrar";
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!action || busy) return;
    if (reason.trim().length < 5) {
      setError("Informe um motivo com pelo menos cinco caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc(
        "vertice_extension_student_lifecycle",
        {
          p_student: student.id,
          p_project: student.project_id,
          p_action: action,
          p_expected_version: student.lifecycle_version ?? 0,
          p_reason: reason.trim(),
        },
      );
      if (error) throw error;
      setAction(null);
      await onChanged();
    } catch (e) {
      setError(
        (e as Error).message ||
          "Não foi possível concluir. Confira o cadastro antes de repetir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ext-student-actions" onClick={(e) => e.stopPropagation()}>
      {studentLifecycleActions(student).map((a) => (
        <button
          type="button"
          className={a === "excluir" ? "ext-btn-danger" : "ext-btn-small"}
          key={a}
          onClick={() => {
            setReason("");
            setError("");
            setAction(a);
          }}
        >
          {LABELS[a]}
        </button>
      ))}
      <dialog
        className="ext-student-dialog"
        ref={dialog}
        aria-label={action ? LABELS[action] : undefined}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setAction(null);
        }}
      >
        {action && (
          <form onSubmit={save}>
            <h3>{LABELS[action]}</h3>
            <p>
              <strong>{student.full_name}</strong>
              <br />
              Projeto: <strong>{projectTitle}</strong>
            </p>
            <p>
              {action === "excluir"
                ? "O cadastro de participação será movido para a lixeira da Extensão e poderá ser restaurado."
                : action === "retirar"
                  ? "O aluno sairá da lista de participantes vinculados deste projeto."
                  : action === "desativar"
                    ? "O aluno ficará inativo neste projeto e seu convite de acesso será revogado."
                    : recovering
                      ? "O cadastro retornará como inativo. Reative-o separadamente após conferir sua situação."
                      : "A situação anterior do vínculo será recuperada."}
            </p>
            <p>
              Esta ação afeta apenas o vínculo selecionado. Horas, evidências,
              contribuições e histórico serão preservados. Outros projetos e a
              conta de acesso institucional permanecem registrados.
            </p>
            {(recovering || action === "reativar") && (
              <p>Convites revogados não serão reativados por esta operação.</p>
            )}
            <label>
              Motivo obrigatório
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className="ext-project-error">
                {error}
              </p>
            )}
            <div className="ext-form-actions">
              <button
                type="button"
                className="ext-btn-cancel"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={
                  action === "excluir" ? "ext-btn-danger" : "ext-btn-save"
                }
                disabled={busy}
              >
                {busy
                  ? "Salvando…"
                  : "Confirmar " + LABELS[action].toLocaleLowerCase("pt-BR")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
