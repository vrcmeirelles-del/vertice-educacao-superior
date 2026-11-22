import type {DeclaredTopic} from './declared-analysis';
import type {QuestionDraft} from './question-draft';

type Catalog = {
 topics: {id:string;title:string}[];
 competencies: {id:string;code:string;title:string}[];
};
const letters=['A','B','C','D','E'];
const normalize=(value:string)=>value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const list=(value:string)=>[...new Set(value.split(',').map(term=>term.trim()).filter(Boolean))];

export function parseQuestionRows(rows:unknown[][],disciplineId:string,catalog:Catalog,options:{newTopicPeriod?:number}={}){
 const [header,...data]=rows;
 if(!header)throw Error('A aba Questões está vazia.');
 const positions=new Map(header.map((cell,index)=>[normalize(String(cell??'')),index]));
 if(!['Tipo','Enunciado','Pontuação','Dificuldade','Finalidade'].every(key=>positions.has(normalize(key))))
  throw Error('Confira os cabeçalhos da aba Questões no modelo do Avalia 360°.');
 const questions:QuestionDraft[]=[];
 const newTopics:DeclaredTopic[]=[];
 const knownTopics=catalog.topics.map(t=>({id:t.id,labels:[t.title,t.id]}));
 const knownCompetencies=catalog.competencies.map(c=>({
  id:c.id,labels:[c.code,c.title,c.id,c.code+' — '+c.title],
 }));
 const topicPeriod=options.newTopicPeriod;
 const canDeclareTopic=typeof topicPeriod==='number'&&Number.isInteger(topicPeriod)&&topicPeriod>=1&&topicPeriod<=12;
 const errors:string[]=[], warnings:string[]=[];
 data.forEach((cells,index)=>{
  if(cells.every(cell=>cell==null||String(cell).trim()===''))return;
  const row=index+2;
  const value=(key:string)=>String(cells[positions.get(normalize(key))??-1]??'').trim();
  const error=(key:string,message:string)=>errors.push(`Linha ${row} · ${key}: ${message}`);
  const warning=(key:string,message:string)=>warnings.push(`Linha ${row} · ${key}: ${message}`);
  const kind=normalize(value('Tipo'));
  const purpose=normalize(value('Finalidade'));
  const statement=value('Enunciado');
  const points=Number(value('Pontuação').replace(',','.'));
  const difficulty=Number(value('Dificuldade'));
  const invalidBefore=errors.length;
  if(kind!=='objetiva'&&kind!=='discursiva')error('Tipo','use Objetiva ou Discursiva.');
  if(purpose!=='diagnostica'&&purpose!=='formativa'&&purpose!=='somativa')error('Finalidade','use Diagnóstica, Formativa ou Somativa.');
  if(statement.length<10)error('Enunciado','informe pelo menos 10 caracteres.');
  if(!Number.isFinite(points)||points<=0)error('Pontuação','informe um número positivo.');
  if(![1,2,3,4,5].includes(difficulty))error('Dificuldade','informe um inteiro de 1 a 5.');
  const options=kind==='objetiva'?letters.map(id=>({id,text:value('Alternativa '+id)})).filter(option=>option.text):[];
  const correctOptionId=kind==='objetiva'?value('Gabarito').toUpperCase():'';
  const answerJustification=kind==='objetiva'?value('Justificativa do gabarito'):'';
  const expectedAnswer=kind==='discursiva'?value('Resposta esperada'):'';
  const rubric=kind==='discursiva'?value('Rubrica de correção'):'';
  const answerLines=Number(value('Linhas de resposta')||8);
  if(kind==='objetiva'){
   if(options.length<2)error('Alternativas','preencha pelo menos duas opções.');
   if(new Set(options.map(option=>normalize(option.text))).size!==options.length)error('Alternativas','remova opções duplicadas.');
   if(!options.some(option=>option.id===correctOptionId))error('Gabarito','escolha uma alternativa preenchida.');
   if(!answerJustification)error('Justificativa do gabarito','preencha a justificativa.');
  }
  if(kind==='discursiva'){
   if(!expectedAnswer)error('Resposta esperada','preencha o padrão de resposta.');
   if(!rubric)error('Rubrica de correção','preencha os critérios.');
   if(!Number.isInteger(answerLines)||answerLines<3||answerLines>60)error('Linhas de resposta','informe um inteiro de 3 a 60.');
  }
  if(errors.length!==invalidBefore)return;
  const topic=value('Tema'), subtopic=value('Subtema');
  const competencyTerms=list(value('Competências'));
  const resolve=(terms:string[],items:{id:string;labels:string[]}[],field:string,declareTopic=false)=>{
   const ids=terms.flatMap(term=>{
    const matches=items.filter(item=>item.labels.some(label=>normalize(label)===normalize(term)));
    if(!matches.length&&declareTopic&&canDeclareTopic){
     const id=crypto.randomUUID();
     newTopics.push({id,title:term,period:topicPeriod});
     items.push({id,labels:[term,id]});
     return [id];
    }
    if(matches.length!==1)warning(field,`revise o vínculo de “${term}” no catálogo.`);
    return matches.length===1?[matches[0].id]:[];
   });
   return [...new Set(ids)];
  };
  const topicIds=resolve([topic,subtopic].filter(Boolean),knownTopics,'Tema / Subtema',true);
  const competencyIds=resolve(competencyTerms,knownCompetencies,'Competências');
  const fileName=value('Arquivo de imagem');
  if(fileName)warning('Arquivo de imagem',`anexe “${fileName}” na revisão da questão.`);
  questions.push({
   id:crypto.randomUUID(),disciplineId,kind:kind as QuestionDraft['kind'],statement,points,
   estimatedDifficulty:difficulty as QuestionDraft['estimatedDifficulty'],purpose:[purpose as QuestionDraft['purpose'][number]],
   options:kind==='discursiva'?letters.map(id=>({id,text:''})):options,correctOptionId,answerJustification,expectedAnswer,rubric,answerLines:kind==='discursiva'?answerLines:8,
   topicIds,competencyIds,examTags:list(value('Exames')).map(normalize),images:[],
   spreadsheetMetadata:{topic,subtopic,keywords:value('Palavras-chave'),competencies:value('Competências'),
    fileName,imagePosition:value('Posição da imagem'),caption:value('Legenda'),altText:value('Descrição acessível')}
  });
 });
 if(!questions.length&&!errors.length)errors.push('Preencha ao menos uma questão na aba Questões.');
 return {questions,errors,warnings,newTopics};
}
