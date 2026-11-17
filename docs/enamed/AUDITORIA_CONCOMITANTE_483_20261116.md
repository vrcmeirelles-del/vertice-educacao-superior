# ENAMED — AUDITORIA CONCOMITANTE E PREPARAÇÃO DE REINDEXAÇÃO
**Versão:** 1.0 — 16/11/2026  
**Caráter:** auditoria estrutural integral de 483 registros + revisão semântica ilustrativa, não homologação clínica ou conferência integral do PDF.  
**Fontes de evidência:** consulta **somente leitura** ao banco Fato & Ordem `public.fo_enamed_items`; Portaria Inep 478/2025 (artigos 3 a 8) reproduzida do DOU; portal oficial de provas e gabaritos Inep 2025/2026.

## 1. Baseline quantitativo confirmado
| Verificação | Resultado |
|---|---:|
| Registros ENAMED 2026 | 483 |
| Registros sem competências estruturadas | 483 |
| `taxonomy_area` genérica "Medicina" | 483 |
| `source_hash` ausente | 483 |
| Status do gabarito declarado "definitivo" | 483 |
| Keywords contendo "enamed 2026" | 483 |
| Keywords contendo exatamente "medicina" | 433 |
| Pares `(source_url, question_number)` com duplicidade | 200 |
| Denominações editoriais de disciplina | 27 |
| Registros de reaplicação, conforme edição | 83 |

**Interpretação:** a numeração e identificação interna **não** demonstram correspondência com arquivo oficial; duplicidade de posição não autoriza exclusão de ID/histórico. O gabarito de 2026 anunciado pelo Inep está em versão preliminar na página consultada em 16/11/2026, portanto o rótulo "definitivo" exige prova adicional; **não alterar** valores ou tentativas nesta fase.

## 2. Artefatos de trabalho
- `DICIONARIO_COMPETENCIAS_478_2025_DRAFT.json`: 7 áreas (art. 3º); 15 competências I–XV (art. 6º); 6 contextos (art. 7º); 21 conteúdos (art. 8º), com **paráfrases editoriais** e `status=review_required`.
- `FILA_REVISAO_483_ENAMED_2026.csv`: todos os 483 IDs existentes; flags, edição, especialidade e proposta *heurística* de área para parte das linhas. Campos não inferidos permanecem vazios, para revisão humana. Não contém enunciados, alternativas, respostas nominais ou dados de alunos.
- `AUDITORIA_TAXONOMIA_20261116.md`: baseline anterior.

## 3. Critérios editoriais aplicáveis aos 483 itens (em fila)
A curadoria deve examinar enunciado, **pergunta efetiva**, alternativas, gabarito vigente, mídia indispensável e fonte primária. Resultado por item: `MANTER`, `REFINAR_TEMA`, `REFINAR_SUBTEMA`, `REFINAR_KEYWORDS`, `ATRIBUIR_COMPETENCIA`, `BLOQUEAR_POR_FONTE`, ou `REVISAR_COM_ESPECIALISTA`.

- **Tema:** eixo clínico ou saúde coletiva realmente avaliado, não apenas lista de sintomas.
- **Subtema:** decisão, raciocínio, conduta, propedêutica, interpretação ou comunicação exigida no comando.
- **Palavras-chave:** sinais, diagnósticos, técnicas, população, contexto e termos importantes para recuperação; metadados `enamed 2026` e `medicina` não devem ser descritores clínicos primários.
- **Competência oficial:** código de I a XV conforme Portaria 478/2025, principal + secundárias quando justificadas. **Atenção:** competência VI é procedimento médico; VII intervenção comunitária (corrige enumeração abreviada anterior).
- **Área oficial:** uma das sete áreas do art. 3º. Especialidade `Cardiologia`, `Geriatria` etc. deve ser preservada em campo separado. `Urgência/Emergência` integra contexto assistencial, não oitava área.
- **Conteúdo estruturante:** referenciar código art. 8º em dimensão própria, sem usar sinônimo de tema.
- **Interexames:** ENADE histórico e Residência Médica podem remeter a mesma competência transversal, mas nunca recebem *atribuição oficial* automática do INEP.

## 4. Amostra de revisão clínica preliminar (a confirmar no PDF original)
| ID | Leitura da classificação existente | Proposta não homologada |
|---|---|---|
| `enamed-2026-c1-q02` | Epiglotite aguda / emergência de via aérea | Manter tema; reconhecer diagnóstico clínico como operação principal (competência II candidata), urgência como contexto |
| `enamed-2026-c1-q10` | Complicações pós-hernioplastia / seroma ou hematoma | Subtema pode limitar indevidamente diferencial; priorizar conduta diante de inflamação da ferida; verificar comando/alternativas |
| `enamed-2026-c2-q01` | Dor torácica / diagnóstico diferencial | Comando pede conduta imediata: propor decisão clínica em potencial síndrome coronariana (V candidata), preservando diferencial secundário |
| `enamed-2026-c2-q10` | Vacinação / contraindicação | Manter TEA como contexto de desinformação/hesitação vacinal, sem centralizar TEA como diagnóstico; competência de comunicação/educação a conferir |
| `enamed-2026-c2-q11` | Crise vaso-oclusiva / manejo da dor | Manter tema e subtema; acrescentar analgesia e manejo de dor aguda como descritores específicos |

Sem revisão do PDF, não atribuir aprovação ou correção definitiva a nenhuma dessas cinco linhas.

## 5. Protocolo dual-IA e curadoria humana
1. **Auditoria documental:** recuperar PDF e gabarito oficiais, calcular hash, verificar edição/caderno/questão, imagens, anulações e retificações.
2. **Pré-proposta automática:** um classificador propõe tema, subtema, keywords clínicas, área e competência com trechos/justificativas.
3. **Duas IAs independentes:** usar revisão `thematic_review` já prevista no Sapiens com o mesmo snapshot, sem conversarem; manter os recibos, modelos, evidências e divergências. Revisão IA não atesta fonte sem verificação documental.
4. **Revisor médico:** aceita/rejeita/edita descritor final e mapeamento oficial; registrar data, versão, fonte e motivação.
5. **Aplicação transacional futura:** somente após aceite, versão estável do item, salvaguarda das tentativas existentes, mecanismo de rollback e testes. **Não executar UPDATE/DELETE/UPSERT no F&O nesta etapa.**

## 6. Matriz de saída e critérios de aceite
- [x] 483 IDs catalogados individualmente em fila de revisão.
- [x] Primeira taxonomia I–XV versionada em JSON, além de 7 áreas, 6 contextos e 21 conteúdos.
- [x] Regras estruturais e indicadores de auditoria calculados em leitura.
- [ ] Conferência de todas as 483 linhas contra provas e gabaritos INEP por página, versão e caderno.
- [ ] Parecer dual-IA para cada item elegível e validação de fonte.
- [ ] Homologação clínica e regulatória por revisão humana.
- [ ] Atualização segura do F&O e validação de histórico, bloqueada até o aceite acima.
- [ ] Integração real ao diagnóstico Sapiens e verificações ponta a ponta.

**Status correto:** E1 em andamento; proposta **preparatória** de E2/E3, sem início formal das etapas dependentes, sem alteração de produção ou homologação da indexação.
