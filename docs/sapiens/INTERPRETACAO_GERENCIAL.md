# Análise interpretativa do planejamento — proposta para integração

**Estado desta entrega:** implementação em branch de revisão, sem integração à `main`, sem aplicação desta migração ao banco real e sem publicação. A autorização para integrar e publicar deve ocorrer após a revisão desta proposta e dos testes. Dados usados nos testes e no exemplo visual são fictícios.

## Inventário realizado antes de desenvolver

| Recurso identificado | Função existente | Aproveitamento nesta proposta |
| --- | --- | --- |
| PRs #140 e #141; `vertice_planning.management` | Consolidação por instituição, última estratégia, plano semestral, metas, ações e resumos acadêmicos | Consulta comum extraída para `portfolio`, preservando o endpoint institucional e seu controle de acesso |
| PR #147; `SapiensPlanning`, RPC `vertice_sapiens_planning` e `planning.ts` | Interpretação com dois provedores, histórico e revisão humana | Evolução do mesmo painel, RPC, função Edge e tabela de pareceres |
| `vertice_private.ai_management_snapshot` | Panorama documental e de metas por dimensão | Mantido; seu resumo não substitui o catálogo de registros individuais necessário para citações verificáveis |
| Metas, medições, ações e repositório | Relações `goal_id`, `course_id`, `request_id` e documentos das ações | Leitura dos vínculos existentes, sem cópia dos cadastros |
| `vertice_learning_course_metrics` e resumos TCC/AC/Estágio | Indicadores agregados de aprendizagem e acompanhamento acadêmico | Contexto gerencial com período, cobertura e limitações |
| `v_student_evasion_risk` | Classificação por regras de risco cadastral | Apenas contagens por curso, quando a fonte existe; grupos menores que cinco suprimidos; sem nomes, CPF ou probabilidades individuais |
| Contexto institucional dos BIs no Sapiens | Inventário de disponibilidade dos módulos | Preservado na análise institucional e excluído dos pareceres de curso |

A PR #147 já estava integrada. Portanto, esta entrega amplia uma análise dedicada existente, em vez de criar outro motor. O inventário foi feito inicialmente no commit `df20d28f2cf75aece437d2874129ddcfe7897d7d`; atualizações posteriores da base são preservadas na preparação da branch.

## Proposta funcional

O gestor abre **Análise interpretativa · Sapiens** no planejamento do curso, na consolidação ou na área Sapiens já existente. A coordenação acessa o mesmo painel pelo planejamento do seu curso.

1. **Conferir o vínculo objetivo–meta.** Escolher um objetivo da versão salva, uma meta do mesmo curso e justificar como o indicador dessa meta mede o objetivo. A associação é explícita; coincidência de palavras não cria vínculo. Alterações do objetivo ou da definição do indicador (indicador, unidade, direção e, quando cadastradas, fórmula/população) tornam a associação pendente de revisão. O registro confirma as revisões carregadas do plano e da meta, sob bloqueio de linha. Uma nova versão não herda vínculos automaticamente.
2. **Gerar o parecer.** O servidor reúne o recorte permitido, calcula alertas cadastrais e envia o contexto ao motor existente. O outro provedor faz o contraditório quando está disponível.
3. **Ler a síntese e as prioridades.** Fatos registrados, tendências descritivas, hipóteses e lacunas têm identificação própria. Recomendações indicam prioridade, justificativa, papel sugerido, prazo proposto, indicador de verificação e os achados que as sustentam.
4. **Conferir cada fonte.** Abrir os metadados do registro congelado: tabela, identificador, campo, data/período, versão e valor usado. O catálogo é construído pelo servidor; a IA só pode citar referências existentes.
5. **Registrar revisão humana.** Direção e alta gestão podem revisar ou devolver o parecer mediante justificativa. A coordenação consulta o encaminhamento. Nenhum desses comandos publica planos ou cria metas, ações ou intervenções.

| Perfil | Escopo de leitura e geração | Vínculos objetivo–meta | Revisão gerencial |
| --- | --- | --- | --- |
| Coordenação/NDE | Curso explicitamente vinculado e ativo em `vertice_learning_staff_scope`; MFA obrigatório | Somente no curso autorizado | Consulta; não decide a revisão gerencial |
| Direção acadêmica | Instituição autorizada, com seleção de curso ou visão institucional | Cursos da instituição | Pode registrar revisão ou devolução |
| Reitoria, direção geral, gestor e procurador | Instituição autorizada | Cursos da instituição | Pode registrar revisão ou devolução |
| Master | Escopo institucional selecionado pelo portal | Cursos da instituição selecionada | Pode registrar revisão ou devolução |
| CPA, equipe, leitor e usuário sem vínculo/MFA | Não recebem este novo acesso | Sem acesso por esta funcionalidade | Sem acesso |

Os filtros de foco gerencial organizam a leitura; a autorização ocorre no banco antes da coleta e antes de chamar provedores. O seletor visual não concede permissão.

## Regras de interpretação

| Situação encontrada | Apresentação e limite |
| --- | --- |
| Objetivo sem associação compatível à meta | Lacuna de mensuração nesta versão |
| Meta marcada concluída e medição divergente do alvo | Divergência entre registros, com referência ao alvo, direção e medição; causa não determinada |
| Prazo vencido sem medição posterior ao prazo | Falta de aferição; uma medição anterior não demonstra o resultado no vencimento |
| Três medições sucessivas em direção adversa | Tendência descritiva da mesma meta cadastral; definição e população ainda exigem conferência |
| Última data com duas medições ou sem fonte | Comparação numérica bloqueada por ambiguidade ou origem insuficiente |
| Meta concluída sem medição com fonte, ação concluída ou documento validado/aprovado | Suporte cadastral de execução insuficiente nas fontes consultadas; não equivale a prova de que nada foi realizado |
| Documento ativo recém-enviado | Não conta como aprovação humana. Documento da Mesa Digital precisa de aprovação registrada, estado ativo, vigência e ausência de substituição |
| Repositório com arquivo antigo validado e arquivo novo devolvido | Usa o estado do arquivo mais recente da solicitação |
| Código de curso ou período duplicado | Valor indisponível; sem associação por aproximação de nomes ou soma automática |
| Queda no estoque de matrículas | Não é convertida em evasão ou retenção de coorte |
| Contagens declaradas de abandono, cancelamento, trancamento e transferência | Mantidas separadas; denominador e coorte não comprovados |
| Métricas Fato & Ordem | Grupos por disciplina, módulo, competência e semestre; cobertura dos participantes, sem soma de populações sobrepostas |
| Fonte ausente ou amostra pequena | Ausência/supressão explícita; nunca zero inventado |
| Recomendações e revisão por IA | Propostas para apreciação humana, mesmo se o revisor sugerir prosseguir |

## Alterações técnicas

- Migração aditiva `20261116004315_planning_interpretation_traceability.sql`. Nova tabela privada `vertice_planning.objective_goal_links`, com objetivo e definição do indicador congelados, versão, meta, justificativa, autor e datas de vínculo/encerramento. A função privada `indicator_definition` compara os atributos materiais; alterar título, alvo ou progresso não invalida por si só o significado do vínculo. Não altera linhas de planejamento, medições ou metas existentes.
- `portfolio` compartilha a consulta da consolidação. O endpoint institucional continua exigindo alta gestão; a coordenação só obtém o curso expressamente autorizado. O catálogo de semestres também respeita o curso. Sem período escolhido, o padrão não avança para carga acadêmica futura.
- A RPC existente ganha `links`, `link_objective` e `unlink_objective`. Histórico é filtrado por curso e período antes do limite de vinte registros. Revisões humanas usam transição condicional de `pending_review` e verificam instituição e perfil no servidor.
- Contexto enriquecido com até oito semestres, 24 medições por meta e cem grupos de aprendizagem, com limites e totais registrados. Dados acadêmicos futuros são excluídos das séries observadas, inclusive quando não há semestre observado disponível para seleção automática. Metas, documentos, ações, planos mais recentes e resumos TCC/AC/Estágio permanecem identificados como cadastro atual.
- Catálogo e verificações determinísticas em `interpretation.ts`, incluindo todos os campos estratégicos enviados ao motor, com valores congelados, versão e data de atualização. `planning.ts` valida o formato da IA, referências, séries temporais e ligações das recomendações aos achados. Tendência de IA exige um campo numérico explicitado, três observações elegíveis de períodos distintos na mesma série e justificativa de comparabilidade; números ausentes, duplicidades e ambiguidade do curso bloqueiam o rótulo; referência válida não é validação semântica da conclusão.
- Hash SHA-256 calculado sobre o contexto efetivamente persistido, inclusive enriquecimentos autorizados de triggers. Parecer de curso não recebe inventário institucional.
- Mesmo motor e provedores existentes, com alternativa quando o primeiro provedor falha e contraditório exclusivamente pelo outro provedor. Revisão ausente ou inválida é informada. Parecer continua aguardando revisão humana.
- A substituição da RPC preserva a integração escolar prévia `school_operations_context`, com seu recorte de ano e suas regras de agregação.
- O painel apresenta a definição atual e a definição confirmada no vínculo, informa mudanças de indicador e mantém histórico legado, indicando citações antigas como texto não estruturado. Notas de revisão são separadas por parecer; troca de instituição/curso limpa o estado e descarta respostas atrasadas da consulta anterior.
- Conferência de esquema real executada somente por consulta aos metadados de colunas. Nenhuma migração, escrita de negócio ou geração com provedores reais foi executada em produção nesta entrega.

## Validação e evidências

Os testes e seus resultados estão em [TESTES_INTERPRETACAO.md](TESTES_INTERPRETACAO.md). O exemplo visual reproduz o componente real com respostas simuladas e rótulo de dados fictícios; não cria serviço ou aplicação de produção.

## Limites e decisão pendente

Esta camada não implanta o PDI estruturado nem deliberação automática. Preserva o alinhamento declarado, sem apresentá-lo como integração comprovada. Não reconstrói o estado histórico de metas, definições de indicadores, documentos ou ações: o período acadêmico selecionado não transforma o cadastro atual em dado daquele passado. Não lê o conteúdo dos arquivos nem certifica a suficiência material da evidência.

A referência de fonte é verificada por existência no contexto. A exatidão interpretativa depende da revisão humana e da qualidade dos cadastros. Correções retroativas e mudanças de definição/população podem comprometer comparações; o parecer deve apresentar esses limites.

Recortes excessivos são recusados antes do consumo dos provedores, sem truncamento silencioso. A análise por curso é o recorte preferencial para conjuntos grandes. O tempo de resposta e a qualidade dos dois provedores reais ainda precisam de homologação no ambiente autorizado.

**Próxima decisão do usuário:** avaliar a proposta corrigida e autorizar expressamente as operações de implantação somente depois de concluir o pacote operacional. Preparar o controle de ativação do piloto e a reversão completa ainda é pendente; não se presume liberação gradual já configurada. O roteiro e os limites estão em [CORRECOES_REVISAO_PR157.md](CORRECOES_REVISAO_PR157.md). Na janela autorizada, suspender a publicação automática dos dois serviços existentes antes do merge; depois integrar o SHA aprovado, aplicar apenas o delta SQL revisado, publicar a Edge e homologar nos serviços expressamente incluídos. A homologação real deve verificar os perfis, fontes, geração, contraditório, histórico e revisão humana, preservando os planos.
