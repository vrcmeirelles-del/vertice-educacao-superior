# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 006 — Imagens e figuras nas questões
**Data:** 2026-11-19 · **PR:** #207, em rascunho · **Situação:** contrato e componente do formulário registrados, integração pendente.

### Requisito acrescentado e aprovado
O formulário docente deverá aceitar **uma ou mais imagens em cada questão**, incluindo gráficos, fotografias, mapas, radiografias, esquemas, quadros, figuras e imagens associadas a alternativas, preservando sua posição e qualidade visual.

### Requisitos da interface
1. Botão de seleção de imagens por questão, com prévia, remoção e indicação do nome do arquivo.
2. Posição da figura: enunciado, alternativa (identificador obrigatório) ou apoio.
3. Campo de legenda e descrição acessível, a ser revisto pelo professor.
4. Indicação de direito de uso/licença, com identificação da origem em versão final.
5. Até doze imagens por questão nesta configuração inicial; PNG/JPEG/WebP, até 10 MB por imagem. Os limites são configuráveis futuramente.
6. Respeito à autonomia docente e aos requisitos de acessibilidade, inclusive quando uma imagem é necessária para resolver a questão.

### Código desenvolvido na branch
- `source-overrides/client/src/lib/avalia360/question-media.ts`: contrato `QuestionImage` e verificador puro de metadados (posição, hash, acessibilidade, tamanho, direito de uso).
- `source-overrides/client/src/lib/avalia360/QuestionImageField.tsx`: componente React reutilizável, seleção local de arquivos, prévia, legenda, descrição e posicionamento.
- `source-overrides/client/src/lib/avalia360/question-media.spec.ts`: seis testes escritos para integridade de referência, formato, acessibilidade, alternativa e colisões.

### Regra operacional obrigatória
O componente atual mantém arquivos em memória do navegador; **não realiza upload**, **não salva no banco**, **não incorpora imagens em PDF** nem está montado em formulário publicado.
O serviço futuro deverá:
- Autorizar instituição, curso, avaliação e questão.
- Validar assinatura real/MIME e dimensões da imagem (não confiar apenas em metadados enviados pelo navegador).
- Guardar o binário em storage privado, sob escopo institucional, com checksum SHA-256 do conteúdo real.
- Retornar um ID versionado e recuperá-lo por URL temporária/signed URL após controle de acesso.
- Preservar a ligação à questão/alternativa e a versão congelada no momento da aplicação.
- Produzir prova impressa e digital com as figuras na posição definida, conferindo paginação, escala e nitidez.
- Separar caderno de prova, gabarito, folha de resposta e folha discursiva QR; o QR não deverá expor aluno, respostas ou URLs privadas.
- Bloquear publicação quando arquivo obrigatório estiver ausente ou corrompido; permitir tratamento acessível de imagens essenciais.

### Preservação dos requisitos anteriores
Continuam válidos integralmente os adendos 001–005: construção curricular, catálogo de competências/temas, algoritmo longitudinal, pré-análise, psicometria futura, autonomia docente, correção objetiva/discursiva e Planejamento Estratégico.

### Critérios para homologação desta camada
- [x] Contrato tipado e regras determinísticas em branch isolada.
- [x] Componente de seleção local para o futuro formulário.
- [x] Testes unitários escritos.
- [ ] Testes executados e aprovados.
- [ ] Campo integrado ao formulário de elaboração de prova.
- [ ] Upload e storage privado com políticas revisadas.
- [ ] Captura real de dimensões e hash de arquivo.
- [ ] Exportação PDF e prova digital testadas com figuras e alternativas.
- [ ] Verificação de acessibilidade, escala, paginação e imagens não resolvidas.
- [ ] Homologação pedagógica, integração e publicação.

### Próximo passo
Executar testes e corrigir integração dos componentes; depois implementar gateway de upload privado e vinculação persistente, com homologação em ambiente isolado, sem alterar produção.
