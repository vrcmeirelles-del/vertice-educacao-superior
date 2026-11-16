# PR #157 — correções da revisão técnica

Estado em 16/11/2026: seis achados corrigidos na branch da mesma PR, com validação local. Sem merge, migração remota, publicação ou geração com provedores reais. A autorização para corrigir a proposta não autoriza essas operações de implantação.

## Achados e correções

| Achado | Alteração | Evidência local |
| --- | --- | --- |
| R1 — contexto escolar perdido | A RPC preserva `school_operations_context` e o recorte por ano | Teste executa o bloco real de integração da migração anterior, com dados operacionais sintéticos, e compara antes/depois |
| R2 — cargas futuras sem semestre observado | O histórico aplica o teto observado também quando o semestre automático é nulo | Curso sem semestre observado e com carga futura mantém histórico observado vazio |
| R3 — confirmação permanece após troca de indicador | Vínculo guarda `indicator_snapshot`; validade compara objetivo e definição; criação bloqueia a meta e exige revisão/definição carregadas | Troca de indicador, unidade, direção, fórmula/população invalida vínculo; confirmação desatualizada é recusada; novo vínculo preserva o anterior encerrado |
| R4 — aferição antiga no alvo oculta lacuna | A falta de aferição após o vencimento independe do resultado numérico antigo | Valor antigo igual ao alvo produz lacuna; medição posterior elimina essa lacuna |
| R5 — campos estratégicos não conferíveis | Catálogo tem fonte para cada campo estratégico, além dos objetivos individuais, com valor/versão/data congelados | SWOT, riscos, objetivos operacionais e visão recuperados do catálogo |
| R6 — tendência com números indisponíveis | Exige campo numérico declarado, três observações elegíveis da mesma série e justificativa de comparabilidade | Recusa nulos, ausência de fonte, duplicidades, futuro, curso ambíguo e mistura de grupos; preserva zero observado |

A interface apresenta a definição atual do indicador, a definição confirmada anteriormente e o motivo da revisão do vínculo. Para tendências, apresenta o campo numérico e a comparabilidade declarada. Comparabilidade declarada pela IA não equivale a certificação histórica da população ou fórmula.

O workflow existente inclui os testes PostgreSQL de planejamento uma vez, na matriz Node 24, com novos filtros de caminhos. Não foi criado workflow paralelo.

## Validação

- 15 testes de regras, fontes e motor.
- 7 testes da interface interpretativa.
- 25 testes das regressões relacionadas.
- 10 testes PostgreSQL/PGlite.
- **Total: 57 testes locais aprovados.**
- TypeScript completo do portal e TypeScript estrito de `planning.ts`/`interpretation.ts` aprovados.
- Build estático aprovado, mantendo o aviso de chunks grandes.
- O aviso do mock `maybeSingle` no ReitorBI permanece; não foi apresentado como evidência de falha no serviço publicado.

As instruções reproduzíveis estão em [TESTES_INTERPRETACAO.md](TESTES_INTERPRETACAO.md). Não há alegação de CI remota aprovada. O commit de correção usa `[skip ci]`; os comandos acima foram executados localmente.

## Migração preparada

A migração `20261116004315_planning_interpretation_traceability.sql` continua sem aplicação remota. Ela foi corrigida antes de qualquer aplicação, incluindo a coluna obrigatória `indicator_snapshot` e a função privada `indicator_definition`. O SQL e seu checksum precisam ser reapresentados na autorização final.

Os atributos materiais comparados são indicador, unidade e direção; fórmula e população entram quando esses campos existirem no cadastro. A leitura desses campos opcionais usa JSON e não acrescenta colunas à tabela de metas. Alvo, título, prazo e progresso não mudam, por si sós, a definição do indicador. Esses cadastros continuam sem reconstrução histórica completa.

## Implantação e reversão ainda pendentes

Antes de solicitar autorização de implantação, concluir o pacote operacional: recapturar definições/ACLs/triggers atuais, resolver a correspondência do histórico de migrações, confirmar o serviço do domínio canônico, preparar e ensaiar a migração compensatória e definir o controle de ativação do piloto. **Estas correções não acrescentam uma chave de ativação por IES/curso; esse mecanismo permanece pendente de preparação antes de uma liberação por piloto.**

A proposta de execução, somente após autorização expressa, mantém esta ordem:

1. Conferir o novo SHA, o SQL exato, seu checksum, os serviços atingidos e a baseline de recuperação; registrar a autorização e seu escopo.
2. Suspender a publicação automática dos serviços existentes `vertice-educacao-superior` e `vertice-portal`, ambos vinculados à main, antes de integrar o commit aprovado.
3. Integrar apenas o SHA aprovado; aplicar exclusivamente a migração revisada, por executor transacional, sem sincronização indiscriminada das migrações antigas.
4. Publicar a função existente `vertice-sapiens-analyze`, incluindo `index.ts`, `planning.ts` e `interpretation.ts`, preservando Auth e verificação de JWT.
5. Publicar no serviço existente autorizado para a homologação e executar os fluxos reais de acesso, geração, contraditório, fontes, histórico e revisão humana.
6. Liberar os demais serviços expressamente incluídos somente após os critérios aprovados; conferir versão publicada e restaurar a política de publicação automática aprovada.

A reversão deve fechar a ativação da versão nova, restaurar os pacotes anteriores de portal e Edge e restaurar, por migração compensatória, as três funções substituídas (`management`, `sapiens`, `sapiens_module_context`) com suas ACLs. Preservar os pareceres e vínculos gerados, manter privados os helpers novos e considerar também `indicator_definition` na conferência de permissões. As novas FKs podem afetar exclusões; sua remoção compensatória, quando necessária para recuperar a semântica anterior, precisa ser enumerada e ensaiada, preservando os dados. Não confundir reparo do registro de migrações com reversão de SQL.

O ensaio anterior da revisão cobriu a restauração das três funções e preservação dos registros em PGlite. A reversão completa de portal/Edge, compatibilidade da interface anterior com pareceres v2, recuperação física e remoção de FKs continuam sem homologação. Também permanecem pendentes provedores reais, latência, volumes institucionais e sessões reais de todos os perfis. PDI estruturado e deliberação automática continuam fora do escopo.
