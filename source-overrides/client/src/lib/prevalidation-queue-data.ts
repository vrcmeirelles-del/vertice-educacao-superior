/** Read-only queue queries. Keep URLs bounded and fail visibly on lookup errors. */
type Client = { from(table: string): any };
type RecordRow = Record<string, any>;
export async function listPrevalidationAttempts(client: Client, institutionId: string, columns: string) {
  const rows: RecordRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from('vertice_doc_prevalidation').select(columns)
      .eq('institution_id', institutionId).order('created_at', { ascending: false })
      .order('id', { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function readPrevalidationBatches(client: Client, institutionId: string,
  table: 'vertice_repository_files' | 'vertice_documents' | 'vertice_doc_indicator_links',
  column: 'id' | 'prevalidation_id', ids: string[], columns: string) {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: RecordRow[] = [];
  for (let start = 0; start < unique.length; start += 50) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(table).select(columns).eq('institution_id', institutionId)
        .in(column, unique.slice(start, start + 50)).order('id').range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}
