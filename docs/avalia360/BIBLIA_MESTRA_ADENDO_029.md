# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 029 — Banco de Questões reutilizável
**Data:** 20/11/2026 | **Ambiente:** demonstração e PR #207 | **Produção:** não alterada

### Decisão docente
O professor poderá guardar uma questão elaborada em um **Banco de Questões**, independente do caderno da prova, e reutilizá-la em avaliações futuras, mantendo a versão original.

### Entrega implementada na prévia
- O Estúdio ganhou um painel **Banco de Questões** após a edição da questão, com **Salvar questão no banco**, **Pesquisar e reutilizar**, campo de busca e ação **Inserir cópia na prova**.
- `question-bank.ts`: registros `BankQuestion` com ID, revisão, IES, curso, disciplina, tipo, enunciado, alternativas, gabarito/rubrica, pontuação, dificuldade, temas, competências, finalidade e marcadores de exames. Status inicial `rascunho`; não há homologação implícita.
- `question-bank-local.ts`: armazenamento em `localStorage` **somente no navegador da demonstração** e segregação nominal por IES e curso, com filtragem por disciplina. Não confundir esse isolamento client-side com RLS/segurança institucional.
- A reutilização cria ID novo e cópia independente; editar a cópia da prova não modifica o conteúdo originalmente arquivado.
- Questões sem enunciado suficiente, com alternativas ou gabarito incompletos, rubrica ausente ou pontuação inválida são rejeitadas na gravação local.
- **Figuras ainda não podem ser arquivadas nesse banco demonstrativo**, pois o arquivo binário exige Storage privado e vínculo validado. Não salvar metadados de imagem sem binário recuperável.
- `question-bank.spec.ts` acrescenta teste de independência da cópia, isolamento por escopo e validações.

### Portões para o Banco de Questões institucional
- Criar tabelas privadas para identificador estável, versões, status, autoria, referências curriculares, mídia e auditoria de aprovação/rejeição.
- RPC autenticada com MFA/AAL2, segregação por IES, curso e docente. Controles de autoria e política de compartilhamento docente/coordenador.
- Busca autorizada por disciplina, temas, subtemas, competências, dificuldade, categoria da questão e exame.
- Permitir revisão/versionamento sem apagar exemplares usados em avaliações, com trilha imutável de origem da cópia.
- Medir frequência de reutilização e, futuramente, métricas de desempenho com amostras válidas, sem assumir equivalência automática entre contextos.
- Testar arquivos e direitos de uso no Storage privado.
- Homologar por perfil e aplicar em staging antes de qualquer publicação na produção.

### Observação regulatória e operacional
Não usar o Banco de Questões da prévia para materiais confidenciais ou como única cópia institucional. Ele fica no dispositivo do visitante e pode ser perdido se o armazenamento local for limpo. Nenhum dado é escrito no Supabase pela prévia pública.

**Preservar os adendos 001–028 sem exclusões.**
