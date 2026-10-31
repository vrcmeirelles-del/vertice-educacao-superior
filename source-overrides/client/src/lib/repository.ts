import type { Row } from "./area";
export const REPOSITORY_BUCKET = "vertice-repositorios";
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};
export type DocumentStatus = "pendente" | "enviado" | "validado" | "devolvido";
export const DOCUMENT_STATUS: Record<DocumentStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado · aguardando análise",
  validado: "Validado",
  devolvido: "Devolvido · corrigir",
};
export function latestDocuments(files: Row[]) {
  const map = new Map<string, Row>();
  for (const f of files) {
    const id = String(f.request_id),
      last = map.get(id);
    if (
      !last ||
      String(f.created_at) > String(last.created_at) ||
      (f.created_at === last.created_at && f.id > last.id)
    )
      map.set(id, f);
  }
  return map;
}
export function repositorySummary(
  requests: Row[],
  files: Row[],
  date = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }),
) {
  const latest = latestDocuments(files);
  let total = 0,
    sent = 0,
    validated = 0,
    returned = 0,
    late = 0;
  for (const r of requests.filter((r) => r.active !== false)) {
    total++;
    const f = latest.get(r.id);
    if (f) sent++;
    if (f?.status === "validado") validated++;
    if (f?.status === "devolvido") returned++;
    if (r.due_date && String(r.due_date) < date && f?.status !== "validado")
      late++;
  }
  return {
    total,
    sent,
    validated,
    returned,
    late,
    pending: total - sent,
    percent: total ? Math.round((validated / total) * 100) : 0,
  };
}
export function documentFile(file: { name: string; size: number }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!FILE_TYPES[ext])
    throw new Error(
      "Formato não aceito. Use PDF, imagem, DOCX, XLSX, PPTX, TXT ou CSV.",
    );
  if (!file.size || file.size > MAX_DOCUMENT_SIZE)
    throw new Error("O arquivo deve ter conteúdo e no máximo 20 MB.");
  return { ext, mime: FILE_TYPES[ext] };
}

export const REPOSITORY_DIMENSIONS: Record<string, string> = {
  "1": "Organização didático-pedagógica",
  "2": "Corpo docente e tutorial",
  "3": "Infraestrutura",
  outros: "Documentos complementares",
};
export function repositorySemester(value: unknown) {
  return String(value ?? "").replace("/", "-");
}
export function requestsInSemester(requests: Row[], semester: string) {
  return requests.filter(
    (r) =>
      !semester ||
      !r.semester ||
      repositorySemester(r.semester) === repositorySemester(semester),
  );
}
export function repositoryDimension(indicator: unknown) {
  const match = String(indicator ?? "").match(/(?:^|[,;\s])([123])\.[0-9]+/);
  return match?.[1] ?? "outros";
}
export function courseRepositoryStatus(
  requests: Row[],
  files: Row[],
  date?: string,
) {
  const s = repositorySummary(requests, files, date);
  return {
    ...s,
    label: !s.total
      ? "Sem checklist"
      : s.returned
        ? "Correções solicitadas"
        : s.late
          ? "Entregas em atraso"
          : s.validated === s.total
            ? "Documentação validada"
            : s.pending
              ? "Documentos pendentes"
              : "Aguardando análise",
  };
}
export function catalogForProfile<T extends { aplicabilidade: unknown }>(
  items: T[],
  course: Row,
  area: string,
) {
  const degree = String(course.degree ?? "");
  const modality = String(course.modality ?? "").toLowerCase();
  return items.filter((t) => {
    const p = Array.isArray(t.aplicabilidade)
      ? (t.aplicabilidade as string[])
      : [];
    return (
      p.includes("todos") ||
      (p.includes("licenciatura") && degree === "licenciatura") ||
      (p.includes("tecnologia") &&
        ["tecnologia", "tecnologo"].includes(degree)) ||
      (p.includes("ead") && ["ead", "semipresencial"].includes(modality)) ||
      (p.includes("saude") && area === "saude") ||
      (p.includes("juridica") && area === "juridica")
    );
  });
}
