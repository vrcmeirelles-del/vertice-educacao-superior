import { useState, type FormEvent } from "react";
import { clean, explain, type Field, type Row } from "@/lib/area";
import {suggestionOptions} from "@/lib/field-suggestions";

/** Formulário genérico de cadastro/edição. Valida no navegador e deixa a regra final ao banco. */
export default function RecordForm({
  title,
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  optionsFor,
  onValueChange,
}: {
  title: string;
  fields: Field[];
  initial?: Partial<Row> | Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  optionsFor?: (field:Field,values:Record<string,unknown>)=>Field['options'];
  onValueChange?: (values:Record<string,unknown>,changed:string)=>Record<string,unknown>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of fields) v[f.name] = initial?.[f.name] ?? "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestionMode,setSuggestionMode] = useState<Record<string,string>>({});
  const set = (k: string, v: unknown) => setValues(s => {const next={...s,[k]:v};return onValueChange?onValueChange(next,k):next;});

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
          const suggestions=(f.type==="textarea"||(!f.type&&f.name!=="cnpj"))?suggestionOptions(f.name,f.label):[];
          const showSuggestions=suggestions.length>0;
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
                  {(optionsFor?optionsFor(f,values):f.options)?.map(([k, l]) => (
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
              {showSuggestions&&<div className="vx-suggestion-box">
                <span className="vx-suggestion-caption">Sugestões padronizadas (opcionais)</span>
                <select id={id+"-suggestions"} value={suggestionMode[f.name]??""} onChange={e=>{
                  const choice=e.target.value;
                  setSuggestionMode(previous=>({...previous,[f.name]:choice}));
                  if(choice==="outro"){set(f.name,"");return;}
                  if(choice!==""&&suggestions[Number(choice)])set(f.name,suggestions[Number(choice)]);
                }}>
                  <option value="">Não substituir o texto atual</option>
                  {suggestions.map((text,i)=><option key={i} value={String(i)}>{text.length>105?text.slice(0,105)+"…":text}</option>)}
                  <option value="outro">Outro — digitar texto personalizado</option>
                </select>
                {suggestionMode[f.name]==="outro"&&<small>Digite livremente no campo acima. O texto personalizado será preservado.</small>}
              </div>}
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
