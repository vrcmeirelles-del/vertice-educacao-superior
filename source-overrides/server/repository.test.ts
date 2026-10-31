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
