# Alerta precoce de evasão por curso (20/11/2026)

Nova aba **"Alerta de evasão"** em Auditoria de Permanência. É um algoritmo estatístico, sem IA (`client/src/lib/evasion-alert.ts`).

## O que os dados permitem, e o que não permitem

`vertice_course_semester_stats` é um **retrato único** (importado em 07/11/2026) da situação atual de cada **coorte de ingresso**. A confirmação veio do relatório de matrículas de 29/10/2026, que reproduz os mesmos números. Por isso:

- **não é possível prever a taxa do próximo semestre.** A queda aparente da evasão (de 33% em 2023/02 para 4% em 2026/02) reflete o menor tempo de exposição das coortes novas, não uma melhora;
- **é válido comparar cursos dentro da mesma coorte**, porque todos tiveram o mesmo tempo para evadir.

Também ficaram documentados: 447 das 864 linhas são vazias (curso sem registros na coorte) e o pico de 2024/01 é quase todo trancamento (6.990 de 7.540), concentrado em cursos semipresenciais e EAD descontinuados.

## Método

- Evasão definitiva = abandono + cancelamento + transferência + troca de curso. O trancamento é tratado à parte, como "trancamento atípico".
- Cada curso é comparado aos pares da mesma coorte e modalidade, sem incluir o próprio curso na média. A medida é o desvio binomial. A taxa dos pares é suavizada ((casos + 0,5) / (registros + 1)) para não zerar.
- Ficam fora da comparação cursos com menos de 10 registros na coorte e grupos com menos de 4 cursos.
- **Alerta:** desvio ≥ 2 numa das duas coortes mais recentes. **Atenção:** desvio médio ≥ 1 nas 4 coortes mais recentes.

## Validação (trava)

A cada leitura, o algoritmo verifica nos dados da própria instituição se o desvio numa coorte antecipa o da coorte seguinte. O alerta só é publicado com pelo menos 30 comparações e 5 desvios fortes no histórico, acerto pelo menos 20 pontos acima do acaso e repetição de pelo menos o dobro do acaso.

Resultado na instituição com histórico (20/11/2026): 174 comparações e correlação de 0,63. O curso alertado seguiu acima dos pares em 89% dos casos, contra 42% ao acaso. O alerta se repetiu em 56% dos casos, contra 14%.

Leitura atual: em **Alerta**, Fisioterapia semipresencial, Direito e Estética e Cosmética; em **Atenção**, Agronomia e Biomedicina.

## Para ir além

Para chegar a uma previsão por semestre, a fonte precisa ser importada de forma periódica, guardando cada retrato com a data. Hoje cada importação substitui a anterior.
