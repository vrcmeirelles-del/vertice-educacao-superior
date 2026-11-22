/**
 * Avalia 360° — lançamento de respostas (funções puras, sem IA).
 * O mapa de versões reproduz exatamente o motor determinístico usado na
 * impressão (exam-variants). A correção é feita no servidor.
 */
import {createExamVariants,type ShuffleMode} from './exam-variants';
import type {QuestionDraft} from './question-draft';

export interface SnapshotQuestion {id:string;kind:'objetiva'|'discursiva';points:number;options:Array<{id:string;text:string}>;correctOptionId:string;statement:string}
export type VariantMap = Record<string, Array<{q:string;o:string[]}>>;

export function snapshotQuestions(raw:Array<Record<string,unknown>>):SnapshotQuestion[]{
 const str=(v:unknown)=>typeof v==='string'?v:'';
 return raw.map(q=>({id:str(q.id),kind:q.kind==='discursiva'?'discursiva':'objetiva',
  points:typeof q.points==='number'?q.points:0,statement:str(q.statement),correctOptionId:str(q.correctOptionId),
  options:Array.isArray(q.options)?(q.options as Array<Record<string,unknown>>).map(o=>({id:str(o.id),text:str(o.text)})):[]}));
}
/** Mesmos parâmetros da impressão => mesmo mapa (o motor é determinístico). */
export function buildVariantMap(questions:SnapshotQuestion[],count:number,mode:ShuffleMode):VariantMap{
 const drafts=questions.map(q=>({...q,disciplineId:'',rubric:'',topicIds:[],competencyIds:[],purpose:[],
  estimatedDifficulty:3,examTags:[],images:[]})) as unknown as QuestionDraft[];
 const variants=createExamVariants(drafts,count,mode);
 return Object.fromEntries(variants.map(v=>[v.code,v.items.map(i=>({q:i.sourceId,o:i.options.map(o=>o.sourceOptionId)}))]));
}
/** Gabarito por versão, para o professor conferir com a folha impressa. */
export function answerKeyByVariant(map:VariantMap,questions:SnapshotQuestion[]):Record<string,string>{
 const byId=new Map(questions.map(q=>[q.id,q]));
 return Object.fromEntries(Object.entries(map).map(([code,items])=>[code,items
  .filter(it=>byId.get(it.q)?.kind==='objetiva')
  .map(it=>String.fromCharCode(65+it.o.indexOf(byId.get(it.q)!.correctOptionId))).join('')]));
}
/** Números impressos das objetivas de uma versão, na ordem do cartão. */
/**
 * Questões para quem só lê cartões: vêm do detalhe da aplicação, sem alternativas nem gabarito
 * (a correção é feita no servidor). Bastam id, tipo e pontuação para posicionar as respostas.
 */
export function readerQuestions(d:{questions:Array<{id:string;kind:'objetiva'|'discursiva';points:number;statement:string}>}):SnapshotQuestion[]{
 return (d.questions||[]).map(q=>({id:q.id,kind:q.kind,points:Number(q.points)||0,statement:q.statement||'',options:[],correctOptionId:''}));
}
export function objectivePositions(map:VariantMap,questions:SnapshotQuestion[],variant:string):number[]{
 const kind=new Map(questions.map(q=>[q.id,q.kind]));
 return (map[variant]||[]).flatMap((it,i)=>kind.get(it.q)==='objetiva'?[i+1]:[]);
}
export function discursivePositions(map:VariantMap,questions:SnapshotQuestion[],variant:string):Array<{n:number;questionId:string}>{
 const kind=new Map(questions.map(q=>[q.id,q.kind]));
 return (map[variant]||[]).flatMap((it,i)=>kind.get(it.q)==='discursiva'?[{n:i+1,questionId:it.q}]:[]);
}
/**
 * Converte a sequência digitada (na ordem do cartão) em {número impresso: letra}.
 * Aceita "ABCDA", "A B C", "A,B,-". "-" ou "." = em branco; "*" = mais de uma marcação.
 */
export function parseAnswerString(value:string,positions:number[]):{answers:Record<string,string>;error?:string}{
 const compact=value.toUpperCase().replace(/[\s,;|]+/g,'');
 if(compact.length>positions.length)
  return {answers:{},error:'Foram digitadas '+compact.length+' respostas para '+positions.length+' objetiva(s).'};
 const invalid=[...compact].find(c=>!/[A-Z\-.*]/.test(c));
 if(invalid)return {answers:{},error:'Caractere inválido: "'+invalid+'". Use letras, "-" (branco) ou "*" (dupla marcação).'};
 const answers:Record<string,string>={};
 positions.forEach((n,i)=>{answers[String(n)]=compact[i]??'-';});
 return {answers};
}

const norm=(v:unknown)=>String(v??'').trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export interface ImportedSheet {label:string;studentId?:string;variant:string;objective:Record<string,string>;discursive:Record<string,number>}
/**
 * Lê a planilha de respostas. Colunas: "Aluno" (ou "Código"), "Versão" (opcional, A),
 * e "Respostas" (sequência) OU "Q1", "Q2"… pelo número impresso; discursivas em "D2", "D5"…
 * (número impresso) com a nota. Aluno com nome idêntico ao da lista da turma é vinculado.
 */
export function parseResponseRows(rows:unknown[][],map:VariantMap,questions:SnapshotQuestion[],
 roster:Array<{id:string;name:string}>=[]):{sheets:ImportedSheet[];errors:string[]}{
 const [header,...data]=rows;
 const errors:string[]=[];
 if(!header)return {sheets:[],errors:['Planilha vazia.']};
 const cols=header.map(norm);
 const col=(...names:string[])=>cols.findIndex(c=>names.includes(c));
 const iName=col('aluno','nome','codigo','código','estudante'),iVar=col('versao','versão'),iSeq=col('respostas','gabarito do aluno');
 if(iName<0)return {sheets:[],errors:['Inclua a coluna "Aluno" (nome ou código).']};
 const qCols=cols.flatMap((c,i)=>/^q\d+$/.test(c)?[{i,n:Number(c.slice(1))}]:[]);
 const dCols=cols.flatMap((c,i)=>/^d\d+$/.test(c)?[{i,n:Number(c.slice(1))}]:[]);
 if(iSeq<0&&!qCols.length&&!dCols.length)return {sheets:[],errors:['Inclua a coluna "Respostas" ou colunas Q1, Q2… / D1, D2….']};
 const byName=new Map(roster.map(s=>[norm(s.name),s.id]));
 const sheets:ImportedSheet[]=[];
 data.forEach((cells,k)=>{
  if(cells.every(c=>c==null||String(c).trim()===''))return;
  const line=k+2;
  const label=String(cells[iName]??'').trim();
  if(!label){errors.push('Linha '+line+': aluno não identificado.');return;}
  const variant=(iVar>=0?String(cells[iVar]??'').trim().toUpperCase():'')||'A';
  if(!map[variant]){errors.push('Linha '+line+': versão "'+variant+'" não existe nesta aplicação.');return;}
  const positions=objectivePositions(map,questions,variant);
  let objective:Record<string,string>={};
  if(iSeq>=0&&String(cells[iSeq]??'').trim()){
   const parsed=parseAnswerString(String(cells[iSeq]),positions);
   if(parsed.error){errors.push('Linha '+line+': '+parsed.error);return;}
   objective=parsed.answers;
  }
  for(const {i,n} of qCols){
   if(!positions.includes(n)){if(String(cells[i]??'').trim())errors.push('Linha '+line+': Q'+n+' não é objetiva na versão '+variant+'.');continue;}
   const v=String(cells[i]??'').trim().toUpperCase();
   objective[String(n)]=v||'-';
  }
  const discursive:Record<string,number>={};
  const dPos=discursivePositions(map,questions,variant);
  for(const {i,n} of dCols){
   const raw=String(cells[i]??'').trim().replace(',','.');
   if(!raw)continue;
   const target=dPos.find(p=>p.n===n);
   if(!target){errors.push('Linha '+line+': D'+n+' não é discursiva na versão '+variant+'.');continue;}
   const value=Number(raw),max=questions.find(q=>q.id===target.questionId)?.points??0;
   if(!Number.isFinite(value)||value<0||value>max){errors.push('Linha '+line+': nota de D'+n+' deve ficar entre 0 e '+max+'.');continue;}
   discursive[target.questionId]=value;
  }
  const studentId=byName.get(norm(label));
  sheets.push({label,...(studentId?{studentId}:{}),variant,objective,discursive});
 });
 const seen=new Set<string>();
 for(const s of sheets){const key=s.studentId||norm(s.label);if(seen.has(key))errors.push('Aluno repetido na planilha: '+s.label+'.');seen.add(key);}
 return {sheets,errors};
}
/** CSV simples (separador ; ou ,), com aspas. */
export function parseCsv(text:string):string[][]{
 const firstLine=text.split(/\r?\n/,1)[0]||'';
 const sep=(firstLine.match(/;/g)||[]).length>=(firstLine.match(/,/g)||[]).length?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;continue;}
  if(c==='"')quoted=true;
  else if(c===sep){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows;
}
