# Base regulatória e-MEC

A área institucional inclui consultas datadas com versões imutáveis, origem, cobertura declarada e lacunas. A importação não é um crawler e não implica sincronização automática.

## Contrato de importação v1

JSON UTF-8 até 2 MB, 1 a 5.000 registros. Campos: `version:1`, `emec_code` (string igual ao cadastro), `source_url` (HTTPS em emec.mec.gov.br), `consulted_on` (YYYY-MM-DD), `coverage` (`partial` ou `complete`), `gaps` (strings) e `records`. Uma consulta parcial exige lacunas; completa não aceita lacunas. Cada registro tem `kind`, `key`, `title`, `data` (objeto). Tipos: institution, course, indicator, act, process, occurrence, address, attachment, alert. Chave única por tipo, estável entre consultas; preserve o código externo, quando existir. `original_text` opcional preserva a transcrição integral no JSON exportado. Não coloque segredos ou dados pessoais de estudantes.

Conceitos SC, valor ausente e zero são distintos. Registre ano, curso, modalidade e fonte específica nos dados quando disponíveis. Não deduza encerramento de processo, perda de credenciamento ou vigência de cautelar a partir de uma data isolada. A cobertura completa é declaração do importador, não certificação automática.

A prévia mostra registros novos, alterados e ausentes. A importação preserva todo o JSON e não sobrescreve cursos internos. `vertice_emec_import` valida instituição, origem, data, registros e cobertura no servidor; serializa por instituição, detecta concorrência por revisão esperada e retorna a mesma versão em reenvios de conteúdo idêntico. SHA-256 calculado pelo PostgreSQL sobre JSONB. Acesso de leitura segue `can_read_institution`; importação exige gestor/master e instituição ativa. Usuários autenticados não têm INSERT, UPDATE ou DELETE direto na tabela.

## Aquisições e valuation

A Base da organização e o formulário de valuation mostram a última consulta. O responsável pode inserir a identificação da versão nas premissas, que são persistidas com o cenário. Não há desconto financeiro automático por conceito ou alerta.

O módulo de aquisições recebe a consulta apenas por associação institucional explícita (`dd_matters.institution_id` ou `vertice_base_matter_links`) e mediante RLS tanto do mandato quanto da instituição. O vínculo não concede acesso. Inclui a aba e-MEC, referência opcional nas limitações de preço e dados na exportação para análise futura. Nenhum dado é enviado a IA pela importação. A consulta ao vivo não altera hashes ou pareceres previamente assinados; referências salvas identificam a versão usada. O responsável deve revisar atualização da fonte antes de decidir.

## Publicação e validação

Aplicar a migration em `supabase/migrations/20261103005635_emec_regulatory_snapshots.sql`; publicar `vertice-aquisicoes-green` com todos os arquivos relativos, mantendo sua autenticação existente; publicar os overrides com o build habitual no Render.

Verificações: TypeScript; build estático; 11 testes de contrato/diff (`npx vitest run server/emec.test.ts`); transações com rollback no banco para acesso autorizado, idempotência, versão incremental, conflito de revisão, rejeição de código divergente, leitura vazia e escrita recusada para usuário sem vínculo. O piloto UNICALDAS é carregado como dados operacionais, separado da migration e do repositório. Seus limites permanecem visíveis, inclusive divergências no número de graduações e falta de anos dos conceitos por curso.
