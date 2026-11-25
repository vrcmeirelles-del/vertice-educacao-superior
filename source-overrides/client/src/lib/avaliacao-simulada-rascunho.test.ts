import { describe, expect, it } from "vitest";
import { camposAPreencher, rascunhoIndicador, RASCUNHO_VERSION } from "./avaliacao-simulada-rascunho";

const base = { code: "1.3", name: "Perfil profissional do egresso", conceitoAtual: null, conceitoViavel: null, equivalencia: null,
  docInfo: { total: 2, docs: 1, validados: 0, enviados: 1, pendentes: 1 } };

describe("rascunho da avaliação simulada por algoritmo", () => {
  it("é determinístico e marcado como rascunho versionado", () => {
    const a = rascunhoIndicador(base), b = rascunhoIndicador(base);
    expect(a).toEqual(b);
    expect(a.parecer).toContain(RASCUNHO_VERSION);
    expect(a.parecer).toMatch(/revisar antes de usar/);
  });

  it("aponta conceito sem lastro quando não há evidência validada", () => {
    const r = rascunhoIndicador({ ...base, conceitoAtual: 4 });
    expect(r.parecer).toMatch(/conceito atual registrado \(4\) não tem.*nenhuma evidência validada/);
    expect(r.lacunas).toMatch(/Nenhuma evidência validada/);
  });

  it("não atribui conceito nem afirma atendimento a critério", () => {
    const r = rascunhoIndicador({ ...base, docInfo: { total: 1, docs: 3, validados: 3, enviados: 0, pendentes: 0 }, conceitoAtual: 5, conceitoViavel: 5 });
    const tudo = Object.values(r).join(" ");
    expect(tudo).not.toMatch(/atende|conceito 5 garantido|recomenda-se conceito/i);
    expect(r.lacunas).toMatch(/texto oficial do instrumento/);
  });

  it("sem solicitação pede cadastro ou 'não se aplica'", () => {
    const r = rascunhoIndicador({ ...base, docInfo: { total: 0, docs: 0, validados: 0, enviados: 0, pendentes: 0 } });
    expect(r.parecer).toMatch(/Não há solicitação documental/);
    expect(r.lacunas).toMatch(/não se aplica/);
  });

  it("usa a equivalência com o Novo Instrumento no plano", () => {
    const r = rascunhoIndicador({ ...base, equivalencia: { objetos: ["1.11", "1.14"], grau: "direto" } });
    expect(r.plano_nde).toMatch(/objeto\(s\) 1\.11, 1\.14/);
  });

  it("nunca sobrescreve texto escrito pelo avaliador", () => {
    const r = rascunhoIndicador(base);
    const novos = camposAPreencher({ parecer: "Parecer do avaliador.", lacunas: "  ", plano_nde: "", perguntas_comissao: "Pergunta própria" }, r);
    expect(Object.keys(novos).sort()).toEqual(["lacunas", "plano_nde"]);
  });
});
