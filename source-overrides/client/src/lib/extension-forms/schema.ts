export type Template = 'ensino' | 'acao_social' | 'extensao';
export type Answers = Record<string, string>;
export interface Field { key: string; label: string; type?: 'text'|'textarea'|'number'|'date'|'email'; required?: boolean; templates?: Template[]; }
export const TEMPLATES: Record<Template, { label: string; source: string }> = {
  ensino: { label: 'Atividade de ensino', source: 'Estrutura CCG-MDL-01 e CCG-MDL-02' },
  acao_social: { label: 'Ação de responsabilidade social', source: 'Estrutura CCG-MDL-05 e CCG-MDL-06' },
  extensao: { label: 'Projeto de extensão', source: 'Estrutura PEX-MDL-55 e relatório de intervenção' },
};
export const SECTIONS: {title: string; stage: 'projeto'|'relatorio'; fields: Field[]}[] = [
  {title:'Identificação',stage:'projeto',fields:[
    {key:'title',label:'Título da atividade',required:true}, {key:'unit',label:'Unidade / campus'},
    {key:'responsible',label:'Professor ou responsável',required:true}, {key:'email',label:'E-mail do responsável',type:'email',required:true},
    {key:'semester',label:'Semestre',required:true}, {key:'discipline',label:'Disciplina / componente vinculado'},
    {key:'thematic_area',label:'Área temática'}, {key:'activity_type',label:'Tipo de atividade / código'},
    {key:'start_date',label:'Data inicial',type:'date',required:true}, {key:'end_date',label:'Data final',type:'date',required:true},
    {key:'hours',label:'Carga horária prevista (horas)',type:'number',required:true}, {key:'schedule',label:'Horários'},
    {key:'location',label:'Local / território',required:true}, {key:'audience',label:'Público-alvo e comunidade externa',type:'textarea',required:true},
  ]},
  {title:'Fundamentação e planejamento',stage:'projeto',fields:[
    {key:'introduction',label:'Introdução / apresentação',type:'textarea'},
    {key:'area_characterization',label:'Caracterização da área e diagnóstico do território',type:'textarea',required:true,templates:['extensao']},
    {key:'justification',label:'Justificativa e problema identificado',type:'textarea',required:true},
    {key:'general_objective',label:'Objetivo geral',type:'textarea',required:true},
    {key:'specific_objectives',label:'Objetivos específicos (um por linha)',type:'textarea',required:true},
    {key:'methodology',label:'Metodologia e participação da comunidade',type:'textarea',required:true},
    {key:'program',label:'Programação e cronograma (etapa, data e responsável)',type:'textarea',required:true},
    {key:'expected_results',label:'Resultados esperados e produtos',type:'textarea',required:true},
    {key:'evaluation',label:'Critérios e instrumentos de avaliação',type:'textarea',required:true},
    {key:'ods',label:'ODS e relação com o PPC / perfil do egresso',type:'textarea'},
    {key:'references',label:'Referências bibliográficas',type:'textarea'},
  ]},
  {title:'Equipe, recursos e divulgação',stage:'projeto',fields:[
    {key:'responsibilities',label:'Responsabilidades do proponente e prazos institucionais',type:'textarea',templates:['acao_social']},
    {key:'team',label:'Equipe executora e responsabilidades',type:'textarea'},
    {key:'students_planned',label:'Alunos previstos',type:'number'}, {key:'faculty_planned',label:'Docentes previstos',type:'number'},
    {key:'staff_planned',label:'Técnicos previstos',type:'number'}, {key:'community_planned',label:'Público externo previsto',type:'number'},
    {key:'partnerships',label:'Parcerias e formas de apoio',type:'textarea'},
    {key:'infrastructure',label:'Infraestrutura, materiais e necessidades',type:'textarea'},
    {key:'budget',label:'Valor proposto (R$)',type:'number'}, {key:'approved_budget',label:'Valor aprovado (R$)',type:'number'},
    {key:'attendance',label:'Forma de confirmação da presença',required:true},
    {key:'publicity',label:'Divulgação e peças necessárias',type:'textarea'},
    {key:'approvals',label:'Aprovações / protocolos institucionais',type:'textarea'},
  ]},
  {title:'Relatório de execução',stage:'relatorio',fields:[
    {key:'execution',label:'Descrição do que foi realizado',type:'textarea',required:true},
    {key:'applied_methodology',label:'Metodologia aplicada e participação dos envolvidos',type:'textarea',required:true},
    {key:'results',label:'Resultados alcançados e comparação com os objetivos',type:'textarea',required:true},
    {key:'difficulties',label:'Dificuldades e ajustes durante a execução (ou informe que não houve)',type:'textarea',required:true},
    {key:'final_evaluation',label:'Avaliação geral e retorno da comunidade',type:'textarea',required:true},
    {key:'recommendations',label:'Recomendações e continuidade',type:'textarea',required:true},
    {key:'conclusion',label:'Conclusão',type:'textarea',required:true},
    {key:'acknowledgements',label:'Agradecimentos',type:'textarea'},
  ]},
  {title:'Indicadores realizados',stage:'relatorio',fields:[
    {key:'students_actual',label:'Alunos envolvidos',type:'number',required:true},
    {key:'faculty_actual',label:'Docentes envolvidos',type:'number',required:true},
    {key:'staff_actual',label:'Técnicos envolvidos',type:'number',required:true},
    {key:'community_actual',label:'Pessoas da comunidade externa beneficiadas',type:'number',required:true},
    {key:'entities_actual',label:'Entidades beneficiadas',type:'number'},
    {key:'services_actual',label:'Atendimentos realizados',type:'number'},
    {key:'donations_actual',label:'Donativos arrecadados',type:'number'},
    {key:'partners_actual',label:'Parceiros da ação',type:'number'},
    {key:'hours_actual',label:'Carga horária realizada (horas)',type:'number',required:true},
    {key:'investment_actual',label:'Valor total investido (R$; zero se sem custos)',type:'number',required:true},
    {key:'evidence_notes',label:'Observações e limitações das evidências',type:'textarea'},
  ]},
];
export const ALL_FIELDS = SECTIONS.flatMap(s=>s.fields);
export function fieldsForTemplate(fields: Field[], template: Template) { return fields.filter(f=>!f.templates||f.templates.includes(template)); }
export function validateAnswers(a: Answers, final: boolean, template: Template = 'extensao'): string[] {
  const errors: string[] = [];
  if (!a.title?.trim()) errors.push('Informe o título.');
  if (!final) return errors;
  for (const f of fieldsForTemplate(ALL_FIELDS,template)) {
    const v = a[f.key]?.trim() ?? '';
    if (f.required && !v && f.key !== 'title') errors.push(`Preencha: ${f.label}.`);
    if (v && f.type === 'number' && (!Number.isFinite(Number(v)) || Number(v) < 0)) errors.push(`Valor inválido: ${f.label}.`);
    if (v && f.type === 'number' && /_(actual|planned)$/.test(f.key) && !['hours_actual','investment_actual'].includes(f.key) && !Number.isInteger(Number(v))) errors.push(`Use um número inteiro: ${f.label}.`);
  }
  if (a.start_date && a.end_date && a.end_date < a.start_date) errors.push('A data final deve ser igual ou posterior à inicial.');
  if (a.semester && !/^[0-9]{4}[-/][12]$/.test(a.semester)) errors.push('Use o semestre no formato AAAA/1 ou AAAA/2.');
  if (a.hours && Number(a.hours) <= 0) errors.push('A carga horária prevista deve ser maior que zero.');
  if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) errors.push('Informe um e-mail válido.');
  return errors;
}
