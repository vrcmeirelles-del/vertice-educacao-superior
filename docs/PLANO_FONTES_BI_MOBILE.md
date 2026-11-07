# Plano de consolidação das fontes para BI — Vértice Educação Superior

Atualização de desenvolvimento de 06/11/2026. Este documento descreve as fontes e as regras; não registra identidades, documentos pessoais ou credenciais.

## Fontes já disponíveis e áreas do BI

| Módulo | Origem | Análise e cautela |
| --- | --- | --- |
| Matrículas | vertice_enrollment_snapshots | Recorte de curso e semestre. Exibir cobertura, fonte e data; nunca deduzir aluno único a partir de vínculos. |
| Metas | vertice_goals | Separar planejadas, ativas, concluídas, canceladas, prazos e responsáveis. |
| Repositório regulatório | vertice_repository_requests e vertice_repository_files | Cobertura por exigência; arquivos enviados não contam como validados. NSA só quando formalizado. |
| Biblioteca INEP | vertice_inep_library | Indicador, dimensão, versão e itens provisórios; item no acervo não comprova evidência aprovada. |
| Reprovações e fluxo acadêmico | vertice_academic_reports | Relatórios por semestre, disciplina e professor; respeitar o denominador e a fonte original. |
| e-ORBIT quantitativo/diários | vertice_eorbit_* | Exige conciliação institucional e verificação de isolamento por instituição antes de novo acesso no aplicativo. |
| Armazenamento | buckets privados do Storage | Binários permanecem protegidos; conferir catálogo contra objetos armazenados. |

## Estágios do pipeline
1. Inventário sem exposição de informações pessoais.
2. Identificação da origem: IES, curso, semestre, modalidade, arquivo e data de extração.
3. Conciliação entre registros importados, semestres, grades e cursos; nenhuma ausência vira zero.
4. Classificação documental por instrumento, dimensão, indicador e curso, com sugestão de vínculo quando houver metadados suficientes.
5. Curadoria humana e validação das evidências. Não aprovar automaticamente nem eliminar originais.
6. Índices agregados protegidos por permissões de instituição (RLS/MFA). Testar autorização com usuários distintos.
7. BI executivo, BI acadêmico e BI documental, exibindo última fonte e lacunas.
8. Atualização periódica apenas por sincronizador homologado, com trilha de auditoria e proteção contra duplicidade.

## Implementação isolada
- Vértice Mobile acrescenta as telas Documentos e Acadêmico, com leitura das tabelas protegidas e sem download dos arquivos binários.
- Novos serviços, bancos, cobranças e publicações não são necessários nesta fase.
- Não publicar enquanto houver inconsistência entre a tabela resumida e o quantitativo e-ORBIT, ou falhas de autenticação.
- O ambiente de produção permanece inalterado; a versão está em PR de homologação.
