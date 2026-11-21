/** Leitura autenticada da Construção Curricular já cadastrada na Vértice.
 * Não usa IA, não publica nem edita a matriz. A leitura é feita pela RPC
 * vertice_avalia_curriculum_import (AAL2 + papel + vínculo de curso), porque as
 * tabelas ficam no schema vertice_app, sem leitura direta pelo navegador.
 */
import {supabase} from '@/lib/supabase';
import {mapCurriculumToAssessment,type CurriculumImport,type SourceBuild,type SourceCompetency,type SourceLink} from './curriculum-import';

export async function importOfficialCurriculum(args:{
 institutionId:string;courseId:string;disciplineName:string;assumedPeriod?:number
}):Promise<CurriculumImport>{
 if(!args.institutionId||!args.courseId||!args.disciplineName.trim())
  throw new Error('Selecione curso e disciplina.');
 const {data,error}=await supabase.rpc('vertice_avalia_curriculum_import',{p_institution:args.institutionId,p_course:args.courseId});
 if(error)throw new Error(error.code==='42501'?'Leitura da matriz restrita à equipe autorizada deste curso, com MFA.':'A leitura da matriz está indisponível.');
 const payload=(data||{}) as {build:SourceBuild|null;competencies:SourceCompetency[];links:SourceLink[]};
 if(!payload.build)throw new Error('Nenhuma matriz curricular publicada está disponível para esse curso na Construção Curricular.');
 if(!payload.competencies?.length)throw new Error('Matriz publicada sem competências cadastradas.');
 return mapCurriculumToAssessment({institutionId:args.institutionId,courseId:args.courseId,disciplineName:args.disciplineName,
  build:payload.build,competencies:payload.competencies,links:payload.links||[],
  ...(args.assumedPeriod!==undefined?{assumedPeriod:args.assumedPeriod}:{})});
}
