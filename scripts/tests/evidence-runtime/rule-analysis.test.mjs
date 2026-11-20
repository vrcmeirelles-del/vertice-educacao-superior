import {test} from 'node:test';import assert from 'node:assert/strict';
import {analyzeByRules,rankIndicators,detectNature,detectPeriod,detectCourse} from '../../../supabase/functions/vertice-doc-prevalidate/rule-analysis.mjs';
import {groundedLinks} from '../../../supabase/functions/vertice-doc-prevalidate/document-text.mjs';
const catalogs=[{id:'c1',instrument_code:'reconhecimento_curso',instrument_version:'2017'}];
const objects=[['2.1','Núcleo Docente Estruturante – NDE'],['2.5','Corpo docente: titulação'],['2.12','Atuação do colegiado de curso ou equivalente'],['1.12','Apoio ao discente'],['3.4','Salas de aula'],['3.15','Núcleo de práticas jurídicas: atividades básicas e arbitragem, negociação, conciliação, mediação e atividades jurídicas reais']].map(([object_code,object_label])=>({catalog_id:'c1',object_code,object_label,description:'NSA para cursos que não contemplam o item.'}));
const ata='ATA DA REUNIÃO ORDINÁRIA DO NÚCLEO DOCENTE ESTRUTURANTE DO CURSO DE DIREITO. Aos quinze dias de maio de 2024, reuniram-se os membros do Núcleo Docente Estruturante – NDE para deliberar sobre a atualização do PPC e o acompanhamento do corpo docente. Ficou registrada a revisão das ementas do 1º semestre de 2024.';
const pages=[{page:1,section:null,text:ata}];
test('ata do NDE: natureza, período, vínculo ancorado no trecho literal e nada inventado',()=>{
 const r=analyzeByRules({extraction:{text:'PÁGINA 1\n'+ata,pages,partial:false},fileName:'Ata NDE 15mai 2024-1.docx',category:'instrumento',objects,catalogs,institution:{name:'Centro Universitário Exemplo',acronym:'CUE'},courses:[{name:'Direito'}]});
 assert.equal(r.nature,'Ata de reunião');assert.equal(r.period_detected,'2024/1');assert.equal(r.course_detected,'Direito');assert.equal(r.institution_detected,undefined);
 assert.equal(r.indicator_links[0].object_code,'2.1');assert.equal(r.indicator_links[0].compatibility,'alta');assert.equal(r.indicator_links[0].is_primary,true);
 assert.ok(!r.indicator_links.some(l=>l.object_code==='2.5'),'"corpo docente" sozinho não comprova titulação');
 assert.equal(groundedLinks(r.indicator_links,{pages}).length,r.indicator_links.length);
 assert.match(r.indicator_links[0].limitations,/confirmar/);
});
test('termos genéricos não geram vínculo; documento sem relação fica sem sugestão',()=>{
 assert.deepEqual(rankIndicators([{page:1,text:'Lista de presença do evento realizado na sala 3, com assinatura dos participantes e horário de entrada e saída de cada um.'}],objects),[]);
});
test('regulamento do NPJ aponta o indicador 3.15',()=>{
 const t='Regulamento do Núcleo de Prática Jurídica. O NPJ realiza atendimento à comunidade, com atividades de conciliação, mediação, negociação e arbitragem, e atividades jurídicas reais supervisionadas.';
 assert.equal(rankIndicators([{page:null,text:t}],objects)[0].object.object_code,'3.15');
});
test('natureza, período e curso por regras',()=>{
 assert.equal(detectNature('P09 Direito Econômico 2026-2.docx','EMENTA DE COMPONENTE CURRICULAR Curso Direito – PPC 2026'),'Ementa de componente curricular');
 assert.equal(detectNature('P04 Formas Consensuais de Resolução de Conflitos.docx','texto'),'Documento');
 assert.equal(detectPeriod('Plano 2021-2025 do PDI'),'2021–2025');
 assert.equal(detectPeriod('qualquer','Relatorio 2026-2.pdf'),'2026/2');
 assert.equal(detectCourse('Curso de Direito do Centro Universitário Exemplo',[]),'Direito');
});
