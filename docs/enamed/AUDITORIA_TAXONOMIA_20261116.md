# Auditoria inicial ENAMED — 16/11/2026

## Escopo e evidência
Consulta **somente de leitura** à tabela pública protegida `public.fo_enamed_items` do projeto Supabase Fato & Ordem. A página oficial do Inep de provas e gabaritos 2026 foi consultada, mas os arquivos PDF do Inep não foram recuperados integralmente nesta etapa (timeout/erro de gateway); por isso **não há homologação semântica contra a prova oficial**. Nenhum item foi alterado.

Fontes:
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos
- https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/enamed-2026-inep-divulga-gabarito-preliminar-da-reaplicacao-da-prova/

## Resultado objetivo da consulta ao banco
- 483 registros de ENAMED 2026 (400 regulares e 83 da reaplicação).
- 200 posições distintas `(caderno, número)` no exame regular, cada uma cadastrada duas vezes sob IDs diferentes. Os enunciados duplicados nem sempre coincidem byte a byte; não excluir registros sem verificar relações históricas de tentativas.
- 483/483 registros sem `source_hash`.
- 483/483 com tema, subtema e palavras-chave preenchidos; nenhum dos três campos vazios nessa população.
- 483/483 incluem ao menos uma palavra-chave genérica `medicina` ou `enamed 2026`. Elas não bastam como competência clínica discriminante.
- 112 registros incluem alguma palavra-chave com menos de quatro caracteres; examinar siglas antes de remover, por exemplo `TEA`, `HAS`, `IOT`.
- 16 registros têm tema com menos de 12 caracteres (não é erro por si só).
- 483/483 estão marcados `official_answer_status='definitivo'`; porém o Inep, na notícia de 20/10/2026, ainda identificava gabaritos de 2026 como preliminares e previa publicação definitiva em 04/12/2026.
- Alguns temas/subtemas observados são específicos, como `Epiglotite aguda` / `Estridor, sialorreia e posição em tripé` (C1 Q2), mas sua pertinência deve ser confirmada lendo o comando e as alternativas.
- Exemplo de palavra-chave possivelmente descontextualizada para revisão humana: `tea` presente em C2 Q10 cujo tema cadastrado é vacinação/contraindicações. Não afirmar erro sem inspeção completa do caso.

## Critérios para confronto oficial questão a questão
1. Registrar arquivo autenticado por hash, edição, caderno, reaplicação, questão, página e tipo de gabarito; não aceitar apenas o texto da URL como prova de origem.
2. Reconstruir enunciado, comando, alternativas e recursos gráficos/multimodais; comparar com a fonte do Inep.
3. Validar gabarito vigente, anulações e retificações; status da fonte e data de publicação.
4. Avaliar **tema** pelo conhecimento central exigido para responder ao comando; **subtema** pela habilidade ou decisão clínica específica; **palavras-chave** por termos clínicos precisos e recuperáveis. Palavras genéricas devem ser secundárias, nunca únicas.
5. Confrontar com matriz oficial vigente; não confundir matriz de referência com taxonomia editorial criada pela plataforma.
6. Gerar parecer dual-IA independente com citações textuais verificáveis e revisão médica humana; manter toda divergência em fila pendente, sem escrita automática no acervo.
7. Preservar os IDs e tentativas existentes ao reconciliar duplicatas.

## Próximas evidências necessárias
- Cadernos e gabaritos oficiais com download íntegro e SHA-256;
- conferência visual de páginas com mídia;
- revisão integral dos 283 registros adicionais além das 200 posições únicas;
- teste de integridade Fato & Ordem → Vértice → Sapiens → 5W2H;
- homologação e publicação separadas do código da interface ENAMED.

Os números são **fotografia da consulta em 16/11/2026**, não atualização contínua.
