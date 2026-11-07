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
