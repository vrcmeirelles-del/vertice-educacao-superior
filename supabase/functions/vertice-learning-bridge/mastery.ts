// Domínio por competência (mastery-feed do Fato & Ordem) → indicadores agregados na Vértice.
// Regras determinísticas e versionadas. Nenhum dado individual sai desta função:
// só agregados por curso × disciplina × tema, com supressão de grupos pequenos.

export const MASTERY_RULES={
 version:"1",
 minAttempts:3,        // abaixo disso a competência do aluno é "evidência insuficiente"
 belowThreshold:0.6,   // probabilidade de domínio (BKT) abaixo da qual o aluno conta como "abaixo"
 minGroup:5,           // grupos com menos alunos avaliados são suprimidos (anonimato)
 maxRecords:200000,
 maxGroups:300,
} as const;

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;

export type MasteryRecord={studentToken:string;courseId:string|null;discipline:string;theme:string;pKnow:number;attemptCount:number;correctCount:number};
export type RosterRow={student_token:string;course_id:string;course_name:string};
export type MasteryGroup={courseId:string;courseName:string;discipline:string;theme:string;
 students:number;meanPKnow:number;studentsBelow:number;attempts:number;accuracy:number|null};
export type MasterySnapshot={groups:MasteryGroup[];disciplines:{discipline:string;students:number;meanPKnow:number;studentsBelow:number}[];
 coverage:{records:number;matchedStudents:number;unmatchedStudents:number;insufficientEvidence:number;suppressedGroups:number;truncatedGroups:number}};

class ContractError extends Error{status=502;}
const bad=(what:string)=>new ContractError("Contrato de domínio por competência inválido: "+what+".");

/** Valida o envelope e cada registro. Resposta incompatível falha inteira. */
export function masteryContract(result:unknown,inst:string):MasteryRecord[]{
 if(!result||typeof result!=="object"||Array.isArray(result))throw bad("envelope");
 const r=result as Record<string,unknown>;
 if(r.institutionId!==inst||!Array.isArray(r.records)||r.records.length>MASTERY_RULES.maxRecords||
   (r.total!==undefined&&r.total!==r.records.length))throw bad("envelope");
 const text=(v:unknown,max:number,what:string)=>{if(typeof v!=="string"||!v.trim()||v.length>max)throw bad(what);return v.trim();};
 // Na origem, knowledge_components.theme é NOT NULL DEFAULT '': tema vazio é válido.
 const optionalText=(v:unknown,max:number,what:string)=>{if(typeof v!=="string"||v.length>max)throw bad(what);return v.trim();};
 const count=(v:unknown,what:string)=>{if(!Number.isSafeInteger(v)||Number(v)<0)throw bad(what);return Number(v);};
 return r.records.map((value:unknown)=>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw bad("registro");
  const s=value as Record<string,unknown>;
  const studentToken=String(s.studentToken??"");if(!TOKEN.test(studentToken))throw bad("token");
  let courseId:string|null=null;
  if(s.courseId!==null&&s.courseId!==undefined){courseId=String(s.courseId).toLowerCase();if(!UUID.test(courseId))throw bad("curso");}
  const pKnow=s.pKnow;if(typeof pKnow!=="number"||!Number.isFinite(pKnow)||pKnow<0||pKnow>1)throw bad("probabilidade de domínio");
  const attemptCount=count(s.attemptCount,"tentativas"),correctCount=count(s.correctCount,"acertos");
  if(correctCount>attemptCount)throw bad("acertos acima das tentativas");
  return {studentToken,courseId,discipline:text(s.discipline,160,"disciplina"),theme:optionalText(s.theme,200,"tema"),pKnow,attemptCount,correctCount};
 });
}

/** Agrega por curso × disciplina × tema somente alunos com matrícula ativa na Vértice. */
export function aggregateMastery(records:MasteryRecord[],roster:RosterRow[]):MasterySnapshot{
 const R=MASTERY_RULES;
 const courses=new Map<string,string>();
 for(const row of roster)courses.set(String(row.student_token).trim()+":"+String(row.course_id).toLowerCase(),String(row.course_name));
 const matched=new Set<string>(),unmatched=new Set<string>();
 type Acc={courseId:string;courseName:string;discipline:string;theme:string;pk:number[];below:number;attempts:number;correct:number};
 const groups=new Map<string,Acc>();
 type DAcc={students:Set<string>;sum:number;n:number;below:Set<string>};
 const disciplines=new Map<string,DAcc>();
 let insufficient=0;
 for(const rec of records){
  const key=rec.studentToken+":"+rec.courseId;
  const courseName=rec.courseId?courses.get(key):undefined;
  if(!rec.courseId||courseName===undefined){unmatched.add(key);continue;}
  matched.add(key);
  if(rec.attemptCount<R.minAttempts){insufficient++;continue;}
  const gk=rec.courseId+"|"+rec.discipline+"|"+rec.theme;
  const g=groups.get(gk)||{courseId:rec.courseId,courseName,discipline:rec.discipline,theme:rec.theme,pk:[],below:0,attempts:0,correct:0};
  g.pk.push(rec.pKnow);if(rec.pKnow<R.belowThreshold)g.below++;g.attempts+=rec.attemptCount;g.correct+=rec.correctCount;groups.set(gk,g);
  const d=disciplines.get(rec.discipline)||{students:new Set<string>(),sum:0,n:0,below:new Set<string>()};
  d.students.add(key);d.sum+=rec.pKnow;d.n++;if(rec.pKnow<R.belowThreshold)d.below.add(key);disciplines.set(rec.discipline,d);
 }
 const round=(n:number)=>Math.round(n*1000)/1000;
 let suppressed=0;
 const visible:MasteryGroup[]=[];
 for(const g of groups.values()){
  // Um aluno tem no máximo um registro por competência; ainda assim conta por registro avaliado.
  if(g.pk.length<R.minGroup){suppressed++;continue;}
  visible.push({courseId:g.courseId,courseName:g.courseName,discipline:g.discipline,theme:g.theme,students:g.pk.length,
   meanPKnow:round(g.pk.reduce((a,b)=>a+b,0)/g.pk.length),studentsBelow:g.below,attempts:g.attempts,
   accuracy:g.attempts?round(g.correct/g.attempts):null});
 }
 visible.sort((a,b)=>a.meanPKnow-b.meanPKnow||b.students-a.students||a.courseName.localeCompare(b.courseName)||
  a.discipline.localeCompare(b.discipline)||a.theme.localeCompare(b.theme));
 const truncated=Math.max(0,visible.length-R.maxGroups);
 const disc=[...disciplines.entries()].filter(([,d])=>d.students.size>=R.minGroup)
  .map(([discipline,d])=>({discipline,students:d.students.size,meanPKnow:round(d.sum/d.n),studentsBelow:d.below.size}))
  .sort((a,b)=>a.meanPKnow-b.meanPKnow||a.discipline.localeCompare(b.discipline));
 return {groups:visible.slice(0,R.maxGroups),disciplines:disc,
  coverage:{records:records.length,matchedStudents:matched.size,unmatchedStudents:unmatched.size,insufficientEvidence:insufficient,suppressedGroups:suppressed,truncatedGroups:truncated}};
}
