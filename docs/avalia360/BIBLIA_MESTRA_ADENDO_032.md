# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 032 — Novo Estúdio em três etapas e interface orientada ao professor
**Data:** 20/11/2026 | **Branch:** feat/avalia360-motor-longitudinal-v1 | **PR:** #207 (rascunho).

### Decisão de produto
A experiência de elaboração de avaliações deve engajar docentes com linguagem simples, orientação contextual e visual institucional **claro e predominantemente azul**, mantendo integralmente os requisitos pedagógicos e tecnológicos anteriores. A complexidade algorítmica não deve ocupar a tela principal.

### Interface implementada
1. **Preparar avaliação:** curso, disciplina, semestre, finalidade e título, com ação `Começar a elaborar questões`.
2. **Elaborar questões:** resumo compacto de curso/disciplina/finalidade/semestre; navegação entre questões; editor com enunciado prioritário, mídia opcional, padrão de resposta esperado e critérios de correção em discursivas, alternativas/gabarito nas objetivas, dificuldade selecionável de 1–5, finalidade e competências associadas.
3. **Revisar e finalizar:** prévia do caderno, salvamento do rascunho, recuperação por ID e emissão de PDFs individualizados com turma fictícia no modo público.

### Funcionalidades preservadas
- Curadoria por regras continua disponível, agora em detalhe expansível da questão.
- Banco de Questões e reutilização independente de versões continuam na etapa de elaboração.
- Importação da Construção Curricular, cadastro declaratório de temas/competências e análise longitudinal continuam em **Opções pedagógicas e análise longitudinal** expansíveis.
- Tratamento de imagens, legendas, direitos de uso, PDF com QR demonstrativo e validações permanece inalterado funcionalmente.
- A lateral contextual mostra estado de campos e andamento estrutural; **não calcula nota jurídica nem afirma homologação do PPC**.
- O estado de salvamento reflete o recibo realmente recebido: `Ainda não salvo` até confirmação, sem simular autosave.
- Reorganização é exclusivamente do frontend; nenhuma migração SQL, alteração de produção ou chamada externa de IA.

### Evidências, riscos e validação
- `avalia-wizard.css`: estilos responsivos para desktop/tablet/celular, contraste e foco visível em controles.
- `Avalia360Studio.tsx`: etapa controlada por estado React, com navegação explícita.
- `avalia-wizard-layout.spec.ts`: verificações estruturais de etapas, presença de funções críticas, segurança dos textos de status e regras básicas de responsividade.
- **Render homologação:** deploy `dep-dc0agnmk1f9s738avo40`, commit `8868b38125e7a0f04b316b3bc0ac05fcd622491b`, confirmado `live` antes de adicionar este adendo e o teste.
- O build Vite prova que a prévia compilou e foi publicada, mas **não comprova homologação interativa** de todas as ações, nem equivalência visual pixel a pixel ao conceito ilustrado.
- Testes automatizados de regressão e interação precisam ter execução verificável após o commit final.
- O portal oficial possui somente a entrada que leva ao estúdio demonstrativo; a PR #207 não foi fundida na branch principal.
- A demonstração pública não aceita alunos reais nem expõe o Supabase.
- O painel lateral exibe estado atual, não executa análise semântica nem deixa a IA ativa.

### Aceite do professor ainda necessário
- Confirmar facilidade de localizar a elaboração discursiva/objetiva, importar competências, adicionar imagens, salvar no banco, consultar a curadoria e emitir PDF.
- Ajustar microinterações e cabeçalho/diagramação da prova conforme teste.
- Preservar integralmente a sequência de adendos 001–031.
