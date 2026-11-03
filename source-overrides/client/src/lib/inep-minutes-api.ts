import { supabase } from './supabase';
import { minutesStore, type MinutesRow } from './inep-minutes';

// Logout/account changes invalidate recoverable plaintext in memory.
let actor: string | undefined;
if (typeof window !== 'undefined') window.addEventListener('beforeunload', e => {
  if (minutesStore.entries('').some(([, session]) => minutesStore.dirty(session))) {
    e.preventDefault(); e.returnValue = '';
  }
});
supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id;
  if (actor !== next) minutesStore.clear();
  actor = next;
});
export async function saveMinutes(row: MinutesRow, mutation: string): Promise<MinutesRow> {
  const { data, error } = await supabase.rpc('vertice_save_minutes_draft', {
    p_id: row.id, p_institution: row.institution_id, p_course: row.course_id,
    p_source: row.source_library_id, p_title: row.title, p_body: row.body,
    p_expected: row.version, p_mutation: mutation,
  });
  if (error) throw error;
  if (!data?.id) throw new Error('Resposta incompleta');
  return data as MinutesRow;
}
