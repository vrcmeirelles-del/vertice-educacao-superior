import { useState } from "react";
import { COURSE_STATUS, DEGREE, MODALITY, type Row } from "@/lib/area";

const fields = [
  { key: "degree", title: "Grau", options: DEGREE },
  { key: "modality", title: "Modalidade", options: MODALITY },
  { key: "status", title: "Situação do curso", options: COURSE_STATUS },
] as const;

const missing = "Não informado";

export function courseClassification(course: Row, key: typeof fields[number]["key"]) {
  const value = String(course[key] ?? "").trim();
  return fields.find(field => field.key === key)?.options.find(([code]) => code === value)?.[1] ?? (value || missing);
}

export function useCourseFilters(courses: Row[], onChange?: () => void) {
  const [values, setValues] = useState<Record<string, string>>({});
  const matches = (course: Row) => fields.every(({ key }) =>
    !values[key] || courseClassification(course, key) === values[key]
  );
  const controls = <>
    {fields.map(({ key, title }) => {
      const options = Array.from(new Set(courses.map(course => courseClassification(course, key))))
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      return <label key={key}>
        {title}
        <select value={values[key] ?? ""} onChange={event => {
          setValues({ ...values, [key]: event.target.value });
          onChange?.();
        }}>
          <option value="">Todos</option>
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>;
    })}
    {Object.values(values).some(Boolean) && <button type="button" className="corp-login-text-button" onClick={() => {
      setValues({});
      onChange?.();
    }}>Limpar classificação</button>}
  </>;
  return { matches, controls, active: Object.values(values).some(Boolean) };
}
