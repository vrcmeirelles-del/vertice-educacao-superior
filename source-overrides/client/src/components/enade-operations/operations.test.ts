import { describe, it, expect } from "vitest";
import {
  blank,
  validation,
  merge,
  safeUrl,
  STATUSES,
  type Entry,
} from "./model";
describe("ENADE operacional: evidências antes do aceite", () => {
  it("expõe os nove estados solicitados sem deduzir status", () => {
    expect(STATUSES).toHaveLength(9);
    expect(blank().status).toBe("não confirmado");
  });
  it("não permite validar teste que não foi executado", () => {
    const p = blank();
    p.note = "Teste local";
    p.tests[0].validated = true;
    expect(validation(p, "Local")).toContain("execução");
  });
  it("código integrado exige versão e URL, sem exigir comprovação real", () => {
    const p = blank();
    p.note = "Código integrado";
    p.status = "integrado";
    expect(validation(p, "Produção")).toContain("versão");
    p.version = "abc123";
    p.url = "https://github.com/org/repo/pull/1";
    expect(validation(p, "Produção")).toBe("");
    expect(p.tests.every((t) => !t.validated)).toBe(true);
  });
  it("dados sintéticos não permitem funcionamento comprovado", () => {
    const p = blank();
    Object.assign(p, {
      status: "comprovadamente funcional",
      version: "abc",
      url: "https://example.org",
      note: "Teste sintético",
    });
    p.tests[1] = {
      ...p.tests[1],
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "passou",
      outcome: "passou" as const,
    };
    expect(validation(p, "Homologação")).toContain("autenticados");
  });
  it("demonstração continua demonstrativa mesmo com testes declarados reais", () => {
    const p = blank();
    Object.assign(p, {
      status: "comprovadamente funcional",
      version: "abc",
      url: "https://example.org",
      note: "Teste real",
    });
    p.tests = p.tests.map((t) => ({
      ...t,
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "passou",
      outcome: "passou" as const,
    }));
    expect(validation(p, "Demonstração")).toContain("homologação ou produção");
  });
  it("OCR, CPU, IA, MFA ou lote real pendentes bloqueiam aceite", () => {
    const p = blank();
    Object.assign(p, {
      status: "comprovadamente funcional",
      version: "abc",
      url: "https://example.org",
      note: "Teste real",
      dependencies: "OCR e MFA pendentes",
    });
    p.tests = p.tests.map((t) => ({
      ...t,
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "passou",
      outcome: "passou" as const,
    }));
    expect(validation(p, "Homologação")).toContain("dependências");
  });
  it("homologação exige checklists e confirmação humana", () => {
    const p = blank();
    Object.assign(p, {
      status: "homologado",
      version: "abc",
      url: "https://example.org",
      note: "Teste real",
    });
    p.tests = p.tests.map((t) => ({
      ...t,
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "passou",
      outcome: "passou" as const,
    }));
    expect(validation(p, "Homologação")).toContain("checklists");
    p.checks = p.checks.map((c) => ({
      ...c,
      result: "atendido",
      evidence: "https://example.org/aceite",
      note: "conferido",
    }));
    expect(validation(p, "Homologação")).toContain("humana");
    p.confirmHuman = true;
    expect(validation(p, "Homologação")).toBe("");
  });
  it("pronto para homologação mantém o aceite científico pendente", () => {
    const p = blank();
    Object.assign(p, {
      status: "pronto para homologação",
      version: "abc",
      url: "https://example.org",
      note: "Pronto para conferência humana",
    });
    p.tests = p.tests.map((t) => ({
      ...t,
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "passou",
      outcome: "passou" as const,
    }));
    p.checks = p.checks.map((c) =>
      c.key === "scientific"
        ? c
        : {
            ...c,
            result: "atendido",
            evidence: "https://example.org/check",
            note: "conferido",
          },
    );
    expect(validation(p, "Homologação")).toBe("");
    p.status = "homologado";
    p.confirmHuman = true;
    expect(validation(p, "Homologação")).toContain("checklists");
  });
  it("teste que falhou não vira comprovação funcional", () => {
    const p = blank();
    Object.assign(p, {
      status: "comprovadamente funcional",
      version: "abc",
      url: "https://example.org",
      note: "Validação de falha",
    });
    p.tests = p.tests.map((t) => ({
      ...t,
      executed: true,
      validated: true,
      evidence: "https://example.org/test",
      result: "verificado",
      outcome: "falhou" as const,
    }));
    expect(validation(p, "Homologação")).not.toBe("");
  });
  it("links não aceitam scripts, HTTP ou credenciais embutidas", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("http://example.org")).toBeUndefined();
    expect(safeUrl("https://user:secret@example.org")).toBeUndefined();
  });
  it("mescla páginas do histórico sem apagar revisões anteriores", () => {
    const a = { id: "a", seq: 1 } as Entry,
      b = { id: "b", seq: 2 } as Entry;
    expect(merge([a], [a, b])).toEqual([b, a]);
  });
});
