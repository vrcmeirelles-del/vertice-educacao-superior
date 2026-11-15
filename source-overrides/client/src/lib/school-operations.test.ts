import {describe,it,expect} from 'vitest';
import {completeSum,schoolRate,financeResult,classesCSV,parseClassCSV} from './school-operations';
describe('school data semantics',()=>{
 it('keeps absent data distinct from confirmed zero',()=>{expect(completeSum([],'n')).toBeNull();expect(completeSum([{n:1},{n:null}],'n')).toBeNull();expect(completeSum([{n:0},{n:0}],'n')).toBe(0);});
 it('does not invent rates with incompatible denominators',()=>{expect(schoolRate(0,0)).toBeNull();expect(schoolRate(30,20)).toBeNull();expect(schoolRate(null,20)).toBeNull();expect(schoolRate(15,30)).toBe(50);});
 it('does not turn missing costs into profit or receivables into cash',()=>{expect(financeResult({revenue_received:1000,receivable:300,personnel:100}).result).toBeNull();expect(financeResult({revenue_received:1000,receivable:300,personnel:100,direct_cost:100,allocated_cost:100}).result).toBe(700);});
});
const row={name:'Turma; "A"',grade:'1º ano',shift:'matutino',year:2026,capacity:30,enrolled:20,source:'Secretaria',reference_date:'2026-11-15',notes:'Duas\nlinhas'};
describe('school import boundary',()=>{
 it('round trips quoted delimiters, accents, newlines and missing counts',()=>{const r=parseClassCSV(classesCSV([row]))[0];expect(r.name).toBe(row.name);expect(r.notes).toBe(row.notes);expect(r.enrolled).toBe(20);expect(r.failed).toBeNull();});
 it('neutralizes spreadsheet formulas on export',()=>{expect(classesCSV([{...row,notes:'=HYPERLINK("bad")'}])).toContain("'=HYPERLINK");});
 it('rejects duplicate headers and unexpected data instead of guessing',()=>{expect(()=>parseClassCSV('name;name\na;b')).toThrow();expect(()=>parseClassCSV('Student Name,Phone\nX,123')).toThrow();});
 it('rejects invalid or incomplete counts',()=>{expect(()=>parseClassCSV(classesCSV([{...row,enrolled:1.5}]))).toThrow();expect(()=>parseClassCSV(classesCSV([{...row,capacity:null}]))).toThrow();});
 it('rejects oversized batches before submitting',()=>{expect(()=>parseClassCSV(classesCSV(Array.from({length:201},()=>row)))).toThrow();});
});
