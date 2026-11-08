import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {demoInstitutionCourses} from '../client/src/lib/demo-showroom';
describe('BI Premium direto e público',()=>{
 it('registra a rota comercial pública e gera HTML estático acessível',()=>{
  const app=readFileSync(new URL('../client/src/PublicApp.tsx',import.meta.url),'utf8');
  const prerender=readFileSync(new URL('../scripts/prerender.tsx',import.meta.url),'utf8');
  const landing=readFileSync(new URL('../client/src/pages/public/CommercialDemo.tsx',import.meta.url),'utf8');
  expect(app).toContain('"/bi-demonstrativo": PremiumBIPublic');
  expect(prerender).toContain('"bi-demonstrativo",');
  expect(landing).toContain('Abrir o BI Premium interativo — acesso público');
  const page=readFileSync(new URL('../client/index.html',import.meta.url),'utf8');
  expect(page).toContain('connect-src');
  expect(page).toContain('https://www.fatoeordem.com.br');
  expect(page).not.toContain('connect-src *');
 });
 it('mantém dados do BI somente nas três IES fictícias',()=>{
  expect(demoInstitutionCourses('faculdade')).toHaveLength(6);
  expect(demoInstitutionCourses('centro')).toHaveLength(12);
  expect(demoInstitutionCourses('universidade')).toHaveLength(18);
 });
});