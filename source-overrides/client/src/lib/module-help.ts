// Catálogo de orientação dos módulos; somente texto local, sem chamadas de IA.
export const MODULE_HELP = [
  {
    "key": "base",
    "term": "Base da organização",
    "text": "Identifique a instituição com os dados oficiais do e-MEC: nome, sigla, CNPJ, código e-MEC, mantenedora, município e UF. Cadastre os cursos ativos com código, grau, modalidade e vagas autorizadas. Essas informações são a âncora de todos os outros módulos — metas, diagnóstico, ações, indicadores e evidências são vinculados a uma instituição e, quando aplicável, a um curso específico. Um curso fora do cadastro não pode receber metas nem evidências. Cursos encerrados devem usar a situação \"Em extinção\" ou \"Extinto\" para preservar o histórico sem poluir a visão ativa."
  },
  {
    "key": "metas",
    "term": "Metas e indicadores",
    "text": "Defina metas com indicador mensurável, linha de base, alvo, prazo, periodicidade, responsável e fonte do dado. O semáforo avalia automaticamente: vermelho para prazo vencido, amarelo para prazo em até 14 dias ou dados incompletos, verde na ausência desses alertas. Registre medições na periodicidade definida, mantendo sempre a mesma regra de cálculo e a mesma fonte — mudar o critério sem registrar invalida a comparação histórica. A barra de progresso calcula a distância entre linha de base e alvo: se a evasão era 18%, o alvo é 12% e a medição deu 15%, o progresso é 50%. Sem linha de base, o sistema indica apenas se o alvo foi atingido. Três a cinco metas por curso costumam ser suficientes para orientar a gestão sem diluir o foco. Vincule cada meta a ações do plano 5W2H para que fragilidades e melhorias estejam conectadas."
  },
  {
    "key": "plano",
    "term": "Plano de ação 5W2H",
    "text": "Cada ação responde a sete perguntas: O quê (a tarefa concreta, com verbo no infinitivo), Por quê (o achado ou meta que justifica), Onde (setor, campus ou instância), Quem (pessoa ou setor responsável), Quando (prazo final — ações vencidas sem conclusão aparecem como atrasadas), Como (os passos de execução) e Quanto custa (estimativa ou \"sem custo\"). Vincule a ação a uma meta ou a um achado do diagnóstico para rastrear origem e finalidade. A evidência de execução é o que comprova que a ação foi feita — ata, portaria, relatório ou link interno, nunca dados pessoais de alunos. Use \"Bloqueada\" quando a ação depende de aprovação, orçamento ou outro setor fora do controle do responsável. Ações canceladas permanecem no histórico com o registro da justificativa."
  },
  {
    "key": "diagnostico",
    "term": "Diagnóstico",
    "text": "Avalie cada critério com nota de 1 (muito frágil) a 5 (excelente), seguindo a mesma escala dos instrumentos de avaliação do INEP. Agrupe os critérios por dimensão (organização didático-pedagógica, corpo docente, infraestrutura) para visualizar onde estão as fragilidades. O achado descreve objetivamente o que foi encontrado — sem adjetivos ou juízos vagos. A evidência consultada é o documento que sustenta a nota: PPC, ata do NDE, relatório de sistema acadêmico. Use \"Criar ação\" para transformar um achado em item do plano 5W2H, já vinculado automaticamente. Um critério \"Resolvido\" exige evidência de que a situação mudou, não apenas que uma ação foi planejada. A prioridade orienta a ordem de tratamento: alta para risco regulatório ou impacto imediato sobre alunos, média para melhorias necessárias com prazo, baixa para aprimoramentos desejáveis."
  },
  {
    "key": "equipe",
    "term": "Equipe",
    "text": "O acesso é por convite vinculado a uma instituição. A Vértice cadastra gestores; gestores cadastram perfis Equipe e Leitura. A pessoa recebe um e-mail para criar senha e configurar o segundo fator (MFA) — obrigatório para todos os perfis que acessam dados institucionais. Perfis: Master (Vértice — acesso total a todas as IES, cria instituições e gestores), Gestor (responsável pela IES — edita dados, define metas, gere equipe, exclui registros), Equipe (operacional — registra medições, ações e diagnósticos, não altera metas nem exclui), Leitura (consulta — indicado para direção, mantenedora ou conselhos). Remoção de acesso desvincula a pessoa da instituição sem apagar a conta. Toda mudança de permissão é registrada na trilha de auditoria."
  },
  {
    "key": "emec",
    "term": "e-MEC · Regulação",
    "text": "Espelha os dados do cadastro e-MEC da instituição e dos cursos: atos regulatórios, conceitos (CI, CC, CPC, IGC, ENADE), prazos de validade e processos em andamento. Use para verificar a situação regulatória atualizada, identificar atos a vencer e acompanhar processos de reconhecimento, renovação ou recredenciamento. Os dados são consultados na base pública do INEP — atualize periodicamente e confira a data da última consulta antes de tomar decisões. Diferenças entre o cadastro no painel e o e-MEC devem ser corrigidas no próprio e-MEC pela PI da instituição."
  },
  {
    "key": "repositorio",
    "term": "Reconhecimento de Curso",
    "text": "Organiza as evidências documentais exigidas nos indicadores do instrumento de avaliação de cursos. A gestão define o documento, vincula ao indicador, designa o responsável e o prazo. O responsável envia a evidência; a gestão valida ou devolve com parecer fundamentado. Cada versão nova preserva as anteriores — nunca há perda de histórico. Documento enviado não significa indicador atendido: a validação confirma pertinência e suficiência. Nas metas, use \"Documentos da meta\" para acompanhar entregas sem confundir entrega documental com cumprimento de meta — medições continuam separadas. Organize por dimensão e indicador do instrumento vigente, e confira a aplicabilidade ao processo específico da instituição (reconhecimento, renovação ou recredenciamento)."
  },
  {
    "key": "biblioteca",
    "term": "Biblioteca INEP",
    "text": "Acervo de documentos-modelo, templates e referências regulatórias organizados por tipo e instrumento. Inclui modelos para PPC, relatório de autoavaliação, plano de melhorias e documentos exigidos nos instrumentos de avaliação. Os modelos são ponto de partida — cada instituição deve adaptar ao seu contexto, curso e ato regulatório. Ao usar um modelo, confira se corresponde ao instrumento e à versão vigentes para o processo da sua IES. Os templates aplicam automaticamente o branding institucional (logo, nome e cores) configurado na base da organização."
  },
  {
    "key": "avaliacao",
    "term": "Recredenciamento · Instrumento 2017",
    "text": "Organiza a preparação para avaliação institucional usando o instrumento de recredenciamento de 2017 (cinco eixos, indicadores com pesos). Para cada indicador, cadastre evidências, atribua conceito simulado e acompanhe a cobertura documental. Os donuts mostram o conceito simulado por eixo e o geral — são simulações internas, não conceitos oficiais do MEC. Confira a aplicabilidade: o instrumento de 2017 é usado para recredenciamento institucional e reconhecimento de curso. A proposta de novo instrumento (2026) está em área separada. Vincule evidências ao repositório para evitar duplicação e garantir rastreabilidade."
  },
  {
    "key": "novo_instrumento",
    "term": "Novo Instrumento",
    "text": "Acompanha a preparação da IES para os novos instrumentos de avaliação propostos pelo INEP a partir de 2026. Inclui checklist de conformidade por objeto de avaliação (Dimensões 1 a 4 para cursos, 5 eixos para institucional), vinculação de evidências, cronograma do ciclo trienal (ENADE → CPA → Visita) e monitoramento da prontidão da CPA. Os objetos de avaliação seguem a proposta submetida a consulta pública — títulos marcados como \"a confirmar\" serão atualizados quando o instrumento definitivo for publicado. Até a confirmação, trate o módulo como ferramenta de preparação, não como checklist oficial. Quando uma evidência se aplica a mais de um objeto, use o espelhamento transversal em vez de duplicar o documento."
  },
  {
    "key": "enade",
    "term": "ENADE 360°",
    "text": "Acompanha o desempenho dos cursos no ENADE e a preparação dos estudantes. Inclui histórico de resultados por curso e edição, elegibilidade (ingressantes ≤25% e concludentes ≥80% da carga), vinculação com a plataforma Fato & Ordem para simulados, e radar de coerência avaliativa entre notas internas e resultados externos. A elegibilidade é calculada automaticamente a partir do roster acadêmico importado — confira se o roster está atualizado antes de usar os números. O ENADE avalia o curso, não o aluno individualmente. Compare sempre a mesma edição e a mesma área ao cruzar resultados entre instituições."
  },
  {
    "key": "geral",
    "term": "Visão geral",
    "text": "Panorama da instituição consolidando dados de todas as abas: matrículas importadas, progresso das metas com semáforo, situação do plano de ação (ações atrasadas, bloqueadas, concluídas) e notas médias do diagnóstico por dimensão. Os números se atualizam em tempo real conforme medições, ações e critérios são registrados. Use os atalhos de cada quadro para navegar diretamente à aba correspondente. Se um quadro mostra zero, verifique se os dados já foram cadastrados — a visão geral reflete o que existe no sistema, não gera dados."
  },
  {
    "key": "visao",
    "term": "Matrículas",
    "text": "Quantitativos acadêmicos importados do sistema da instituição, preservados como na origem — não editáveis no painel. Quando o total do relatório e a soma das turmas diferem, o painel mostra ambos os valores e sinaliza a divergência para conferência com a secretaria. \"Matriculado\" refere-se ao vínculo por turma, não necessariamente ao aluno único — um estudante pode aparecer em mais de uma turma. Para calcular evasão e retenção reais é necessário cruzamento individual, que depende da importação nominal (Camada 2). Compare sempre o mesmo semestre, modalidade e fonte ao usar esses números."
  },
  {
    "key": "cadastro",
    "term": "Cadastro e cursos",
    "text": "Lista de cursos vinculados à instituição com código, grau, modalidade, vagas autorizadas, coordenador e situação. Mantenha os códigos e-MEC corretos — são a chave para cruzar relatórios, vincular metas e importar dados acadêmicos. Para cursos encerrados, use \"Em extinção\" (não recebe ingressantes, mas ainda tem alunos) ou \"Extinto\" (sem alunos), em vez de excluir — a exclusão apaga o histórico vinculado. A edição é restrita ao gestor e à Vértice; equipe e leitura apenas consultam."
  },
  {
    "key": "eorbit",
    "term": "e-ORBIT · Espelho",
    "text": "Espelho dos dados extraídos do sistema acadêmico e-ORBIT, específico da UNITOP. Inclui cursos, grades, turmas, quantitativos por semestre e alunos (quando importados na Camada 2). Os dados são uma fotografia da última sincronização — confira a data antes de usar. A Vértice é agnóstica de sistema acadêmico: o e-ORBIT é fonte da UNITOP, não da plataforma. Outras IES usarão seus próprios conectores. Dados legados importados por raspagem na v1 estão congelados até a ativação do conector oficial."
  },
  {
    "key": "backups",
    "term": "Backups Acadêmicos",
    "text": "Armazena cópias de segurança dos dados acadêmicos importados por CSV, planilhas ou bancos de dados. Cada importação registra origem, data, responsável e status de validação. Use para rastrear a procedência dos dados que alimentam os indicadores. A importação é idempotente — repetir com o mesmo arquivo não duplica registros. Confira os erros reportados na importação antes de usar os números nos indicadores."
  },
  {
    "key": "auditoria",
    "term": "BI · Reprovações de Todos os Cursos",
    "text": "Painel analítico de reprovações por curso, disciplina, professor e semestre. Diferencia reprovação por nota (desempenho insuficiente), por falta (frequência insuficiente) e após exame. A unidade é ocorrência em disciplina, não estudante único — um aluno reprovado em três disciplinas gera três registros. Use para identificar disciplinas com taxas atípicas, acompanhar a evolução semestral e diferenciar reprovações estruturais (currículo, pré-requisitos) de conjunturais (turma específica, semestre atípico). Cruze com dados de evasão para verificar se reprovação alta precede abandono."
  },
  {
    "key": "fontes",
    "term": "Importar dados de sites",
    "text": "Recebe dados de fontes externas autorizadas: planilhas do sistema acadêmico, CSV de relatórios e extrações autorizadas. Antes de importar, confira a instituição de destino, o período, o formato e as colunas esperadas. A importação valida tipos e rejeita linhas com erros, apresentando relatório detalhado ao final. Dados importados alimentam matrículas, cursos, indicadores e egressos conforme o tipo de extração. Não use este módulo para dados financeiros ou pessoais sem autorização explícita da IES."
  },
  {
    "key": "conexoes",
    "term": "Conexões de dados",
    "text": "Configura a integração entre o portal Vértice e o sistema acadêmico da IES. A instituição informa o tipo de conexão (API REST, banco somente-leitura, CSV/OneDrive ou agente local), a chave de autenticação, a frequência de sincronização e os escopos de dados autorizados. Cada escopo (matrículas, notas, frequência, financeiro) é autorizado separadamente com explicação da finalidade. Se a IES solicita um módulo que depende de um dado não autorizado, o sistema avisa que o dado precisa ser liberado. Conexão configurada não significa dados atualizados — confira a última sincronização bem-sucedida."
  },
  {
    "key": "ia",
    "term": "Análise Documental",
    "text": "Analisa documentos (PDFs e DOCXs) enviados ao repositório usando inteligência artificial. Extrai resumo, avalia conformidade regulatória de 0 a 100 e identifica achados tipados (conforme, parcial, ausente, crítico). Os achados são sugestões — a validação final é responsabilidade do gestor. O botão \"Pré-validar com IA\" submete o documento para análise; os pontos de interrogação \"?\" exibem textos prontos e não acionam a IA. A análise pode vincular o documento a indicadores de até três instrumentos simultaneamente (Reconhecimento 2017, Recredenciamento 2017 e Novo Instrumento 2026). Requer a chave ANTHROPIC_API_KEY ou OPENAI_API_KEY configurada nos secrets do Supabase."
  },
  {
    "key": "analise",
    "term": "Análise gerencial",
    "text": "Dashboard executivo com indicadores cruzados de todas as áreas: metas, ações, diagnóstico, matrículas, reprovações, evasão e regulação. Permite identificar correlações entre fragilidades (ex.: curso com evasão alta E reprovação alta E diagnóstico frágil em organização didático-pedagógica). Use para priorizar onde concentrar recursos e atenção da gestão. Os dados são os mesmos das abas individuais, consolidados em uma visão única — confira as datas de atualização de cada fonte."
  },
  {
    "key": "reitor",
    "term": "Área da Direção · EBITDA",
    "text": "Painel executivo para a direção e reitoria com indicadores econômico-financeiros: DRE, EBITDA, margem, ticket médio, inadimplência, ocupação de vagas e custo por aluno. No cálculo de EBITDA, utilize os valores da DRE do mesmo período e confira a memória de cálculo. EBITDA não representa caixa disponível nem preço de venda. A aba de captação traz dados de funil e investimento por canal — etapas informadas não comprovam matrícula acadêmica. Simulações manuais ficam separadas dos registros e não alteram indicadores. Inclui modo TV com auto-refresh para monitor do gabinete."
  },
  {
    "key": "resultado-curso",
    "term": "Resultado por Curso",
    "text": "Simula o resultado financeiro por curso cruzando matrículas reais (importadas do sistema acadêmico) com parâmetros de custo estimados: piso hora-aula por titulação (CCT vigente), encargos, overhead institucional, ticket médio e ensalamento ideal vs real. Não é contabilidade — é simulação gerencial para identificar cursos superavitários, equilibrados e deficitários. Os parâmetros são configuráveis por IES. Compare o ensalamento ideal (turmas cheias) com o real (turmas efetivas) para identificar ineficiência operacional. Suporta importação e exportação JSON para cenários."
  },
  {
    "key": "simulador",
    "term": "Simulador de Custo",
    "text": "Estima o custo por curso com base na titulação do corpo docente, piso hora-aula da CCT vigente, encargos (fator DSR), overhead institucional e ensalamento. Cruza matrículas reais com parâmetros estimados — os dados financeiros reais da IES (folha, receita, despesas) não são usados nesta simulação, porque o reitor optou por não abrir caixa contábil. A referência é a CCT 2026/2028 SINTEPP-TO com pisos por titulação: Graduado, Especialista, Mestre e Doutor. Use para comparar cenários (ex.: contratar doutores vs especialistas, aumentar ou reduzir turmas) e fundamentar decisões de viabilidade acadêmica."
  },
  {
    "key": "raio-x-direito",
    "term": "Raio-X do Curso",
    "text": "Visão 360° otimizada para reunião com a coordenação. Selecione um curso e veja numa única tela todos os dados da plataforma: matrículas e ocupação, metas com avanço, plano de ação 5W2H com atrasadas destacadas, diagnóstico com nota média e critérios frágeis, evidências regulatórias e pendências, projetos de extensão e participantes, casos de inclusão e PEIs ativos, egressos com cobertura cadastral, achados da CPA e corpo docente. Cada bloco tem link direto para a aba de origem. Ideal para reuniões de NDE, colegiado ou preparação para avaliação in loco."
  },
  {
    "key": "aprendizagem",
    "term": "Aprendizagem Conectada",
    "text": "Integra a Vértice com a plataforma Fato & Ordem para acompanhamento da aprendizagem por simulados. Inclui upload de roster (CSV com alunos por curso), conector de API do sistema acadêmico com mapeamento de campos e sync periódico, comunicação com alunos (email/WhatsApp/SMS) para convocação a exames, e radar de coerência avaliativa entre notas internas e resultados em simulados. O módulo ENADE vincula elegíveis ao banco ENADE do F&O automaticamente. ENAMED e residência médica pertencem ao ensino superior; ENEM pertence à Vértice Escolas. A vinculação do aluno é compulsória pela IES, com opt-out disponível para o estudante."
  },
  {
    "key": "egressos",
    "term": "Egressos 360°",
    "text": "Acompanhamento longitudinal de egressos — da formação à carreira. Seis abas: Visão Geral (KPIs de cobertura cadastral e contato válido), Base (listagem com filtros por curso, status e verificação), Importação (CSV com deduplicação por CPF hash), Pesquisas (instrumentos versionados por onda — conclusão, 6, 12 e 24 meses — com convites rastreáveis e respostas parciais), Indicadores (14 indicadores com fórmula, numerador, denominador e limitações — atividade remunerada, aderência à área, formação continuada, trabalho-ou-estudo sem duplicar pessoas), CPA (achados vinculados a indicadores e instrumentos INEP com ciclo de ação 5W2H e evidência). Pesquisa voluntária não é amostra probabilística. Denominador zero = \"não disponível\", não 0%. Faixas de renda não permitem cálculo de mediana exata. CPF armazenado apenas como hash SHA-256 para deduplicação."
  },
  {
    "key": "extensao",
    "term": "Extensão 360°",
    "text": "Gestão completa de projetos de extensão universitária com vinculação aos ODS. Cadastre projetos com eixo temático, equipe (professores com CPF/Lattes e alunos com matrícula), entregas e evidências com vinculação aos indicadores INEP (Dimensões 2, 3 e 5, Indicadores 5.3 e 5.4). Fluxo de governança: projeto concluído → análise pela Pró-Reitoria de Extensão (pode pedir correções) → Regulação valida → BI. O agente de IA sugere eixo temático e corrige vinculações equivocadas após ler o projeto. Acompanhe a cobertura por curso (Resolução CNE/CES 7/2018 exige 10% da carga em extensão) e gere dossiê regulatório."
  },
  {
    "key": "governanca",
    "term": "Governança 360°",
    "text": "Organiza órgãos colegiados (NDE, Colegiado de Curso, Conselho Superior, CPA como instância), membros com mandatos e portarias, reuniões com pautas e atas, deliberações e encaminhamentos com responsáveis e prazos. Cada deliberação pode gerar uma ação no plano 5W2H com rastreabilidade de origem. Diferencia decisões consultivas de deliberativas. Use para comprovar regularidade da governança acadêmica nas avaliações in loco: frequência de reuniões, presença de representação discente, docente e técnica, e produção efetiva de deliberações que se conectam a melhorias."
  },
  {
    "key": "inclusao",
    "term": "Inclusão 360° · PEI",
    "text": "Acompanhamento pedagógico de estudantes com necessidades específicas. Registre o caso, as adaptações necessárias, os apoios oferecidos e o Plano Educacional Individualizado (PEI) com objetivos, estratégias, responsáveis e cronograma. O PEI organiza metas pedagógicas individuais — não é laudo médico. Limite dados sensíveis ao estritamente necessário e restrinja acesso aos perfis autorizados (coordenação, Núcleo de Apoio). Use para demonstrar as políticas de inclusão e acessibilidade exigidas nos instrumentos de avaliação (Lei 13.146/2015 — Estatuto da Pessoa com Deficiência). Evidências de atendimento devem registrar providências, não diagnósticos."
  },
  {
    "key": "acompanhamento-especial",
    "term": "Acompanhamento Especial 360°",
    "text": "Regimes acadêmicos especiais: exercícios domiciliares (Decreto-Lei 1.044/69), regime de estudante-atleta, gestante, servidor público ou outras situações previstas no regimento. Registre o tipo de regime, período, fundamentação legal, responsável pedagógico, atividades previstas e entregas. Acompanhe o cumprimento das atividades sem expor informações clínicas desnecessárias — o módulo registra a providência acadêmica, não o prontuário médico. Inclua a data de início e fim, e o encerramento formal com avaliação do resultado acadêmico."
  },
  {
    "key": "cpa-autoavaliacao",
    "term": "CPA e Autoavaliação",
    "text": "Módulo completo e independente da CPA, não subordinado a Egressos. Fluxo: planejar → aplicar pesquisas → acompanhar participação → analisar resultados → identificar fragilidades → decidir → executar melhorias → registrar evidências → devolver resultados à comunidade → reavaliar o processo. Inclui biblioteca de referenciais INEP versionados (instrumento 2017 vigente e proposta 2026), governança da CPA (composição, mandatos, portarias, reuniões e atas), ciclos de autoavaliação com projeto e metodologia, instrumentos de pesquisa versionados por público (estudante, docente, técnico, egresso, sociedade), campanhas com estados granulares (elegível→concluído), respostas com pausa e retomada, achados com decisão rastreável (recusa não apaga o achado), ações 5W2H com avaliação de eficácia, devolutivas à comunidade e meta-avaliação do processo. Horas complementares desativadas por padrão — cada IES configura após aprovar suas regras."
  },
  {
    "key": "aquisicoes",
    "term": "Aquisições 360°",
    "text": "Gestão de compras institucionais com quatro etapas: cadastro de fornecedores (CNPJ, contato, histórico), requisições de compra (com fluxo de aprovação por alçada), cotações (comparativo de preços com justificativa de escolha) e ordens de compra (com acompanhamento de entrega). Use para demonstrar economicidade e transparência nas aquisições — exigência dos instrumentos de avaliação e boa prática de governança. Integrado ao plano 5W2H quando a ação de melhoria envolve aquisição de recursos."
  },
  {
    "key": "conta",
    "term": "Minha Conta",
    "text": "Exibe o pacote contratado pela IES, situação comercial, módulos ativados, faturas em aberto e histórico de pagamentos. O gestor consulta aqui o que sua instituição tem acesso e quando o trial expira. Módulos não contratados aparecem bloqueados com opção de degustação por 15 dias. Não altera permissões nem contrata serviços automaticamente — mudanças de pacote passam pelo canal comercial."
  },
  {
    "key": "contrato",
    "term": "Meu Contrato",
    "text": "Exibe as 18 cláusulas do contrato Vértice com resumo comercial (pacote, valor por aluno, piso, teto, implementação, trial), condições negociadas (cortesia, desconto, valor fixo) e status da assinatura digital. A assinatura eletrônica simples (Lei 14.063/2020) registra hash SHA-256 do contrato, IP, user-agent, timestamp e confirmação por e-mail. Os consentimentos LGPD são gerados automaticamente na assinatura: tratamento de dados, compartilhamento MEC, dados de alunos, dados de docentes, analytics e subprocessadores. Leia integralmente antes de assinar — a assinatura tem validade jurídica."
  },
  {
    "key": "modulos",
    "term": "Gerenciar Módulos",
    "text": "Permite ao master ativar e desativar módulos individualmente por IES. Cada módulo tem código, pacote de origem, tier e dependências. A ativação é por chave — liga e desliga sem reinstalação, migração ou perda de dados. Dados fluem entre módulos automaticamente (deliberação → ação 5W2H, concluinte → egresso, caso inclusão → evidência COMPLY). Módulos desativados ficam inacessíveis na interface, mas seus dados permanecem no banco para reativação futura. IES sem módulos configurados = tudo liberado (retrocompatibilidade com a base existente)."
  },
  {
    "key": "catalogo",
    "term": "Catálogo de Módulos",
    "text": "Vitrine dos módulos disponíveis com descrição, pacote, preço por aluno e opção de degustação gratuita por 15 dias. Os pacotes são cumulativos: Essencial (core + sync + financeiro + BI + comunicação), Regulação (+ instrumentos + biblioteca + repositório), Gestão 360° (+ governança + 5W2H + resultado por curso + CPA), Completo (todos os módulos). Add-ons avulsos: Fato & Ordem (simulados ENADE/OAB/CFC) e Financeiro Avançado (DRE/EBITDA). A degustação ativa o módulo com dados reais borrados — ao ativar, o blur sai instantaneamente porque os dados já estão no banco."
  },
  {
    "key": "integracao-ies",
    "term": "Configurar Integração",
    "text": "A IES informa a chave de API do seu sistema acadêmico, escolhe o tipo de conexão (API REST, banco somente-leitura, CSV periódico, OneDrive/SharePoint ou agente local na rede), define a frequência de sincronização e seleciona os escopos de dados autorizados — cada escopo tem explicação da finalidade e do que será acessado. Se a IES solicita um módulo que depende de um dado não liberado, o sistema alerta e informa o tempo de integração (24-72h). A Vértice é agnóstica de sistema acadêmico — busca informações em qualquer plataforma via conector oficial, nunca por raspagem."
  },
  {
    "key": "billing",
    "term": "Painel Financeiro",
    "text": "Visão financeira da plataforma para o master: MRR ativo e total, contratos em trial, base total de alunos, recebido, a receber e taxa de inadimplência. Permite criar contratos com cálculo automático (valor por aluno × base, respeitando piso e teto), registrar pagamentos, acompanhar ciclos de faturamento e negociar condições (cortesia total, desconto percentual ou valor fixo). O faturamento mensal é gerado automaticamente por pg_cron (06:00 UTC diário). Inadimplência acima de 30 dias suspende o acesso. Arrependimento: 7 dias após assinatura (art. 49 CDC), com cancelamento imediato e reembolso."
  },
  {
    "key": "escola-enem",
    "term": "ENEM 360°",
    "text": "Para Vértice Escolas. Acompanha o desempenho histórico no ENEM (média geral, por área e ranking municipal/estadual/nacional), resultados de simulados com heatmap de competências por habilidade (faixas: crítico, baixo, médio, alto), metas institucionais (nota média, taxa acima de 600, taxa acima de 700) e evolução semestral. Os simulados podem ser integrados ao Fato & Ordem (quando contratado) ou registrados diretamente. Compare sempre a mesma edição e a mesma área ao analisar evolução. Resultados ENEM oficiais têm defasagem — os do ano corrente são estimados por simulados."
  },
  {
    "key": "escola-egressos",
    "term": "Egressos Escolar",
    "text": "Acompanha o destino dos estudantes após o Ensino Médio: universidade pública ou privada, curso técnico, mercado de trabalho, exterior, gap year, forças armadas. Registra aprovações detalhadas por universidade × curso × tipo de ingresso (vestibular, SISU, ProUni, FIES) e pesquisa de satisfação. Indicadores: taxa de aprovação geral e por tipo, ranking de universidades de destino, evolução anual. Use para demonstrar resultados pedagógicos da escola, orientar a preparação por área e alimentar campanhas de captação com dados reais de aprovação."
  },
  {
    "key": "validacao",
    "term": "Validação Pendente",
    "text": "Fila central de documentos que passaram pela pré-validação com IA e aguardam aprovação humana dos vínculos sugeridos. Mostra KPIs (documentos pendentes, vínculos de alta/média/baixa compatibilidade), filtros por status e aprovação em lote para vínculos de alta compatibilidade. A IA sugere a quais indicadores e instrumentos o documento se aplica — cabe ao responsável confirmar, ajustar ou rejeitar cada vínculo. A sugestão da IA não equivale à validação da evidência. O espelhamento transversal vincula uma evidência a múltiplos instrumentos (Reconhecimento 2017, Recredenciamento 2017, Novo Instrumento 2026) quando pertinente."
  },
  {
    "key": "documentos",
    "term": "Gestão Documental",
    "text": "Módulo transversal de gestão documental inteligente para IES e escolas. Organiza documentos por 33 categorias (regulatórias, pedagógicas, administrativas, CEE/CME/SEDUC conforme dependência administrativa), com controle de vencimento, obrigatoriedade e conformidade. Upload para bucket privado (50MB/arquivo), análise por IA (resumo + score de conformidade + achados tipados), alertas automáticos para documentos críticos e busca full-text em português. A obrigatoriedade é dinâmica: escola privada exige CEE, municipal exige CME, estadual exige CEE sem CME. Exportações são protegidas contra injeção de fórmulas."
  },
  {
    "key": "sync",
    "term": "Central de Sincronização",
    "text": "Monitora a saúde de todos os módulos de dados da plataforma: última sincronização, status (ok, erro, pendente, nunca executou), origem e contagem de registros. Cobre 12+ módulos: e-ORBIT, cursos, matrículas, vestibular, professores, ENADE, diário de classe, biblioteca, compliance, captação, egressos e documentos. Conexão configurada não significa dados atualizados — confira o timestamp da última execução bem-sucedida e os erros reportados. O sincronizador Python (supabase-sync) roda na máquina local da IES com parsers por tipo de relatório e agendamento diário."
  }
];
