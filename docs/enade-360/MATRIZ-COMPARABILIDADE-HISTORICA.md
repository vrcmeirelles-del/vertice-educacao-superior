# Matriz de comparabilidade histórica — Enade 360°
Versão 0.1 | 2026-11-16 | STATUS: especificação preliminar, pendente conferência em dados brutos

## Objetivo e granularidade
A unidade mínima é (edição, área de avaliação, grau acadêmico, instrumento/metodologia, código do curso quando aplicável). A lista consolidada de 2021, 2022 e 2023 consta de CATALOGO-BACHARELADOS-2021-2023.md. As 45 linhas área-edição já catalogadas não formam uma série longitudinal homogênea.

## Classes de comparação
- C0 — Mesma edição, mesma área, mesmo instrumento, população compatível e mesma medida: comparação de notas de cursos autorizada após conferir filtros e unidades.
- C1 — Mesma área, edições distintas, instrumentos e regras verificadamente equivalentes: comparação longitudinal condicionada à evidência da equivalência; não pressupor que escala bruta é estável.
- C2 — Mesma área, edições distintas, houve mudança relevante de instrumento, cálculo ou população: apresentação lado a lado somente com aviso de ruptura; vedada leitura de variação numérica como ganho de aprendizagem.
- C3 — Áreas distintas: permitir distribuição de CONCEITOS em faixas como descrição contextual, sem inferir ordenação de proficiência absoluta entre provas distintas; não comparar notas brutas/componentes específicos de áreas diferentes.
- C4 — Distintos graus acadêmicos (bacharelado, licenciatura, tecnólogo) ou modalidades examinadas por instrumentos diferentes: impedir união automática.
- CX — Evidência insuficiente: bloquear comparação quantitativa interpretativa e solicitar nota técnica/dicionário, sem substituir dados faltantes por aproximações.

## Matriz operacional inicial
| Recorte | Classe provisória | Condição de liberação | Situação atual |
|---|---|---|---|
| Dois cursos Direito, Enade 2022, mesma área e indicador | C0 | conferir códigos de curso, população válida, notas e metodologia | Sem microdados: bloqueada |
| Direito 2022 vs edição histórica de Direito | CX (candidata C1/C2) | localizar edição anterior, instrumentos e notas técnicas equivalentes | Não avaliada |
| Direito 2022 vs Psicologia 2022 (nota bruta) | C3 | não efetuar ranking por nota bruta | Bloqueada |
| Administração 2022 vs Psicologia 2022 (faixas de conceito) | C3 | indicar caráter descritivo; não inferir maior aprendizagem | Exibição contextual condicionada |
| Engenharia Civil 2023 vs Engenharia Civil anterior | CX (candidata C1/C2) | confirmar edição anterior e compatibilidade metodológica | Não avaliada |
| Bacharelado Educação Física 2021 vs licenciatura de mesmo nome | C4 | isolar grau e instrumento | Bloqueada |
| Educação superior 2026 sem resultado oficial publicado | CX | não apresentar indicador como resultado já ocorrido | Bloqueada |

## Esquema mínimo do cadastro
Campos: source_url, edition_year, source_publication_date, retrieval_date, source_sha256, area_code, area_name_original, academic_degree, course_code, institution_code, instrument_id, methodology_reference, population_filter_version, metric_id, metric_scale, denominator, exclusion_count, comparability_class, comparison_justification, reviewer, reviewer_date, status.
Nenhum valor ausente pode ser preenchido por suposição. Identificadores de áreas e instrumentos precisam ser extraídos do dicionário oficial da edição.

## Portas de qualidade
1. Impedir comparações C4, CX e comparações de notas brutas C3.
2. Não elevar uma comparação provisória C1 antes da conferência documental da escala/metodologia.
3. Conservar valor fonte, transformação, justificativa, sinalização de ruptura e aprovação humana.
4. Registrar quebras metodológicas e mudanças de nomenclatura em tabela de equivalências versionada.

## Pendência externa
**P-ZIP-001:** usuário fornecerá posteriormente o ZIP oficial de microdados (ou conjunto de ZIPs por edição) e, se disponível, os dicionários e tabelas oficiais para conciliação. Não recebido em 2026-11-16. Não afirmar processamento nem homologação antes do recebimento e dos testes.
