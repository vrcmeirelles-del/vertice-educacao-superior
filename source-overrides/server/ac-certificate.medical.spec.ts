import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const dir='supabase/functions/vertice-ac-extract/';
const code=ts.transpile(readFileSync(dir+'certificate.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
const exportsObj:any={};
vm.runInNewContext(code,{exports:exportsObj,module:{exports:exportsObj},Math,Number,String,Array,Object,JSON,Set,Date,RegExp});
const {extractCertificate,findMinutes,findDates}=exportsObj;
const cats=[
 {id:'00000000-0000-4000-8000-000000000005',code:'AC05',label:'Eventos acadêmicos e científicos',description:'Congressos, seminários, palestras, fóruns, conferências e jornadas na área jurídica',max_per_item_minutes:600},
 {id:'00000000-0000-4000-8000-000000000016',code:'AC16',label:'Cursos de capacitação na área',description:'Cursos de capacitação na área jurídica (mín. 20h). Máx 20h/curso.',max_per_item_minutes:1200},
 {id:'00000000-0000-4000-8000-000000000008',code:'AC08',label:'Monitoria',description:'Monitoria acadêmica com certificação.',max_per_item_minutes:1200},
];
const SEMINARIO=`ORDEM DOS ADVOGADOS DO BRASIL - SECCIONAL RIO DE JANEIRO
CERTIFICADO
Certificamos que Maria Clara de Souza Lima participou do Seminário "Reforma Tributária e o Novo IVA Dual",
realizado nos dias 10 e 11 de outubro de 2026, com carga horária de 8 horas.
Rio de Janeiro, 20 de outubro de 2026.
Código de verificação: A1B2-C3D4`;
describe('leitura de certificado por regras',()=>{
 it('certificado completo: campos, categoria por palavra-chave e qualidade completa',()=>{
  const e=extractCertificate(SEMINARIO,{studentName:'Maria Clara de Souza Lima',declared:{title:'Seminário Reforma Tributária',issuer:'OAB RJ',minutes:480},categories:cats});
  expect(e.participant_name).toBe('Maria Clara de Souza Lima');
  expect(e.issuer).toBe('ORDEM DOS ADVOGADOS DO BRASIL - SECCIONAL RIO DE JANEIRO');
  expect(e.event_title).toBe('Reforma Tributária e o Novo IVA Dual');
  expect([e.starts_at,e.ends_at]).toEqual(['2026-10-10','2026-10-11']);
  expect(e.documentary_minutes).toBe(480);
  expect(e.extraction_quality).toBe('complete');
  expect(e.suggested_category_id).toBe(cats[0].id);
  expect(e.suggested_justification).toContain('seminario');
  expect(e.warnings).toEqual([]);
 });
 it('aponta divergências: nome, carga declarada, limite da categoria, falta de assinatura',()=>{
  const e=extractCertificate(SEMINARIO.replace(/Código.*$/,'').replace('8 horas','12 horas'),{studentName:'João Pedro Alves',declared:{minutes:1200},categories:cats});
  expect(e.name_matches).toBe(false);
  expect(e.participant_name).toBe('Maria Clara de Souza Lima');
  expect(e.warnings.join('|')).toMatch(/Nome no certificado \("Maria Clara de Souza Lima"\) não confere/);
  expect(e.warnings.join('|')).toMatch(/Carga declarada \(20h\) difere da do documento \(12h\)/);
  expect(e.warnings.join('|')).toMatch(/acima do limite da categoria \(10h por item\)/);
  expect(e.warnings.join('|')).toMatch(/Sem assinatura ou código de verificação/);
  expect(e.extraction_quality).toBe('partial');
 });
 it('curso com datas numéricas e carga em horas e minutos; categoria de capacitação',()=>{
  const t=`ESCOLA SUPERIOR DA ADVOCACIA
Certificado
Certificamos que JOÃO PEDRO ALVES concluiu o curso de Prática em Processo Civil, promovido pela ESA,
no período de 01/09/2026 a 30/09/2026, com carga horária total de 20h30min. Documento assinado digitalmente.`;
  const e=extractCertificate(t,{studentName:'João Pedro Alves',categories:cats});
  expect(e.documentary_minutes).toBe(1230);
  expect([e.starts_at,e.ends_at]).toEqual(['2026-09-01','2026-09-30']);
  expect(e.event_title).toBe('curso de Prática em Processo Civil');
  expect(e.suggested_category_id).toBe(cats[1].id);
  expect(e.extraction_quality).toBe('complete');
 });
 it('horário do evento não vira carga; várias cargas diferentes ficam como ambíguas',()=>{
  expect(findMinutes('Palestra às 19h30, duração de 2 horas').minutes).toBe(120);
  expect(findMinutes('módulo 1: 4 horas; módulo 2: 6 horas')).toEqual({minutes:null,ambiguous:true});
  expect(findDates('Brasília, 5 de março de 2026').onlyOne).toBe(true);
 });
 it('documento sem texto (imagem ou digitalizado): insuficiente, sem inventar campos',()=>{
  const e=extractCertificate('   ',{studentName:'Maria',categories:cats});
  expect(e.extraction_quality).toBe('insufficient');
  expect([e.issuer,e.documentary_minutes,e.event_title,e.suggested_category_id]).toEqual([null,null,null,null]);
  expect(e.warnings[0]).toMatch(/sem texto legível/);
 });
 it('a função não chama mais IA, exige vínculo e grava qualidade aceita pelo banco',()=>{
  const index=readFileSync(dir+'index.ts','utf8').replace(/\{const __aiFetch[\s\S]*?as typeof fetch;\}/,'');
  expect(index).not.toMatch(/api\.openai\.com|OPENAI_API_KEY|gpt-4o/);
  expect(index).toContain("vertice_memberships?user_id=eq.");
  expect(index).toContain("extraction_quality: extracted.extraction_quality,");
 });
});
