# UNITOP — auditoria de matrícula gratuita, participação e reprovações

**Data da análise:** 6 de novembro de 2026. **Ambiente:** Supabase existente da Vértice. **Mudanças nos dados originais:** nenhuma. **Escopo:** leitura, diagnóstico e preparação de painel para alta gestão; não foi feita qualquer inferência nominal de abandono, reprovação ou aprovação posterior.

## 1. Critérios que precisam permanecer separados

- **Matrícula gratuita:** isenção de taxa/valor de matrícula comprovada no contrato/financeiro, não inferida a partir de nota, ausência ou situação do estudante.
- **Primeiro vínculo:** primeira matrícula acadêmica por identificador estável da pessoa, sem histórico anterior confirmado, considerando mudanças de turma/curso.
- **AV1 / AV2 não realizadas:** ocorrência explícita de não comparecimento em cada avaliação, com calendário válido, já encerrado e registro publicado. `NULL`, `0`, não lançada e não realizada são categorias distintas.
- **Sem ativação acadêmica:** ingresso confirmado sem evidência de participação acadêmica, após conciliação de chamada, provas, atividades, trancamento, cancelamento e rematrícula. Não presumir por AV1 ausente.
- **Evasão real:** depende de definição institucional (vínculo não renovado e sem retorno no período de observação), nunca apenas ausência na coorte seguinte.
- **Reprovação e segunda chance:** vincular estudante + matrícula + oferta da disciplina + professor + semestre + avaliação final e eventual resultado posterior, sem confundir recuperação/segunda chamada com rematrícula ou repetição de disciplina.

**Regra gerencial a homologar:** somente após verificação e decisão auditada, matrícula gratuita de primeiro vínculo com AV1 e AV2 efetivamente não realizadas poderá sair do **denominador gerencial ajustado**, nunca ser apagada do banco fonte nem suprimir taxa acadêmica oficial. Não retirar de nenhum denominador enquanto a evidência estiver incompleta.

## 2. Fontes de dados efetivamente conferidas

1. `public.vertice_academic_reports` (institution_id UNITOP: `1f5fd5b4-93c6-4626-834d-136884915587`):
   - `cohorts` (último levantamento em 20/10/2026, Direito código 027; 2023/1 a 2026/2);
   - `reprovacoes_professor`, 484 linhas de ranking histórico (fonte 04/11/2026);
   - `reprovacoes_disciplina`, 1.078 linhas de ranking histórico (fonte 04/11/2026);
   - `reprovacoes_semestre`, 10 períodos de agregado institucional (fonte 04/11/2026);
   - `course_indicators`, recortes por UUID de curso, `reprobation_series` por período, RF/RN/RA.
2. `public.vertice_eorbit_alunos`: **0 linhas**; não há nomes de alunos, matrícula individual, AV1, AV2 ou segunda chance acessíveis nesta tabela.
3. `public.vertice_eorbit_diario_classe`: 733 linhas em outra chave `instituicao_id=cda828bd-4f55-432a-a824-387716c3cb2b`, que **não coincide** com o `id` do cadastro UNITOP em `public.vertice_institutions`. Não equiparar identidades nem incorporar os registros ao relatório privado da UNITOP sem resolver documentalmente o mapeamento.
4. OneDrive da instituição, arquivo **Lista_Final_Alunos_Risco_UNITOP.xlsx**, atualizado em 31/10/2026. O conteúdo pesquisado tinha 816 linhas válidas por código/curso e nome, agrupadas em 34 grupos; **23 registros para o código de Direito 027**. Contém contatos pessoais, por isso **não foi copiado** para tabelas públicas ou para a PR. A fonte não especifica o semestre nem a disciplina da seleção. Link de acesso, sujeito à autorização no OneDrive: https://vrcmeirelles-my.sharepoint.com/personal/vrcmeirelles_vrcmeirelles_onmicrosoft_com/_layouts/15/Doc.aspx?sourcedoc=%7B18370DC0-633B-4683-BAAF-73CB614D5FE7%7D&file=Lista_Final_Alunos_Risco_UNITOP.xlsx&action=default&mobileredirect=true

## 3. Achados quantitativos verificáveis

### Direito — coortes históricas com semestre seguinte observado (2023/1–2026/1)
- 484 primeiros vínculos observados no conjunto de coortes.
- 210 sem vínculo no semestre imediatamente seguinte localizado, **não necessariamente evasão definitiva**.
- 114 sem vínculo imediatamente seguinte **e sem nota AV1 positiva localizada** (23,6% dos ingressantes no recorte). Não há AV2 nem isenção comprovada. Não classificar como aluno que não fez prova, abandonou ou usufruiu matrícula grátis.
- A coorte 2026/2 **não** entrou no cálculo de continuidade, pois não há semestre seguinte observado.

### Taxa institucional bruta por matrículas em disciplina (não pessoas únicas)
- 2026/1: 4.045 registros de reprovação em 35.610 vínculos em disciplina: 11,36% no relatório histórico.
- 2026/2: 2.256 registros de reprovação em 22.682 vínculos em disciplina: 9,95% no relatório histórico.
- Estas contagens **não** podem ser ajustadas por matrícula gratuita até que o vínculo individual/AV1/AV2 seja conferido. Não há impacto financeiro apurado.

### Ranking institucional de disciplinas (não estudantes únicos)
- ANATOMIA I: 254; ANATOMIA VETERINARIA-I: 131; ANATOMIA HUMANA: 119; ANATOMIA II: 117. Não somar códigos/nomes semelhantes sem identificar ofertas e períodos.

### Qualidade do cadastro
- Existem pelo menos dois UUIDs distintos de `vertice_courses` com código `027` e descrição "Direito – Bacharelado", cada um com diferentes recortes de relatórios. Não unificar silenciosamente. O painel diferencia recortes pelo número de períodos existentes.

## 4. Alterações de interface preparadas

- Nova aba **BI · Permanência e Reprovações**, restrita à alta gestão, dentro do workspace da instituição.
- Indicadores sobre primeiro vínculo e o alerta explícito de que matrícula grátis/AV1 e AV2 continuam **não verificadas**.
- Tabela de coortes, com curso e período; período sem observação posterior aparece como não calculável.
- Curso clicável com filtros de semestre para contagens RF/RN/RA e denominadores por matrícula em disciplina.
- Série institucional bruta de reprovações, com coluna de taxa ajustada indisponível (sem extrapolar).
- Rankings históricos com seleção de disciplina (busca por "Anatomia") e professor, exibindo RF/RN/RA quando disponível.
- Link para a lista nominal externa autorizada de alunos em risco, quando a fonte estiver associada ao curso. Não apresentar a lista como reprovados confirmados da disciplina em questão.
- Advertência para múltiplos cadastros do mesmo código de curso.

## 5. Próxima extração exigida do e-ORBIT / administrador

Solicitar em **modo somente leitura**, conforme LGPD e autorização institucional:
- Lista nominal de primeiro vínculo por pessoa e faculdade, curso, turma, semestre, situação e eventual transferência/rematrícula.
- Identificador de vínculo por oferta de disciplina e responsável docente.
- Flag de gratuidade da matrícula oriunda do financeiro/contrato, data de confirmação e situação do pagamento (sem dados financeiros excessivos).
- Notas e **status de realização** de AV1 e AV2 (realizada, ausente, não lançada, pendente), atividades/frequência e datas efetivas das avaliações.
- Resultado oficial por disciplina (aprovado, reprovado por nota, reprovado por falta, demais categorias) e eventuais avaliações de 2ª chamada, recuperação e resultado posterior.
- Metadados de extração, paginação, códigos, dicionário RF/RN/RA, chaves estrangeiras e localizador da evidência.
- Data de início e término do período para impedir classificação prematura de estudantes em curso.

Com essas fontes será possível calcular métricas **brutas e ajustadas lado a lado**, sem destruir ou reescrever histórico oficial. A homologação deverá verificar casos de nota zero vs ausente, aluno de dependência, primeira matrícula sem confirmação de isenção, provas fora do prazo e retorno após intervalo.

## 6. Governança e publicação

O código da nova aba está na branch `feature/unitop-auditoria-matricula-av1-av2-20261106`; ainda **não foi mesclado na main nem publicado no Render**, por falta de validação do build e sessão real na instalação. Não criar novas assinaturas, não alterar preços e não alterar dados acadêmicos.


## RETIFICAÇÃO IMPORTANTE — descoberta da base nominal restrita em 06/11/2026

**Correção do diagnóstico anterior:** a afirmação de que não existia base nominal de alunos disponível estava errada. A tabela `public.vertice_eorbit_alunos` está vazia, mas o arquivo nominal **já existe no Supabase Storage da Vértice** e foi recuperado também pela Biblioteca do usuário.

**Localização exata da fonte original:**
- Arquivo: `UNITOP_Direito_Coortes_Continuidade_AV1_20102026_RESTRITO.xlsx`
- Bucket privado: `vertice-documentos`
- Objeto: `1f5fd5b4-93c6-4626-834d-136884915587/restrito/34ff9e51-7ab1-53e4-b2d7-c837bf88f81e/UNITOP_Direito_Coortes_Continuidade_AV1_20102026_RESTRITO.xlsx`
- Registro `vertice_app.documents`: `classification='restricted'`, `scan_status='pending_scan'`, `deleted_at=null`, 398.839 bytes.
- SHA-256 do arquivo armazenado no Supabase e da cópia conferida: `1069937c3828b03521dd47ca5110151d370a1acf78c229e39201b5d5381ed9d1` (idênticos).
- Fonte consultada no e-ORBIT em 20/10/2026.

**Estrutura encontrada:**
- 4 abas: `Resumo`, `Alunos`, `Base`, `Fontes`.
- `Alunos`: 552 registros com **552 CPFs distintos**, nome, matrícula, primeiro vínculo, vínculo seguinte, AV1 positiva/zero, retorno, disciplina e docente vinculados à evidência e URL de comprovação no e-ORBIT.
- `Base`: histórico por CPF para 2023/1–2026/2, vínculo por semestre, AV1 positiva e AV1 zero por semestre; não contém AV2 comprovada.
- `Fontes`: cobertura da extração, com apontamento de diários consultados e limitações.
- Contagem rechecável em `Alunos`: 353 estudantes com AV1 positiva na entrada; 199 sem AV1 positiva localizada (27 com AV1 zero sem positiva). Não afirmar que 199 não realizaram prova.
- Coortes observáveis até 2026/1: 484 entradas, 210 sem vínculo imediatamente seguinte, 114 sem vínculo seguinte e sem AV1 positiva localizada. A coorte 2026/2 ainda não tem acompanhamento posterior.

**Implicação na PR #57:** os dados individuais necessários para nomes e evidência de AV1 já existem em arquivo próprio. O que falta é **indexá-los de maneira segura**, preservando a classificação restrita, resolver o `pending_scan` conforme a política institucional e implementar consultas protegidas pelo perfil autorizado. A ausência de dados na tabela `vertice_eorbit_alunos` NÃO significa ausência de fonte nominal. Evitar nova solicitação ou extração duplicada desta planilha.

**Limites que permanecem:** este arquivo não comprova individualmente AV2, matrícula gratuita, reprovação final por disciplina, recuperação/segunda chance ou aprovação posterior. Sem essas fontes, não calcular exclusão gerencial definitiva nem inferir evasão verdadeira. CPF, nome, matrícula e URLs de evidências não devem ser impressos em logs, expostos publicamente ou enviados a GitHub.


## Inventário aprofundado multcurso (06/11/2026) — não confundir CPF com matrícula

Foram examinados:
1. `UNITOP_Consolidado_2016_2026.xlsx` — OneDrive `CLIENTES/UNITOP/Migração`: Rel 6 "Relação de Alunos" tem **596/597 linhas de totais agregados por curso × semestre**, sem CPF/nome individual. Há dados de muitos cursos, mas não é cadastro nominal.
2. `UNITOP_Gestao_Completa_Reitor (1).xlsx` — mesma pasta: base gerencial histórica por curso, semestre e reprovações, **sem coluna CPF** no conteúdo legível; 84 cursos nas tabelas consolidadas.
3. `Lista_Final_Alunos_Risco_UNITOP.xlsx` — OneDrive `CLIENTES/UNITOP/planilhas`: **816 registros de risco de reprovação**, distribuídos por **34 cursos/códigos**, todos com status "Em Risco (Reprovado)" na versão de 31/10/2026. A terceira coluna numérica contém **identificadores de oito dígitos**, compatíveis com matrícula/RA; **não é uma coluna de CPF de 11 dígitos**. É lista de risco, não relação completa de matriculados ou ingressantes.
4. `UNITOP_Dados_Pessoais_Retencao.xlsx` — OneDrive `CLIENTES/UNITOP/planilhas`: apenas linha de aviso de uso interno e proibição de enviar dados pessoais para Vértice; **sem linhas de alunos** no conteúdo extraído.
5. `UNITOP_Direito_Coortes_Continuidade_AV1_20102026_RESTRITO.xlsx` — Biblioteca e Storage `vertice-documentos`: **552 CPFs distintos**, mas somente do Direito, com primeiro vínculo, AV1 e fonte de evidência. A planilha possui 4 abas e 552 registros individuais.
6. `UNITOP_2026-11-06T19-03-50-501Z.json` — extração do Collector em homologação: guarda a tela de filtros `/system/acad/rela/alun/` ("Relação de alunos") e campos de formulário; **não registra uma lista nominal resultante da execução da consulta**.
7. `tabelas_UNI_GIZ.csv`: inventário de nomes de tabelas `dbo` do sistema GIZ, não exportação de estudantes da UNITOP. Não usar como base nominal de alunos.

**Conclusão verificada:** a existência de uma base com nomes e CPF abrangendo todos os cursos da UNITOP **não foi comprovada nos arquivos efetivamente acessíveis nessa varredura**. Isso não permite afirmar que tal extração não exista em outra subpasta/arquivo ainda não indexado. Até localizá-la, o BI pode usar 816 nomes/matrículas da lista de risco (com a limitação de 34 cursos e sem vínculo de reprovação por disciplina) e 552 CPFs de Direito (com a restrição documental e pendência de scan). Não deve atribuir CPF aos 816 registros, nem assumir que representem todos os alunos ou toda a evasão.

A reconciliação indicou que `diagnostico.txt` da pasta `Migração/reconciliacao` descreve a fonte `rel6_alunos_data.csv` como agregado (597 chaves curso × semestre), e `UNITOP_qtde_structured.json` como quantitativos por grade — nenhuma delas garante dados individualizados.

**Ação de busca seguinte:** procurar exportação original do Rel 6 após executar filtros/gerar relatório (arquivo CSV/XLSX/PDF efetivo, e não apenas a tela de filtros). Não divulgar CPFs, registrar no Git, importar listas desautorizadas ou alterar bases oficiais.
