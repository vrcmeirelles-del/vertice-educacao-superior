# ENADE 360° — Termo de encerramento da fase de protótipo e governança
Data: 2026-11-17 | Estado: fase técnica documental/prototipação ENCERRADA; núcleo científico NÃO HOMOLOGADO.

## Decisão final
Não abrir novos ciclos artificiais. Os contratos de relatórios R1–R7, estados de indisponibilidade, políticas por edição, rastreabilidade, governança e ensaios em banco descartável constituem o pacote técnico de protótipo. Nenhum destes artefatos equivale a um motor oficial reproduzido, à autenticação real na aplicação Vértice ou à publicação em produção.

## Evidências realizadas
- CI do commit `7a3672384565bd078b30e137e06248d7a5582b96`, run `44048407509`: `contract-tests` com 266/266 cenários sintéticos aprovados; `disposable-postgres-rls` passou RLS e rollback em PostgreSQL 17, com schema e papéis fictícios.
- Consultas reais de metadados/agregados ao Supabase Vértice: 289 linhas e-ORBIT, 241 com ID curso, 48 sem, 62 pares IES/curso distintos com ID; 0 vínculos na `vertice_enade_course_config`; 196 linhas no cadastro de cursos. Consulta adicional de candidatos diretos de código e nome normalizado dentro da mesma instituição retornou zero linhas. Esta consulta não prova que nenhum curso corresponda; somente que **a regra de igualdade direta testada não encontrou correspondência**.
- A RLS institucional foi verificada no banco; o nível por curso no ENADE, os papéis reais de NDE/Coordenação e a integração com eventos auditáveis não foram homologados.

## Escopo concluído
1. Contratos e testes sintéticos estruturais R1–R7, distinções epistêmicas, ausência de evidência, SC, políticas por edição e comparabilidade.
2. Regra de rastreabilidade que exige fonte, versão, hash de formato válido, indicador, metodologia, edição, decisão humana e status DRAFT_ONLY.
3. Projeto de auditoria/eventos e permissões, testes de acesso simulado e policy RLS sintética comprovada em PostgreSQL descartável.
4. Documentação acumulada, versionada e preservada em Bíblia-Mestra, Plano e Diário.

## Impedimentos objetivos à homologação definitiva
**B1 — Fonte oficial:** arquivo ZIP dos microdados e planilhas de resultados/versões oficiais ainda não recebidos, não há reprodução de conceitos oficiais por curso/edição.
**B2 — Mapeamento institucional:** 62 pares IES/curso do e-ORBIT demandam tabela de equivalência verificável; não há pares automáticos por código/nome simples; não associar por suposição.
**B3 — Ambiente institucional:** teste de políticas efetivas e permissões de curso com autenticação real em clone isolado, aplicação de migração de auditoria, API de evidências, replay e assinatura não realizados.
**B4 — Metodologia:** tolerâncias, notas técnicas e regras exatas de todas as edições e indicadores ainda exigem auditoria documental, sem aceitar arredondamento sintético como regra oficial.

## Critério fechado de retomada
Não continuar apenas com mais ciclos. Retomar a homologação **somente** com uma das entradas materiais:
- pacote de microdados/documentos oficiais, para reprodução numérica;
- fonte de equivalência validada dos 62 pares IES/curso, para conciliação institucional;
- ambiente clonado/descartável da Vértice, com políticas e identidades de teste, para homologação RLS real.
Cada entrada autoriza uma entrega de aceite direta, não uma cadeia indefinida de protótipos.

## Resultado para decisão
**Protótipo técnico de governança: entregue e testado sinteticamente.**
**Integração de produção: não implementada.**
**Reprodução de indicadores INEP: não executada.**
**Homologação científica e especialização de bacharelados: bloqueadas por evidências ausentes.**
**Dados/sistemas em produção: não modificados nesta fase.**
