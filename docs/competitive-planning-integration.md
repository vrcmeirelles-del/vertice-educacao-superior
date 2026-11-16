# Inteligência competitiva no planejamento nativo

O portal existente oferece uma seção **Inteligência competitiva · mercado e ações do curso** no planejamento estratégico salvo. Usa a sessão Supabase/MFA e os mesmos IDs de instituição e curso. Não cria login, serviço, aplicativo ou agendamento.

## Fluxo e limites

1. Selecionar a IES e o curso nativo. Abrir uma versão salva do planejamento estratégico.
2. Configurar campus, nomes institucionais/marcas sem presumir equivalência, domínios oficiais exatos e critérios/relevância mínima.
3. Importar relatório JSON pela tela, ou pelo conector autorizado descrito abaixo. Cada item se vincula a um objetivo da versão salva, com snapshot do objetivo/indicador. O vínculo inicial é uma sugestão.
4. Gestor revisa o achado, a versão atual e o objetivo, escolhe opcionalmente uma meta/indicador nativo e decide. Para acolher, informa responsável, prazo, método e justificativa; custo é opcional e deve refletir uma decisão efetiva.
5. A decisão cria exatamente uma ação em `public.vertice_actions`, como `nao_iniciada`, progresso zero. Preserva evidência, origem e histórico. Não altera ou publica o plano, metas ou preços. A execução será acompanhada pelo módulo 5W2H existente.

Importações são imutáveis e idempotentes por `(IES,curso,external_key)`. A mesma chave/conteúdo é ignorada; conteúdo diferente com chave reutilizada é recusado. Uma retificação exige nova chave e descrição da condição anterior. Os eventos guardam ator, data, origem, evidência e decisão. Rejeição não apaga os achados. A revisão exige a revisão exata do plano salvo e recusa metas de outro curso. Achados não verificáveis não geram ação até nova evidência confirmada.

`baseline` significa referência inicial, não mudança histórica. `change` exige comparação documentada pelo monitoramento. O banco valida o contrato e o domínio da fonte; não comprova sozinho a veracidade do conteúdo. `kind=fact|inference`, `verification=confirmed|unverified`; impactos são apresentados como **[Inferência]**. Datas ausentes permanecem nulas; `document_on` não substitui `published_on`. A relevância mínima filtra a tela, sem apagar o histórico.

## Ponte para o monitoramento existente

O ChatGPT não é uma fonte automaticamente sincronizada. A rotina já existente “Concorrência Direito em Palmas” deve reutilizar a linha de base e só importar novos achados após pesquisa/comparação. Não criar outro agendamento.

Contrato JSON: `campus` (idêntico ao perfil), `plan_id` (versão salva da mesma IES/curso), `expected_updated_at` (revisão exata do plano salvo), `origin` (identificação e versão do relatório) e `findings` (1–100 itens, total até 1 MB). Cada item contém:

| Campo | Regra |
| --- | --- |
| external_key | Identificador estável do evento, até 200 caracteres; não usar nova chave para repetir o mesmo achado |
| competitor | Nome exato no perfil; marca/campus conferidos |
| title, current_condition | Título até 500 e condição documentada até 8.000 caracteres |
| previous_condition | Condição anterior documentada ou “Anterior não localizada” |
| event_type | baseline / change |
| kind, verification | fact / inference; confirmed / unverified |
| relevance | low / medium / high, conforme critérios do perfil |
| source_url | HTTPS em domínio oficial exato configurado; subdomínios não são herdados |
| consulted_on | Data real da consulta; obrigatória e não futura |
| published_on, document_on | Datas distintas; nulas quando ausentes |
| valid_from, valid_until | Datas anunciadas de vigência/prazo, nulas quando não publicadas |
| objective_index | Índice a partir de zero no plano salvo; apenas vínculo sugerido |
| limitations, impact, suggested_action | Limitações explícitas, hipótese de impacto e proposta para revisão |

A tela baixa um modelo conforme o curso/plano aberto. Para integração por conector de banco autorizado, usar:

```sh
node scripts/competitive-report-sql.mjs INSTITUTION_UUID COURSE_UUID < report.json
```

Executar o SQL produzido com `execute_sql` no projeto Supabase existente. A função `vertice_planning.ingest_competitive_report(uuid,uuid,jsonb,uuid)` é liberada somente para `service_role`/proprietário; deixa ator nulo para importação de sistema. Usuários do portal usam a RPC `public.vertice_competitive_intelligence` com operações `context`, `configure`, `import`, `approve`, `reject`; a autorização verifica MFA/papel/vínculo do curso em cada chamada. Não fabricar sessão JWT ou ampliar permissões para executar a rotina. Se o conector não estiver disponível, preservar o relatório e registrar o impedimento; nunca declarar sincronização realizada.

## Caso UNITOP / Direito

Instituição `1f5fd5b4-93c6-4626-834d-136884915587`, curso público/nativo `dfca6d07-fef6-4fa0-9475-3a85eaf4baa6`, código 027. A referência importada vem do relatório persistido `Concorrencia_Direito_Palmas_Linha_Base_20261115.json`, atualizado em 16/11/2026, e não representa nova pesquisa ou mudança histórica. Afya, CEULP/ULBRA (documentação usa CEULP, não CEUP), CESUP e UniCatólica são mantidas separadas. Não há alteração automática das condições comerciais da UNITOP.

## Verificação

`node --test scripts/tests/planning-runtime/*.test.mjs` testa as funções SQL reais em PostgreSQL isolado/PGlite: MFA, segregação por IES/curso, domínios falsificados, rollback atômico, imutabilidade, duplicidade, revisão, metas externas, revisão desatualizada e ação nativa não iniciada. Os testes React cobrem o fluxo humano, datas ausentes, fato/inferência, bloqueios e falhas. Dados e usuários são sintéticos; não há ações fictícias aprovadas em produção.

Publicação de código e persistência da importação devem ser verificadas separadamente em Render, `/version.json`, recursos JS/CSS servidos e banco. Uma sessão autenticada é necessária para homologação visual final no portal; testes simulados não comprovam essa etapa.
