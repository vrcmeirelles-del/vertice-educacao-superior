import type { Row } from "./area";
import catalog from "./repository-catalog.json";

// The original catalog keys remain stable so existing versions and requirements match.
const catalogCodes = catalog.map((item) => ({
  code: item.codigo,
  suffix: item.codigo.replace(/^DIR-/, ""),
}));
export function repositoryTemplateCode(value: unknown) {
  const code = String(value ?? "").trim();
  return (
    catalogCodes.find(
      (item) => code === item.code || code.endsWith(`-${item.suffix}`),
    )?.code ?? code
  );
}

export function repositoryCoursePrefix(course: Row | null | undefined) {
  if (!course) return "IES";
  const registered = String(course.code ?? "").trim();
  if (registered) return registered;
  const words = String(course.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(
      (word) =>
        word &&
        ![
          "DE",
          "DA",
          "DO",
          "DAS",
          "DOS",
          "E",
          "EM",
          "CURSO",
          "BACHARELADO",
          "LICENCIATURA",
          "TECNOLOGIA",
          "TECNOLOGO",
        ].includes(word),
    );
  if (words.length === 1) return words[0].slice(0, 3);
  if (words.length)
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 8);
  return `CUR-${String(course.id)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase()}`;
}

export function repositoryDocumentCode(value: unknown, course?: Row | null) {
  const canonical = repositoryTemplateCode(value);
  const template = catalogCodes.find((item) => item.code === canonical);
  return template
    ? `${repositoryCoursePrefix(course)}-${template.suffix}`
    : String(value ?? "");
}
