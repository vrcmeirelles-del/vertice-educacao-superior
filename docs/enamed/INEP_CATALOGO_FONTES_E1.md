# E1 — CATÁLOGO NORMATIVO E DOCUMENTAL INEP (PARCIAL)
**Data de consulta:** 16/11/2026. **Natureza:** inventário rastreável, não repositório de arquivos homologados. **Estado:** E1 em andamento; critérios de saída ainda não cumpridos.

## Códigos de situação
- `PAGINA_CONFIRMADA`: página institucional e título do documento verificados; arquivo não necessariamente baixado.
- `TEXTO_INSPECIONADO`: texto oficial examinado (não significa arquivo copiado/hash autenticado).
- `ARQUIVO_AUTENTICADO`: somente quando arquivo integral foi baixado, hash SHA-256 calculado e identidade validada; **nenhum documento atingiu este status nesta etapa**.
- `PENDENTE`: arquivo ou validade não conferido.

## Catálogo por prioridade
| ID | Documento / edição | URL oficial/canal | Estado E1 | Norma ou dado destinado ao motor | Pendência |
|---|---|---|---|---|---|
| E1-001 | Portaria MEC 330, 23/04/2025 | https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed/2025 | PAGINA_CONFIRMADA | ENAMED como modalidade ENADE de Medicina | Texto integral, eventuais revogações e arquivo |
| E1-002 | Portaria Inep 413, 18/06/2025 | mesmo catálogo 2025 | PAGINA_CONFIRMADA | Regulamentação e procedimentos | Verificar duas entradas publicadas e retificações |
| E1-003 | Portaria Inep 478, 18/07/2025 | https://www.in.gov.br/en/web/dou/-/portaria-n-478-de-18-de-julho-de-2025-643085112 | TEXTO_INSPECIONADO (espelho do DOU/UFBA) | Matriz oficial: 7 áreas, 7 atributos, 15 competências, contextos e conteúdos | Arquivo DOU de origem, hash, transcrição revisada |
| E1-004 | NT 40/2025 | https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2025/nota_tecnica_40_calculo_conceito_enade_medicina.pdf | TEXTO_INSPECIONADO | Conceito Enade Medicina por curso e edição, filtros e PCP | Arquivo integral e hash; testar contra resultado publicado |
| E1-005 | NTs 19/2025, 1PL/2025, 42/2025 | https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/notas-tecnicas | PAGINA_CONFIRMADA | Cálculo do participante, escala e assuntos respectivos ainda a extrair | Determinar assunto de cada NT pelo PDF e validade |
| E1-006 | Manual “Da Matriz ao Resultado do Participante” (2026) | https://download.inep.gov.br/educacao_superior/enade/manuais/manual_do_enamed_para_participantes_e_ies.pdf | TEXTO_INSPECIONADO (parcial) | 100 itens, Rasch/TRI, escala 0–100, diferença entre 4º e 6º ano, 12 competências em prova teórica | Hash, leitura integral e tabelas |
| E1-007 | Edital ENAMED 2025 nº 81 e retificações | https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed/2025 | PAGINA_CONFIRMADA | Regras específicas da edição 2025 | Download, texto integral, versões |
| E1-008 | MP 1.370 de 19/06/2026 | https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed | PAGINA_CONFIRMADA | Duas etapas e regime semestral | Confirmar estado legislativo e atos posteriores em fonte primária atual |
| E1-009 | Editais 49, 71/2026 republicados + retificações; edital 146 reaplicação | https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed | PAGINA_CONFIRMADA | Habilitação, participação, prazos, reaplicação e publicação de resultados | Arquivos integrais, edições vigentes, divergências de cronograma |
| E1-010 | Provas e gabaritos 2025/2026 | https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos | PAGINA_CONFIRMADA | Confronto de itens e gabaritos preliminares/definitivos | Recuperar arquivos, hashes, cadernos, anulações |
| E1-011 | Conceito Enade Medicina 2025 | https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2025 | PAGINA_CONFIRMADA | Benchmark público por curso e código e-MEC | Obter XLSX/ODS, dicionário, hash, conferir republicação 07/07/2026 |
| E1-012 | Microdados ENAMED 2025 | https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enamed | PAGINA_CONFIRMADA | Reproduzir indicadores, conforme variáveis publicadas | Baixar ZIP/dicionário, verificar versão/aviso de atualização e hash |
| E1-013 | ENADE histórico e microdados | https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enade | PAGINA_CONFIRMADA | Mapeamento por edição/curso, sem confundir com ENAMED | Matrizes históricas e provas de Medicina |
| E1-014 | Normas e provas de Residência Médica/ENARE por edição | Portal oficial aplicável ao certame, URL ainda não autenticada | PENDENTE | Camada de formação complementar; sem equiparar ao Conceito Enade | Inventariar bancas, direitos e provas |

## Achados normativos críticos de E1
1. **NT 40/2025:** cálculo por **código de curso e-MEC**, com filtro de concluintes regulares, presença válida, mínimo de dez; `TP_PRES=555` na edição identificada; `PCP = NCP / NC`. Faixas: [0,0.4)→1; [0.4,0.6)→2; [0.6,0.75)→3; [0.75,0.9)→4; [0.9,1]→5. Não usar percentuais brutos como proficiência TRI.
2. **Portaria 478/2025:** as competências oficiais seguem I–XV do art. 6º, e são distintas da enumeração resumida anterior. **Correção obrigatória:** VI refere-se a indicar e realizar procedimentos médicos; VII refere-se a necessidades coletivas e projetos de intervenção. Não efetuar `competency_code` a partir de lista abreviada da conversa.
3. **Manual 2026:** prova de 100 itens; 4º ano com finalidade diagnóstica sem atribuição de nível de proficiência no manual; concluintes 6º ano com regime próprio. Nunca incluir 4º ano no cálculo do Conceito sem regra explícita por edição.
4. **Gabaritos 2026:** a página pública consultada em 16/11 lista arquivos **preliminares**; não homologar o status `definitivo` do banco F&O sem arquivo definitivo identificado.
5. **Microdados 2025:** a página oficial expõe 2025. Data textual do aviso de atualização está ambígua; verificar cabeçalhos e arquivos, não confiar só no rótulo da página.

## Campos obrigatórios do registry (quando implementado)
`source_id; edition; document_type; official_url; issuer; published_at; retrieved_at; effective_from; effective_to; parent_or_replacement; status; format; size_bytes; sha256; parse_version; approval_state; reviewer; factual_scope; methodology_version; page_locator; notes`.
Não atribuir SHA inventado. Onde não existe arquivo íntegro, `sha256 = NULL` e estado diferente de `ARQUIVO_AUTENTICADO`.

## Bloqueios de aceite da E1
- [ ] Download de arquivos íntegros e hashes SHA-256 do conjunto obrigatório.
- [ ] Matriz oficial transcrita em literal com todos os códigos I–XV, atributos, redes e conteúdos.
- [ ] Ler integralmente notas 19, 1PL e 42/2025 e registrar papéis corretos.
- [ ] Resolver atualidade/precedência normativa 2026 e retificações.
- [ ] Inspecionar PDFs de cadernos e gabaritos e conferir versões por aplicação.
- [ ] Confrontar o cálculo da NT 40 com a planilha oficial de 2025 em lote público.
- [ ] Ter validação regulatória e médica antes de declarar regras normativas homologadas.

**Falha operacional registrada:** tentativa de recuperar arquivo NT40 por conexão direta do ambiente de execução falhou por indisponibilidade de resolução de nome; leitura textual/web foi possível, mas não dá suporte a hash local do binário. Não falsear a prova de integridade.


## Revisão de procedência em 16/11/2026 — links confirmados no portal, bytes ainda não
Uma renderização real com JavaScript da página oficial INEP `provas-e-gabaritos` no GitHub Actions run [43999991024](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/43999991024) identificou **11 URLs de PDFs** em âncoras publicadas pela fonte oficial. Catálogo verificável em `INEP_2026_LINKS_OFICIAIS_CONFIRMADOS.json`:
- regular: cadernos 1/2, versões acessíveis do caderno 1 (ledor, ampliada, superampliada), gabaritos preliminares cadernos 1/2;
- reaplicação: cadernos 1/2 e respectivos gabaritos preliminares.
Os três links de cadernos previamente anotados no F&O estão entre as URLs efetivamente publicadas. Isso **eleva a confiança na procedência dos endereços**, mas **não comprova a integridade dos PDFs** nem o conteúdo dos gabaritos.

**Barreira de transferência reproduzida:** nenhum dos 11 PDFs foi baixado pelo navegador/script Python (erro SSL issuer, conexão reset). A segunda rota `curl`, com TLS verificado, tentou os 8 documentos principais na execução [44000426717](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44000426717): **0/8 arquivos**, respostas `curl 60` (cadeia certificadora não validada) em sete e `curl 35` (conexão reset) em um. Por segurança, **não usar bypass `-k` / `verify=False` para declarar documento autenticado**.

Status: **LINKS_OFICIAIS_CONFIRMADOS, BINÁRIOS NÃO RECUPERADOS, SHA256 NULL, HOMOLOGAÇÃO E1 BLOQUEADA**. A autenticação futura requer arquivo integral e verificação da edição, caderno, tipo de gabarito e validade.


## Adendo verificável de 17/11/2026 — recuperação positiva do corpus 2026
**Este adendo supera apenas o bloqueio de acesso aos oito arquivos de prova e gabaritos preliminares; as limitações históricas descritas acima permanecem como registro da coleta anterior.**

- **E1-010 (parcial):** oito binários PDF (regular 1/2, reaplicação 1/2, quatro gabaritos PRELIMINARES) obtidos por HTTPS com cadeia de confiança reparada e validada; tamanho, 28/2 páginas e hashes SHA-256 conferidos em `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json`.
- Cadeia de custódia: DOM do catálogo oficial Inep (run `43999991024`) → validação da intermediária GlobalSign/RNP até raiz do SO → download `44017133303` → recálculo SHA-256 do ZIP. Isso prova a integridade desses binários sem homologar edital/gabarito definitivo ou temas.
- **E1-010 (ainda pendente):** versões DEFINITIVAS de gabarito e possíveis retificações/anulações; confirmar publicação, hashes, versão e vigência.
- **E1-005/E1-009/E1-011/E1-012:** notas técnicas integrais, atos posteriores e bases públicas ainda exigem verificação documental e testes da metodologia.
- Resultado correlato: 483 registros F&O com gabarito coincidente com a chave **preliminar**, conforme `E1_CONFRONTO_GABARITOS_PRELIMINARES_483_20261117.md`; não é aceite clínico ou confirmação da versão definitiva.

**Porta E1:** **ABERTA, não aceita**. Não editar questões ou publicar indicadores oficiais.
