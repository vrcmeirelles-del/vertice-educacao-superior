import {describe,expect,it} from 'vitest';
import {checkAssessment,checkQuestion,checklistQuestionsFromSnapshot,type ChecklistQuestion} from './item-checklist';

const base:ChecklistQuestion={
 kind:'objetiva',statement:'Considere o caso concreto e assinale a alternativa correta.',
 options:[{id:'A',text:'Responsabilidade objetiva'},{id:'B',text:'Responsabilidade subjetiva'},{id:'C',text:'Culpa exclusiva da vítima'},{id:'D',text:'Caso fortuito externo'}],
 correctOptionId:'A',answerJustification:'Art. 927, parágrafo único, do CC.',rubric:'',expectedAnswer:'',
 points:1,competencyIds:['c1'],topicIds:[],images:[]
};
const codes=(q:ChecklistQuestion)=>checkQuestion(q,0).map(i=>i.code);

describe('checklist técnico do item (regras determinísticas)',()=>{
 it('item bem construído não gera pendência',()=>{expect(codes(base)).toEqual([]);});
 it('bloqueia estrutura incompleta',()=>{
  expect(codes({...base,correctOptionId:''})).toContain('SEM_GABARITO');
  expect(codes({...base,answerJustification:' '})).toContain('SEM_JUSTIFICATIVA');
  expect(codes({...base,options:[...base.options.slice(0,3),{id:'D',text:'responsabilidade  OBJETIVA'}]})).toContain('ALTERNATIVA_DUPLICADA');
  expect(codes({...base,options:[...base.options.slice(0,3),{id:'D',text:''}]})).toContain('ALTERNATIVA_VAZIA');
  expect(codes({...base,kind:'discursiva',options:[],correctOptionId:'',rubric:'',expectedAnswer:''})).toEqual(expect.arrayContaining(['SEM_RUBRICA','SEM_PADRAO_RESPOSTA']));
  expect(codes({...base,images:[{altText:'',rightsStatus:'nao_informado'}]})).toEqual(expect.arrayContaining(['IMAGEM_SEM_DESCRICAO','IMAGEM_SEM_DIREITO']));
 });
 it('alerta "todas/nenhuma das anteriores"',()=>{
  expect(codes({...base,options:[...base.options.slice(0,3),{id:'D',text:'Nenhuma das alternativas anteriores'}]})).toContain('TODAS_NENHUMA');
  expect(codes({...base,options:[...base.options.slice(0,3),{id:'D',text:'Todas as anteriores'}]})).toContain('TODAS_NENHUMA');
  expect(codes({...base,options:[...base.options.slice(0,3),{id:'D',text:'Nenhuma das opções acima'}]})).toContain('TODAS_NENHUMA');
 });
 it('negativa só alerta quando não está destacada',()=>{
  expect(codes({...base,statement:'Assinale a alternativa incorreta sobre o caso.'})).toContain('NEGATIVA_SEM_DESTAQUE');
  expect(codes({...base,statement:'Assinale a alternativa INCORRETA sobre o caso.'})).not.toContain('NEGATIVA_SEM_DESTAQUE');
  expect(codes({...base,statement:'Todas as alternativas estão corretas, EXCETO:'})).not.toContain('NEGATIVA_SEM_DESTAQUE');
 });
 it('alerta correta desproporcionalmente longa',()=>{
  const longa={...base,options:[{id:'A',text:'Responsabilidade objetiva fundada no risco da atividade normalmente desenvolvida pelo autor do dano'},...base.options.slice(1)]};
  expect(codes(longa)).toContain('CORRETA_MAIS_LONGA');
 });
 it('alerta pista absoluta em todas as erradas',()=>{
  const q={...base,options:[base.options[0],{id:'B',text:'Sempre há culpa'},{id:'C',text:'Nunca há dever de indenizar'},{id:'D',text:'Somente o Estado responde'}]};
  expect(codes(q)).toContain('PISTA_ABSOLUTA');
 });
 it('alerta questão sem vínculo curricular',()=>{
  expect(codes({...base,competencyIds:[],topicIds:[]})).toContain('SEM_VINCULO_CURRICULAR');
 });
});

describe('checklist do caderno',()=>{
 const withKey=(k:string)=>({...base,correctOptionId:k});
 it('distribuição do gabarito, concentração e sequência',()=>{
  const r=checkAssessment(['A','A','A','B','A'].map(withKey));
  expect(r.answerKey).toEqual({A:4,B:1});
  expect(r.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['GABARITO_CONCENTRADO','GABARITO_SEQUENCIA']));
  expect(r.canSubmit).toBe(true);
 });
 it('gabarito equilibrado não alerta',()=>{
  const r=checkAssessment(['A','C','B','D','A','C'].map(withKey));
  expect(r.issues.filter(i=>i.code.startsWith('GABARITO'))).toEqual([]);
 });
 it('cobertura da tabela de especificação',()=>{
  const r=checkAssessment([base],{requiredCompetencyIds:['c1','c2'],requiredTopicIds:['t9'],competencyLabels:{c2:'C2 Analisar'}});
  const msgs=r.issues.map(i=>i.message).join(' ');
  expect(msgs).toContain('C2 Analisar');
  expect(r.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['COMPETENCIA_DESCOBERTA','TEMA_DESCOBERTO']));
 });
 it('bloqueio impede o envio e caderno vazio é bloqueado',()=>{
  expect(checkAssessment([{...base,correctOptionId:''}]).canSubmit).toBe(false);
  expect(checkAssessment([]).canSubmit).toBe(false);
 });
 it('resultado é determinístico',()=>{
  const qs=['A','B','A','A','A'].map(withKey);
  expect(checkAssessment(qs)).toEqual(checkAssessment(qs));
 });
 it('converte o snapshot salvo para o revisor com o mesmo resultado',()=>{
  const snap=[{...base,id:'q1',disciplineId:'x',images:[]}] as unknown as Array<Record<string,unknown>>;
  expect(checkAssessment(checklistQuestionsFromSnapshot(snap))).toEqual(checkAssessment([base]));
 });
});

describe('avaliação somativa exige competência',()=>{
 const q={kind:'objetiva' as const,statement:'Considere o caso concreto e assinale.',options:[{id:'A',text:'x'},{id:'B',text:'y'}],
  correctOptionId:'A',answerJustification:'ok',rubric:'',points:1,competencyIds:[] as string[],topicIds:['t1'],images:[]};
 it('somativa sem competência é bloqueio; formativa continua apenas alerta',()=>{
  const s=checkAssessment([q],undefined,{purpose:'somativa'});
  expect(s.canSubmit).toBe(false);
  expect(s.issues.map(i=>i.code)).toContain('SOMATIVA_SEM_COMPETENCIA');
  expect(checkAssessment([q],undefined,{purpose:'formativa'}).canSubmit).toBe(true);
  expect(checkAssessment([{...q,competencyIds:['c1']}],undefined,{purpose:'somativa'}).canSubmit).toBe(true);
 });
});

describe('rubrica estruturada e Bloom no checklist',()=>{
 const d={kind:'discursiva' as const,statement:'Explique o princípio da legalidade tributária.',options:[],correctOptionId:'',rubric:'',
  expectedAnswer:'Padrão esperado.',points:2,competencyIds:['c1'],topicIds:[],images:[]};
 it('soma dos critérios deve bater com a pontuação; critério precisa de descrição e pontos',()=>{
  const codes=(q:typeof d&{rubricCriteria?:Array<{id:string;label:string;points:number}>})=>checkAssessment([q]).issues.map(i=>i.code);
  expect(codes({...d,rubricCriteria:[{id:'1',label:'Conceito',points:1},{id:'2',label:'Exemplo',points:1}]})).not.toContain('RUBRICA_SOMA');
  expect(codes({...d,rubricCriteria:[{id:'1',label:'Conceito',points:1.5}]})).toContain('RUBRICA_SOMA');
  expect(codes({...d,rubricCriteria:[{id:'1',label:'',points:2}]})).toContain('RUBRICA_CRITERIO');
  expect(codes(d)).toContain('SEM_RUBRICA');
 });
 it('somativa: alerta de rubrica sem critérios e de desalinhamento de Bloom',()=>{
  const r=checkAssessment([{...d,rubric:'texto livre'},{...d,rubric:'x',statement:'Defina tributo.'},{...d,rubric:'x',statement:'Cite dois impostos.'}],undefined,{purpose:'somativa',period:7});
  expect(r.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['RUBRICA_SEM_CRITERIOS','BLOOM_BAIXO']));
  expect(r.canSubmit).toBe(true);
 });
});
