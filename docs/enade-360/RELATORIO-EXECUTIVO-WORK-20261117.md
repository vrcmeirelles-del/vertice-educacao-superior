# ENADE 360° — relatório executivo de execução Work
17/11/2026 · America/Sao_Paulo

**Correções operacionais integradas e publicadas. Núcleo científico NÃO HOMOLOGADO.**

A PR #169 integrou o histórico cumulativo e corrigiu a verificabilidade dos novos eventos de auditoria, a identificação institucional do espelho e o bloqueio de validação de resultados oficiais. A migração 20261117092634 está aplicada; os dez registros e dez eventos originais foram preservados. Nenhum privilégio foi ampliado. Bíblia-Mestra, Plano e Diário foram atualizados sem apagar entradas.

| Situação exigida | Evidência e resultado |
|---|---|
| A. Implementado no código | Contratos, auditoria v2, consulta do espelho e barreira científica. Sem motor científico integral validado. |
| B. Integrado ao banco | Auditoria e bloqueio aplicados no Supabase existente. Nenhum resultado oficial importado. |
| C. Publicado no ambiente | PR #169 merged; portal e site institucional com deploy live e marcadores da correção conferidos nos JS servidos. |
| D. Sessões reais | Não homologadas: login recusou credenciais; não foram criadas identidades nem concessões artificiais. |
| E. Reprodução com dados oficiais | Nenhum Conceito Enade, IDD, CPC ou IGC reproduzido de ponta a ponta. |
| F. Conciliação com INEP | Nenhuma conciliação científica concluída. Valores ausentes não receberam zero. |
| G. Aprovação humana | Nenhum resultado científico aprovado; autorização técnica da missão não foi tratada como aprovação de indicador. |
| H. Homologação científica | NÃO. Publicação acadêmica e especialização por bacharelado permanecem bloqueadas. |

**Cursos:** 289 linhas no espelho; 241 com identificador, 48 sem; 62 pares IES/curso; 196 cursos no cadastro; nenhuma equivalência comprovada. Inventário exportado: 49 candidatos textuais únicos, 11 múltiplos e 2 sem candidato. Identificadas 43 colisões numéricas entre namespaces de códigos diferentes. Nenhum cadastro original modificado.

**Testes:** sete workflows da revisão final aprovados, incluindo TypeScript Node 22/24 e builds; 266 casos contratuais anteriores, seis testes do espelho e 25 asserts SQL das migrações/funções em PostgreSQL 17. Estes usam identidades sintéticas. No Supabase real: hashes dos 10 baselines/10 linhas sem divergência; negação sem identidade retornou zero linhas; trigger v2 gerou evento temporário com hashes/cadeia corretos e rollback confirmado; tentativa de validar oficial foi rejeitada pelo bloqueio. Esses testes não substituem sessões autenticadas.

**Fontes e bloqueios objetivos:**

- Três pacotes de microdados 2021–2023, doze XLSX e três notas técnicas retornaram HTTP 503; também falharam a recuperação pelo buscador e o download do ZIP pelo navegador. Quatro HTML oficiais foram recebidos com SHA-256. Não há binários nacionais, dicionários íntegros ou componentes suficientes para executar e conciliar as quatro metodologias. IDD exige ainda ligação Enem pertinente; CPC/IGC exigem os respectivos insumos adicionais.
- Dois PDFs disponíveis foram recuperados, mas são duplicatas do relatório Direito/Faculdade de Olímpia/2022, sem comprovação do download original INEP. Não são UNITOP nem bases nacionais e não foram importados.
- Login inválido; zero escopos em learning_staff_scope e zero papéis ativos em impacto_roles nos mecanismos consultados. Não ampliar privilégios para declarar homologação. O snapshot e-MEC UNITOP é parcial e contém apenas modelo institucional, sem códigos oficiais de cursos para provar equivalências.

**Evidências:**

- [PR integrada #169](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/169) · [commit publicado ff0963d](https://github.com/vrcmeirelles-del/vertice-educacao-superior/commit/ff0963dcfd2fd356a82ff29ae3a5c74cc479076c).
- [CI de contratos e PostgreSQL](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44056013177) · [TypeScript e regressões do portal](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44056012516).
- [Render portal](https://dashboard.render.com/static/srv-dbm52uhsrm7s73f3ojkg): dep-dbu1um0ae00c73a5fd4g, live às 06:33:52; [Render institucional](https://dashboard.render.com/static/srv-dbbm6q3ncjis7396t7fg): dep-dbu1um0ae00c73a5fd10, live às 06:33:54.
- [Recibos das fontes](evidencias/20261117-work/official-source-receipts.json) · [inventário dos 62 pares](evidencias/20261117-work/course-reconciliation-pending.json) · [testes no banco](evidencias/20261117-work/operational-validation.json) · [verificação dos artefatos publicados](evidencias/20261117-work/published-artifact-verification.json).
