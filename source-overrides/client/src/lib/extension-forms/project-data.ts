import type { Answers } from './schema';

export interface ProjectSource {
  id: string;
  title: string;
  course_ids?: string[] | null;
  deleted_at?: string | null;
  status?: string;
  review_status?: string;
  first_submitted_at?: string | null;
  coordinator_email?:string | null;
  owner_id?: string | null;
}

const projectFields = {
  title: 'title',
  unit: 'unit_name',
  responsible: 'coordinator_name',
  email: 'coordinator_email',
  semester: 'semester',
  thematic_area: 'thematic_area',
  activity_type: 'activity_type',
  modality: 'modality',
  start_date: 'start_date',
  end_date: 'end_date',
  hours: 'total_hours',
  schedule: 'activity_schedule',
  location: 'activity_location',
  audience: 'target_community',
  introduction: 'description',
  justification: 'social_problem',
  general_objective: 'general_objective',
  specific_objectives: 'specific_objectives',
  methodology: 'methodology',
  program: 'detailed_program',
  expected_results: 'expected_results',
  evaluation: 'evaluation_method',
  community_planned: 'target_audience_count',
  budget: 'budget_estimated',
  infrastructure: 'infrastructure_needs',
  partnerships: 'partnerships_detail',
} as const;

export function projectAnswers(project: ProjectSource): Answers {
  const source = project as unknown as Record<string, unknown>;
  const answers: Answers = {};
  for (const [field, column] of Object.entries(projectFields)) {
    const value = source[column];
    if (value == null) continue;
    const text = Array.isArray(value) ? value.join('\n') : String(value);
    if (text.trim()) answers[field] = text;
  }
  return answers;
}

export function fillEmpty(answers: Answers, source: Answers, fields: string[]) {
  const added = fields.filter(key => !answers[key]?.trim() && !!source[key]?.trim());
  if (!added.length) return { answers, added };
  const next = { ...answers };
  for (const key of added) next[key] = source[key];
  return { answers: next, added };
}

export const ODS_NAMES = [
  'Erradicação da pobreza', 'Fome zero e agricultura sustentável', 'Saúde e bem-estar',
  'Educação de qualidade', 'Igualdade de gênero', 'Água potável e saneamento',
  'Energia limpa e acessível', 'Trabalho decente e crescimento econômico',
  'Indústria, inovação e infraestrutura', 'Redução das desigualdades',
  'Cidades e comunidades sustentáveis', 'Consumo e produção responsáveis',
  'Ação contra a mudança global do clima', 'Vida na água', 'Vida terrestre',
  'Paz, justiça e instituições eficazes', 'Parcerias e meios de implementação',
];

export const PLANNED_FIELD: Record<string, string> = {
  students_actual: 'students_planned',
  faculty_actual: 'faculty_planned',
  staff_actual: 'staff_planned',
  community_actual: 'community_planned',
  hours_actual: 'hours',
  investment_actual: 'budget',
};

const DOCUMENT_HEADINGS: Record<string, string[]> = {
  introduction: ['introdução', 'apresentação'],
  area_characterization: ['diagnóstico do território', 'caracterização da área'],
  justification: ['justificativa', 'problema identificado'],
  general_objective: ['objetivo geral'],
  specific_objectives: ['objetivos específicos'],
  methodology: ['metodologia'],
  program: ['programação', 'cronograma'],
  expected_results: ['resultados esperados'],
  evaluation: ['instrumentos de avaliação', 'critérios de avaliação'],
  references: ['referências bibliográficas', 'referências'],
  ppc_alignment: ['competências do egresso', 'perfil do egresso', 'competências'],
  execution: ['atividades realizadas', 'descrição da execução'],
  applied_methodology: ['metodologia aplicada'],
  results: ['resultados alcançados', 'resultados obtidos'],
  difficulties: ['dificuldades e ajustes', 'dificuldades'],
  final_evaluation: ['avaliação geral', 'retorno da comunidade'],
  recommendations: ['recomendações'],
  conclusion: ['conclusão'],
  acknowledgements: ['agradecimentos'],
};

export function documentSuggestions(text:string, fields:string[]) {
  const headings = Object.entries(DOCUMENT_HEADINGS).flatMap(([key,names])=>names.map(name=>[name,key] as const));
  const pattern = new RegExp('^[\\t ]*(?:[0-9.]+[\\t ]+)?(' + headings
    .map(([name])=>name).sort((a,b)=>b.length-a.length).join('|') + ')[\\t ]*(?:[:–-][\\t ]*|(?=\\r?$))', 'gimu');
  const matches = [...text.matchAll(pattern)];
  return matches.flatMap((match,index)=>{
    const key=headings.find(([name])=>name===match[1].toLocaleLowerCase('pt-BR'))?.[1];
    if(!key||!fields.includes(key))return [];
    const start=match.index+match[0].length;
    const section=text.slice(start,matches[index+1]?.index).trim();
    const excerpt=section.split(/\r?\n[\t ]*\r?\n/)[0].slice(0,900).trim();
    return excerpt.length>15?[{key,excerpt}]:[];
  });
}
