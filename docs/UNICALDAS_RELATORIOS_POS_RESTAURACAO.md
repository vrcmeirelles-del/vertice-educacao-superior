# UNICALDAS: recebimento dos resultados pós-restauração na Vértice

## Situação atual

O backup original UNI_GIZ (.bak) está recebido no cofre privado da UNICALDAS e a restauração em SQL Server isolado foi solicitada. **O SQL Server de homologação e a restauração ainda não foram executados por este fluxo.**

A nova seção **Conferir relatórios das 642 tabelas**, na aba **Backups Acadêmicos**, recebe apenas os dois relatórios estruturais gerados depois da restauração:

- `00_manifesto_conciliacao.json`
- `02_642_tabelas.csv`

Ambos são gerados pelo script `UNICALDAS_exportar_validacao_642.ps1` do pacote na pasta `CLIENTES/UNICALDAS/Migração/Validacao_Tecnica_2026-11-06` do OneDrive.

## Fluxo de uso

1. Executar o BAK original com os scripts de inspeção/restauração em SQL Server **isolado**. Exigir o banco `UNI_GIZ_HOMOLOGACAO` em modo `READ_ONLY`.
2. Executar o script de conciliação da lista de 642 tabelas. O script deve produzir cinco CSVs de resultados e um manifesto JSON com SHA-256 de cada arquivo.
3. Abrir Vértice → UNICALDAS → Backups Acadêmicos → Conferir relatórios das 642 tabelas.
4. Enviar os dois arquivos acima e pressionar **Conferir relatórios sem publicar no BI**.
5. O navegador verifica o hash do CSV contra o manifesto, o hash do SQL autorizado, o conjunto exato dos 642 nomes, duplicidades, situações e totais.
6. Pressionar **Registrar pré-análise com evidências no cofre privado**. Os arquivos serão mantidos no bucket privado `vertice-validacoes-ies` segregado por IES e ID do relatório.
7. Uma função de servidor com JWT e MFA consulta as evidências e verifica os hashes novamente antes de marcar como **evidências recebidas**. O estado de revisão fica sempre como **pendente de análise técnica**.

## O que este fluxo não faz

- Não restaura o arquivo BAK no Supabase, Render ou no navegador.
- Não envia arquivos .BAK, .RAR, MDF/LDF nem dados pessoais ao módulo de análise.
- Não certifica que a base SQL Server foi restaurada corretamente, porque o manifesto é originado no laboratório e ainda exige auditoria independente.
- Não calcula número de alunos a partir das linhas das tabelas.
- Não homologa ou publica indicadores no BI.
- Não transfere registros entre UNICALDAS e outras IES.

## Evidências e segurança

Banco: `public.vertice_backup_structure_checks`, RLS por IES/MFA, sem UPDATE de aprovação pelo navegador. Arquivos: bucket privado `vertice-validacoes-ies` com apenas JSON/CSV técnico, sem DELETE/OVERWRITE de evidências. A migração também corrige a política de solicitações de restauração para comparar explicitamente o ID da instituição externa com a instituição do backup.

Se a confirmação falhar, o registro fica **aguardando arquivos**; não considerar o processo concluído nem publicar no BI. Solicitar auditoria manual do registro e do conteúdo no Supabase.

## Próxima etapa não executada

Disponibilizar SQL Server Developer ou Express em laboratório (sem contratar novos serviços sem autorização), executar `RESTORE HEADERONLY`, `FILELISTONLY`, `VERIFYONLY` e a restauração, comparar os relatórios com o catálogo e só então definir regras de métricas acadêmicas e homologação.
