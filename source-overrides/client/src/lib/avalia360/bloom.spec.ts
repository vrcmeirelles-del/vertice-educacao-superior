import {describe,expect,it} from 'vitest';
import {bloomProfile,classifyBloom,effectiveBloom} from './bloom';
describe('Bloom por verbo de comando',()=>{
 it('reconhece imperativo e infinitivo, sem acento, e escolhe o nível mais alto',()=>{
  expect(classifyBloom('Identifique o instituto e, em seguida, JUSTIFIQUE sua resposta.')).toEqual({level:5,verbs:['justifique','identifique']});
  expect(classifyBloom('Esclareça o conceito de posse.').level).toBe(2);
  expect(classifyBloom('Redija um parecer sobre o caso.').level).toBe(6);
 });
 it('não confunde substantivos jurídicos com comandos',()=>{
  expect(classifyBloom('No julgamento do recurso, a aplicação da lei ao fato concreto foi questionada. Assinale a correta.').level).toBeNull();
 });
 it('a correção do professor prevalece',()=>{
  expect(effectiveBloom({statement:'Identifique o instituto.',bloomLevel:4})).toEqual({level:4,source:'professor'});
  expect(effectiveBloom({statement:'Assinale a correta.'})).toEqual({level:null,source:'nenhum'});
 });
 it('desalinhamento: somativa a partir do 5º período com 60% em Lembrar/Compreender',()=>{
  const qs=[{statement:'Defina posse.'},{statement:'Explique a usucapião.'},{statement:'Cite dois requisitos.'},{statement:'Analise o caso.'},{statement:'Assinale a correta.'}];
  const p=bloomProfile(qs,{purpose:'somativa',period:6});
  expect(p).toMatchObject({unclassified:1,lowShare:0.75,misaligned:true});
  expect(p.distribution[1]).toBe(2);
  expect(bloomProfile(qs,{purpose:'formativa',period:6}).misaligned).toBe(false);
  expect(bloomProfile(qs,{purpose:'somativa',period:3}).misaligned).toBe(false);
 });
});
