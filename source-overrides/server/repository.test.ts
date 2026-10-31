import { describe, it, expect } from "vitest";
import {
  documentFile,
  latestDocuments,
  repositorySummary,
} from "../client/src/lib/repository";
describe("repositório ligado às metas", () => {
  it("conta a última versão e não transforma reenvio em nova exigência", () => {
    const requests = [
      { id: "a", active: true, due_date: "2026-10-01" },
      { id: "b", active: true },
      { id: "c", active: false },
    ];
    const files = [
      {
        id: "1",
        request_id: "a",
        status: "validado",
        created_at: "2026-10-01T10:00:00Z",
      },
      {
        id: "2",
        request_id: "a",
        status: "devolvido",
        created_at: "2026-10-02T10:00:00Z",
      },
      {
        id: "3",
        request_id: "c",
        status: "validado",
        created_at: "2026-10-03T10:00:00Z",
      },
    ];
    expect(latestDocuments(files).get("a")?.id).toBe("2");
    expect(repositorySummary(requests, files, "2026-10-31")).toEqual({
      total: 2,
      nsa: 0,
      sent: 1,
      validated: 0,
      returned: 1,
      late: 1,
      pending: 1,
      percent: 0,
    });
  });
  it("recebido não equivale a validado nem a meta cumprida", () => {
    expect(
      repositorySummary(
        [{ id: "a" }],
        [
          {
            id: "1",
            request_id: "a",
            status: "enviado",
            created_at: "2026-10-01",
          },
        ],
        "2026-10-31",
      ),
    ).toMatchObject({ sent: 1, validated: 0, percent: 0 });
  });
  it("não inventa 100% quando não há exigências", () => {
    expect(repositorySummary([], []).percent).toBe(0);
  });
  it("recusa executáveis, arquivo vazio e tamanho excedido", () => {
    expect(() => documentFile({ name: "foto.svg", size: 10 })).toThrow(
      /Formato/,
    );
    expect(() => documentFile({ name: "teste.pdf", size: 0 })).toThrow(
      /conteúdo/,
    );
    expect(() =>
      documentFile({ name: "teste.pdf", size: 20 * 1024 * 1024 + 1 }),
    ).toThrow(/20 MB/);
    expect(documentFile({ name: "Ata.PDF", size: 100 }).mime).toBe(
      "application/pdf",
    );
  });
});

// A apresentação deve respeitar o período e separar acervo não configurado de pendência.
import {
  requestsInSemester,
  repositoryDimension,
  courseRepositoryStatus,
  catalogForProfile,
} from "../client/src/lib/repository";
describe("navegação e cobertura do repositório", () => {
  it("normaliza o período e mantém documentos sem semestre no acervo", () => {
    expect(
      requestsInSemester(
        [
          { id: "a", semester: "2026/2" },
          { id: "b", semester: "2026-1" },
          { id: "c", semester: null },
        ],
        "2026-2",
      ).map((r) => r.id),
    ).toEqual(["a", "c"]);
  });
  it("organiza as dimensões sem inventar referência para documento personalizado", () => {
    expect(repositoryDimension("1.2, 2.3")).toBe("1");
    expect(repositoryDimension("3.15")).toBe("3");
    expect(repositoryDimension("")).toBe("outros");
  });
  it("um curso sem checklist não aparece como validado nem como pendente", () => {
    expect(courseRepositoryStatus([], [])).toMatchObject({
      label: "Sem checklist",
      total: 0,
      pending: 0,
      percent: 0,
    });
  });
  it("o catálogo respeita perfil, grau e oferta a distância do curso", () => {
    const catalog = [
      { aplicabilidade: ["todos"] },
      { aplicabilidade: ["juridica"] },
      { aplicabilidade: ["licenciatura"] },
      { aplicabilidade: ["ead"] },
    ];
    expect(
      catalogForProfile(
        catalog,
        { id: "a", degree: "bacharelado", modality: "presencial" },
        "juridica",
      ),
    ).toHaveLength(2);
    expect(
      catalogForProfile(
        catalog,
        { id: "b", degree: "licenciatura", modality: "semipresencial" },
        "geral",
      ),
    ).toHaveLength(3);
  });
});

import {
  coverageCsv,
  evidenceSemesters,
  evidenceSeries,
} from "../client/src/lib/repository-evidence";
describe("experiência do repositório original integrada", () => {
  it("monta três semestres atravessando a virada do ano", () => {
    expect(evidenceSemesters("2026-1")).toEqual(["2025-1", "2025-2", "2026-1"]);
    expect(evidenceSemesters("2026")).toEqual([]);
  });
  it("distingue semestre não configurado de pendência e usa a última versão", () => {
    const requests = [
      { id: "a", document_code: "ATA", title: "Atas", semester: "2026/1" },
      { id: "b", document_code: "ATA", title: "Atas", semester: "2026-2" },
      {
        id: "c",
        document_code: "ATA",
        title: "Atas",
        semester: "2025-2",
        active: false,
      },
    ];
    const files = [
      {
        id: "1",
        request_id: "a",
        status: "validado",
        created_at: "2026-01-01",
      },
      {
        id: "2",
        request_id: "a",
        status: "devolvido",
        created_at: "2026-01-02",
      },
    ];
    const row = evidenceSeries(requests, files, [
      "2025-2",
      "2026-1",
      "2026-2",
    ])[0];
    expect(row.cells.map((c) => c.status)).toEqual([
      "nao_configurado",
      "devolvido",
      "pendente",
    ]);
  });
  it("não projeta documento sem semestre como três entregas históricas", () => {
    const rows = evidenceSeries(
      [{ id: "a", title: "Regulamento", semester: null }],
      [{ id: "f", request_id: "a", status: "validado" }],
      ["2026-1", "2026-2"],
    );
    expect(rows[0].cells.every((c) => c.status === "nao_configurado")).toBe(
      true,
    );
  });
  it("exporta CSV com escape de aspas e de fórmulas de planilha", () => {
    const csv = coverageCsv(
      [
        {
          id: "a",
          title: '=HYPERLINK("teste")',
          document_code: "ATA",
          semester: "2026-2",
        },
      ],
      [],
    );
    expect(csv).toContain('"\'=HYPERLINK(""teste"")"');
    expect(csv).toContain('"pendente"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});

import {
  repositoryCoursePrefix,
  repositoryDocumentCode,
  repositoryTemplateCode,
} from "../client/src/lib/repository-codes";
import repositoryCatalog from "../client/src/lib/repository-catalog.json";
describe("códigos documentais por curso", () => {
  it("prioriza o código cadastrado e preserva os zeros iniciais", () => {
    const course = {
      id: "direito",
      name: "Direito – Bacharelado",
      code: "027",
    };
    expect(repositoryCoursePrefix(course)).toBe("027");
    expect(repositoryDocumentCode("DIR-NDE-01", course)).toBe("027-NDE-01");
    expect(repositoryDocumentCode("027-NDE-01", course)).toBe("027-NDE-01");
  });
  it("usa uma abreviatura estável quando o curso não tem código", () => {
    expect(
      repositoryCoursePrefix({ id: "a", name: "Administração – Bacharelado" }),
    ).toBe("ADM");
    expect(
      repositoryCoursePrefix({ id: "b", name: "Sistemas de Informação" }),
    ).toBe("SI");
    expect(repositoryCoursePrefix(null)).toBe("IES");
  });
  it("identifica o mesmo modelo sem sobrescrever códigos personalizados", () => {
    expect(repositoryTemplateCode("027-NDE-01")).toBe("DIR-NDE-01");
    expect(repositoryTemplateCode("ADM-NDE-01")).toBe("DIR-NDE-01");
    expect(
      repositoryDocumentCode("PROTOCOLO-EXTERNO", { id: "a", code: "027" }),
    ).toBe("PROTOCOLO-EXTERNO");
    expect(
      new Set(repositoryCatalog.map((t) => t.codigo.replace(/^DIR-/, ""))).size,
    ).toBe(repositoryCatalog.length);
  });
  it("reúne o código antigo e o novo na mesma linha histórica", () => {
    const rows = evidenceSeries(
      [
        {
          id: "a",
          title: "Atas NDE",
          document_code: "DIR-NDE-01",
          semester: "2026-1",
        },
        {
          id: "b",
          title: "Atas NDE",
          document_code: "027-NDE-01",
          semester: "2026-2",
        },
      ],
      [],
      ["2026-1", "2026-2"],
      { id: "direito", code: "027" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("027-NDE-01");
    expect(rows[0].cells.map((c) => c.required)).toEqual([1, 1]);
  });
  it("exporta o código do curso em vez do prefixo legado", () => {
    const csv = coverageCsv(
      [{ id: "a", title: "Atas", document_code: "DIR-NDE-01" }],
      [],
      { id: "direito", code: "027" },
    );
    expect(csv).toContain("027-NDE-01");
    expect(csv).not.toContain("DIR-NDE-01");
  });
});

import {
  REPOSITORY_PERIODS,
  semesterLabel,
  requestDocumentStatus,
} from "../client/src/lib/repository";
describe("semestres e não aplicabilidade documental", () => {
  it("oferece os sete semestres solicitados e exibe ano/semestre", () => {
    expect(REPOSITORY_PERIODS.map(semesterLabel)).toEqual([
      "2027/1",
      "2026/2",
      "2026/1",
      "2025/2",
      "2025/1",
      "2024/2",
      "2024/1",
    ]);
  });
  it("exclui NSA das pendências, devoluções, atrasos e do denominador", () => {
    const requests = [
      { id: "a", not_applicable: true, due_date: "2020-01-01" },
      { id: "b", not_applicable: true },
      { id: "c" },
    ];
    const files = [{ id: "f", request_id: "a", status: "devolvido" }];
    expect(repositorySummary(requests, files, "2026-10-31")).toMatchObject({
      total: 1,
      nsa: 2,
      pending: 1,
      returned: 0,
      late: 0,
      sent: 0,
      validated: 0,
      percent: 0,
    });
  });
  it("não apresenta todos os itens NSA como checklist ausente ou 100% validado", () => {
    const summary = courseRepositoryStatus(
      [{ id: "a", not_applicable: true }],
      [],
    );
    expect(summary.label).toBe("NSA — Não se aplica");
    expect(summary.percent).toBe(0);
    expect(summary.pending).toBe(0);
  });
  it("recalcula as pendências quando o item volta a ser aplicável", () => {
    expect(
      repositorySummary([{ id: "a", not_applicable: false }], []).pending,
    ).toBe(1);
  });
  it("mostra NSA no histórico e na exportação mesmo se havia arquivo anterior", () => {
    const request = {
      id: "a",
      title: "Documento",
      document_code: "027-NDE-01",
      semester: "2026-2",
      not_applicable: true,
      nsa_reason: "Fora do PPC",
    };
    const files = [{ id: "f", request_id: "a", status: "devolvido" }];
    expect(requestDocumentStatus(request, files[0])).toBe("nsa");
    expect(
      evidenceSeries([request], files, ["2026-2"])[0].cells[0].status,
    ).toBe("nsa");
    expect(coverageCsv([request], files)).toContain("Fora do PPC");
    expect(coverageCsv([request], files)).toContain('"nsa"');
  });
  it("um documento antigo não cumpre a exigência do semestre atual", () => {
    const requests = [
      { id: "old", semester: "2024-1" },
      { id: "now", semester: "2026-2" },
    ];
    const files = [{ id: "f", request_id: "old", status: "validado" }];
    expect(
      repositorySummary(requestsInSemester(requests, "2026-2"), files),
    ).toMatchObject({ total: 1, validated: 0, pending: 1 });
  });
});
