# Área do reitor e cálculo de EBITDA

Público: `/reitor` (também `/reitor.html`). Cálculo rápido, detalhamento opcional da IES, conciliação, margem e indicadores por aluno. Os números públicos permanecem somente na memória da página; não são enviados nem salvos.

Reservado: `/reitor/reservado`. Após login e MFA, selecionar instituição e **Área do reitor · EBITDA**. Também há atalho **Calcular EBITDA** na lista de instituições. Acesso financeiro limitado a Master e Gestor, conforme vínculos atuais. Equipe, Leitor, visitantes e MFA aal1 não leem cálculos ou DREs.

Infraestrutura existente: mesmo Render Static Site e projeto Supabase. Nenhum novo projeto, plano ou serviço de IA. Nenhuma conta, senha ou dado institucional foi alterado.

A função `vertice-ebitda` autentica via `auth.getUser`, verifica o vínculo/MFA com RPC SECURITY INVOKER, recalcula pelo motor compartilhado e confere os bytes da DRE usando a RLS do usuário. Só depois utiliza credencial de serviço para inserir uma versão imutável. Resultados enviados pelo navegador não são aceitos. O gateway JWT fica desativado porque o corpo implementa sua própria autenticação, tal como a Biblioteca INEP; não retirar a verificação do corpo.

DREs no bucket privado `vertice-dre`, até 15 MB, PDF/XLSX/DOCX/CSV. Caminhos por instituição e usuário; sem acesso anônimo, substituição ou exclusão pelo cliente. Downloads autorizados recebem URL de 60 segundos e auditoria. Cálculos possuem trilha de auditoria e versões anteriores preservadas. A autenticação do site é independente da senha do módulo local de DD.

Migração aditiva gerada pela CLI: `20261101235047_reitor_ebitda_reserved.sql`. Aplicada e verificada por testes transacionais com rollback. O teste cobre tenant, MFA, Master/Gestor, bloqueio Equipe/Leitor, arquivo privado, upload inválido, instituição arquivada e imutabilidade. Testes da aplicação: 99 aprovados; validação TypeScript, build estático e preenchimento no navegador com dados fictícios. A área pública não possui input de upload; a reservada o possui.

O motor não é avaliação de preço nem IA e não extrai valores da DRE. CPC 06/IFRS 16 e projeções são identificados; períodos parciais não são anualizados. A margem depende de receita líquida positiva. O detalhamento gerencial não substitui silenciosamente a conciliação pela DRE.

Fonte deste release: `source-overrides/`, migração e função em `supabase/`. Os ZIPs anteriores são pacotes-base históricos. Para reproduzir o deploy, extrair `vertice-servidor-source.zip`, sobrepor integralmente `source-overrides/`, executar `npm ci --legacy-peer-deps`, `npm run check`, `npm test` e `npm run build:static`, exatamente como o comando existente do Render. Não publicar DREs ou dados de instituições dentro do código ou da pasta pública.
