# Contratos de saída — relatórios auditáveis ENADE 360°
Versão 0.1 | 2026-11-16 | Especificação proposta, sem implantação em aplicação

## Contrato base R0 — cabeçalho imutável
Identificação: report_id, report_type, schema_version, generated_at, edition_year, academic_degree, area_code, area_name, course_code (opcional conforme escopo), institution_code (opcional), source_documents[] {url, document_title, publication_date, retrieval_date, sha256, edition, file_version}, methodology_id, methodology_url, engine_version, dataset_hash, sample_n, exclusion_counts, missing_counts, comparator_definition, comparability_class, caveats[], generated_by, reviewed_by, reviewed_at, review_status.

## Contrato obrigatório por afirmação
claim_id; text; epistemic_label enum OFFICIAL_FACT, REPRODUCED_CALCULATION, STATISTICAL_INFERENCE, PEDAGOGICAL_HYPOTHESIS, ACTION_PROPOSAL; evidence_refs[]; calculation_formula (se cálculo); assumptions[]; limitations[]; validation_status enum PENDING, VALIDATED, REJECTED; reviewer_comment. Uma afirmação sem evidência NÃO pode receber rótulo OFFICIAL_FACT ou REPRODUCED_CALCULATION.

## Produtos mínimos previstos
- R1 Panorama: população, inscritos, presentes, válidos, taxas, áreas, séries, universo e faltantes.
- R2 Desempenho: FG/CE com unidades, distribuição, componentes, prova e metodologia vigente.
- R3 Perfil discente: categorias do questionário com denominadores, missing e proteção de dados.
- R4 Indicadores: Conceito Enade, IDD, CPC, IGC cada qual com nível e método próprios, valores contínuos/faixas, SC e versões.
- R5 Comparabilidade: matriz C0–CX, rupturas e justificativa documental.
- R6 Intervenção: evidência→hipótese→ação sugerida→validação humana→indicador de acompanhamento, com conexão futura ao Sapiens.
- R7 Conciliação: chave de edição/área/código de curso/indicador, valor oficial, valor calculado, tolerância fundamentada, diferença, status e motivo.

## Exemplo sintético (não extraído do INEP)
```json
{
  "report_id": "TEST-R7-001",
  "schema_version": "0.1",
  "report_type": "R7_CONCILIATION",
  "edition_year": 2022,
  "academic_degree": "bacharelado",
  "indicator": "CONCEITO_ENADE",
  "course_code": "TEST-COURSE-001",
  "official_value": null,
  "computed_value": null,
  "status": "PENDING_DATA",
  "epistemic_label": "PEDAGOGICAL_HYPOTHESIS",
  "caveats": ["Exemplo sintético; sem microdados e tabela oficial"]
}
```
O exemplo NÃO é validação de schema nem resultado de curso real. O contrato definitivo deve ter esquema de validação automatizado (JSON Schema) e assinatura/referência dos anexos documentais.

## Portões de aceite
Todo relatório precisa de procedência completa, população, critérios de elegibilidade, método, limites, classificação de afirmações e assinatura de revisão humana. Relatório sem metadados deve falhar fechado. Proibido exibir rótulo homologado enquanto P-ZIP-001, P-NT-001 e P-REF-001 impedirem a conciliação.
