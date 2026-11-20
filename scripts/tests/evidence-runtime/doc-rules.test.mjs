import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const src=readFileSync(new URL('../../../supabase/functions/vertice-doc-analyze/doc-rules.ts',import.meta.url),'utf8');
const {ruleAnalysis,latestDate}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(src)));
const now=new Date(Date.UTC(2026,10,21));
const TYPES=['gap','inconsistency','non_compliance','outdated','suggestion','risk','strength'];
const SEV=['critical','high','medium','low','info'];

test('PPC completo: sem lacunas relevantes, fundamento citado, índice alto e contrato do banco',()=>{
 const ppc='Faculdade Exemplo. Projeto Pedagógico do Curso de Direito, aprovado pelo Colegiado em 10/03/2026. Objetivos do curso. Perfil do egresso. Matriz curricular com ementas e bibliografia. Carga horária total de 3.700 horas. Estágio supervisionado, atividades complementares, trabalho de conclusão de curso e curricularização da extensão. Sistema de avaliação da aprendizagem. Núcleo Docente Estruturante. Libras optativa. Conforme DCN, Res. CNE/CES 5/2018.';
 const r=ruleAnalysis(ppc,{code:'PPC',label:'Projeto Pedagógico de Curso',regulatory_basis:'DCN, Res. CNE/CES',renewal_months:60},now);
 assert.equal(r.findings.filter(f=>f.type==='gap').length,0);
 assert.ok(r.compliance_score>=95,String(r.compliance_score));
 assert.match(r.summary,/não é parecer de conformidade/i);
 for(const f of r.findings){assert.ok(TYPES.includes(f.type),f.type);assert.ok(SEV.includes(f.severity),f.severity);assert.ok(f.title&&f.message);}
});
test('norma revogada, lacunas e documento vencido pela data do texto',()=>{
 const txt='Regimento da Faculdade Exemplo, aprovado em 5 de fevereiro de 2019, nos termos do Decreto nº 5.773/2006 e da Portaria Normativa MEC 40/2007. Trata da matrícula e da frequência.';
 const r=ruleAnalysis(txt,{code:'PDI',label:'Plano de Desenvolvimento Inst.',regulatory_basis:'Lei 10.861/2004',renewal_months:60},now);
 const out=r.findings.filter(f=>f.type==='outdated').map(f=>f.regulatory_reference);
 assert.deepEqual(out,['Decreto 5.773/2006','Portaria Normativa MEC 40/2007']);
 assert.ok(r.findings.some(f=>f.title==='Missão e objetivos: não localizado'));
 assert.ok(r.findings.some(f=>f.type==='risk'&&/vencido/.test(f.title)));
 assert.ok(r.findings.some(f=>/Fundamento normativo da categoria não citado/.test(f.title)));
 assert.ok(r.compliance_score<50);
});
test('não acusa revogação sem citação e não inventa validade sem data',()=>{
 const r=ruleAnalysis('Ata da reunião do NDE. Presentes os membros. Pauta: revisão do PPC. Deliberações aprovadas.',{code:'NDE_ATA',label:'Ata do NDE',regulatory_basis:'Res. CONAES 01/2010',renewal_months:null},now);
 assert.equal(r.findings.filter(f=>f.type==='outdated').length,0);
 assert.equal(r.findings.filter(f=>f.type==='risk').length,0);
 assert.ok(r.findings.some(f=>f.title==='Data do documento: não localizado'));
 const alv=ruleAnalysis('Alvará. Endereço: Rua A. Validade indeterminada.',{code:'ALVARA',label:'Alvará',regulatory_basis:null,renewal_months:12},now);
 assert.match(alv.summary,/não verificável/);
});
test('datas: a mais recente vale, datas futuras são ignoradas',()=>{
 assert.equal(latestDate('Em 01/02/2020 e em 3 de março de 2024; prazo até 01/01/2099.',now).toISOString().slice(0,10),'2024-03-03');
 assert.equal(latestDate('sem datas',now),null);
});
