/**
 * Composição docente assistida, determinística, sem IA.
 * Não inventa fatos, fundamentos, respostas, leis ou questões.
 * O professor fornece todos os elementos substantivos antes da montagem.
 */
export type TeachingStructure='caso'|'problema'|'comparacao';
export interface TeacherMaterial {
 structure:TeachingStructure;
 context:string;
 task:string;
 comparisonObject?:string;
}
export type Composition=
 | {ok:true;statement:string;requiresTeacherReview:true;source:'teacher-authored-template'}
 | {ok:false;issues:string[]};
const clean=(s:string)=>s.trim().replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n');
export function composeTeacherQuestion(material:TeacherMaterial):Composition{
 const issues:string[]=[];
 const context=clean(material.context||'');
 const task=clean(material.task||'');
 const comparison=clean(material.comparisonObject||'');
 if(context.length<20)issues.push('Descreva o contexto ou problema com pelo menos 20 caracteres.');
 if(task.length<12)issues.push('Informe o comando avaliativo com pelo menos 12 caracteres.');
 if(material.structure==='comparacao'&&comparison.length<5)
  issues.push('Informe o segundo elemento da comparação.');
 if(!['caso','problema','comparacao'].includes(material.structure))
  issues.push('Selecione uma estrutura pedagógica válida.');
 if(issues.length)return {ok:false,issues};
 const base=context.replace(/[.\s]+$/,'');
 const command=task.replace(/^\s+/,'');
 const statement=material.structure==='comparacao'?
  base+'.\n\nElementos a comparar: '+comparison+'.\n\n'+command:
  base+'.\n\n'+command;
 return {ok:true,statement,requiresTeacherReview:true,source:'teacher-authored-template'};
}
