# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 007 — Formulário docente de questões com imagens
**Data:** 2026-11-19 | **PR:** #207 (rascunho) | **Estado:** interface de elaboração local, ainda não integrada/publicada

### Requisito incorporado
O professor poderá compor questões objetivas e discursivas em formulário, copiar e colar enunciados, adicionar alternativas ou rubrica, selecionar temas/competências validados no PPC, informar finalidade, dificuldade e exame de referência e anexar figuras no enunciado, nas alternativas ou como material de apoio.

### Código acrescentado
- `source-overrides/client/src/lib/avalia360/question-draft.ts`: contrato tipado de questão objetiva/discursiva e verificação determinística de campos.
- `source-overrides/client/src/lib/avalia360/QuestionDraftEditor.tsx`: formulário React local que integra `QuestionImageField` e oferece botão explícito de validar/preparar para curadoria.
- `source-overrides/client/src/lib/avalia360/question-draft.spec.ts`: oito cenários unitários de integridade do formulário.
- Atualização em `QuestionImageField.tsx`: direitos de uso iniciam como `nao_informado`, exigindo declaração explícita do docente antes de validar.

### Regras fundamentais
1. Seleção de temas/competências somente a partir de opções permitidas fornecidas pela aplicação; o backend futuro deverá impor escopo por instituição, curso, disciplina e versão.
2. Questões objetivas exigem alternativas com identificadores distintos e gabarito correspondente; discursivas exigem rubrica.
3. Imagens precisam de descrição acessível, tipo/tamanho aceitáveis, direito de uso informado e vínculo a alternativa válida quando aplicável.
4. A dificuldade é **estimativa docente**, não parâmetro psicométrico calibrado.
5. O botão `Validar e preparar para curadoria` não salva dados, não faz upload nem publica avaliações; o retorno é via callback `onPrepare` destinado ao futuro orquestrador autorizado.
6. O componente não atribui resultado de aprendizagem ou qualidade semântica de enunciados; valida metadados estruturados.

### O que se preserva
Todos os adendos 001–006: motor algorítmico longitudinal, catálogo institucional, contratos de persistência, pré-análise, imagens por questão, autonomia docente, Planejamento Estratégico, Sapiens 360°, Fato & Ordem e modalidades diagnóstica/formativa/somativa.

### Pendências antes de homologar
- [x] Modelo, formulário e testes de unidade criados.
- [x] Imagens integradas ao formulário local.
- [x] Direitos de imagem exigidos no rascunho.
- [ ] Execução real dos testes Vitest e análise TypeScript.
- [ ] Renderização e testes acessíveis em navegador.
- [ ] Upload privado, validação real do conteúdo binário, hash e versionamento de imagens.
- [ ] Persistência transacional com servidor de aplicação e perfis autorizados.
- [ ] Exportação de prova PDF e cartão-resposta com QR Code.
- [ ] Rubrica estruturada por critério (atualmente o campo é texto livre).
- [ ] Conexão ao menu acadêmico e homologação com PPC/prova real.
- [ ] Integração efetiva ao Fato & Ordem e Sapiens 360°.

### Próximo passo recomendado
Comprovar testes e compilar o formulário, depois implementar backend autenticado de mídia e rascunho com segregação por IES/curso e trilha de auditoria. Somente depois conectar ao portal publicado.
