# ENAMED 360° — Roteiro de homologação autenticada por perfil e isolamento multi-IES
**Data:** 17/11/2026. **Estado:** PREPARADO, NÃO EXECUTADO em sessões reais. Integração em PR #168 (draft).

## 1. Base técnica verificada
- Frontend `visibleTabs`: `enade` institucional disponível a Master, Reitoria, Direção, Gestor e CPA; Coordenação e NDE visualizam `trilhas-enade`, **não** `enade`. É comportamento de interface, não regra de autorização do banco.
- Supabase `public.vertice_learning_course_metrics` com RLS `learning_metrics_read`: leitura para membro institucional com papel autorizado ou, com `aal2`, escopo de docente ativo por `institution_id/course_id/subject_code`. `vertice_private.member_role` exige AAL2, inclusive Master.
- A tabela de indicadores estava vazia na última consulta: nenhum teste pode usar **zero linhas** como evidência de segregação RLS. É preciso criar **dados sintéticos em homologação isolada**, não contaminar produção.
- Testes SSR/menus e TypeScript automatizados não substituem sessão real com MFA/JS/browser.

## 2. Massa sintética de teste (somente homologação)
Preparar duas IES fictícias sem nome real, `IES-A` e `IES-B`; cursos `MED-A1`, `MED-A2`, `MED-B1`, disciplinas `DISC-01` e `DISC-02`; turmas/agrupamentos com pelo menos cinco estudantes sintéticos. Utilizar usuários de teste com MFA habilitada: Master, Reitor-A, CPA-A, Coordenador-A1, NDE-A1, Docente-A1/DISC-01, Usuário-B, Leitor-A. Não inserir CPFs ou nomes de pessoas reais.

## 3. Matriz de cenários a executar
| Caso | Perfil/condição | Operação | Esperado |
|---|---|---|---|
| ACL-01 | Master, MFA AAL2 | entrar em IES-A e consultar ENAMED | somente indicadores do curso/IES selecionados pelo filtro; sem mistura na mesma consulta |
| ACL-02 | Master, sem MFA AAL2 | consultar métricas restritas | acesso negado / ausência controlada, nunca exposição de dados |
| ACL-03 | Reitor-A, AAL2 | visualizar MED-A1 e MED-A2 | permitido dentro da IES-A |
| ACL-04 | Reitor-A, AAL2 | consultar MED-B1 de outra IES | negado por RLS |
| ACL-05 | CPA-A, AAL2 | visualizar dados agregados dentro de IES-A | permitido conforme política; ações financeiras/operacionais não autorizadas bloqueadas |
| ACL-06 | Coordenador-A1 | abrir ENADE 360 institucional | aba indisponível na navegação atual; decisão formal necessária antes de dar acesso por curso |
| ACL-07 | Coordenador-A1/NDE-A1 | acessar Trilhas ENADE e MED-A1 | só curso vinculado, sem MED-A2/B1; validar RLS específica de Trilhas |
| ACL-08 | NDE-A1 | tentar manipular ação institucional não aprovada | bloqueado; registrar tentativa e trilha |
| ACL-09 | Docente-A1, AAL2, escopo DISC-01 ativo | visualizar métricas DISC-01/MED-A1 | permitido apenas para escopo |
| ACL-10 | Docente-A1, sem AAL2 ou escopo inativo | visualizar métricas | negado |
| ACL-11 | Usuário-B, AAL2 | forçar URL/ID de IES-A | negado por RLS (IDOR cruzado) |
| ACL-12 | Leitor-A | acessar dados de competência protegidos | negado; sem dados de linha |
| ACL-13 | Usuário autorizado IES-A | alterar filtros do ENAMED sem recarregar | nenhum grupo de IES-B e nenhuma resposta de requisição antiga misturados |
| ACL-14 | Usuário autorizado IES-A | abrir em celular e desktop | navegação, contraste, tabulação, estados vazio/erro e recarregar painel funcionam |
| ACL-15 | Sessão expirada | consulta agregada, recarregamento | erro tratado, nenhuma persistência indevida de dados |
| ACL-16 | Aluno não conciliado | demanda de sincronização de desempenho | nenhum vínculo presumido, ausência != nota zero |

## 4. Procedimento de prova
Para cada caso registrar: perfil sintetizado, `institution_id`, `course_id`, disciplinas de escopo, AAL, URL/tela, data, request REST/Edge retornado **sem JWT, chave, CPF ou dados reais**, resultado esperado/observado, teste positivo/negativo, captura com dados sintéticos, logs e validação por responsável. Nunca transcrever tokens de sessão.

## 5. Bloqueios
- [ ] Ambiente de homologação isolado com autenticação e dados sintéticos preparados.
- [ ] Sessões AAL2 disponíveis para os perfis; nenhuma foi disponibilizada nesta conversa.
- [ ] Executar os 16 casos e obter evidências, inclusive negativos inter-IES.
- [ ] Decidir autorização e apresentação de visão restrita por curso à Coordenação/NDE, sem remover limites de RLS.
- [ ] Conferir latência e estados de erro e responsividade.
- [ ] Verificar ponte F&O→Vértice→Sapiens sintética e autorização de ações.
- [ ] Aceite assinado/registrado por responsáveis de segurança, pedagogia e gestão.

**Regra:** NÃO marcar esta matriz como homologada nem ampliar o acesso na produção porque os testes automatizados de front-end passaram.
