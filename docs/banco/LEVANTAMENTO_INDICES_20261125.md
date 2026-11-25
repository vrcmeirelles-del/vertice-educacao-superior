# Levantamento de índices do portal — 25/11/2026

Leitura de produção (projeto Vértice), só consultas de catálogo e de estatística. Nada foi alterado.
Esquemas gerenciados pelo Supabase (`auth`, `storage`, `realtime`, `cron`, `vault`, `net`, `extensions`) ficaram fora.

## Contexto que muda a prioridade

| Medida | Valor |
|---|---|
| Tamanho do banco | 95 MB |
| Índices (todos os esquemas) | 1.383, somando 26 MB |
| Estatísticas de uso desde | 02/10/2026 (54 dias) |
| Maior tabela com chave sem índice | 1.447 linhas |

Com esse volume, nenhum dos achados causa lentidão perceptível hoje. O ganho é de higiene e de preparação para o crescimento. A única correção com efeito funcional é a do índice de texto do ENADE 360°.

## 1. Índices duplicados — 15 pares no portal

Duplicata exata: mesma tabela, colunas, expressão, predicado e classe de operador. Regra de escolha:
- fica o índice que sustenta restrição ou chave estrangeira;
- entre dois sem restrição, fica o que tem uso registrado.

| Tabela | Remover | Manter | Motivo |
|---|---|---|---|
| vertice_eorbit_compliance_notas | idx_eorbit_compl_notas_inst | idx_eorbit_comp_notas_inst | mantido tem 27 usos |
| vertice_eorbit_compliance_notas | idx_eorbit_compl_notas_sem | idx_eorbit_comp_notas_semestre | nenhum dos dois usado |
| vertice_eorbit_compliance_plano | idx_eorbit_compl_plano_inst | idx_eorbit_comp_plano_inst | mantido tem 26 usos |
| vertice_eorbit_compliance_plano | idx_eorbit_compl_plano_sem | idx_eorbit_comp_plano_semestre | nenhum dos dois usado |
| vertice_eorbit_diario_classe | idx_eorbit_diario_inst | idx_eorbit_diario_instituicao | mantido tem 27 usos |
| vertice_eorbit_diario_classe | idx_eorbit_diario_prof | idx_eorbit_diario_professor | nenhum dos dois usado |
| vertice_eorbit_diario_classe | idx_diario_classe_upsert | restrição única semestre/curso/professor | restrição prevalece |
| vertice_eorbit_quantitativo | idx_quantitativo_upsert | restrição única semestre/curso/grade | restrição prevalece |
| vertice_eorbit_vestibular_editais | idx_eorbit_vest_editais_inst | idx_eorbit_vest_edit_inst | mantido tem 2 usos |
| vertice_courses | vertice_courses_institution_id_pair | vertice_courses_scope_key | o mantido sustenta chaves estrangeiras (ENADE 360°, Automação 360°) |
| vertice_avalia_questions | idx_avalia_questions_assess | restrição única | coberto |
| vertice_captacao_connections | captacao_connection_ies | restrição única (institution_id, id) | coberto; a restrição sustenta chave estrangeira |
| vertice_extension_imports | idx_ext_imports_hash | restrição única | coberto |
| vertice_extension_student_identity | idx_student_identity_pseudo | restrição única | coberto |
| vertice_app.enrollments | enrollments_course_semester_idx | restrição única | coberto |

Também existe uma duplicata em `auth.custom_oauth_providers`, esquema gerenciado pelo Supabase. Não mexer.

Nenhum código do portal referencia pelo nome os índices a remover; só aparecem nos `CREATE INDEX` de origem.

## 2. Chaves estrangeiras sem índice — 567 (o verificador do Supabase conta 583)

A diferença vem do critério de ordem das colunas: o verificador exige a mesma ordem; este levantamento aceita qualquer ordem.

| Recorte | Quantidade |
|---|---|
| Em tabelas vazias | 533 |
| Em tabelas com dados | 34 |
| Em tabelas com 1.000+ linhas | 3 |
| Com exclusão em cascata ou SET NULL (exige varredura ao apagar o pai) | 132 |

Proposta: criar índice só nas 14 chaves das tabelas com 250+ linhas.
- **Repositório:** `goal_id`, `nsa_by`, `classified_by`.
- **Due Diligence:** `matter_id` em 4 tabelas e `requirement_id`.
- **Metas:** `course_id`.
- **E-Orbit:** `grade_id` e `curso_id`.
- **Catálogo de migração:** chave composta.
- **Registro de alunos:** `course_id`.

As 533 de tabelas vazias ficam para quando os módulos tiverem uso. Criar agora só aumenta o custo de escrita.

## 3. Índices sem uso — 237 (5,3 MB)

Quase todos estão em tabelas vazias ou recém-criadas, e por isso não têm uso. **Não recomendo remover:** serão necessários quando os módulos forem usados.

Exceção com efeito funcional:
- **`enade360_evidence_text_idx`** (2,7 MB, o maior da lista) indexa `to_tsvector('portuguese', extracted_text)`.
- A busca da migração `20261117113047` consulta outra expressão (título + categoria + indicadores + texto). Por isso o índice nunca é usado e a busca percorre a tabela inteira.
- Correção: alinhar a expressão da busca ao índice, ou indexar a expressão concatenada.
- É decisão do módulo ENADE 360°; não está na migração candidata.

## Migração aplicada em 25/11/2026

Aplicada por autorização expressa, depois de ensaio desfeito no esquema real. Resultado em produção: 14 índices novos, 0 das 15 duplicatas restantes, 74 chaves estrangeiras para `vertice_courses` íntegras e registro pela versão do arquivo.

`supabase/migrations/20261125130000_indices_portal_limpeza.sql`:
- remove as 15 duplicatas;
- cria os 14 índices de chave estrangeira.

Reversão:
- a parte A se desfaz recriando os índices com os `CREATE INDEX` das migrações de origem;
- a parte B, com `DROP INDEX`.

## Correção da busca do ENADE 360° — aplicada em 25/11/2026

Por autorização expressa, migração `20261125140000_enade360_busca_texto_preanalisado.sql`.
- O texto de cada documento já fica analisado na tabela auxiliar `vertice_doc_prevalidation_tsv`, mantida por gatilho. A leitura segue a RLS da pré-validação e não há escrita direta.
- A busca analisa na hora só título, categoria e indicadores, e soma o texto já analisado.
- O índice de expressão sem uso, `enade360_evidence_text_idx`, foi removido.

| Medida | Antes | Depois |
|---|---|---|
| Busca "projeto pedagógico" (774 documentos) | 1.583 ms | 27 ms |
| Documentos encontrados | 188 | 188 |

Evidências:
- **Equivalência:** 774 documentos × 10 buscas típicas, 0 divergências.
- **Ensaio:** feito em transação desfeita, antes da aplicação.
- **Gatilho:** testado em transação desfeita; o vetor acompanha a alteração do texto e é removido quando o texto é apagado.
- **Permissões:** `authenticated` só lê a tabela auxiliar; `anon` não tem acesso.
- **Assinatura:** colunas e ordem do resultado da função não mudaram.

