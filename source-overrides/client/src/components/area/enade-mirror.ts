import type { SupabaseClient } from "@supabase/supabase-js";

// Resolve only a persisted institutional identity. Never infer course equivalence.
export async function loadEnadeMirror(client: Pick<SupabaseClient, "from">, institutionId: string) {
  const mapping = await client.from("vertice_eorbit_institution_map")
    .select("eorbit_instituicao_id").eq("institution_id", institutionId);
  if (mapping.error) return { rows: [], notice: "Espelho indisponível: não foi possível consultar o vínculo institucional." };
  const ids = [...new Set((mapping.data ?? []).map(row => String(row.eorbit_instituicao_id)))];
  if (!ids.length) return { rows: [], notice: "Espelho indisponível: vínculo institucional não localizado ou não autorizado para esta sessão." };
  const rows: Record<string, unknown>[] = [];
  for (const id of ids) {
    for (let offset = 0; ; offset += 1000) {
      const page = await client.from("vertice_eorbit_enade")
        .select("id,semestre,curso_nome,habilitados").eq("instituicao_id", id)
        .order("id").range(offset, offset + 999);
      if (page.error) return { rows: [], notice: "Espelho indisponível: leitura não autorizada ou falha na fonte acadêmica." };
      rows.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
    }
  }
  if (!rows.length) return { rows, notice: "Nenhum registro visível no espelho para esta sessão; ausência de dados e restrição de acesso não foram distinguidas." };
  return { rows, notice: "Espelho consultado pelo vínculo institucional cadastrado. Equivalências de curso ainda exigem comprovação." };
}
