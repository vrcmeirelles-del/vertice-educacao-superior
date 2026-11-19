# BÍBLIA-MESTRA · VÉRTICE AVALIA 360°
## Adendo técnico cumulativo 001 · Motor Algorítmico Pedagógico Longitudinal v1

Data: 2026-11-19 | Estado: código proposto em branch, não homologado nem publicado.

### Decisões preservadas
- O algoritmo precede os formulários, o QR Code, a correção discursiva, a TRI e a integração com IA.
- Construção Curricular permanece fonte primária: `curriculum_builds`, `curriculum_competencies`, `curriculum_discipline_links`.
- Independência entre finalidade diagnóstica/formativa/somativa e referencial externo (ENADE, OAB, CFC, ENAMED etc.).
- Autonomia docente: pareceres consultivos e justificáveis; nenhuma modificação automática de notas, provas ou itens.
- Conhecimentos prévios podem vincular diferentes períodos e disciplinas, somente quando o vínculo estiver explicitamente informado.
- Correlação não prova causalidade: erros não são atribuídos automaticamente a docentes, estudantes ou disciplinas.
- Segurança multi-IES, acesso por perfil, versionamento e auditoria são exigências para integração futura.

### Evidências verificadas no código existente
- Componente `source-overrides/client/src/components/area/CurriculumBuilder.tsx` consulta `curriculum_builds`, `curriculum_competencies` e `curriculum_discipline_links`.
- Migração `supabase/migrations/20261107230000_learning_alignment_metrics.sql` produz métricas agregadas somente com mapeamentos validados e usa limiar de grupo >= 5.
- O componente Curricular armazena competência, código, título, descrição, ordem e disciplina vinculada; não se deve presumir tema, subtema, período, pré-requisito ou rubrica já existentes nele.
- Há referência ao PPC no repositório, mas o código inspecionado apenas identifica o documento e pede extração manual do perfil; não comprova extração automática de competências.

### Contrato do primeiro motor
Arquivo: `source-overrides/client/src/lib/avalia360/longitudinal-engine.ts`.

Entrada: avaliação (instituição, curso, período, disciplina, finalidades, competências e temas esperados, dificuldade pretendida, questões), catálogo de competências e temas, resultados objetivos opcionais.

Saída: quantidade de itens/pontos; cobertura por competência/tema; vínculos longitudinais declarados; distribuição e média de dificuldades **estimadas**; acerto descritivo por questão; alertas fundamentados por código e identificadores das questões; estado de integridade dos dados.

Regras de cautela:
1. `evidence=declarada` não equivale a aderência textual comprovada.
2. Nenhum percentual deste núcleo equivale a conceito oficial do MEC, nota ENADE ou proficiência TRI.
3. Dificuldade estimada e dificuldade observada são dimensões separadas.
4. Amostras pequenas recebem indicação `amostra_reduzida`; não gerar interpretação psicométrica avançada.
5. Ausência de temas ou competências gerará alerta de cobertura, e não uma reprovação automática da prova.
6. O motor é puro: sem conexão de rede, acesso ao banco, escrita, autenticação, correção discursiva ou QR Code.

### Etapas posteriores — não confundir com funcionalidades entregues
- Tabela institucional de temas, subtemas, habilidades, relações interdisciplinares e evolução por período, versionada e protegida por RLS.
- Adaptador de leitura para estruturas reais da Construção Curricular (sem escrever nelas).
- Formulários e importação de prova, com validação dos metadados.
- Cartão-resposta com QR Code, leitura OMR e resolução de leituras ambíguas.
- Rubricas discursivas e validação docente.
- TCT com controles de tamanho amostral; TRI somente após calibração psicométrica apropriada.
- Contratos de integração com Sapiens 360°, Fato & Ordem e Planejamento Estratégico.
- Homologação de permissões, multi-IES e isolamento de dados.

### Critérios de aceite da Entrega 1
- [x] Código do motor determinístico versionado em branch isolada.
- [x] Arquivo de testes para cobertura, longitudinalidade, dificuldades e validação.
- [ ] Execução do teste automatizado em CI confirmada.
- [ ] Revisão técnica do contrato de dados e dos limites científicos.
- [ ] Conexão à estrutura curricular real com controle de versões.
- [ ] Homologação pedagógica com PPC e prova reais de instituição autorizada.
- [ ] Publicação controlada e aprovação operacional.

### Regra de manutenção
Toda próxima alteração acrescentará um adendo numerado contendo o que mudou, o que foi preservado, diferenças entre pedido/código/teste/homologação/publicação, evidências e pendências. Não substituir o histórico por um resumo do estado atual.
