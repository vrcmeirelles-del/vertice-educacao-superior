/** Leitura autenticada da Construção Curricular já cadastrada na Vértice.
 * Não usa IA, não publica/edita matriz e respeita o escopo de RLS das tabelas.
 * Matrizes sem período explicitamente validado não alimentam o diagnóstico como oficiais.
 */
import {supabase} from '@/lib/supabase';
import {mapCurriculumToAssessment,type CurriculumImport,type SourceBuild,type SourceCompetency,type SourceLink} from './curriculum-import';

export async function importOfficialCurriculum(args:{
 institutionId:string;courseId:string;disciplineName:string
}):Promise<CurriculumImport>{
 if(!args.institutionId||!args.courseId||!args.disciplineName.trim())
  throw new Error('Selecione curso e disciplina.');
 const {data:user,error:authError}=await supabase.auth.getUser();
 if(authError||!user.user)throw new Error('Faça login institucional antes de importar competências.');
 const builds=await supabase.from('curriculum_builds').select('id,institution_id,course_id,version,status')
  .eq('institution_id',args.institutionId).eq('course_id',args.courseId)
  .eq('status','published').order('version',{ascending:false}).limit(1);
 if(builds.error)throw new Error('A leitura da matriz foi recusada ou está indisponível.');
 const build=(builds.data||[])[0] as SourceBuild|undefined;
 if(!build)throw new Error('Nenhuma matriz curricular publicada está disponível para esse curso.');
 const comps=await supabase.from('curriculum_competencies')
  .select('id,build_id,code,title,origin_period,period_status')
  .eq('build_id',build.id).order('sort_order',{ascending:true});
 if(comps.error)throw new Error('Competências não disponíveis; verifique se a migração de períodos foi homologada.');
 const rows=(comps.data||[]) as SourceCompetency[];
 if(!rows.length)throw new Error('Matriz publicada sem competências cadastradas.');
 const ids=rows.map(r=>r.id);
 const links=await supabase.from('curriculum_discipline_links')
  .select('competency_id,discipline_name').in('competency_id',ids);
 if(links.error)throw new Error('Não foi possível consultar as disciplinas vinculadas.');
 return mapCurriculumToAssessment({
  ...args,build,competencies:rows,links:(links.data||[]) as SourceLink[]
 });
}
