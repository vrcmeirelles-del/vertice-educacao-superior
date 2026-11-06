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
