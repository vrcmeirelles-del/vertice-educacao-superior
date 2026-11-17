import { ALL_FIELDS } from './schema';

const proposal = [
  'introduction', 'area_characterization', 'justification', 'general_objective', 'specific_objectives',
  'methodology', 'program', 'expected_results', 'evaluation', 'references', 'team', 'infrastructure', 'publicity',
];
const report = [
  'execution', 'applied_methodology', 'results', 'difficulties', 'final_evaluation',
  'recommendations', 'conclusion', 'acknowledgements', 'evidence_links',
];
export const STUDENT_FIELDS = [...proposal, ...report].map(key => ({
  key,
  label: ALL_FIELDS.find(f => f.key === key)?.label || 'Evidências (uma por linha no formato AAAA-MM-DD | descrição | https://endereço)',
  report: report.includes(key),
}));
