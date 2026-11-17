# E1 — VERIFICAÇÃO DOCUMENTAL E CONFRONTO INTERNO DOS 483 REGISTROS
**Rodada:** 16/11/2026, após Bíblia v1.4. **Estado:** E1 INCOMPLETA. Consultas de leitura; nenhuma alteração no acervo.

## Evidências normativas e disponibilidade
- Página oficial: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos (atualizada em 20/10/2026; marcadores 2026 e 2025, mas os documentos não ficaram integralmente acessíveis nesta coleta).
- Página oficial de notas: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/notas-tecnicas (lista NT 40/2025, NT 19/2025, NT 1PL/2025, NT 42/2025).
- Portaria Inep nº 478/2025: conferida em reprodução PDF de página pública da UFBA: https://prograd.ufba.br/sites/prograd.ufba.br/files/portaria_no_478_de_18_de_julho_de_2025_matriz_de_referencia_enamed.pdf, com referência e URL DOU https://www.in.gov.br/en/web/dou/-/portaria-n-478-de-18-de-julho-de-2025-643085112; inspeção textual de 4 páginas e visual de página 2. São **15 competências I–XV (art. 6º), 7 áreas (art. 3º), 6 redes/contextos (art. 7º) e 21 conteúdos (art. 8º)**. Registro editorial não é equivalente a reprodução autenticada de binário oficial.
- Manual 2026 do Inep: https://download.inep.gov.br/educacao_superior/enade/manuais/manual_do_enamed_para_participantes_e_ies.pdf — texto recuperado pela ferramenta de consulta, screenshot binário falhou por cache miss.
- Tentativas de download do arquivo oficial `2026_caderno_1.pdf` e da Nota Técnica 40/2025: ambiente de arquivo apresentou falha de resolução DNS para `download.inep.gov.br`, enquanto a consulta web ao endereço NT40 retornou 502. **Nenhum SHA-256 de arquivo oficial aferido nesta rodada.**
- Não há prova de que URLs cadastradas no F&O correspondam à íntegra oficial ou de que os documentos hoje publicados tenham gabaritos definitivos. Não substituir `source_hash=NULL`.

## Auditoria SQL interna de divergências de versão
Agrupamento: `source_url, question_number` na tabela `public.fo_enamed_items`. Total: 483 registros de 2026.

| Medida | Contagem |
|---|---:|
| Posições distintas fonte + número | 283 |
| Posições com mais de um registro | 200 |
| Excedentes em relação a uma linha por posição | 200 |
| Posições repetidas com diferenças textuais de enunciado | 57 |
| Posições repetidas com diferenças serializadas de alternativas | 2 |
| Posições repetidas com divergência de resposta armazenada | 0 |
| Posições repetidas com temas distintos | 6 |
| Posições repetidas com subtemas distintos | 191 |
| Posições repetidas com conjuntos/listas de palavras-chave distintos | 192 |

**Metodologia:** comparação `count(distinct md5(coalesce(stem,'')))`, equivalente para `alternatives::text`, e valores `answer_key/theme/subtheme/keywords`, sem normalizar acentos/espaços. Assim, a diferença detectada **não prova** alteração semântica ou gabarito correto; é um sinal de auditoria para exame do item. As categorias podem se sobrepor.

### Decisão por segurança de histórico
- A mesma posição de questão pode ter dois IDs e tentativas históricas; não excluir, fundir ou reescrever registros sem mapa de aliases e teste de integridade referencial.
- Como as duas versões divergem em 191 subtemas e 192 listas de keywords, não declarar a taxonomia atual estável nem publicá-la automaticamente.
- Duplicatas idênticas em gabarito **não** validam o gabarito contra o Inep.

## Próxima rodada técnica e aceite
1. Autenticar arquivos PDF e gabaritos originais por caderno e edição; conferir URL, tamanho, `sha256`, situação preliminar/definitiva e data da fonte.
2. Recuperar diferenças exatas nos 57 enunciados e 2 alternativas por posição, anexando comparativo restrito à curadoria (não expor texto clínico completo no repositório).
3. Validar 6 divergências de tema e 191/192 de subtema/palavras-chave com leitura integral da pergunta e da matriz.
4. Gerar proposta por ID, com confiança, evidência textual, independência das duas IAs e homologação humana.
5. Preparar uma migração reversível de aliases/sincronização sem usar `UPDATE/DELETE` até aprovação e proteção das tentativas.

**ACEITE E1: BLOQUEADO.** Textos/web confirmados não substituem binários completos, gabaritos, hashes e vigência. **E2/E3: apenas preparação técnica; não homologadas.**
