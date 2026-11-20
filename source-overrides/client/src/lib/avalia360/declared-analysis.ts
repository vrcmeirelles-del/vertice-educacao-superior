/** Dados declarados pelo professor na demonstração. Não são PPC validado. */
import {analyzeAssessment,type Assessment,type Catalog,type Difficulty,type Purpose,type Relation} from './longitudinal-engine';
import type {QuestionDraft} from './question-draft';
export interface DeclaredCompetency {id:string;code:string;title:string;period:number}
export interface DeclaredTopic {id:string;title:string;period:number}
export interface PedagogicalDraft {
 currentPeriod:number;targetDifficulty:Difficulty;purpose:Purpose;
 examFocus:string;requiredCompetencyIds:string[];requiredTopicIds:string[];
 competencies:DeclaredCompetency[];topics:DeclaredTopic[];
 relations:{sourceCompetencyId:string;targetCompetencyId:string;kind:Relation}[];
}
export function analyzeDeclaredDraft(args:{
 institutionId:string;courseId:string;disciplineId:string;questions:QuestionDraft[];
 config:PedagogicalDraft;
}){
 const {config:c}=args;
 const catalog:Catalog={
  competencies:c.competencies.map(x=>({
   id:x.id,code:x.code,period:x.period,relations:c.relations
    .filter(r=>r.sourceCompetencyId===x.id).map(r=>({to:r.targetCompetencyId,kind:r.kind}))
  })),
  topics:c.topics.map(t=>({id:t.id,period:t.period,disciplineId:args.disciplineId}))
 };
 const assessment:Assessment={
  id:'preanalise-declarada',institutionId:args.institutionId,
  courseId:args.courseId,disciplineId:args.disciplineId,
  period:c.currentPeriod,purpose:[c.purpose],targetDifficulty:c.targetDifficulty,
  requiredCompetencyIds:c.requiredCompetencyIds,requiredTopicIds:c.requiredTopicIds,
  ...(c.examFocus?{examFocus:c.examFocus}:{}),
  items:args.questions.map(q=>({id:q.id,disciplineId:q.disciplineId,
   topicIds:q.topicIds,competencyIds:q.competencyIds,points:q.points,
   purpose:q.purpose,estimatedDifficulty:q.estimatedDifficulty,
   examTags:q.examTags,evidence:'declarada' as const}))
 };
 const analysis=analyzeAssessment({assessment,catalog});
 return {analysis,verified:false as const,
  notice:'Análise preliminar de metadados declarados: não comprova aderência ao PPC, não valida conteúdo jurídico e não atribui nota.'};
}
