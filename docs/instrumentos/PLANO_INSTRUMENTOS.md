# Instrumentos de avaliação — plano de automação (25/11/2026)

Base: levantamento de 25/11/2026, com leitura de produção e mapa do código. Tudo é por algoritmo determinístico, sem IA. Cada passo vai em PR próprio, e a aplicação em produção depende de autorização expressa.

## Situação de partida

| Instrumento | Catálogo no banco | Acervo em produção |
|---|---|---|
| Reconhecimento 2017 (curso) | 58 indicadores; critérios e tipos de evidência vazios | 1.254 solicitações e 525 arquivos na UNITOP; 5 validados |
| Recredenciamento 2017 (IES) | não havia; só `avaliacao-institucional.json` no portal | 0 solicitações |
| Novo Instrumento 2026, curso e IES | não havia; só `novo-instrumento.ts` no portal | 0 solicitações; checklist e ciclo em uso |
| Equivalência 2017 → 2026 | não havia; só `instrumento-mapping.ts` | — |

## Passos

1. **Catálogos no banco** — migração `20261125150000_instrumentos_catalogos.sql`, gerada por `scripts/instrumentos/gerar-catalogos.mjs` a partir dos arquivos do portal. Leva o Recredenciamento 2017 (50 indicadores, eixos com peso, descritores 1 a 5, evidências esperadas), o Novo Instrumento 2026 de curso (38 indicadores) e o institucional (26), todos como proposta, e 51 pares de equivalência.
   - Os catálogos novos entram inativos para a pré-validação. A revisão de cache dela não muda, e isso tem teste.
   - A proveniência registra arquivo e sha256 de origem, além de `official_text_verified=false`. A conferência contra o PDF oficial do INEP fica pendente.
   - A carga é só para a UNITOP, mesmo escopo do catálogo do Reconhecimento. Estender a outras IES é decisão à parte.
2. **Gravar a avaliação institucional** (hoje as notas por eixo ficam só na tela). Versionar `vertice_avaliacao_simulada`, que não está em `supabase/migrations`, e restringir a escrita a papel de gestão: hoje basta poder ler a IES.
3. **Regras de instrumento na Automação 360°**, em modo sombra:
   - indicador sem evidência validada;
   - arquivo enviado e parado sem validação;
   - indicador sem solicitação e sem "não se aplica";
   - conceito simulado ≥ 3 sem lastro;
   - item não conforme ou parcial sem responsável;
   - marco do ciclo a vencer ou vencido.
4. **Pré-validação e busca nos acervos** do Recredenciamento e do Novo Instrumento. Hoje a função lê só o acervo do Reconhecimento, e a trava de classificação aceita só códigos 2017 de curso. Ligar os catálogos novos à pré-validação é decisão deste passo.
5. **Parecer da avaliação simulada por algoritmo**, no lugar do botão "Gerar com IA". Hoje ele está bloqueado pela política e cai num texto-modelo.

## Andamento

| Passo | Situação |
|---|---|
| 1 | PR #284 integrado; migração ainda não aplicada em produção |
| 2 | PR #285 integrado. Migração candidata `20261125160000_avaliacao_registros.sql`, que depende do passo 1, e tela da avaliação institucional gravando por eixo. Na avaliação simulada: chaves de instituição e de curso da mesma IES, escrita só de gestor e equipe com MFA (antes bastava ler) e autor gravado pelo banco (o campo estava vazio nos 39 registros) |
| 3 | PR #286 integrado. Seis regras `instrument.*` (família `instrumental`, versão 2026.11-instrument.1), leitor `vertice_automation_source_instrumental` (migração candidata `20261125170000`, depende dos passos 1 e 2) e executor 2026.11-executor.5. No curso, as regras olham o Reconhecimento 2017; na IES, o Recredenciamento 2017, o checklist e o ciclo. Sem catálogo no banco, a regra se abstém |
| 4 | Migração candidata `20261125180000_instrumentos_acervos.sql` (depende do passo 1) e função `vertice-doc-prevalidate`: acervo e catálogo pela seção da solicitação. Corrige dois defeitos — o registro de envio do Recredenciamento e do Novo Instrumento era sempre recusado (o arquivo era procurado no acervo do Reconhecimento) e classificar o arquivo tirava a solicitação do acervo. Reconhecimento e documentos gerais sem mudança, inclusive a revisão de cache (teste). Pendente: botão de pré-validação nas telas do Recredenciamento e do Novo Instrumento e filtro por seção na busca de evidências |
| 5 | PR #287 integrado. "Gerar com IA" trocado por "Gerar rascunho" (regras `avs-rascunho-v1`): parecer, lacunas, plano e perguntas montados com os conceitos registrados, a cobertura documental e a equivalência 2017→2026. Só preenche campo vazio; antes, a geração sobrescrevia o texto do avaliador |

## Produção (25/11/2026)

As quatro migrações (150000 a 180000) estão aplicadas e registradas. Publicados: executor 2026.11-executor.5 e `vertice-doc-prevalidate` versão 13. O portal foi publicado automaticamente pelo Render a cada merge. Evidências na Bíblia-Mestra (`docs/automacao360/BIBLIA-MESTRA.md`).

## Pendências fora dos passos

- As 6 correspondências Reconhecimento → Novo Instrumento em produção foram sugeridas por IA (`ai_metadata`) antes da suspensão e não têm revisão humana.
- Os critérios oficiais (descritores 1 a 5) dos 58 indicadores do Reconhecimento não estão no repositório.
- Os indicadores 2.8, 3.14 e 3.18 do Reconhecimento não têm solicitação nem "não se aplica" na UNITOP.
