# Plano de Trabalho Cumulativo — ENAMED 360°
**Versão:** 1.0.0 · **Data-base:** 16/11/2026 · **Status:** planejamento; não executado integralmente

Documento de execução da [Bíblia do Projeto](./BIBLIA_DO_PROJETO_ENAMED_360.md). Cada fase deve começar com leitura das anteriores, verificação de código e fontes, e terminar atualizando este plano e a Bíblia. Não há compromisso com datas arbitrárias: a passagem depende de **gates de evidência**.

## Quadro-mestre de fases

| Ordem | Fase | Produto verificável | Dependência | Gate |
|---|---|---|---|---|
| 0 | Consolidação | Bíblia, plano, ADR, baseline e evidências | Nenhuma | Documentos versionados, escopo e riscos explícitos |
| 1 | Corpus normativo INEP | Índice de portarias, editais, notas, matrizes, provas, gabaritos, relatórios, microdados e retificações por edição | 0 | Documentos essenciais obtidos íntegros, hashes, vigência e metodologia conferidos |
| 2 | Dicionário e motor de cálculos | Matriz oficial versionada, elegibilidade e calculadora de indicadores | 1 | Casos de teste e resultados de referência reproduzidos; cálculo interno nunca rotulado oficial |
| 3 | Auditoria F&O completa | Relatório por item (ENAMED 2025/2026, ENADE histórico, Residência), evidências, duplicidade e classificação | 1,2 | Cobertura medida por edição/caderno e pareceres humanos para divergências |
| 4 | Reindexação pedagógica | Temas/subtemas/keywords refinados, competências e áreas oficiais vinculadas | 2,3 | Duas IAs independentes + revisão médica; recibos e aprovação registrada; sem perda de histórico |
| 5 | Plataforma de integração | Pipeline INEP Intelligence, ligações F&O→Vértice, evento e competência; ENAMED 360° em UI | 1–4 | Testes de CI/SQL/segurança, auditoria e deploy comprovados, regressão ENADE |
| 6 | Sapiens + diagnóstico longitudinal | Perfis pedagógicos por competência e origem, intervenções e devolutiva | 4,5 | Amostra/limitações visíveis, segregação entre exames, aprovação humana e testes ponta a ponta |
| 7 | Gestão acadêmica | Trilhas, PPC/internato, coordenação/NDE, metas 5W2H e relatórios | 5,6 | Indicadores ligados às metas, rastreabilidade e isolamento por curso/IES |
| 8 | Homologação sistêmica | Conjunto de testes e evidências de produção, manual de operação | 1–7 | Segurança, QA e conformidade aprovados; observabilidade e rollback |
| 9 | **Piloto com IES real (FUTURO)** | Análise pontual de resultados reais de uma faculdade | 8 + dados e autorização fornecidos posteriormente | Conciliação com fonte oficial, diagnóstico, revisão de limitações |
| 10 | Expansão multiesinstitucional | Entrada gradual de cada nova IES | 9 | Testes por tenant, contratos, integridade e monitoramento |

## Detalhamento operacional e checklists

### ETAPA 0 — Fundação documental e baseline
**Concluído neste ciclo:**
- [x] Bíblia e plano criados em branch de desenvolvimento vinculada à PR #168.
- [x] Escopo genérico sem resultados de IES reais, com piloto formalmente posterior.
- [x] Fotografia de auditoria do Supabase do Fato & Ordem em 16/11/2026.
- [x] Conjunto de integrações existentes identificado, sem comprovação de ponta a ponta.
**A fazer:**
- [ ] Revisão cruzada da Bíblia e links entre documentos, conferência de CI e aceite do mantenedor.
**Saída:** documentos, responsáveis por papel e fontes históricas estabelecidos.

### ETAPA 1 — Auditoria normativa e corpus INEP
- [ ] Recuperar integralmente TODOS os atos aplicáveis de 2025/2026 e seus anexos; identificar fontes primárias; registrar os atos revogados/retificados.
- [ ] Verificar 330/2025, 413/2025, 478/2025, 780/2025, NT 40/2025, atos complementares, MP 1.370/2026 e editais 2026: título exato, vigência e função no sistema.
- [ ] Obter prova ENAMED por edição/caderno/reaplicação e gabaritos com hash por versão, incluindo anulações e correções.
- [ ] Obter matriz ENADE de Medicina histórica e documentação aplicável; não inventar equivalência entre edições.
- [ ] Obter dicionários/microdados públicos e layout dos relatórios por curso; mapear restrições de granularidade.
- [ ] Listar cada prova de Residência médica por organizador/edital e a autorização de uso.
**Gate:** corpus reproduzível, trilha de fonte e parecer metodológico. **Não iniciar cálculo normativo com regras não verificadas.**

### ETAPA 2 — Modelo oficial e cálculo
- [ ] Criar dicionário de áreas, competências, atributos, contextos e conteúdos, com códigos originais e `matrix_version_id`.
- [ ] Validar lista exata das 15/12 competências por matriz/edição, sem inferir códigos de resumo.
- [ ] Modelar regras de habilitação, presença, amostra válida e Sem Conceito conforme ato aplicável.
- [ ] Codificar conversão de percentual de concluintes proficientes em Conceito Enade **por edição** com testes de fronteira.
- [ ] Separar algoritmo de nota TRI/Angoff/equalização INEP de cálculos de acerto interno; se parâmetros indisponíveis, indicador oficial apenas importado, não reproduzido.
- [ ] Publicar nota metodológica em cada painel; divergência documentada bloqueia o indicador.
**Gate:** testes automatizados de limites, reproduzibilidade de casos públicos e autorização metodológica.

### ETAPA 3 — Confronto do acervo
- [ ] Resolver duplicidades 2026 C1/C2 pelo identificador de origem e histórico de tentativas, sem exclusão automática.
- [ ] Levantar ENAMED 2025 ausente do banco auditado e reaplicação de 2026 incompleta.
- [ ] Revisar os 483 registros ENAMED por PDF completo: texto, comando, alternativas, imagens, gabarito, edição, status e origem.
- [ ] Confrontar 1.934 registros ENADE e 200 de Residência, segregando a aplicação à formação médica.
- [ ] Para cada item emitir `validado / divergente / impossível verificar / dependente de revisão humana` com código de razão e prova documental.
- [ ] Resolver marcação `definitivo` em ENAMED 2026 somente quando documento oficial definitivo estiver comprovado.
**Gate:** inventário item-a-item assinado editorialmente, taxa de cobertura explícita e relatório de divergência.

### ETAPA 4 — Indexação pedagógica
- [ ] Revisar tema, subtema, keywords com foco no comando e competência, preservando campos históricos.
- [ ] Transferir `medicina` e `enamed 2026` de palavras clínicas para metadados de módulo/edição.
- [ ] Relacionar disciplinas às 7 áreas normativas, preservando subespecialidades.
- [ ] População `competencies=[]` dos 483 registros somente após confronto e homologação.
- [ ] Executar revisões independentes OpenAI/Anthropic com comprovante, modelo, evidência e versão do snapshot.
- [ ] Revisores médicos autorizados avaliam divergências, bloqueios, casos multimodais e gabaritos.
- [ ] Atualizações de F&O por lote idempotente e auditável, precedidas por preview e aprovação específica.
**Gate:** 100% dos itens-alvo classificados em um dos estados (validado/pendente/bloqueado), sem homologação automática.

### ETAPA 5 — ENAMED 360° e INEP Intelligence
- [ ] Revisar interface criada em PR #168 (fontes/curso/auditoria) e testar acessibilidade/responsividade.
- [ ] Reutilizar ENADE 360°, Trilhas, currículo, Sapiens e 5W2H; nenhuma duplicação indevida.
- [ ] Implementar catálogo de documentos e importador INEP em staging, com versões/hash, sem dados de IES reais ainda.
- [ ] Adaptar `TrailAnalysis.tsx` que contém prompt “curso de Direito” para templates por curso e exame.
- [ ] Reutilizar `vertice-learning-bridge`, verificar esquemas, RLS, MFA, mapeamentos, vínculos acadêmicos e idempotência.
- [ ] Criar painel de status de fonte: pendente, preliminar, definitivo, retificado, homologado; indicador e amostra visíveis.
- [ ] Realizar smoke tests com dados sintéticos e comparação de fontes públicas apenas.
**Gate:** CI, banco, segurança e deploy testados; PR revisada e homologada antes de merge.

### ETAPA 6 — Diagnóstico longitudinal e Sapiens
- [ ] Criar snapshot individual por competência com eventos e origem (ENAMED/ENADE histórico/Residência).
- [ ] Manter percentuais segregados; calibrar e comparar apenas quando houver método validado.
- [ ] Exibir nível de confiança, quantidade de evidências e janela temporal, sem precisão falsa.
- [ ] Sapiens propõe plano individual e plano coletivo; docente e coordenação aprovam.
- [ ] Definir não resposta, reapresentação de itens, questão anulada e conflito de gabarito.
- [ ] Validar mesmo aluno, curso e IES com origem acadêmica legítima.
**Gate:** testes longitudinais com perfis sintéticos, segurança e avaliação por especialistas.

### ETAPA 7 — Planejamento, currículo e indicadores
- [ ] Cruzar competências com PPC/DCNs/ementas/planejamento semestral/internato;
- [ ] Vincular diagnósticos validados a metas 5W2H, responsável, orçamento, prazos e verificação;
- [ ] Relatório para NDE, coordenação, reitoria, com edição, amostra, fonte e limitações;
- [ ] Verificar indicadores de sucesso de aprendizagem, sem confundir correlação com causalidade;
- [ ] Integrar Conecta 360° para continuidade do egresso conforme finalidade e autorização.
**Gate:** teste de ciclo completo da detecção de lacuna à medição de intervenção.

### ETAPA 8 — Homologação genérica, sem IES real
- [ ] Testes de unidade, integração, banco, RLS, permissão por curso, acessibilidade, celular/desktop, carga e segurança;
- [ ] Demonstrar processamento de retificação INEP e reprocessamento controlado;
- [ ] Relatórios auditáveis sem dados nominais em painéis comparativos;
- [ ] Comprovar logs Render/Supabase/CI, rollback e recuperação;
- [ ] Revisar Bíblia e criar versão 2.0 “pronto para piloto”.
**Gate:** aceite técnico, metodológico, editorial, segurança e produto. Nenhum status fictício de publicação.

### ETAPA 9 — Piloto real de UMA faculdade (somente após fornecimento)
- [ ] Solicitar dados institucionais/restritos somente quando responsável os disponibilizar legitimamente;
- [ ] Identificar edição, curso e-MEC, relatórios originais, consentimento/base legal e política de tratamento;
- [ ] Executar reconciliação de indicadores sem ajustes ad hoc não generalizáveis;
- [ ] Confrontar resultado oficial × indicadores internos × hipóteses do Sapiens;
- [ ] Elaborar parecer de melhoria da ferramenta e da estratégia pedagógica;
- [ ] Homologar mudanças genéricas, sem expor dados da faculdade a outros tenants.
**Gate:** validação institucional assinada. Cada IES seguinte terá seu próprio dossiê, com isolamento.

## Regra de handoff por etapa
A etapa N+1 só inicia com este bloco preenchido e incorporado à Bíblia:

```
ETAPA:
Versão da Bíblia e commit:
Documentos INEP e versões consultadas:
Hipóteses e decisões:
Código e dados efetivamente alterados:
Testes, logs e evidências:
Aceites (técnico/médico/metodológico/gestor):
Pendências e riscos:
Mudanças nos módulos ENADE / ENAMED / Residência / Sapiens / Vértice:
Próxima etapa e pré-requisitos:
```

## Responsáveis por função (não são pessoas já designadas)
- **Produto/coordenação Vértice:** escopo, prioridades, aceite e relação com IES.
- **Especialista regulatório/metodológico:** INEP, matriz, edital, notas e cálculo.
- **Editor médico habilitado:** pertinência clínica, gabarito, tema, subtema e intervenção.
- **Engenharia F&O:** integridade dos itens, tentativas, sincronização e revisão IA.
- **Engenharia Vértice/Supabase:** matriz, segurança, importação, indicadores e portais.
- **Sapiens/psicometria:** interpretação do desempenho, calibração e limites da inferência.
- **Segurança/LGPD:** permissões, isolamento e proteção da informação.
Não existe aprovação implícita de qualquer uma dessas funções.

## Indicadores de execução (não confundir com indicadores de alunos)
- % documentos críticos INEP íntegros, versionados e conferidos;
- % questões com confrontação íntegra e gabarito vigente;
- % questões com competência oficial validada, tema/subtema e keywords revisados;
- % inconsistências duplicadas resolvidas sem quebra de vínculos;
- % testes de segurança/CI/QA aprovados;
- % fluxos F&O → Vértice → Sapiens → planejamento homologados;
- % indicadores oficiais com proveniência e metodologia completa.

## Diário de execução
**16/11/2026:** etapa 0 parcialmente concluída. Catálogo e regras descritos; captura integral do corpus INEP, confrontação semântica total e implementação funcional do motor permanecem pendentes. PR #168 é rascunho; nenhum dado de IES real foi importado.
