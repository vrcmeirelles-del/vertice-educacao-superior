/** Local adapter implementation coverage, NOT a claim that production is enabled.
 * Keep the SQL allowlist and descriptor whitelist in sync. Unknown tables fail closed.
 * All associations remain proposals for a gestor/master to accept or reject.
 */
export const SOURCE_ADAPTERS = [
  { table: 'vertice_documents', label: 'Documentos', kind: 'file', fieldPolicy: 'Arquivo autorizado e versionado; extração controlada.', coverage: 'connected' },
  { table: 'vertice_repository_files', label: 'Arquivos dos repositórios', kind: 'file', fieldPolicy: 'Arquivo e solicitação ativos, instituição/curso e bucket verificados.', coverage: 'connected' },
  { table: 'vertice_goals', label: 'Metas', kind: 'structured', fieldPolicy: 'Alvo declarado, datas, unidade restrita; sem responsáveis/texto livre. Indicador referenciado por ID, definição não disponibilizada.', coverage: 'connected' },
  { table: 'vertice_goal_measurements', label: 'Medições das metas', kind: 'structured', fieldPolicy: 'Medição reportada, data e meta pai no mesmo tenant/curso. Denominador desconhecido permanece nulo.', coverage: 'connected' },
  { table: 'vertice_actions', label: 'Planos de ação', kind: 'structured', fieldPolicy: 'Progresso declarado, datas e referências verificadas; sem nomes, custos ou texto livre.', coverage: 'connected' },
  { table: 'vertice_diagnosis_items', label: 'Diagnósticos', kind: 'structured', fieldPolicy: 'Situação e data declaradas, sem nota regulatória, achados ou evidências livres.', coverage: 'connected' },
  { table: 'vertice_enrollment_snapshots', label: 'Matrículas agregadas', kind: 'structured', fieldPolicy: 'Contagens operacionais por coorte importada, data, capacidade/denominador. Suprime coortes menores que 10; sem nomes, turmas ou URLs. Não somar coortes sem deduplicação.', coverage: 'connected' },
] as const;
export type SourceTable = typeof SOURCE_ADAPTERS[number]['table'];
export const SOURCE_COVERAGE_LIMITATIONS = 'Cobertura parcial local. Governança, pessoas, escolas, saúde, finanças, aquisições confidenciais e tabelas não listadas não estão conectadas. Nenhum número comprova qualidade ou conceito 5.';
