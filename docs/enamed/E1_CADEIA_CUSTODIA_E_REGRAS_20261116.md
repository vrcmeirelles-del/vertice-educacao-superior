# E1 — Cadeia de custódia e regras normativas verificadas
**Registro:** 16/11/2026 · **Estado:** parcial; arquivos integrais não autenticados por hash; E1 sem aceite.

## Normas e documentos verificados no portal oficial
1. **Edital nº 71/2026, republicação em 21/08/2026, DOU seção 3, página 53.** URL: https://download.inep.gov.br/enamed/edital_71_de_28_de_maio_de_2026.pdf?term=dpoc
   - Itens 1.1.1/1.1.2: 12º semestre (concluinte) e 8º semestre (4º ano).
   - Item 1.3: aplicação 13/09/2026; reaplicação 18/10/2026; gabarito definitivo e resultado final previstos para 04/12/2026.
   - Itens 3.1.1.1/3.1.1.2: 100 questões de múltipla escolha, 4 alternativas, uma resposta correta; base na Portaria Inep nº 478/2025.
   - Item 3.1.1.2.1: **marco temporal normativo/bibliográfico de elaboração 03/07/2026**.
   - Itens 3.1/3.1.1: quarta série/oitavo semestre tem finalidade formativa/diagnóstica; conclusão/sexto ano tem aferição de proficiência.
   - **Nível de evidência:** texto PDF indexado no domínio oficial e identificado como DOU; screenshot do PDF não disponível na ferramenta. PDF binário não materializado, hash NÃO calculado.
2. Página oficial de provas/gabaritos: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos. Página atualizada em 20/10/2026; lista 2025 e 2026, mas o HTML entregue à ferramenta não expôs os links internos de PDF. Resultados de busca do mesmo site indexam Cadernos 01/02 e gabaritos **preliminares** da aplicação e da reaplicação.
3. Página de notas técnicas: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/notas-tecnicas. Lista NT 40, NT 19, NT 1PL e NT 42/2025. Tentativas de abrir NT 40 e NT 19 falharam (502/timeout).
4. Resultado da reaplicação: notícia oficial https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/enamed-2026-inep-divulga-gabarito-preliminar-da-reaplicacao-da-prova/ confirma **preliminar em 20/10/2026** e previsão de definitivo em 04/12/2026.

## Fontes referidas no F&O, sem comprovação de identidade binária
- `2026_caderno_1.pdf`: 200 registros; 100 posições, duas versões/IDs por posição.
- `2026_caderno_2.pdf`: 200 registros; 100 posições, duas versões/IDs por posição.
- `2026_caderno_1_reaplicacao.pdf`: 83 registros e 83 posições. Não tomar essa amostra como caderno completo.
As URLs individuais estão em `FONTES_FO_PENDENTES_AUTENTICACAO_20261116.json` e precisam ser confrontadas com links oficiais primários, não bastando o domínio `download.inep.gov.br`.

## Procedimento de autenticação (não executado sobre arquivos reais nesta rodada)
1. Obter arquivo binário pela publicação oficial e registrar URL/fonte, momento, bytes, `content-type`, redirecionamentos e identificação do órgão.
2. Validar se a edição, caderno, paginação e tipo de gabarito condizem com o título/versão do portal.
3. Executar `python scripts/enamed/verify_inep_artifacts.py --manifest MANIFESTO.json --base DIRETORIO --output RELATORIO.json`.
4. Inspecionar visualmente páginas amostradas e comparar enunciados/comandos/alternativas, com cuidado com figuras e mídia.
5. Registrar SHA-256 e a cadeia de origem; não confundir **integridade local do arquivo** com assinatura digital, autenticidade do DOU ou publicação definitiva.
6. Bloquear qualquer emissão de `official_validated` sem conferência de proveniência e aceite humano.

## Implicações na modelagem
- Armazenar `exam_stage` (8º/12º semestre), `edition`, `reference_cutoff_at`, `question_count`, `alternative_count` e `score_purpose` separados, em regras por edição.
- Não interpretar as tentativas no F&O como participação obrigatória ou resultados oficiais.
- Não mudar os 483 `official_answer_status='definitivo'` até existir versão oficial verificada e processo de correção com trilha de auditoria.

## Bloqueios
- [ ] Arquivos de prova e gabarito oficiais íntegros e autenticados por SHA-256.
- [ ] Correspondência dos 483 registros com caderno/questão/comando/gabarito.
- [ ] Nota Técnica nº 40 e NTs 19, 1PL, 42/2025 recuperadas e avaliadas integralmente.
- [ ] Homologação normativa e médica de todas as regras.
- [ ] Validação de resultados com base pública por curso e dicionário.

**Status:** E1 ABERTA; E2/E3 permanecem preparatórias. Sem DDL/DML, sem merge, sem produção.
