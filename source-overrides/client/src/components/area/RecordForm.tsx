import { useState, type FormEvent } from "react";
import { clean, explain, type Field, type Row } from "@/lib/area";

/** Formulário genérico de cadastro/edição. Valida no navegador e deixa a regra final ao banco. */
export default function RecordForm({
  title,
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
}: {
  title: string;
  fields: Field[];
  initial?: Partial<Row> | Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of fields) v[f.name] = initial?.[f.name] ?? "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setValues(s => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(clean(values, fields));
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="area-form" onSubmit={submit} aria-label={title}>
      <h3>{title}</h3>
      <div className="area-form-grid">
        {fields.map(f => {
          const id = `f-${f.name}`;
          const v = values[f.name] as string | number | undefined;
          return (
            <label key={f.name} htmlFor={id} className={f.wide || f.type === "textarea" ? "wide" : ""}>
              <span>
                {f.label}
                {f.required && <em aria-hidden="true"> *</em>}
              </span>
              {f.type === "textarea" ? (
                <textarea id={id} rows={3} required={f.required} value={v ?? ""} placeholder={f.placeholder} onChange={e => set(f.name, e.target.value)} />
              ) : f.type === "select" ? (
                <select id={id} required={f.required} value={v ?? ""} onChange={e => set(f.name, e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.required && v === "" && <option value="">Selecione…</option>}
                  {f.options?.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.type === "number" ? f.step ?? "any" : undefined}
                  min={f.min}
                  max={f.max}
                  required={f.required}
                  value={v ?? ""}
                  placeholder={f.placeholder}
                  onChange={e => set(f.name, e.target.value)}
                />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="area-error">
          {error}
        </p>
      )}
      <div className="area-form-actions">
        <button className="corp-button" disabled={busy}>
          {busy ? "Salvando…" : submitLabel}
        </button>
        <button type="button" className="corp-login-text-button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
