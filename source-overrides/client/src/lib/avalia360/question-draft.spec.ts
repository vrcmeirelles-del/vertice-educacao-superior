import {describe,expect,it} from 'vitest';
import {validateQuestionDraft,type QuestionDraft} from './question-draft';
const base:QuestionDraft={
 id:'q1',disciplineId:'civil',kind:'objetiva',
 statement:'Considere a situação descrita e indique a resposta correta.',
 options:[{id:'A',text:'Alternativa 1'},{id:'B',text:'Alternativa 2'}],
 correctOptionId:'A',rubric:'',topicIds:['responsabilidade'],
 competencyIds:['c1'],purpose:['formativa'],estimatedDifficulty:3,points:2,
 examTags:['oab'],images:[]
};
const validate=(q:QuestionDraft)=>validateQuestionDraft(q,['responsabilidade'],['c1']);
describe('formulário docente Avalia 360°',()=>{
 it('aceita questão objetiva sem imagem quando íntegra',()=>expect(validate(base)).toEqual([]));
 it('recusa questões sem tema curricular autorizado',()=>{
   expect(validate({...base,topicIds:['inexistente']}).map(e=>e.code)).toContain('INVALID_TOPICS');
 });
 it('recusa gabarito não relacionado às alternativas',()=>{
   expect(validate({...base,correctOptionId:'C'}).map(e=>e.code)).toContain('INVALID_KEY');
 });
 it('exige padrão de resposta esperado separadamente da rubrica',()=>{
   expect(validate({...base,kind:'discursiva',rubric:'Critérios e pontuação',expectedAnswer:''}).map(e=>e.code)).toContain('MISSING_EXPECTED_ANSWER');
 });
 it('exige rubrica para questão discursiva',()=>{
   expect(validate({...base,kind:'discursiva',rubric:''}).map(e=>e.code)).toContain('MISSING_RUBRIC');
 });
 it('não exige gabarito objetivo para discursivas com rubrica',()=>{
   expect(validate({...base,kind:'discursiva',correctOptionId:'',rubric:'Critério 1 — 2 pontos',expectedAnswer:'Resposta fundamentada pelo aluno contendo pressupostos da responsabilidade civil.'})).toEqual([]);
 });
 it('exige descrição da imagem e declaração de direitos',()=>{
   const image={localId:'tmp',file:{size:1024,type:'image/png'} as File,altText:'',caption:'',
     placement:'enunciado' as const,rightsStatus:'nao_informado' as const};
   const codes=validate({...base,images:[image]}).map(e=>e.code);
   expect(codes).toEqual(expect.arrayContaining(['MISSING_ALT_TEXT','MISSING_RIGHTS']));
 });
 it('impede referência à alternativa inexistente',()=>{
   const image={localId:'tmp',file:{size:1024,type:'image/png'} as File,altText:'Mapa conceitual',caption:'',
     placement:'alternativa' as const,alternativeId:'E',rightsStatus:'autoral' as const};
   expect(validate({...base,images:[image]}).map(e=>e.code)).toContain('INVALID_ALTERNATIVE_REFERENCE');
 });
 it('impede dificuldade inválida e pontuação não positiva',()=>{
   expect(validate({...base,estimatedDifficulty:6 as 3,points:0}).map(e=>e.code))
     .toEqual(expect.arrayContaining(['INVALID_DIFFICULTY','INVALID_POINTS']));
 });
});
