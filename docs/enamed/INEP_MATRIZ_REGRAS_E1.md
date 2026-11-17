# E1 — MATRIZ NORMA → REGRA → IMPLEMENTAÇÃO → TESTE
**Revisão 0.1 (parcial) — 16/11/2026**. Não é uma reprodução integral das normas; toda regra é condicionada à versão do documento e edição.

| Regra | Fonte/trecho | Implementação planejada | Teste de aceite | Status |
|---|---|---|---|---|
| ENAMED como modalidade ENADE para Medicina | Portaria MEC 330/2025; NT40 §§1.2/2.1 | Evitar dupla contagem ENAMED/ENADE oficial no mesmo curso-edição | duas origens/um resultado oficial | Confirmado na fonte; código pendente |
| Matriz por área e competência | Portaria Inep 478/2025 arts. 3, 5 e 6 | Código literal versionado, mais ontologia editorial | validar códigos I–XV; impedir confusão VI↔VII | Correção identificada, cadastro pendente |
| Participação duas etapas | Manual 2026, seção Quem participa; editais republicados | `stage = fourth_year/sixth_year`, regras por edição | quarto ano não alimenta proporção de concluintes | Texto inspecionado, regras completas pendentes |
| Resultado válido para Conceito | NT40 §§5 e 6 | filtrar condição de inscrição, registro e presença | TP_INSCRICAO=1, IN_REGULAR=1, TP_INSCRICAO_ADM in (0,2), TP_PRES=555 | Lógica identificada; layout real pendente |
| Curso Sem Conceito | NT40 §5.1-5.2 | NC<10 ⇒ SC, jamais conceito 1 ou zero | NC=9/10 | Confirmado; testes da fórmula em documentação |
| Percentual de proficientes | NT40 §7.2 | PCP=NCP/NC com NC>0 válido | 0/10, 4/10, 6/10, 7.5 de 10 *não é pessoa*; usar 75/100 | Confirmado; teste limiar |
| Conversão em 1–5 | NT40 §7.4 Tabela 1 | cortes exatos sem arredondamento anterior | 39/100→1; 40→2; 60→3; 75→4; 90→5 | Confirmado; teste limiar |
| Proficiência individual | Manual 2026 + NT40 §§2.6/4 | resultado oficial proveniente do Inep ou estimativa interna rotulada | impedir que 60% de acertos vire 60 pontos TRI | Princípio confirmado; algoritmo oficial não reproduzido |
| Gabarito por versão | página Inep Provas e Gabaritos 2026 | campos preliminary/final/annulled e derivação por hash | retificação não apaga anterior; invalida derivado | Fonte preliminar confirmada, arquivos pendentes |
| Agregação por IES/curso | NT40 §2.2, microdados e-MEC | linkage por código e-MEC e edição | colisões de nomes não misturam cursos | Confirmado, implantação pendente |
| Relatório por IES futuro | LGPD + governança da Bíblia | tenant isolado, dados nominais com acesso autorizado | duas IES sintéticas; teste RLS | Planejado, não acionar dados reais |

## Testes determinísticos de especificação da regra §7 da NT40
Executados com dados puramente sintéticos em 16/11/2026. São **testes da interpretação matemática**, NÃO testes da aplicação Vértice/Supabase.

```python
def conceito(validos, proficientes):
    if validos < 10: return "SC"
    if proficientes < 0 or proficientes > validos: raise ValueError()
    p = proficientes / validos
    return 1 if p < .4 else 2 if p < .6 else 3 if p < .75 else 4 if p < .9 else 5
assert conceito(9,9) == "SC"
assert conceito(10,0) == 1
assert conceito(100,39) == 1
assert conceito(100,40) == 2
assert conceito(100,59) == 2
assert conceito(100,60) == 3
assert conceito(100,74) == 3
assert conceito(100,75) == 4
assert conceito(100,89) == 4
assert conceito(100,90) == 5
assert conceito(100,100) == 5
```

**Limites:** esta fórmula recebe NCP já determinado **pelo resultado oficial de proficiência**. Não calcula a nota TRI, não decide quem é concluinte regular e não substitui a revisão da metodologia em alterações futuras.
