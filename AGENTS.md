# Vértice — fonte única de código

- Este repositório (`vrcmeirelles-del/vertice-educacao-superior`) é a fonte ativa
  para o portal e seus módulos. Integre novas funcionalidades aqui.
- Não crie outro repositório, aplicativo, login ou serviço paralelo para uma
  funcionalidade da Vértice, salvo pedido explícito do usuário para separá-la.
- Preserve Supabase Auth, MFA, os vínculos institucionais e o projeto Supabase
  existente. Não substitua o banco por um banco temporário de outro provedor.
- A interface publicada é composta pelo pacote-base com `source-overrides/`.
  As migrações e os testes do Supabase ficam em `supabase/`.
- O planejamento usa os componentes nativos do portal e as tabelas já existentes
  em `vertice_app`. Não restaure a interface ou a API independente do snapshot.
- `archives/` preserva material histórico; não é fonte editável nem alvo de deploy.
- Antes de publicar, execute as verificações pertinentes à alteração e confira
  o serviço existente que atende `www.verticesuperior.com.br`.
- O programa de estudos Fato & Ordem é outro produto; esta regra de consolidação
  se refere à Vértice e não autoriza alterar o repositório do Fato & Ordem.
- Avalia 360°: antes de evoluir o módulo, leia
  `docs/avalia360/ROADMAP_INTELIGENCIA_PEDAGOGICA.md` (princípios, contratos de dados,
  o que está pronto e a ordem dos próximos blocos). A inteligência pedagógica é por
  algoritmo determinístico e regras versionadas, sem IA.
