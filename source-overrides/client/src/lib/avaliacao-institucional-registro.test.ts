import { describe, expect, it } from "vitest";
import { carregarNotasEixos, gravarNotaEixo, type Db } from "./avaliacao-institucional-registro";

type Resp = { data: any; error: any };
function fakeDb(responses: Record<string, Resp>, calls: any[] = []): Db {
  return {
    from(table: string) {
      const q: any = {
        _t: table,
        select: () => q, eq: (k: string, v: unknown) => { calls.push([table, "eq", k, v]); return q; },
        maybeSingle: () => q,
        upsert: (row: unknown, opts: unknown) => { calls.push([table, "upsert", row, opts]); return q; },
        then: (ok: (r: Resp) => unknown) => Promise.resolve(responses[table] ?? { data: null, error: null }).then(ok),
      };
      return q;
    },
  };
}

describe("registro do conceito por eixo", () => {
  it("sem catálogo no banco fica só em simulação, sem erro", async () => {
    const r = await carregarNotasEixos(fakeDb({ vertice_instrument_catalog: { data: null, error: null } }), "ies");
    expect(r).toEqual({ catalogId: null, notas: {}, erro: null });
  });

  it("carrega as notas gravadas; nota limpa volta como nula", async () => {
    const calls: any[] = [];
    const r = await carregarNotasEixos(fakeDb({
      vertice_instrument_catalog: { data: { id: "cat" }, error: null },
      vertice_avaliacao_institucional_eixos: { data: [{ axis_code: 2, conceito: 4 }, { axis_code: 5, conceito: null }], error: null },
    }, calls), "ies");
    expect(r).toEqual({ catalogId: "cat", notas: { 2: 4, 5: null }, erro: null });
    expect(calls).toContainEqual(["vertice_instrument_catalog", "eq", "instrument_code", "recredenciamento_institucional"]);
    expect(calls).toContainEqual(["vertice_avaliacao_institucional_eixos", "eq", "institution_id", "ies"]);
  });

  it("grava pela chave única e traduz a recusa de permissão", async () => {
    const calls: any[] = [];
    expect(await gravarNotaEixo(fakeDb({}, calls), "ies", "cat", 3, 5)).toBeNull();
    expect(calls[0]).toEqual(["vertice_avaliacao_institucional_eixos", "upsert",
      { institution_id: "ies", catalog_id: "cat", axis_code: 3, conceito: 5 }, { onConflict: "institution_id,catalog_id,axis_code" }]);
    const negado = fakeDb({ vertice_avaliacao_institucional_eixos: { data: null, error: { code: "42501", message: "new row violates row-level security policy" } } });
    expect(await gravarNotaEixo(negado, "ies", "cat", 3, 5)).toMatch(/Sem permissão/);
  });

  it("recusa conceito fora de 1 a 5 antes de ir ao banco", async () => {
    const calls: any[] = [];
    expect(await gravarNotaEixo(fakeDb({}, calls), "ies", "cat", 1, 6)).toMatch(/1 a 5/);
    expect(calls).toEqual([]);
  });
});
