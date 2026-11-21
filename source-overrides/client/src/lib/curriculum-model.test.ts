import {describe,expect,it} from 'vitest';
import {buildCurriculumModel} from './curriculum-model';

const base={course:'Direito',graduate_profile:'Egresso apto a interpretar e aplicar o Direito com ética, autonomia e responsabilidade social.',
 dcn_reference:'Resolução CNE/CES nº 5/2018',dcn_document_url:'https://example.org/dcn.pdf',competencies:[
 {code:'C1',title:'Interpretar normas',origin_period:1,period_status:'validated' as const,disciplines:[{discipline_name:'Introdução ao Direito',category:'profissional' as const},{discipline_name:'Metodologia',category:'instrumental' as const}]},
 {code:'C2',title:'Argumentar',origin_period:2,period_status:'validated' as const,disciplines:[{discipline_name:'Teoria da Argumentação',category:'profissional' as const},{discipline_name:'metodologia',category:'instrumental' as const},{discipline_name:'Filosofia',category:'basica' as const}]},
]};
describe('modelo replicável da Construção Curricular por regras',()=>{
 it('matriz completa atende toda a lista e conta disciplinas integradoras',()=>{
  const m=buildCurriculumModel(base);
  expect(m.checks.every(c=>c.ok)).toBe(true);
  expect(m.text).toContain('2 competência(s); 5 vínculo(s) disciplina–competência; 4 disciplina(s) distinta(s).');
  expect(m.text).toContain('Disciplinas integradoras (em mais de uma competência): Metodologia (2).');
  expect(m.text).toContain('profissional 2 (40%), instrumental 2 (40%), básica 1 (20%)');
 });
 it('aponta lacunas: período vazio, homologação, competência sem profissional, link sem https, código repetido',()=>{
  const m=buildCurriculumModel({...base,dcn_document_url:'http://x',competencies:[
   {...base.competencies[0],origin_period:1},{...base.competencies[1],code:'c1',origin_period:3,period_status:'proposed',disciplines:[{discipline_name:'Filosofia',category:'basica'}]}]});
  const fail=m.checks.filter(c=>!c.ok).map(c=>c.text);
  expect(fail).toEqual(expect.arrayContaining(['Link oficial da DCN informado (https).','Códigos de competência únicos.',
   'Toda competência tem ao menos uma disciplina profissional.','Períodos homologados no PPC.','Sem períodos vazios entre o 1º e o 3º.']));
  expect(m.text).toContain('Períodos sem competência de origem: 2º.');
 });
 it('mesma disciplina em duas categorias na mesma competência é sinalizada',()=>{
  const m=buildCurriculumModel({...base,competencies:[{...base.competencies[0],disciplines:[{discipline_name:'Lógica',category:'profissional'},{discipline_name:'lógica',category:'basica'}]}]});
  expect(m.checks.find(c=>c.text.startsWith('Nenhuma disciplina classificada'))?.ok).toBe(false);
 });
 it('é determinístico',()=>{expect(buildCurriculumModel(base).text).toBe(buildCurriculumModel(structuredClone(base)).text);});
});
