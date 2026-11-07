# UNITOP — primeiro vínculo efetivo por todos os cursos

Data da verificação: 07/11/2026. Estado: preparação da rotina local, ainda sem exportação nominal institucional completa. Não publicar resultados não homologados.

## Fontes adicionais efetivamente localizadas no OneDrive institucional — 07/11/2026

A pesquisa anterior não abrangia a conta Microsoft 365 de trabalho e por isso **não havia identificado a árvore de documentos correta**. O endereço-base é:

`Documentos Virgilio/Empresas/Vertice/CLIENTES/UNITOP/`

Acessado via biblioteca pessoal Microsoft 365 de trabalho (não o drive pessoal de outra conta). As fontes encontradas incluem:

| Arquivo / pasta | Cobertura verificada | Uso correto |
| --- | --- | --- |
| `planilhas/unitop_aba09_dados_pessoais.csv` | 1.662 linhas com Nome, CPF, Codigo, Status Atual, Matricula e ÚLTIMO semestre com reprovação; 1.658 CPFs distintos, 44 códigos e status 1.613 Matriculado + 49 Trancado | **Lista nominal parcial de risco**, não catálogo completo de primeiras matrículas e sem campo de primeiro vínculo |
| `Migração/UNITOP_Consolidado_2016_2026.json` | ~13 MB; `rel6_relacao_alunos.dados` com 596 registros agregados por semestre e curso (sem CPF) | Série de quantitativos, não permite observar a primeira matrícula individual |
| `Migração/rel6_alunos_data.csv` | 597 linhas de quantitativos por semestre/curso, sem CPF ou matrícula nominal | Comparativo estatístico apenas |
| `planilhas/matricula_agregada.json` | 840 registros agregados por curso, semestre e turmas; estruturas internas sem identificadores pessoais | Séries agregadas, não coortes |
| `cursos-eorbit-2022-2026/{Presencial,EAD,Semipresencial}` | 27 + 30 + 27 pastas com CSVs de status e turmas por período (agregados) | Granularidade de curso e turma, não pessoa |
| `Migração/supabase-sync/` | Sincronizador, `run_sync.py`, mapeamento e parsers | Verificar etapa de importação dos dados nominais e detectar lacuna |
| `regulacao-auditoria/Eorbit/02_Bases_Restritas/` | Bases nominais existentes ligadas ao Direito | Não estender a outros cursos sem comprovar histórico completo |

No projeto Supabase Vértice, a conferência independente encontrou `public.vertice_eorbit_alunos=0`, `vertice_private.api_staging_records=0` e `vertice_app.ingestion_batches=0`. As fontes `vertice_academic_reports` de tipo `cohorts` são agregados identificados apenas para Direito. Os arquivos nominais do OneDrive de trabalho **não estavam materializados nas tabelas nominais do Supabase consultado**.

**Decisão metodológica:** O arquivo `unitop_aba09_dados_pessoais.csv` é útil para identificar pessoas de risco e cursos; o campo `Ultimo semestre com reprovacao` **não equivale** ao primeiro semestre acadêmico. Não transformar os seus 1.658 CPFs em ingressantes. O próximo passo técnico é localizar os demais vínculos históricos por CPF na fonte autenticada (ou pasta de raspagem que contenha estas linhas), conciliar com e-ORBIT, homologar datas e somente então executar a rotina de cálculo já preparada. Nenhum dado pessoal deve ser publicado ou copiado para commits.

## Causa da lacuna de sincronização nominal — conferida no código de origem

O sincronizador institucional original está em
`Documentos Virgilio/Empresas/Vertice/CLIENTES/UNITOP/Migração/supabase-sync/run_sync.py`.
Suas listas `FONTES_JSON`, `FONTES_JSON_345`, `FONTES_XLSX` e `FONTES_XLSX_OPCIONAIS` incluem
os relatórios 2, 3, 4, 5, 8, 10 e 13 e a planilha gerencial, **mas não incluem a planilha
nominal `planilhas/unitop_aba09_dados_pessoais.csv` nem uma importação de `rel6_relacao_alunos`**.

A fonte `UNITOP_Consolidado_2016_2026.json`, identificada explicitamente como
`Camada 1 — dados agregados (sem dados pessoais)`, contém 596 registros em
`relatorios.rel6_relacao_alunos.dados`, com campos `semestre`, `curso_id`,
`curso_nome`, `total_alunos` e nenhuma identidade individual.
O arquivo `planilhas/matricula_agregada.json` contém 840 registros agregados;
suas turmas são descritas somente por série, turma e quantidade de matriculados.

**Não importar a planilha com CPF diretamente em `public.vertice_academic_reports` ou qualquer
tabela exposta à API.** Uma futura sincronização nominal exige tabela privada,
controles de acesso e conferência da origem do primeiro semestre acadêmico por pessoa,
além de aprovação de segurança da fonte.

## Decisão executiva de integração — fontes verificadas em 07/11/2026

**Fonte 1 — Risco acadêmico individual (permitida em ambiente restrito, não em prévia pública).**
Arquivo institucional `CLIENTES/UNITOP/planilhas/unitop_aba09_dados_pessoais.csv`:
1.662 linhas, 1.658 CPFs distintos, 44 códigos de curso, 1.613 registros com
status Matriculado e 49 com status Trancado. O arquivo contém `Codigo`,
`Matricula`, `CPF`, `Status Atual`, reprovações e `Ultimo semestre com reprovacao`.
**Não há coluna de data ou semestre do primeiro vínculo**.
Esta fonte alimentará apenas retenção/risco após ingestão privada, RLS, varredura e mapeamento
de códigos, sem CPF em API pública. O código 027 possui múltiplos UUIDs na Vértice;
é proibido adotar um deles por conveniência.

**Fonte 2 — Tendência de alunos e status (apta a agregados, não a ingressantes).**
`CLIENTES/UNITOP/planilhas/matricula_agregada.json`: 840 registros por
curso/semestre; 1.389 linhas de turmas agregadas nas estruturas aninhadas.
As turmas contêm apenas série, turma e matriculados, sem identificador pessoal.

**Fonte 3 — Histórico e-ORBIT 2016/01–2026/02 (apta a agregados, não a ingressantes).**
`CLIENTES/UNITOP/Migração/UNITOP_Consolidado_2016_2026.json`:
`relatorios.rel6_relacao_alunos.dados` inclui 596 registros resumidos,
com `semestre`, `curso_id`, `curso_nome`, `total_alunos`. O arquivo se
identifica como *Camada 1 — dados agregados (sem dados pessoais)*.
Arquivo auxiliar `rel6_alunos_data.csv` também contém apenas quantitativos.

**Estado do destino Supabase verificado:** `public.vertice_eorbit_alunos=0`,
`vertice_private.api_staging_records=0`,
`vertice_app.retention_records=0`, e 1 conjunto de coortes do Direito.
O sincronizador `Migração/supabase-sync/run_sync.py` carrega rel2, rel3/4/5,
rel8, rel10, rel13 e planilhas de gestão, mas não a base nominal da aba09.
Raspar os totais da página não equivale a exportar histórico de alunos por CPF.

**Definição de execução, sem novas contratações:**
1. Conservar relatórios 2/6 e matrículas agregadas na camada de indicadores quantitativos.
2. Habilitar carga **restrita** e auditada da aba09 para risco/permanência, após inspeção
   da origem, verificação de CPF/duplicidades, mapeamento de código/curso/IES e RLS;
   jamais para atribuir primeiro ingresso.
3. Para primeira matrícula: exigir os registros históricos efetivos de pessoa +
   curso identificado + semestre + situação, do período de observação completo;
   importar em staging privado, deduplicar por pessoa/curso/semestre e conciliar
   transferências, modalidades, mudanças de grade e rematrículas.
4. Publicar somente agregados homologados no BI; jamais expor a fonte nominal
   na prévia pública sem senha. Sem histórico suficiente, mostrar **não verificável**.
5. Não iniciar rotina contínua em nuvem até verificar credenciais da conta Microsoft
   e o ambiente de execução autorizado, para evitar chaves no navegador e custo extra.

## Conciliação verificável dos 44 códigos da fonte nominal

Comparação do campo `Codigo` da aba09 com o cadastro `public.vertice_courses` da UNITOP:

- **42 códigos** têm correspondência única.
- **027 (Direito): 62 registros**, com dois UUIDs ativos. O cadastro
  `679995fa-72a9-4bae-a5ec-812b2ec229d5` tem 12 relatórios,
  incluindo coortes, e 56 linhas de snapshots de matrículas.
  O cadastro `dfca6d07-fef6-4fa0-9475-3a85eaf4baa6` tem
  2 relatórios e 9 linhas de snapshots. Não mesclar automaticamente nem
  redistribuir pessoas sem chave histórica de origem.
- **029: 10 registros** sem código correspondente em `vertice_courses`.
  O diretório de cursos do OneDrive tem a pasta `EAD/029 - CIÊNCIAS CONTÁBEIS -EAD`,
  mas essa referência documental exige conciliação com o cadastro de cursos
  antes de vincular os registros à IES e modalidade corretas.
- **Total nominal analisado:** 1.662 linhas em 44 códigos de curso; as
  duas divergências abrangem **72 registros**. Esses registros devem ser
  enviados para fila de curadoria, não descartados ou realocados silenciosamente.

**Decisão de implementação:** mesmo os 1.590 registros com códigos de
curso de correspondência única não demonstram primeira matrícula, pois
não trazem semestre de ingresso. A prioridade é homologar essa base
para o **BI de permanência/risco**, mantendo a classificação correta,
enquanto a trilha histórica por pessoa permanece separada.

## Diagnóstico de dados

- A tabela pública vertice_eorbit_alunos tem zero registros.
- O tipo cohorts em vertice_academic_reports está disponível para um cadastro de Direito.
- O tipo quantitativo_alunos_historico possui 485 registros históricos para 73 cadastros de curso, mas não é nominal.
- Existem 138 cadastros de cursos UNITOP para 83 códigos. Um código pode corresponder a mais de um cadastro histórico.
- Os sete arquivos no bucket privado vertice-documentos incluem planilhas nominalmente restritas sobretudo do Direito, com scan_status pendente. Eles não foram utilizados nem expostos.
- A captura UNITOP_2026-11-06T19-03-50-501Z.json da página e-ORBIT Relação de alunos contém as opções de filtro e não a listagem histórica nominal.

Consequência: diferenças entre estoques de matriculados ou a soma por grade não demonstram quantas pessoas ingressaram pela primeira vez.

## Exportação mínima autorizada do e-ORBIT

- Extrair em modo leitura o histórico completo de relação de alunos, em todos os cursos, modalidades, grades, turmas e semestres disponíveis (não apenas o primeiro período).
- Campos essenciais: CPF ou identificador estável da pessoa, curso_id estável do e-ORBIT, semestre letivo e situação acadêmica do registro.
- Campos de auditoria que podem permanecer somente na fonte restrita: matrícula acadêmica, modalidade, grade, turma, data e referência de extração, status da matrícula, origem do vínculo.
- Preservar TODOS os status originais, incluindo pré-matriculado, trancado, cancelado, transferido e matriculado. A apuração básica considera somente o status MATRICULADO.
- Conferir a identidade institucional do e-ORBIT antes de inserir em tabelas da UNITOP: atualmente a chave institucional no conjunto e-ORBIT não coincide com o UUID da instituição na tabela principal.
- O material nominal deve permanecer em armazenamento restrito e aprovado pela varredura de segurança, com trilha de auditoria e permissões por IES. Não publicar em páginas, GitHub ou URLs sem senha.

## Apuração local preparada

Script no GitHub: scripts/unitop_primeira_matricula_nominal.py

Exemplo de execução em máquina institucional autorizada:

python scripts/unitop_primeira_matricula_nominal.py --entrada /pasta-restrita/relacao_alunos_historica.csv --saida /pasta-restrita/primeira_matricula_agregada.json --instituicao UNITOP --identificador cpf

O script aceita CSV e JSON e, com a dependência local openpyxl, XLSX. Para um identificador pessoal pseudonimizado e estável ao longo de toda a instituição, pode-se usar a opção --identificador id_estavel, após validar a equivalência com CPF. A matrícula acadêmica isolada NÃO substitui a identidade pessoal estável. O ID do curso deve ser inequívoco. Usar códigos de curso sem ID somente após conciliar duplicidades.

## Regras de cálculo

1. Primeira matrícula no curso: primeiro semestre com registro MATRICULADO para a mesma pessoa naquele curso.
2. Primeira matrícula na IES: primeiro semestre com registro MATRICULADO para a mesma pessoa em qualquer curso da instituição.
3. Reingresso posterior da mesma pessoa não é ingresso novo na instituição.
4. A primeira matrícula da pessoa em um segundo curso pode ser nova para o curso, mas não para a IES.
5. Múltiplas turmas, grades e disciplinas da mesma pessoa em um curso/semestre contam uma só vez.
6. Duas matrículas simultâneas em cursos diferentes no primeiro semestre contam uma pessoa no agregado institucional, com atribuição por curso marcada como ambígua.
7. Pré-matrícula não equivale a matrícula efetivada. Ausência de registro, CPF inválido ou curso ambíguo não gera zero nem estimativa inventada.
8. Sem comprovar completude temporal e institucional do arquivo, o resultado é classificado somente como PRIMEIRO VÍNCULO OBSERVADO.
9. A rotina não modifica matrículas, coortes oficiais ou documentos do banco original. É obrigatória homologação humana antes de atualizar o BI.

## Evidências de qualidade

- As fontes são identificadas no resumo agregado somente por SHA-256.
- A saída contém unicamente contagens por curso e semestre, sem CPF, nome ou matrícula nominal.
- Arquivos sem registros nominais confirmados são rejeitados, em vez de produzir totais zero.
- Os testes automatizados cobrem CPF/ID ausente, grade duplicada, rematrícula, transferência/mudança de curso, vínculos simultâneos, códigos ambíguos, pré-matrícula, divergência de status e separação de instituições.

Bloqueio atual: obter do e-ORBIT (ou da pasta institucional autorizada) a extração histórica nominal de todos os cursos. O painel existente somente será preenchido com dados efetivos após esta conciliação. A demonstração pública do aplicativo permanece usando valores fictícios.
