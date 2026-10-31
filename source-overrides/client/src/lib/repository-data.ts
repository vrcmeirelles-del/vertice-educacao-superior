import { supabase } from "./supabase";
import type { Row } from "./area";
export async function listRepository(
  table: "vertice_repository_requests" | "vertice_repository_files",
  institutionId: string,
) {
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}
