# Cadastro e convites IES — integração para revisão

Base: `79f42f112350a5375ff3b66e6e556fcfe264ac13`. Branch local: `feature/ies-onboarding-cloud`.

## Comportamento

A rota `#ies=1` abre uma área própria antes de `OwnerDashboard` e `DemoTelemetry`. Um atalho nos painéis existentes aponta para `/master#ies=1`. A área usa a sessão e o MFA existentes, verifica o usuário confirmado e AAL2, e consulta `vertice_ies_my_context`. Não converte atribuições acadêmicas em memberships legados, não cria contas Auth e não envia mensagens.

Com o backend desativado, apresenta indisponibilidade sem permitir cadastro, revisão, emissão ou aceite. Não contém alteração de flags, migration ou integração documental. O SQL autoritativo foi recebido em sete partes de texto, conferidas individualmente e concatenadas com SHA-256 `dc9e62d5a0517c23c8035c03651d4a93f1c1e518d93db0b585f76f3558603c13`. Foi usado exclusivamente como referência local, fora do Git. A transferência do ZIP Library versão 2 falhou; o ZIP e seus testes/baseline não foram recuperados neste executor.

Fluxos implementados:

- Lista contextual paginada por UUID; superadmin preservado por leitura de `vertice_admins`, sem inferir acesso por memberships.
- Cadastro manual identificado como não verificado; revisão local antes do rascunho e decisão explícita sobre o detalhe retornado pelo servidor. Consolidação usa revisão otimista. Revisões recusadas de instituições existentes podem ser reabertas pelo contrato próprio.
- Convites por IES ou curso, perfis/capacidades múltiplos, revisão antes da emissão, listagem paginada e revogação. A seleção de perfis reduz ações na interface; a autorização efetiva permanece no backend.
- Aceite mediante preview confirmado, comparação de UUID, validade, confirmação explícita e nova consulta antes do aceite.
- Preferências opcionais por finalidade/canal a partir do contexto, usando a versão do aviso retornada pelo servidor. Avisos essenciais são separados.
- Decisão de alta gestão sobre dupla checagem por escopo explícito, aviso/versionamento do servidor, confirmação de risco e revisão otimista. Mostra que `document_adapter_ready=false`: a decisão não ativa nem protege documentos legados.

## Segurança de tokens e integração

`client/index.html` carrega `/ies-invitation-bootstrap.js` como script clássico bloqueante, no head, antes de qualquer módulo. O script captura e limpa fragmentos IES sincronamente. Tokens e UUID ficam somente em memória volátil. Fragmentos misturados com Master, academic ou Auth são rejeitados e limpos. Fragmentos exclusivos desses outros fluxos permanecem intactos. Parâmetros de convite em query string são rejeitados e removidos.

O token tem 32 bytes gerados por Web Crypto, codificados como 64 hex minúsculos; o hash SHA-256 é calculado sobre os bytes UTF-8 desse texto. Apenas o hash é enviado na emissão. O token segue somente nos corpos dos RPCs de preview/aceite e no fragmento do link entregue ao usuário. Não há localStorage/sessionStorage, logs ou analytics de tokens IES. Uma segunda defesa, `preAuthGuard.ts`, rejeita e limpa qualquer fragmento IES remanescente antes de `createClient` e da captura de callbacks; não aceita convites como fallback. `detectSessionInUrl` fica desabilitado nesse caso, inclusive com mistura de tokens Auth. O armazenamento de sessão Auth existente não foi modificado.

Compartilhar significa copiar por clique explícito. Não há wa.me, mailto com token, navegação de terceiros ou envio automático. O link pode ser ocultado e deixa de existir ao desmontar a tela. Logout, troca de conta, pagehide e saída do fluxo invalidam o segredo; respostas tardias de outra sessão/view são descartadas. Novos fragmentos na mesma página reinicializam o fluxo. Escritas concorrentes são bloqueadas pelo cliente e novamente pelo backend. O estado de escrita é compartilhado: a navegação interna e Fechar ficam bloqueados até a confirmação, preservando o link emitido. Logout de segurança continua disponível, com aviso de que uma operação admitida pode concluir e requer reconciliação. `pagehide` desmonta o workspace sincronamente antes do BFCache, removendo links emitidos do estado e do DOM; `pageshow.persisted` cria um workspace novo.

### Pontos de coordenação antes de publicar

1. Preservar a ordem do script de limpeza no HTML final/prerender. Integrá-lo antes do parser Master; este patch não contém código Master. O parser IES deixa Master-only intacto e rejeita misturas. Testar ambos juntos após o merge coordenado.
2. `App.tsx` tem alteração mínima de import, hook de rota, título/noindex, escolha antecipada da área IES e atalho. Resolver com cuidado mudanças concorrentes de roteamento.
3. `client/index.html` é um override novo derivado do pacote-base. Mesclar eventual alteração de branding/CSP/HTML do PR #7, preservando segurança, e reconstruir os artefatos finais.
4. `OwnerDashboard.tsx`, `main.tsx`, NewInstitutionForm, InstitutionBranding e toda a pasta `supabase/` permanecem inalterados. `lib/supabase.ts` tem somente o import da defesa pré-Auth e o gate de `detectSessionInUrl`; ao integrar Masters, executar essa defesa antes dos parsers de callback e de qualquer criação de cliente, sem transportar código Master. O cadastro IES não usa o formulário legado.
5. Não aplicar o SQL novamente. Não ativar `enabled`/`document_adapter_verified` nem conectar documentos como parte desta publicação.

## Reprodução

Extrair `vertice-servidor-source.zip` em uma pasta de build, sobrepor `source-overrides/` e copiar também `supabase/` da raiz do repositório (os testes existentes importam a função de demonstração dessa pasta). Executar:

```sh
npm ci --legacy-peer-deps --cache /tmp/vertice-ies-npm-cache
npm run check
npm test
npm run build:static
```

O cache local evita a falha de escrita no cache padrão deste executor. Não houve mudança de dependências ou lockfile.

Para QA de navegador, servir `dist/public` em localhost e executar `scripts/qa-ies.py` com Python Playwright e Chromium disponíveis. Variáveis opcionais: `IES_QA_ORIGIN`, `IES_QA_OUTPUT`, `IES_QA_CHROMIUM`. O script intercepta todo tráfego externo, usa contas/tokens fictícios e falha para RPCs não previstos. Nunca usa sessão real. Capturas são apenas evidência interna de QA.

## Evidência e limites

- Typecheck completo aprovado.
- 23 arquivos de teste, 193 testes aprovados, incluindo 54 testes IES novos.
- Build Vite e prerender completos aprovados: 12 páginas públicas e 18 áreas com noindex. Permanece aviso de chunks acima de 500 kB.
- 24 grupos de cenários de navegador aprovados (lista completa em `qa-ies.py`): desativado/mobile/teclado; cadastro/revisão/emissão/preferências/política; aceite/limpeza/memória/mobile; UUID divergente; convite expirado; e-mail não confirmado; contexto acadêmico sem membership legado; fragmento novo/fechar/reabrir; logout/resposta tardia; paginação anterior/próxima; falha de escrita sem confirmação; BFCache; script externo ausente; login sem sessão e MFA com falha/retry; privacidade por SPA; escrita confirmada seguida de falha/desligamento na consulta; desligamento durante mutação; erro de logout; troca de fragmento durante preview; reabertura confirmada seguida de falha; revogação distinguível por curso; bloqueio de navegação durante emissão; saída de segurança durante cadastro pendente.
- Conferência visual em Chromium, 390px e 1280px. Não equivale a auditoria completa de acessibilidade ou teste em todos os navegadores.
- Mocks não validam Auth/MFA real, revogação de sessões, RLS, Storage, concorrência do banco ou instalação do backend. Não houve chamada de escrita a produção, convite real, merge, push ou deploy.
- Não há consulta automática a uma API oficial e-MEC. Referências fornecidas são texto não verificado.
- Cursos usam o contrato de busca com limite 100. A emissão permite refinar a busca; a política mostra a limitação e não permite escolher cursos ausentes. Cadastro de adoção de IES legada (`register_existing`) e administração/revogação de atribuições já aceitas não têm tela nesta entrega; o foco é cadastro novo, revisão e convites.
- Publicação depende da revisão coordenada dos arquivos e da autorização específica exigida pelo fluxo GitHub. Recurso deve permanecer desativado.

## Correções da revisão de ciclo de vida

- `feature_disabled` é propagado por qualquer RPC: limpa o contexto, remove os formulários e bloqueia novos transportes. Não afirma que escritas anteriores foram desfeitas.
- Registro/reabertura e consulta posterior são etapas separadas. UUID e revisão confirmados ficam em memória, sem permitir reenvio cego; a consulta pode ser retomada. Se o recurso for desligado, a tela informa a última escrita confirmada.
- O aceite fixa o objeto/token da tentativa e compara sua identidade com o vault após o preview; uma troca de fragmento invalida a tentativa e exige nova revisão explícita.
- A lista/confirmacão de revogação mostra instituição, curso (ID como fallback fora do lote), perfil, composição e UUID do convite.
- A política de escopo nulo é chamada de **Padrão institucional**. Reativá-la não remove dispensas específicas por curso, que têm precedência no backend.
- O gate de rota observa eventos pushState/replaceState usados pelo Wouter, além de hashchange/popstate. Sair por privacidade limpa o convite.
- Mudanças de sessão reinicializam busy/lock do MFA com proteção por epoch. Erros de logout são reportados mesmo se o SDK encerrar a sessão local antes de retornar o erro; caso retenha a sessão, há reentrada explícita com uma API nova.

A lista sensível do bootstrap externo e da defesa pré-Auth inclui também `code` e `token_hash`. Misturas com IES em query ou fragmento são rejeitadas e limpas; links exclusivos de Auth permanecem intactos. A correção foi coberta por testes unitários e quatro combinações adicionais no navegador, com zero chamadas de Auth/telemetria.
