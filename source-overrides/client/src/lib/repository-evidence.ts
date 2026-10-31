import {
  repositoryDocumentCode,
  repositoryTemplateCode,
} from "./repository-codes";
import type { Row } from "./area";
import {
  latestDocuments,
  repositorySemester,
  requestDocumentStatus,
} from "./repository";

export function evidenceSemesters(current: string, count = 3) {
  const match = current.match(/^(\d{4})-([12])$/);
  if (!match) return [];
  let year = Number(match[1]),
    half = Number(match[2]);
  const periods: string[] = [];
  for (let i = 0; i < count; i++) {
    periods.unshift(`${year}-${half}`);
    if (half === 2) half = 1;
    else {
      year--;
      half = 2;
    }
  }
  return periods;
}

export function evidenceSeries(
  requests: Row[],
  files: Row[],
  periods: string[],
  course?: Row | null,
) {
  const latest = latestDocuments(files);
  const groups = new Map<string, Row[]>();
  for (const r of requests.filter((r) => r.active !== false)) {
    const key = String(
      repositoryTemplateCode(r.document_code) || `custom:${r.title}`,
    );
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    title: String(rows[0].title),
    code: repositoryDocumentCode(rows[0].document_code, course) || "—",
    cells: periods.map((period) => {
      const required = rows.filter(
        (r) => repositorySemester(r.semester) === period,
      );
      const states = required.map((r) =>
        requestDocumentStatus(r, latest.get(r.id)),
      );
      return {
        period,
        required: required.length,
        status: !states.length
          ? "nao_configurado"
          : states.every((s) => s === "nsa")
            ? "nsa"
            : states.filter((s) => s !== "nsa").every((s) => s === "validado")
              ? "validado"
              : states.includes("devolvido")
                ? "devolvido"
                : states.includes("pendente")
                  ? "pendente"
                  : "enviado",
      };
    }),
  }));
}

export function coverageCsv(
  requests: Row[],
  files: Row[],
  course?: Row | null,
) {
  const latest = latestDocuments(files);
  const safe = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]|^[\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  };
  const rows: unknown[][] = [
    [
      "Código",
      "Documento",
      "Semestre",
      "Indicadores",
      "Responsável",
      "Prazo",
      "Situação",
      "Arquivo",
      "Justificativa NSA",
    ],
  ];
  for (const r of requests.filter((r) => r.active !== false)) {
    const f = latest.get(r.id);
    rows.push([
      repositoryDocumentCode(r.document_code, course),
      r.title,
      r.semester,
      r.indicator,
      r.assignee_email,
      r.due_date,
      requestDocumentStatus(r, f),
      f?.file_name,
      r.nsa_reason,
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n");
}
