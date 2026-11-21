/**
 * Curadoria determinística e auditável da questão — NÃO é análise jurídica semântica.
 * Sem IA externa, sem acesso a dados e sem reescrever teses jurídicas.
 * A sugestão automática só modifica espaçamento/terminação gráfica;
 * demais problemas exigem decisão e texto do professor.
 */
import type {QuestionDraft} from './question-draft';
import type {PedagogicalDraft} from './declared-analysis';

export type CurationLevel='blocked'|'attention'|'info';
export interface CurationFinding {
 code:string;level:CurationLevel;field:string;message:string;
 recommendation:string;automatable:boolean;
}
export interface CurationResult {
 version:'rules-curation-1.0';
 questionId:string;
 findings:CurationFinding[];
 suggestedStatement:string|null;
 needsTeacherReview:true;
 substantiveReview:'not-performed';
}
const clean=(s:string)=>s.trim().replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/[ \t]+\n/g,'\n');
const comparable=(s:string)=>clean(s).normalize('NFKC').toLocaleLowerCase('pt-BR');
export function curateQuestion(q:QuestionDraft,p:PedagogicalDraft):CurationResult{
 const findings:CurationFinding[]=[];
 const add=(code:string,level:CurationLevel,field:string,message:string,recommendation:string,automatable=false)=>
  findings.push({code,level,field,message,recommendation,automatable});
 const original=q.statement;
 const cleaned=clean(original);
 let suggestion=cleaned;
 if(!cleaned) add('EMPTY_STATEMENT','blocked','statement','Enunciado não preenchido.','Redija o problema ou comando que o estudante deverá responder.');
 else{
  if(cleaned.length<30)add('SHORT_STATEMENT','attention','statement','Enunciado muito curto para uma avaliação contextualizada.','Verifique se o contexto, a pergunta e o objeto de avaliação estão suficientemente delimitados.');
  if(cleaned!==original)add('WHITESPACE','info','statement','Há espaços redundantes no enunciado.','Normalizar somente a formatação, sem modificar o conteúdo jurídico.',true);
  if(!/[.!?;:]$/.test(cleaned)){
   suggestion=cleaned+'.';
   add('END_PUNCTUATION','info','statement','O enunciado não termina com pontuação.','Acrescentar ponto final, conferindo se o comando pede pergunta ou afirmação.',true);
  }
 }
 if(q.kind==='objetiva'){
  if(!q.answerJustification?.trim())add('MISSING_KEY_JUSTIFICATION','blocked','answerJustification','A justificativa do gabarito não foi informada.','Registre os fundamentos que sustentam a alternativa correta, com revisão docente.');
  if(q.options.length<2||q.options.length>8)add('OPTIONS_COUNT','blocked','options','Quantidade de alternativas fora do intervalo de 2 a 8.','Complete o conjunto de alternativas antes da aplicação.');
  const texts=q.options.map(o=>comparable(o.text));
  const duplicates=texts.filter((v,i)=>v!==''&&texts.indexOf(v)<i);
  if(duplicates.length)add('DUPLICATE_OPTIONS','blocked','options','Existem alternativas com texto idêntico após normalização.','Reescreva manualmente os distratores repetidos; não há sugestão de conteúdo automático.');
  if(q.options.some(o=>!o.text.trim()))add('EMPTY_OPTION','blocked','options','Há alternativas em branco.','Preencha todas as alternativas.');
  if(!q.options.some(o=>o.id===q.correctOptionId))
    add('NO_KEY','blocked','correctOptionId','Gabarito não foi marcado.','Selecione a alternativa correta e valide a fundamentação jurídica.');
 }else{
  if(!Number.isInteger(q.answerLines??8)||(q.answerLines??8)<3||(q.answerLines??8)>60)add('INVALID_ANSWER_LINES','blocked','answerLines','Quantidade de linhas inválida.','Defina entre 3 e 60 linhas.');
  if(!q.rubric.trim())add('MISSING_RUBRIC','blocked','rubric','Falta rubrica de correção discursiva.','Defina critérios observáveis e distribuição de pontos; a ferramenta não inventa fundamentação.');
  else if(q.rubric.trim().length<35)add('BRIEF_RUBRIC','attention','rubric','Rubrica curta: pode não especificar os critérios.','Descreva os elementos exigidos na resposta, com pontuação verificável.');
  if(!q.expectedAnswer?.trim())add('MISSING_EXPECTED_ANSWER','blocked','expectedAnswer','Padrão de resposta esperado não informado.','Descreva os elementos de conteúdo esperados, separadamente dos critérios e da pontuação.');
 }
 if(!Number.isFinite(q.points)||q.points<=0)add('INVALID_POINTS','blocked','points','Pontuação inválida.','Informe quantidade positiva de pontos.');
 if(![1,2,3,4,5].includes(q.estimatedDifficulty))add('INVALID_DIFFICULTY','blocked','estimatedDifficulty','Dificuldade fora da escala.','Escolha nível entre 1 e 5.');
 if(!q.purpose.includes(p.purpose))add('PURPOSE_MISMATCH','attention','purpose','Finalidade da questão diferente da avaliação.','Confirme intencionalidade pedagógica ou ajuste o vínculo.');
 if(!q.competencyIds.length)add('NO_COMPETENCIES','attention','competencyIds','Nenhuma competência associada.','Vincule a competência curricular declarada ou aprovada.');
 for(const id of q.competencyIds){
  const c=p.competencies.find(x=>x.id===id);
  if(!c)add('UNKNOWN_COMPETENCY','blocked','competencyIds','Competência não consta no catálogo informado.','Revise o vínculo da questão.');
  else if(c.period>p.currentPeriod)add('FUTURE_COMPETENCY','attention','competencyIds','Competência pertence a período posterior.','Confirme se a antecipação curricular é intencional.');
 }
 if(!q.topicIds.length)add('NO_TOPICS','attention','topicIds','Nenhum tema associado.','Associe os temas abordados pela questão.');
 for(const id of q.topicIds)if(!p.topics.some(t=>t.id===id))
  add('UNKNOWN_TOPIC','blocked','topicIds','Tema não consta no catálogo informado.','Revise o vínculo.');
 if(p.examFocus&&!q.examTags.includes(p.examFocus))
  add('EXAM_NOT_MAPPED','attention','examTags','O vínculo com o exame escolhido não foi declarado.','Associe o exame somente se o item for pertinente.');
 for(const im of q.images){
  if(!im.altText?.trim())add('IMAGE_ALT','blocked','images','Imagem sem descrição acessível.','Inclua descrição da imagem.');
  if(im.rightsStatus==='nao_informado')add('IMAGE_RIGHTS','blocked','images','Direitos de uso da imagem não confirmados.','Registre a permissão ou a origem autorizada.');
 }
 // Nenhuma sugestão automática de redação substantiva: só formato textual.
 return {version:'rules-curation-1.0',questionId:q.id,findings,
  suggestedStatement:suggestion!==original?suggestion:null,
  needsTeacherReview:true,substantiveReview:'not-performed'};
}
