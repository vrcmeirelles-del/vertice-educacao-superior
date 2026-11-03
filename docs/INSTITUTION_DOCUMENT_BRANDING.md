# Identidade institucional — entrega para revisão

Base: `79f42f112350a5375ff3b66e6e556fcfe264ac13`, main revalidada em 03/11/2026.
Branch: `feature/institution-template-branding-cloud`.
Reconstrução a partir do remoto, sem arquivos do desktop e sem acesso a documentos/credenciais de produção.

## Comportamento

- `document_branding` nullable, com `header_text` até 600 caracteres, `theme_color` HEX/null e `logo_data` PNG 300×120/null. Entrada PNG/JPEG até 2 MB; SVG recusado. A imagem é decodificada e normalizada no navegador com proporção preservada, sem metadados da origem.
- Editor independente para IES existentes. Gestor/master com MFA podem editar; equipe/leitor vinculados consultam sob as regras RLS existentes (inclusive MFA). Sugestão de cor é opt-in. HEX e seletor continuam editáveis. O texto temático é ajustado para contraste 4,5:1 sobre branco; preenchimentos de estilos explicitamente aprovados usam texto preto/branco contrastante.
- Prévia de cabeçalho com 25% logo/75% texto; não representa paginação. IES é chave do componente; cargas, imagens, saves e downloads obsoletos são descartados. O RPC exige `expected_updated_at`, comparado atomicamente. Um trigger mantém versão estritamente crescente.
- A biblioteca envia bytes em memória após autorização por sessão/RLS, verificação SHA-256 e auditoria. DOCX sem preparação, PDF e XLSX são devolvidos byte a byte originais. O cliente ainda entende a resposta antiga de URL assinada para compatibilidade de implantação.
- DOCX preparado exige caminho separado `<institution_id>/templates/<template_sha256>.docx`, hash do template, hash da fonte igual ao cadastro e referência editorial. A fonte atual também é baixada e verificada antes da personalização. Falha de hash/revisão/auditoria impede a entrega. Nenhuma cópia personalizada é salva no Storage.
- Cor somente nos estilos enumerados; cores semânticas, formatação direta, corpo, fontes, gráficos, imagens e rodapés não aprovados permanecem preservados. Todas as cópias partem do template imutável, evitando cabeçalhos acumulados.

## Alcance exato das cores

| Elemento | Suporte neste patch |
| --- | --- |
| Texto do cabeçalho gerado | Cor institucional ajustada para contraste sobre branco |
| Faixa/fundo do cabeçalho | Não é criada nem colorida automaticamente |
| Estilo de parágrafo/caractere listado | Cor de texto e sombreamentos `w:shd` daquele estilo |
| Estilo de tabela listado | Preenchimento de célula definido no estilo (`w:tcPr/w:shd`) e cor de texto herdada, sem alterar o corpo |
| Preenchimento direto de célula/trecho no corpo | Preservado; não há seletor de células nem substituição global |
| Alerta/estilo não marcado | Preservado |

A fixture inclui uma tabela `InstitutionTable` aprovada com uma célula temática e outra célula com alerta vermelho direto não marcado. Os testes confirmam corpo byte a byte e cor vermelha intactos; a renderização confirma célula temática laranja/amarela, conforme HEX, ao lado do alerta vermelho. A variante sem cor conserva o preenchimento azul original do estilo. Na revisão, migrar editorialmente campos que precisem de tema para estilos apropriados; este mecanismo não promete colorir toda formatação direta existente. A ordenação XML de `w:rPr` foi validada antes de `w:tcPr`/propriedades de tabela.

## Segurança e integração pendentes

**Não aplicar nem publicar automaticamente.** `supabase/review/institution_document_branding.sql` é SQL de revisão, intencionalmente fora de `migrations/`. Após a revisão e conciliação, gerar a migração pela CLI, revisar os grants e aplicar na ordem coordenada: banco, função, frontend. Não houve deploy, merge, alteração de dados reais, habilitação de arquivo ou política de Storage nova.

O RPC público é SECURITY INVOKER e chama uma função privada SECURITY DEFINER com UID/MFA/papel explícitos, search_path vazio e controle de versão. A revogação de UPDATE da tabela é seguida de grants por coluna para manter as permissões anteriores, exceto `document_branding`; revisar esta lista com quaisquer colunas novas das outras frentes. INSERT de IES permanece sujeito à política master existente. A auditoria não armazena logo/texto.

O banco valida estrutura JSON, tamanho, assinatura/dimensões/chunks/CRC PNG; a decodificação integral do fluxo PNG e sua regravação sem metadados ocorrem no download, antes da entrega. Um PNG malformado forjado diretamente no RPC que passe as verificações estruturais falha fechado no decodificador. Não afirmar que PostgreSQL faz decodificação raster completa.

`NewInstitutionForm` pertence **somente ao cadastro legado**. A frente IES usa rascunho privado por `vertice_ies_register(name, emec, source_reference)` e aprovação por `vertice_ies_review_registration(uuid, approve)`. Se essa jornada estiver ativa, preservar suas RPCs: não usar `saveRow` direto nem adicionar branding ao rascunho. Após aprovação, o editor independente atende a IES criada. Não foram implementadas/ativadas flags de IES, Masters, convites ou e-MEC.

Pontos de conciliação:

- `OwnerDashboard.tsx`: troca pequena do formulário legado; a seleção da jornada nova pertence ao integrador.
- `Workspace.tsx`: import + editor independente, sem alterar cadastro regulatório.
- `RecordForm.tsx`: `children?: ReactNode`, `submitDisabled?: boolean` e guarda de submissão.
- `source-overrides/package.json`/lock: apenas `jsdom@26.1.0` como devDependency para testes de troca de IES; nenhuma versão de dependência anterior mudou. Reconciliar com as outras frentes, sem substituir seu lockfile cegamente. Sem alteração em vitest.config.ts.
- `InepLibrary.tsx`/Edge Function: contrato adicional de resposta binária; usar ambos na integração.

Limites: testes Auth/Storage HTTP usam clientes sintéticos; PostgreSQL real descartável executou as funções/políticas com helpers de claims compatíveis. Não houve login real nem teste ponta a ponta contra o Supabase hospedado. A renderização foi validada em LibreOffice 7.4 com fixtures; arquivos reais e outros editores ainda exigem revisão editorial/visual individual. Os 420 registros e placeholders não foram classificados como templates por este patch.

## Preparação offline

`scripts/branding/prepare-template.ts` não acessa Supabase. O manifesto exige:

```json
{
  "classification": "reviewed-template",
  "source_sha256": "<sha256 exato do mestre original>",
  "review_ref": "<referência da revisão editorial>",
  "replace_headers": ["word/header1.xml"],
  "clear_footers": [],
  "theme_style_ids": ["InstitutionAccent"],
  "preserved_parts_review": {"docProps/core.xml": "<sha256 do part revisado>"},
  "remove_parts": []
}
```

`preserved_parts_review` precisa enumerar por hash todos os docProps, mídias e embeddings da fonte, inclusive itens cuja remoção foi explicitamente aprovada. É uma declaração editorial, não um detector de marcas. Opcional `remove_parts` foi acrescentado para remover somente metadados ou mídias órfãs aprovados; uma mídia ainda referenciada pelo documento é recusada. Não há substituição de nomes no corpo. Rodapés só são esvaziados se listados. Documentos com conteúdo ativo, assinatura digital ou recursos externos não suportados são recusados.

Os cabeçalhos listados precisam já existir e ter referências no documento. Templates sem esse espaço devem passar por preparação editorial adicional, evitando reescrever o corpo automaticamente. Revisar conteúdo institucional substantivo, direitos, mídia antiga, primeiras páginas/cabeçalhos pares e ímpares e metadados antes de liberar qualquer cópia.

```sh
DENO_DIR=/tmp/vertice-deno-cache deno run \
  --allow-read=/caminho/entrada --allow-write=/caminho/saida-nova \
  scripts/branding/prepare-template.ts \
  /caminho/entrada/fonte.docx /caminho/entrada/revisao.json /caminho/saida-nova
```

A pasta de saída deve ser nova. A ferramenta cria `<hash>.docx` e `review.json` exclusivamente, sem sobrescrita. Repetir na mesma pasta falha com `AlreadyExists`; isso foi testado. O resultado é **preparado, não publicado**. Upload e associação no catálogo dependem da revisão posterior; nenhum comando deste pacote faz isso.

## Reprodução e resultados

Ferramentas usadas: Node 24, Deno 2.9.6; dependências npm do processamento fixadas no código e no `supabase/functions/vertice-inep-library/deno.lock`. Fonte reconstruída em diretório separado:

```sh
unzip -q vertice-servidor-source.zip -d /tmp/vertice-check
cp -a source-overrides/. /tmp/vertice-check/
cp -a supabase /tmp/vertice-check/
cd /tmp/vertice-check
npm ci --legacy-peer-deps --cache /tmp/vertice-npm-cache
npm run check
npm test
npm run build:static
```

Resultados finais: TypeScript aprovado; **149 testes / 25 arquivos aprovados**; build estático aprovado (aviso já existente de chunks >500 kB). O build não foi publicado e os ZIPs de distribuição existentes não foram substituídos.

```sh
deno check --lock=supabase/functions/vertice-inep-library/deno.lock supabase/functions/vertice-inep-library/index.ts
deno test --lock=supabase/functions/vertice-inep-library/deno.lock scripts/branding/document-template.test.ts
```

Deno: **5 testes de cenários aprovados**, incluindo manifesto/hash, preservação de bytes, estilos/fills explícitos, mídia referenciada, XML/ZIP não seguros, PNG inválido, ausência de logo, repetição, permissões negativas e auditoria. Nenhum acesso de rede/Storage real nesses testes.

PostgreSQL 17 descartável em Docker, com `scripts/branding/bootstrap-test-db.sql`, migrações existentes `202610260001_access_foundation`, `202610300001_area_real`, `20261101224102_institutional_inep_library` e SQL de revisão:

- `supabase/tests/institution_document_branding.sql`: aprovado; RLS, MFA, papéis, CAS, bloqueio da escrita direta, validação, auditoria, nenhum template habilitado e restrições de revisão.
- `supabase/tests/institution_logo.sql`: aprovado; PNG sintético válido, CRC corrompido e dimensões inválidas.
- `supabase/tests/inep_library.sql`: aprovado; tenant/inativos/MFA/externo/anon/Storage/escrita no catálogo.
- `python3 scripts/branding/test-concurrency.py`: dois escritores simultâneos com a mesma versão; exatamente um grava, o outro recebe conflito. Script aponta exclusivamente ao container descartável `vertice-branding-postgres`.

Fixtures visuais geradas por `scripts/branding/render-fixtures.ts`; convertidas em PDF pelo LibreOffice headless e rasterizadas pelo `pdftoppm`. Inspeção visual confirmou cabeçalho, texto longo, ausência de logo, célula temática colorida ao lado de alerta vermelho preservado e rodapé substantivo preservado. Não representam validação de todos os arquivos reais.

![Cabeçalho normal e alerta semântico preservado](branding-validation/normal.png)
![Sem logo nem texto de cabeçalho](branding-validation/absent.png)
![Texto longo, com cor de texto contrastante](branding-validation/long.png)

A leitura do changelog Supabase foi tentada mas recebeu 403; a documentação oficial de RLS foi consultada: https://supabase.com/docs/guides/database/postgres/row-level-security. A CLI local não ficou utilizável (v3 tentou escrever em diretório de configuração somente leitura; instalação v2 falhou no download DNS). Isso não foi contornado com credenciais ou acesso remoto; o SQL ficou como artefato de revisão, testado diretamente no PostgreSQL descartável.
