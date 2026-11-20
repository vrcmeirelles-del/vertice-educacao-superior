import { describe, it, expect } from 'vitest';
import { sortAlerts, describeEvidence, ruleLabels } from './pei-alerts';
describe('pei-alerts',()=>{
 it('ordena por severidade e depois pelo mais antigo',()=>{const r=sortAlerts([{severity:'media',created_at:'2026-01-01'},{severity:'alta',created_at:'2026-03-01'},{severity:'alta',created_at:'2026-02-01'}]);expect(r.map(x=>x.created_at)).toEqual(['2026-02-01','2026-03-01','2026-01-01']);});
 it('não muta a lista original',()=>{const a=[{severity:'baixa',created_at:'b'},{severity:'alta',created_at:'a'}];sortAlerts(a);expect(a[0].severity).toBe('baixa');});
 it('descreve só datas e status, sem texto clínico',()=>{expect(describeEvidence({next_review_date:'2026-11-01',plano_status:'ativo',foo:'laudo secreto'})).toBe('revisão em 01/11/2026 · plano ativo');});
 it('tem rótulo para as 10 regras',()=>{expect(Object.keys(ruleLabels)).toHaveLength(10);});
});
