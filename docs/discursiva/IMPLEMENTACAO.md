# Discursiva 360° — implementação inicial

Implementado na fonte única do portal; nenhuma nova aplicação, identidade ou banco foi criado.

## Fluxo disponível no código

- Workspace → Módulos Acadêmicos → Discursiva 360°; também na página do curso.
- Seleção explícita do curso e autorização efetiva por RPC, com MFA.
- 24 casos autorais iniciais distribuídos em Direito, saúde, gestão, contabilidade, educação, engenharia, tecnologia, psicologia e comunicação. São rascunhos educacionais, não questões oficiais nem itens homologados. O professor carrega, adapta e salva os itens adequados em seu curso; não há distribuição automática a matrizes diferentes.
- Busca de textos efetivamente extraídos no acervo existente, com fonte e hash quando disponível. Coordenadores/NDE recebem somente documentos de seu curso; a gestão também pode selecionar documentos institucionais. Catálogos sem texto não são usados como fundamentação.
- OpenAI gera questão e rubrica; Anthropic revisa. Ausência ou erro de um provedor não é mascarada por uma segunda chamada ao mesmo provedor. Toda questão permanece em rascunho até decisão docente.
- Rubrica com critérios explícitos que somam dez pontos.
- Provas de 1 a 20 questões homologadas; snapshots de enunciados, fontes, rubricas e respostas esperadas permanecem imutáveis.
- QR por questão com instituição, curso, prova, questão, página lógica e assinatura HMAC SHA-256. O código não contém identificação pessoal nem gabarito. A câmera é opcional, conforme suporte nativo do navegador; também há leitura de fotografia ou colagem do conteúdo e seleção manual.
- Versão de impressão em A4, com opção do navegador de salvar PDF. Espelho docente separado do caderno impresso.
- Fotos privadas de até 6 MB. Transcrição visual independente dos dois provedores, comparação das leituras e confirmação humana obrigatória.
- Resposta digitada ou transcrição conferida; registro da imagem e das leituras originais disponíveis na submissão.
- Correção por dois provedores, com pontuação por critério, trechos literais da resposta e devolutiva. Pontuação fora da rubrica, evidência inventada e resposta incompleta de provedor são rejeitadas.
- Média das avaliações é apenas sugestão, com diferença entre avaliadores visível. Nota final exige decisão docente, justificativa, nova conferência da imagem quando existente e controle de versão. Notas homologadas não são sobrescritas.
- Auditoria das alterações; tabelas privadas e acesso por funções autorizadas.

## Componentes

- `source-overrides/client/src/components/area/Discursiva360.tsx`
- `source-overrides/client/src/lib/discursiva/templates.ts`
- `supabase/functions/vertice-discursiva/{index,handler,core}.ts`
- `supabase/migrations/20261117171929_discursiva360.sql`
- `scripts/tests/discursiva-runtime/` e `Discursiva360.ui.test.tsx`

A função usa as variáveis já adotadas pelo Sapiens: SUPABASE_URL, SUPABASE_SECRET_KEYS/default ou SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY e, opcionalmente, OPENAI_MODEL e ANTHROPIC_MODEL. Os modelos padrão reproduzem os padrões presentes no código do Sapiens. A execução real desses modelos não foi homologada nesta entrega.

O gateway `verify_jwt` está desabilitado porque a função verifica a sessão com Auth.getUser(token); a autorização e MFA são reavaliadas no banco usando o JWT do usuário. Nunca utiliza RPC com identidade de serviço para ler/gravar questões ou notas de um usuário.

A assinatura de QR deriva da chave secreta do servidor com separação de finalidade; sua rotação invalida os códigos anteriores. Não há expiração implícita das provas. Uma futura política de retenção/rotação com chave histórica deve ser definida antes de conservar provas por vários ciclos.

## Validação executada

- TypeScript completo do portal: aprovado.
- Build estático completo: aprovado.
- Suíte existente: 415 testes aprovados.
- Contratos do módulo: 12 testes Node/PostgreSQL e 4 testes de interface.
- Testes de IA usam provedores simulados; não demonstram precisão pedagógica ou de manuscritos.
- QR tem validação criptográfica em teste; leitura óptica e impressão precisam de homologação com amostras físicas.

## Estado da implantação

- Migração aplicada no Supabase `qvetbbmviatxxatzzuzc`, versão 20261117171929.
- Bucket `discursiva-responses` privado, limite 6291456 bytes.
- Edge Function `vertice-discursiva` publicada, ACTIVE, versão 1.
- HTTP em produção: POST sem autenticação retornou 401. Isso não comprova execução autenticada das IAs.
- Envio do commit ao GitHub bloqueado pela revisão automática: classificou o push como exportação de código organizacional para remoto não verificado sem autorização explícita. Código preservado em commit local; nenhuma PR criada.
- Publicação da interface depende de identificar o serviço existente de www.verticesuperior.com.br no workspace correto do Render. O conector retornou que a seleção precisa ser confirmada pelo usuário; não foi selecionado um workspace por inferência.

## Limites e próximos critérios de aceite

Esta implementação não equivale à cobertura homologada de todas as disciplinas, nem à alta precisão demonstrada. A autoria manual e a geração por fontes atendem qualquer curso autorizado sem catálogo fixo de nomes, mas a cobertura curricular requer revisão das matrizes e aprovação dos itens por área.

Antes de liberar avaliação oficial: testar ponta a ponta com sessão real e MFA; confirmar disponibilidade dos dois provedores; revisar casos e fontes por disciplina; avaliar amostras manuscritas autorizadas com correções docentes; medir erros de transcrição e diferenças por critério; definir critérios institucionais de aceite. A nota automática sem revisão permanece fora do fluxo entregue.

As chamadas às IAs são síncronas, com timeout e falha explícita. Não foi criada uma fila de processamento em lote. Não há envio de notas ao sistema acadêmico nem intervenção automática no Sapiens; esses vínculos exigem contrato próprio e homologação.
