// Fixture sintética do contrato da RPC vertice_automation_dashboard.
const I = '00000000-0000-4000-8000-000000000101';
const regra = (id: string, state = 'inactive', sourceStatus = 'identificada', priority = 'P0') => ({ id, version: 'v1', module: 'Repositório', priority, cadence: 'daily', sourceStatus, state });
export const painel = (over: Record<string, unknown> = {}) => ({
  institutionId: I, courseId: null, readOnly: false, config: null, pendingConfig: null, lastRun: null, pending: null, events: [],
  rules: [regra('repo.overdue'), regra('repo.due', 'shadow', 'identificada', 'P1'), regra('enade.gap', 'inactive', 'pendente')], ...over });

