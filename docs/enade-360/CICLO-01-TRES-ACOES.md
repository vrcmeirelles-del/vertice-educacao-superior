# CICLO 01 — Três ações para o ENADE 360°
Data: 2026-11-17 | Status: análise do código versionado, sem consulta ao banco de produção.

## Ação 1 — Confronto com estrutura existente
Fontes efetivamente lidas do repositório:
- `supabase/migrations/20261107200000_enade360_continuous_quality.sql`: `public.vertice_enade360_records` com `institution_id`, `course_id`, validação, vínculo composto com `vertice_courses(id,institution_id)`, e RLS via `vertice_private.can_read_institution` e `has_role`.
- `supabase/migrations/20261107203000_enade360_mirror_read.sql`: leitura institucional de agregados `vertice_eorbit_enade`.
- `supabase/migrations/202610300001_area_real.sql`: `vertice_memberships`, `vertice_private.member_role/has_role`, MFA `aal2`, papéis `master/gestor/equipe/leitor` em parte da arquitetura.

Achado verificável: há base por curso e FK composta, mas a política `enade360_read` consultada autoriza por instituição e lista `gestor,equipe,reitor,diretor_geral,diretor_pedagogico,procurador,cpa`; **não incorpora um predicado de autorização por curso**. A regra documentada de restringir Coordenação/NDE ao curso ainda precisa de modelagem e teste. Não equiparar automaticamente os papéis de negócio MASTER/REITORIA/COORDENACAO/NDE/CPA aos nomes persistidos no banco.

Limite: esta é uma inspeção da migração no repositório. Não foi confirmado quais migrações estão efetivamente aplicadas, nem o schema, funções e policies existentes no banco conectado.

## Ação 2 — Contrato da migração reversível (não executada)
Princípio: extensão aditiva do modelo existente; NÃO substituir `vertice_enade360_records` nem alterar sua RLS sem homologação. Destino futuro sugerido: schema privado `vertice_enade_audit` com `streams`, `events`, `sources`, `decisions` e `course_grants`; compor FK de `course_id/institution_id` com `vertice_courses` após checar PK/unique reais; eventos append-only e consultas `security invoker` ou backend sujeito a autorizações.
Portas de pré-migração: snapshot do schema, consulta de policies/grants, compatibilidade de tipos de coluna, banco de testes isolado, backup/restauração, plano de reversão, verificação de acessos e auditoria por tenant. Evitar DROP em produção; reversão é desligar novos leitores/escritores e restaurar a versão anterior do serviço, preservando eventos.

Nenhum arquivo de migração executável com numeração de produção foi criado: é preciso gerar a migração pela CLI suportada quando houver ambiente e aprovação. **Nenhuma DDL foi aplicada.**

## Ação 3 — Testes de contrato de permissões
Matriz de casos documentada: Master com concessão explícita; Reitoria somente IES; Coordenação/NDE somente curso; CPA agregados autorizados; sem papel não tem leitura; pessoa sem MFA não deve ter autorização; evidências pessoais excluídas sem base de acesso específica; publicação não autorizada mesmo após parecer.
Os testes executáveis de simulação não provam RLS. A validação definitiva precisa de sessões reais e da base de autorização.

## Pendências
P-SCHEMA-REAL-001: conferir esquema efetivo do Supabase, funções e políticas atuais, sem alterar dados.
P-ACCESS-001: mapear papéis efetivos para perfil de negócio e vínculo por curso, validar MFA e RLS em ambiente isolado.
P-TRACE-001: migração, persistência, encadeamento e prova de integridade reais.
P-API-001: consultas autenticadas e somente leitura.
P-ZIP-001, P-REF-001, P-NT-001, P-TOL-001 preservadas.
O núcleo científico segue NÃO HOMOLOGADO.
