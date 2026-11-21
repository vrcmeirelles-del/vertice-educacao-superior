/**
 * Avalia 360° — Bloco 3: mapa de erros conceituais (algoritmo, sem IA).
 * O professor descreve o equívoco que cada alternativa errada revela; o sistema soma
 * as escolhas pela descrição normalizada (sem acentos, minúsculas, espaços colapsados,
 * sem pontuação final). Erro "recorrente na turma": atinge ao menos 30% dos alunos
 * avaliados (com pelo menos 5 alunos).
 */
export const ERROR_RULES = {version:'2026.11-1',classShare:0.3,minStudents:5} as const;

export interface ErrorRow {studentId:string|null;label:string;applicationId:string;questionId:string;statement:string;optionId:string|null;note:string|null;competencies:string[]}
export interface ErrorEvidence {
 scope:'application'|'discipline';
 applications:Array<{id:string;appliedOn:string;classLabel:string;discipline:string;title:string;status:string}>;
 students:Array<{studentId:string|null;label:string;applications:number}>;
 objectiveAnswers:Array<{questionId:string;applicationId:string;n:number}>;
 errors:ErrorRow[];
 answeredBank:Array<{studentId:string|null;label:string;bankIds:string[]}>;
}
export const noteKey=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim().replace(/[.;:!?,]+$/,'');
const studentKey=(r:{studentId:string|null;label:string})=>r.studentId??'label:'+r.label.trim().toLowerCase();

export interface Misconception {key:string;note:string;students:number;occurrences:number;questions:number;competencies:string[];share:number;recurrent:boolean}
export interface ErrorMap {totalStudents:number;misconceptions:Misconception[];unmapped:Array<{applicationId:string;questionId:string;statement:string;wrong:number}>}

export function classErrorMap(e:ErrorEvidence):ErrorMap{
 const totalStudents=new Set(e.students.map(studentKey)).size;
 const groups=new Map<string,{spellings:Map<string,number>;students:Set<string>;occ:number;questions:Set<string>;comps:Set<string>}>();
 const unmapped=new Map<string,{applicationId:string;questionId:string;statement:string;wrong:number}>();
 for(const r of e.errors){
  if(!r.note){
   const k=r.applicationId+'\u0000'+r.questionId;
   const u=unmapped.get(k)||{applicationId:r.applicationId,questionId:r.questionId,statement:r.statement,wrong:0};u.wrong++;unmapped.set(k,u);
   continue;
  }
  const key=noteKey(r.note);if(!key)continue;
  const g=groups.get(key)||{spellings:new Map(),students:new Set(),occ:0,questions:new Set(),comps:new Set()};
  g.spellings.set(r.note.trim(),(g.spellings.get(r.note.trim())||0)+1);
  g.students.add(studentKey(r));g.occ++;g.questions.add(r.applicationId+'\u0000'+r.questionId);r.competencies.forEach(c=>g.comps.add(c));
  groups.set(key,g);
 }
 const misconceptions=[...groups.entries()].map(([key,g])=>{
  const note=[...g.spellings.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
  const share=totalStudents?g.students.size/totalStudents:0;
  return {key,note,students:g.students.size,occurrences:g.occ,questions:g.questions.size,competencies:[...g.comps].sort(),share,
   recurrent:totalStudents>=ERROR_RULES.minStudents&&share>=ERROR_RULES.classShare};
 }).sort((a,b)=>b.students-a.students||b.occurrences-a.occurrences||a.key.localeCompare(b.key));
 return {totalStudents,misconceptions,unmapped:[...unmapped.values()].sort((a,b)=>b.wrong-a.wrong||a.questionId.localeCompare(b.questionId))};
}

/** Erros conceituais de um aluno, do mais frequente para o menos frequente. */
export function studentMisconceptions(e:ErrorEvidence,who:{studentId:string|null;label:string}):Array<{note:string;count:number}>{
 const k=studentKey(who);const m=new Map<string,{note:string;count:number}>();
 for(const r of e.errors)if(r.note&&studentKey(r)===k){const key=noteKey(r.note);const cur=m.get(key)||{note:r.note.trim(),count:0};cur.count++;m.set(key,cur);}
 return [...m.values()].sort((a,b)=>b.count-a.count||a.note.localeCompare(b.note));
}
