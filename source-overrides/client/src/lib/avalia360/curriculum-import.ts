/** Importação curricular em leitura, sem inventar competências nem períodos. */
import type {PedagogicalDraft} from './declared-analysis';
export type SourceBuild={id:string;institution_id:string;course_id:string;version:number;status:string};
export type SourceCompetency={
 id:string;build_id:string;code:string;title:string;
 origin_period?:number|null;period_status?:'proposed'|'validated'|null;
};
export type SourceLink={competency_id:string;discipline_name:string};
export interface CurriculumImport {
 ready:boolean;warnings:string[];buildId:string;buildVersion:number;
 competencies:PedagogicalDraft['competencies'];
 missingPeriods:string[];
}
export function normalizeDiscipline(text:string):string{
 return text.trim().normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
}
export function mapCurriculumToAssessment(args:{
 institutionId:string;courseId:string;disciplineName:string;
 build:SourceBuild;competencies:SourceCompetency[];links:SourceLink[];
}):CurriculumImport{
 const {build}=args,warnings:string[]=[];
 if(!args.institutionId||!args.courseId||build.institution_id!==args.institutionId||build.course_id!==args.courseId)
  throw new Error('Matriz pertence a outra instituição ou curso.');
 if(build.status!=='published')throw new Error('A matriz curricular selecionada não está publicada.');
 if(!Number.isInteger(build.version)||build.version<1)throw new Error('Versão da matriz inválida.');
 if(!args.disciplineName.trim())throw new Error('Informe a disciplina antes de importar.');
 const candidates=new Set(args.links.filter(l=>normalizeDiscipline(l.discipline_name)===normalizeDiscipline(args.disciplineName)).map(l=>l.competency_id));
 const own=args.competencies.filter(c=>c.build_id===build.id&&candidates.has(c.id));
 const missingPeriods:string[]=[];
 const codes=new Set<string>(),ids=new Set<string>();
 const competencies:PedagogicalDraft['competencies']=[];
 for(const c of own){
  if(!c.id||ids.has(c.id))throw new Error('Competência com ID duplicado.');
  ids.add(c.id);
  const code=c.code.trim(),title=c.title.trim();
  if(!code||!title)throw new Error('Competência sem código ou título.');
  if(codes.has(code.toLocaleLowerCase('pt-BR')))throw new Error('Código de competência duplicado.');
  codes.add(code.toLocaleLowerCase('pt-BR'));
  if(!Number.isInteger(c.origin_period)||!c.origin_period||c.origin_period<1||c.origin_period>12||c.period_status!=='validated'){
   missingPeriods.push(c.code);
   continue;
  }
  competencies.push({id:c.id,code,title,period:c.origin_period});
 }
 if(!candidates.size)warnings.push('Nenhuma competência dessa matriz está vinculada à disciplina selecionada.');
 if(missingPeriods.length)warnings.push('Competências sem período validado na Construção Curricular: '+missingPeriods.join(', ')+'.');
 return {ready:missingPeriods.length===0&&competencies.length>0,buildId:build.id,
  buildVersion:build.version,competencies,warnings,missingPeriods};
}
