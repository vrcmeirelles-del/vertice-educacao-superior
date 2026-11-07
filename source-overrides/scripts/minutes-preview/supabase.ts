// LOCAL SYNTHETIC VISUAL/BEHAVIOR FIXTURE ONLY. Never imported by the production app.
// Synthetic records persist here solely to exercise browser reload in the preview.
import type { MinutesRow } from '../../client/src/lib/inep-minutes';
const fixtureKey = 'minutes-synthetic-fixture';
const read = (): MinutesRow[] => JSON.parse(localStorage.getItem(fixtureKey) ?? '[]');
export const fixture = { delay: 0, loseResponse: false, saves: 0 };
const sources = ['ies-a','ies-b'].map((institution_id, i) => ({ id: `source-${i}`, institution_id, code: 'D2-2.12-COL-02', version: '2026-teste', title: 'Ata' }));
class Query {
 filters: Record<string, unknown> = {};
 constructor(private table: string) {}
 select() { return this; } eq(k: string, v: unknown) { this.filters[k] = v; return this; }
 order() { return this; } limit() { return this; }
 async maybeSingle() { return { data: this.table === 'vertice_memberships' ? { role: 'gestor' } : null, error: null }; }
 async single() { const result = await this.result(); return { data: result.data[0], error: null }; }
 async result(): Promise<{ data: any[]; error: null }> {
  const ies = this.filters.institution_id;
  if (this.table === 'vertice_courses') return { data: [{ id: `course-${ies}`, name: 'Direito · curso de demonstração' }], error: null };
  if (this.table === 'vertice_inep_library') return { data: sources.filter(s => s.institution_id === ies), error: null };
  if (this.table === 'vertice_minutes_revisions') return { data: read().filter(r => r.institution_id === ies && r.id === this.filters.draft_id).map(snapshot => ({ snapshot })), error: null };
  return { data: read().filter(r => r.institution_id === ies && (!this.filters.id || this.filters.id === r.id)), error: null };
 }
 then(resolve: (r: any) => unknown, reject?: (e: unknown) => unknown) { return this.result().then(resolve, reject); }
}
export const supabase = {
 auth: { async getUser() { return { data: { user: { id: 'synthetic-actor' } }, error: null }; }, onAuthStateChange(fn: (event: string, session: any) => void) { queueMicrotask(() => fn('INITIAL_SESSION', { user: { id: 'synthetic-actor' } })); return { data: { subscription: { unsubscribe() {} } } }; } },
 from(table: string) { return new Query(table); },
 async rpc(_name: string, p: any) {
  fixture.saves++;
  await new Promise(r => setTimeout(r, fixture.delay)); fixture.delay = 0;
  const rows = read(), prior = rows.find(r => r.id === p.p_id);
  if (prior?.mutation_id === p.p_mutation) return { data: prior, error: null };
  if (prior && prior.version !== p.p_expected) return { data: null, error: { code: '40001' } };
  const row = { id: p.p_id, institution_id: p.p_institution, course_id: p.p_course, source_library_id: p.p_source, title: p.p_title, body: p.p_body, version: p.p_expected + 1, mutation_id: p.p_mutation, created_by: 'synthetic-actor', updated_by: 'synthetic-actor', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  localStorage.setItem(fixtureKey, JSON.stringify([...rows.filter(r => r.id !== p.p_id), row]));
  if (fixture.loseResponse) { fixture.loseResponse = false; throw new Error('synthetic lost response'); }
  return { data: row, error: null };
 },
};
