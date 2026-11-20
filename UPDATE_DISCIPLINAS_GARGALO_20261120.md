# Mapa de disciplinas-gargalo (20/11/2026)

Nova aba **"Disciplinas-gargalo"** em Auditoria de Permanência. É um algoritmo estatístico, sem IA (`client/src/lib/bottleneck.ts`).

## Método

- **Fonte:** `vertice_offering_outcomes`, com aprovados e reprovações por falta (RF), nota (RN) e aproveitamento (RA) em cada oferta.
- **Taxa:** reprovações ÷ matrículas com resultado. Turmas da mesma disciplina no semestre são somadas.
- **Ficam fora:** ofertas com mais de 10% ainda cursando (CR) ou em prova final (PF), o que exclui a maior parte de 2026/02; ofertas com menos de 10 resultados; e cursos com menos de 5 ofertas no semestre.
- **Comparação:** cada oferta é comparada às demais **do mesmo curso no mesmo semestre**, sem incluir a própria oferta na média, pelo desvio binomial com taxa dos pares suavizada.
- **Classificação** (últimos 6 semestres com resultado):
  - **gargalo persistente:** 2 ou mais ofertas com desvio ≥ 2 e desvio acumulado ≥ 2;
  - **desvio recente:** desvio ≥ 2 na oferta mais recente;
  - **atenção:** desvio acumulado ≥ 1,5.
- **Ranking:** pelo **excesso de reprovações** (reprovações reais menos as esperadas pelos pares).
- **Indicadores descritivos:** participação da reprovação por falta, que sinaliza abandono da disciplina, e o padrão de docentes (o desvio se repete com docentes diferentes ou se concentra num só). Não é avaliação individual.

## Validação (trava)

A cada leitura, o algoritmo verifica se o desvio de uma oferta antecipa o da oferta seguinte da mesma disciplina. As exigências são as mesmas do alerta de evasão.

Resultado na base de produção (20/11/2026): 2.742 pares e correlação de 0,43. A oferta com desvio forte seguiu acima dos pares em 73% dos casos, contra 39% ao acaso; o desvio forte se repetiu em 43% dos casos, contra 16%.

A persistência se mantém **mesmo quando o docente muda** (correlação de 0,37; 69% contra 42%) e é maior com o mesmo docente (0,48; 77% contra 36%). Há, portanto, um componente estrutural da disciplina e outro de condução da turma.

## Leitura atual

- 87 das 766 disciplinas com resultado são gargalos persistentes e concentram **76% do excesso de reprovações** (2.398 de 3.160 matrículas).
- No topo estão as ciências básicas da saúde, quase sempre com docentes diferentes:
  - Anatomia I: +111 reprovações acima do esperado;
  - Bioquímica: +90;
  - Bioquímica aplicada à Medicina Veterinária: +74;
  - Anatomofisiologia I: +73;
  - Anatomia Humana: +67.
