// Conceito simulado por eixo do Recredenciamento 2017, gravado por instituição
// (tabela vertice_avaliacao_institucional_eixos, migração 20261125160000).
// A escrita é restrita pelo banco a gestor e equipe com MFA; a tela mostra a recusa, não a esconde.
export const EIXOS_TABLE = "vertice_avaliacao_institucional_eixos";
export const CATALOGO = { code: "recredenciamento_institucional", version: "2017" } as const;

type Result<T> = { data: T | null; error: { message?: string; code?: string } | null };
type Query = PromiseLike<Result<any>> & Record<string, any>;
export type Db = { from: (table: string) => Query };

export type NotasEixo = Partial<Record<number, number | null>>;
export type Registro = { catalogId: string | null; notas: NotasEixo; erro: string | null };

/** Lê o catálogo da IES e as notas gravadas. Sem catálogo no banco, a tela fica só em modo de simulação. */
export async function carregarNotasEixos(db: Db, institutionId: string): Promise<Registro> {
  const cat = await db.from("vertice_instrument_catalog").select("id")
    .eq("institution_id", institutionId).eq("instrument_code", CATALOGO.code).eq("instrument_version", CATALOGO.version).maybeSingle();
  if (cat.error) return { catalogId: null, notas: {}, erro: "Não foi possível ler o catálogo do instrumento." };
  if (!cat.data) return { catalogId: null, notas: {}, erro: null };
  const res = await db.from(EIXOS_TABLE).select("axis_code,conceito")
    .eq("institution_id", institutionId).eq("catalog_id", cat.data.id);
  if (res.error) return { catalogId: cat.data.id, notas: {}, erro: "Não foi possível ler as notas gravadas." };
  const notas: NotasEixo = {};
  for (const r of res.data ?? []) notas[Number(r.axis_code)] = r.conceito === null ? null : Number(r.conceito);
  return { catalogId: cat.data.id, notas, erro: null };
}

/** Grava (ou limpa, com null) a nota de um eixo. Devolve mensagem de erro legível ou null. */
export async function gravarNotaEixo(db: Db, institutionId: string, catalogId: string, axis: number, conceito: number | null): Promise<string | null> {
  if (conceito !== null && (!Number.isInteger(conceito) || conceito < 1 || conceito > 5)) return "Conceito deve ser de 1 a 5.";
  const res = await db.from(EIXOS_TABLE).upsert(
    { institution_id: institutionId, catalog_id: catalogId, axis_code: axis, conceito },
    { onConflict: "institution_id,catalog_id,axis_code" });
  if (!res.error) return null;
  return res.error.code === "42501" || /row-level security/i.test(res.error.message ?? "")
    ? "Sem permissão para gravar: só gestor e equipe da instituição, com MFA."
    : "Não foi possível gravar a nota.";
}
