# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 021 — Prévia interativa isolada publicada no Render
**Data local:** 2026-11-19, 22h35 aproximadamente (20/11 UTC) | **PR:** #207, rascunho

### Requisitos preservados
Todos os adendos 001–020 permanecem vigentes. A publicação da prévia é exclusivamente demonstrativa e não altera produção nem substitui homologação de autenticação, Storage e PPC.

### Publicação efetivamente realizada
- Serviço novo no Render: `vertice-avalia360-homolog`.
- Workspace: `Virgílio Meirelles | Projetos` (`tea-d925voi8qa3s73csvir0`).
- Service ID: `srv-dbvq79f40ujc73eha49g`.
- Endereço: https://vertice-avalia360-homolog.onrender.com
- Repositório: `vrcmeirelles-del/vertice-educacao-superior`.
- Branch: `feat/avalia360-motor-longitudinal-v1`.
- Deploy ID: `dep-dbvq79n40ujc73eha4l0`.
- Commit implantado: `c7247be5d11c47ee9acb30acdcbf86c3b5680398`.
- Render informou `status=live`, `finishedAt=2026-11-20T01:34:52.739303Z`.
- Logs: `✓ 36 modules transformed`, `✓ built in 848ms`, `Your site is live`.
- Auto deploy desativado (`autoDeploy=no`) para impedir mudança involuntária da prévia a cada push.

### Segurança da demonstração
- Entrada HTML isolada: `source-overrides/preview-avalia360/index.html` com metadados `noindex,nofollow` e aviso visível de demonstração.
- Configuração Vite: `source-overrides/vite.avalia-preview.config.ts`, substitui `@/lib/supabase` por `preview-avalia360/mock-supabase.ts`, impedindo o frontend da demonstração de usar a conexão normal ao Supabase da Vértice.
- A interface real `Avalia360Studio.tsx` é renderizada com `previewMode=true`; dados demonstrativos de cursos e IES fictícia.
- O adaptador simula RPCs de rascunhos e tickets de mídia; metadados de rascunho são gravados em `localStorage` do próprio navegador. **Nenhum dado é enviado à plataforma Vértice, Supabase ou ao Fato & Ordem.**
- O upload é simulado localmente; o arquivo binário não é armazenado permanentemente. Fotos e figuras só são exibidas na sessão do navegador, e após recarregar a página os anexos persistidos mostram os metadados, não a imagem real.
- Não exige login real ou MFA; **NÃO é homologação de produção**.

### Limitação de verificação de disponibilidade externa
- A API do Render confirmou serviço `live`, URL criada, build e publicação bem-sucedidos.
- Ferramentas de acesso HTTP independentes não conseguiram resolver/acessar o domínio nesta sessão; por isso, a experiência real em dispositivo externo e o funcionamento completo de cada interação precisam de confirmação pelo usuário no navegador.
- Não confundir status de deploy publicado com homologação end-to-end no aplicativo.

### Fluxo visual para validação
1. Abrir https://vertice-avalia360-homolog.onrender.com
2. Selecionar curso demonstrativo de Direito, disciplina Direito Civil, título e semestre.
3. Adicionar questão objetiva, alternativas, gabarito, pontuação.
4. Adicionar questão discursiva com rubrica.
5. Anexar imagem PNG/JPEG/WebP com posição, legenda, descrição e direitos.
6. Pré-visualizar caderno.
7. Guardar rascunho local e consultar pelo identificador no mesmo navegador.

### Critérios pendentes
- [x] Endereço de demonstração publicado em serviço Render independente.
- [x] Build de Vite da prévia concluído.
- [x] Isolamento do cliente Supabase por mock explícito na configuração do build.
- [ ] Teste de navegação no dispositivo do usuário e aprovação visual/pedagógica.
- [ ] Autenticação verdadeira e MFA/AAL2 em staging Supabase.
- [ ] Storage de imagens real, URL temporária de download e reabertura editável de figuras.
- [ ] Integração ao PPC real e competências aprovadas por curso.
- [ ] Correção, exportação, QR/OMR e devolutivas.
- [ ] Merge da PR #207 e publicação no portal oficial — NÃO realizados.

**Nunca usar a URL de demonstração como comprovação de dados persistidos ou de controle efetivo de acesso por IES/curso.**
