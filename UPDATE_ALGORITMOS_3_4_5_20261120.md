# Algoritmos 3, 4 e 5 (20/11/2026)

## 4. Ritmo de entregas do Repositório (`client/src/lib/repository-pace.ts`)

**Onde aparece:** painel no topo do Repositório (visão geral, sem curso selecionado).

**O que calcula:** para cada prazo e para cada curso dentro do prazo, mostra quantas entregas faltam, o ritmo semanal necessário até o prazo, o ritmo observado nos últimos 28 dias e a data projetada de conclusão. A situação é classificada como:
- no ritmo: observado igual ou maior que o necessário;
- em risco: observado entre metade e o necessário;
- crítico: observado abaixo da metade do necessário;
- vencido: prazo passado com pendência.

**Regras:** só entram no ritmo os pedidos **com prazo**. A importação em lote de 31/10 (545 documentos antigos, todos em pedidos sem prazo) não conta. Documentos devolvidos também não contam como entrega.

**Por que não é um modelo de risco treinado:** nenhum prazo venceu ainda. Os pedidos foram criados a partir de 31/10/2026 e os prazos vão de 15/12/2026 a 30/06/2027, então não há histórico de atraso para aprender. A projeção é linear e aparece declarada como tal.

**Leitura atual:**
- Dos 901 pedidos com prazo, nenhum tem arquivo.
- 252 vencem em 15/12/2026, o que exige cerca de 70 entregas por semana.
- O ritmo observado está perto de zero: 2 envios desde a importação.

## 5. Titulação do corpo docente: indicador 4.1 (`client/src/lib/faculty-titulation.ts`)

**Onde aparece:** dentro do indicador 4.1, em Avaliação Institucional.

**O que calcula:**
- o percentual de mestres e doutores e o conceito estimado;
- quantas contratações, ou quantas titulações de docentes atuais, faltam para a próxima faixa;
- um simulador de contratações e desligamentos.

**Regras:**
- As faixas (25%, 40%, 60% e 80%) são **lidas do texto oficial** do critério no instrumento cadastrado (`avaliacao-institucional.json`), sem números digitados no código. Se o texto não puder ser lido, o cálculo é recusado.
- **Trava de qualidade:** o cadastro atual tem os 95 docentes como "mestre, horista, 16h, sem curso", um padrão típico de valor padrão de importação. O conceito aparece como **não confiável** até o cadastro ser corrigido.
- O instrumento de curso (regime e titulação por curso) não está cadastrado no portal, e por isso não foi implementado: não se digitam faixas de memória.

## 3. Previsão de demanda do vestibular: **bloqueado por falta de dado**

- **Editais** (`vertice_eorbit_vestibular_*`): vão de 2016/01 a 2023/2, com lacunas. Os nomes de curso não são padronizados e o campo "aprovados" está quase sempre zerado.
- **Captação** (`vertice_captacao_*`): 5 leads.
- **Ingressantes de primeira matrícula** (`academic_reports.cohorts`): só existem para o Direito.
- **Fontes acumuladas:** `vertice_course_semester_stats` e `quantitativo_alunos_historico` são retratos acumulados com definições divergentes entre si. No Direito, 2026/1, os totais são 300 e 390, contra 133 ingressantes de primeira matrícula.

Para viabilizar a previsão, é preciso importar periodicamente os inscritos e os ingressantes por curso e por semestre (2024 em diante), guardando cada importação com data.
