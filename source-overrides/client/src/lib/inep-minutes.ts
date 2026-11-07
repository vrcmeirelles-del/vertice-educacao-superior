import { z } from 'zod';

export const MINUTES_CODE = 'D2-2.12-COL-02';
export const ACTION_STATES = ['pendente', 'em_andamento', 'concluida', 'reprogramada', 'cancelada'] as const;
const text = (max = 8000) => z.string().max(max);
const date = z.union([z.literal(''), z.string().date()]);
export const minutesSchema = z.object({
  meetingType: z.enum(['ordinaria', 'extraordinaria']), number: text(80), date,
  time: text(5).regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/), location: text(250),
  chair: text(200), secretary: text(200), quorum: text(1000),
  agenda: text(), previousMinutes: text(), discussion: text(), decisions: text(),
  nextMeeting: text(500), participants: text(4000),
  actions: z.array(z.object({
    id: z.string().uuid(), description: text(2000).min(1), owner: text(200), due: date,
    status: z.enum(ACTION_STATES), evidence: text(1000), origin: text(200), reason: text(1000),
  }).strict()).max(100),
}).strict().superRefine((data, ctx) => {
  const ids = new Set<string>();
  data.actions.forEach((a, i) => {
    if (ids.has(a.id)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'id'], message: 'Identificador repetido.' });
    ids.add(a.id);
    if (a.status === 'concluida' && !a.evidence.trim()) ctx.addIssue({ code: 'custom', path: ['actions', i, 'evidence'], message: 'Informe a referência da evidência da conclusão.' });
    if (['cancelada', 'reprogramada'].includes(a.status) && !a.reason.trim()) ctx.addIssue({ code: 'custom', path: ['actions', i, 'reason'], message: 'Informe o motivo do cancelamento ou reprogramação.' });
    if (a.status === 'reprogramada' && !a.due) ctx.addIssue({ code: 'custom', path: ['actions', i, 'due'], message: 'Informe o novo prazo.' });
  });
});
export type MinutesBody = z.infer<typeof minutesSchema>;
export type MinutesRow = {
  id: string; institution_id: string; course_id: string; source_library_id: string;
  title: string; body: MinutesBody; version: number; mutation_id: string;
  created_by: string; updated_by: string; updated_at: string; created_at: string;
};
export const emptyMinutes = (): MinutesBody => ({ meetingType: 'ordinaria', number: '', date: '', time: '', location: '', chair: '', secretary: '', quorum: '', agenda: '', previousMinutes: '', discussion: '', decisions: '', nextMeeting: '', participants: '', actions: [] });

// In-memory recovery is scoped to the authenticated actor and institution. No document
// contents enter browser storage. Pending operations outlive mounted React components.
export type MinutesSession = {
  row: MinutesRow; saved: string; pending: boolean; uncertain: boolean; message: string;
  attempt?: { row: MinutesRow; mutation: string }; conflict: boolean;
};
export function createMinutesStore() {
  const sessions = new Map<string, MinutesSession>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  const fingerprint = (r: MinutesRow) => JSON.stringify([r.title, r.body]);
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    get(key: string) { return sessions.get(key); },
    entries(prefix: string) { return [...sessions.entries()].filter(([key]) => key.startsWith(prefix)); },
    open(key: string, row: MinutesRow) {
      if (!sessions.has(key)) sessions.set(key, { row, saved: row.version ? fingerprint(row) : '', pending: false, uncertain: false, message: '', conflict: false });
      emit();
    },
    edit(key: string, row: MinutesRow) {
      const s = sessions.get(key);
      if (!s || s.pending || s.uncertain || s.conflict) return;
      sessions.set(key, { ...s, row, message: '' }); emit();
    },
    dirty(s?: MinutesSession) { return !!s && (s.saved !== fingerprint(s.row) || s.pending || s.uncertain); },
    clear() { sessions.clear(); emit(); },
    forget(key: string) { if (!sessions.get(key)?.pending) { sessions.delete(key); emit(); } },
    async save(key: string, persist: (row: MinutesRow, mutation: string) => Promise<MinutesRow>) {
      const s = sessions.get(key);
      if (!s || s.pending || s.conflict) return;
      const attempt = s.attempt ?? { row: structuredClone(s.row), mutation: crypto.randomUUID() };
      const working = { ...s, attempt, pending: true, uncertain: false, message: 'Salvando no repositório…' };
      sessions.set(key, working); emit();
      try {
        const row = await persist(attempt.row, attempt.mutation);
        if (sessions.get(key) !== working) return; // signed out; never repopulate another session
        sessions.set(key, { row, saved: fingerprint(row), pending: false, uncertain: false, conflict: false, message: `Rascunho salvo · versão ${row.version}. Não assinado.` });
      } catch (error) {
        if (sessions.get(key) !== working) return;
        const code = (error as { code?: string })?.code;
        const conflict = code === '40001';
        const definitive = conflict || ['42501', '23514', '22023', '23503'].includes(code ?? '');
        sessions.set(key, { ...s, attempt: definitive ? undefined : attempt, pending: false, uncertain: !definitive, conflict,
          message: conflict ? 'Outra pessoa salvou uma versão mais recente. Seu texto está preservado nesta tela; consulte a versão do servidor antes de continuar.' : definitive ? 'Gravação recusada. Confira os campos e a permissão da sua sessão. O texto continua nesta tela.' : 'Não foi possível confirmar a gravação. Verificar gravação repete a mesma operação com segurança, sem criar outra ata.' });
      }
      emit();
    },
  };
}
export const minutesStore = createMinutesStore();
