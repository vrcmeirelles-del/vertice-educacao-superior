# Gestão nativa da Vértice Escolas

O Workspace usa o mesmo repositório, autenticação, MFA, identidade visual, metas, ações, governança, documentos e integrações já existentes. Os formulários institucionais de planejamento escolar não dependem de curso superior nem criam cursos artificiais.

## Novos acessos

- Planejamento Estratégico: identificação da direção, visão, SWOT, análise competitiva, objetivos, riscos, ações e alinhamento PPP/Plano de Gestão.
- Planejamento Semestral: prioridades, calendário, atividades/responsáveis/datas/situações, metas e recursos.
- Consolidação Escolar: versões dos planejamentos, metas, 5W2H e referência ENEM da própria escola; ausências e rascunhos explícitos.
- BI executivo e BI do Reitor encaminham a aba Estratégia e execução ao componente escolar quando tier=escolas.

A tabela versionada fica em vertice_planning.school_plans. O acesso ocorre exclusivamente pela RPC vertice_school_planning, com verificação institucional/tier e papel de alta gestão, usando o mesmo controle MFA-aware do portal. DML direto da tabela não é concedido a clientes. Publicações são explícitas; editar uma versão publicada cria novo rascunho. Alterações concorrentes são rejeitadas.

## Limites

Nenhum plano escolar foi preenchido automaticamente. A validação utilizou a escola demonstrativa existente, sem cursos; os testes de escrita foram revertidos em transação. Metas e ações permanecem registros atuais, enquanto ENEM usa seu ano de referência. Ausência de dados não equivale a zero; o ENEM só é pertinente às etapas escolares ofertadas. Análise interpretativa por IA, alinhamento automático de objetivos/indicadores, gestão financeira de orçamento aprovado e vínculo documental automático ao PPP não são implementados por esta entrega. TCC, estágio superior e instrumentos MEC de IES não são replicados como ferramentas escolares.

## Verificação

Build estático e testes de planejamento superior, escolar e navegação; transações para criação, publicação, nova versão e conflito; bloqueio sem sessão, sem vínculo e para instituição superior. Revisão visual pós-publicação deve verificar menus, planejamento sem cursos e consolidação sem dados artificiais.
