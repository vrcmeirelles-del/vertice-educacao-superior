import {describe,expect,it} from 'vitest';
import {createCurationDecision} from './curation-decision';
describe('registro docente versionado com o rascunho',()=>{
 it('preserva original, proposta, versão de regra e decisão explícita',()=>{
  const d=createCurationDecision({
   questionId:'questao-1',action:'accepted',original:'  O caso concreto  ',
   proposal:'O caso concreto.',findings:['WHITESPACE','END_PUNCTUATION','WHITESPACE'],
   timestamp:'2026-11-20T12:00:00.000Z'});
  expect(d.action).toBe('accepted');
  expect(d.ruleVersion).toBe('rules-curation-1.0');
  expect(d.findings).toEqual(['WHITESPACE','END_PUNCTUATION']);
  expect(d.originalStatement).not.toBe(d.proposedStatement);
 });
 it('não permite aceite sem proposta nem ciência com alteração automática',()=>{
  expect(()=>createCurationDecision({questionId:'1',action:'accepted',
   original:'abc',proposal:null,findings:[],timestamp:'2026-11-20T12:00:00Z'})).toThrow();
  expect(()=>createCurationDecision({questionId:'1',action:'acknowledged',
   original:'abc',proposal:'def',findings:[],timestamp:'2026-11-20T12:00:00Z'})).toThrow();
 });
});
