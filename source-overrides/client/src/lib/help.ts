// Textos de ajuda da área real: campos, abas, glossário e perguntas frequentes.
// Fonte única para o painel e para a página pública /guia.
import type { Field } from "@/lib/area";

type HelpMap = Record<string, string>;

export const FIELD_HELP: Record<"institution" | "course" | "goal" | "measurement" | "action" | "diagnosis", HelpMap> = {
  institution: {
    name: "Nome oficial, exatamente como aparece no cadastro e-MEC.",
    acronym: "Como a instituição é conhecida no dia a dia. Ex.: a sigla usada nos documentos oficiais.",
    cnpj: "Informe o CNPJ completo, com ou sem pontuação. Novos CNPJs também podem conter letras. O cadastro abre a Base da organização; não concede acesso a outros clientes ou mandatos.",
    emec_code: "Código da instituição no cadastro e-MEC. Consulte em emec.mec.gov.br.",
    maintainer: "Pessoa jurídica responsável pela instituição (a mantenedora), quando houver.",
    city: "Município da sede.",
    state: "Unidade da Federação da sede.",
    status: "“Arquivada” guarda o histórico, mas indica que a instituição não está mais em acompanhamento.",
    notes: "Informações de contexto úteis para quem vai trabalhar com esta instituição. Não registre dados pessoais.",
  },
  course: {
    name: "Nome do curso como consta no ato regulatório. Ex.: Direito.",
    code: "Código do curso no e-MEC ou o código interno usado nos relatórios. Ajuda a cruzar dados.",
    degree: "Bacharelado, licenciatura, tecnólogo etc.",
    modality: "Presencial, semipresencial ou EAD, conforme o cadastro do curso.",
    status: "“Em implantação” para curso autorizado ainda sem turmas; “Em extinção” quando não recebe novos ingressantes.",
    vacancies: "Vagas anuais autorizadas no ato regulatório. Deixe em branco se não tiver certeza.",
    coordinator: "Nome de quem coordena o curso atualmente.",
  },
  goal: {
    title: "O resultado que se quer alcançar, em uma frase com verbo. Ex.: Reduzir a evasão do 1º ano do curso de Direito.",
    indicator: "O número que mostra se a meta está sendo cumprida. Ex.: Taxa de evasão anual (%).",
    course_id: "Escolha um curso se a meta for só dele. Deixe em branco para metas da instituição inteira.",
    unit: "Como o número é medido: %, alunos, nota, R$, dias… Ex.: %.",
    direction: "Se o bom resultado é o número subir (aumentar), cair (reduzir) ou ficar estável (manter).",
    baseline: "O valor do indicador hoje, antes das ações. É o ponto de partida. Ex.: 18.",
    baseline_date: "Quando a linha de base foi medida. Ex.: o fim do semestre 2026/1.",
    target: "O valor que se quer atingir até o prazo. Ex.: 12.",
    due_date: "Até quando a meta deve ser alcançada.",
    frequency: "De quanto em quanto tempo o indicador será medido de novo.",
    owner_user_id: "Conta já vinculada à IES como Equipe ou Gestor. O repositório usa esta atribuição como responsável inicial pelas entregas da meta.",
    owner_name: "Quem responde pela meta. Pode ser cargo ou nome. Ex.: Coordenação do curso de Direito.",
    status: "“Planejada” ainda não começou; “Em acompanhamento” está valendo e recebe medições.",
    source: "De onde sai o número. Ex.: relatório de matrículas do sistema acadêmico, CPA, secretaria.",
    formula: "Como o número é calculado, para que todos calculem igual. Ex.: alunos que saíram no ano ÷ matriculados no início do ano × 100.",
    notes: "Contexto, premissas ou cuidados na leitura do indicador.",
  },
  measurement: {
    measured_on: "Data a que o número se refere (não a data em que você está digitando).",
    value: "O valor do indicador nessa data, na mesma unidade da meta. Use ponto ou vírgula para decimais. Ex.: 15,5.",
    source: "Documento ou sistema de onde o valor foi tirado.",
    note: "Algo que explique o resultado. Ex.: troca de sistema acadêmico no período.",
  },
  action: {
    what: "O quê: a ação concreta, começando por verbo. Ex.: Revisar o PPC com o NDE.",
    why: "Por quê: o problema ou a meta que a ação resolve.",
    goal_id: "A meta que esta ação ajuda a alcançar, se houver.",
    finding_id: "O achado do diagnóstico que originou a ação, se houver.",
    course_id: "O curso envolvido. Em branco quando a ação é da instituição.",
    who: "Quem: a pessoa ou setor responsável pela entrega. Ex.: Coordenação + NDE.",
    where_at: "Onde: setor, campus ou instância em que a ação acontece. Ex.: Reunião do NDE.",
    start_date: "Quando a execução começa.",
    due_date: "Quando: prazo final de entrega. Depois dessa data, ações não concluídas aparecem como atrasadas.",
    how: "Como: os passos principais da execução.",
    how_much: "Quanto custa: valor estimado ou “sem custo”. Ex.: R$ 2.000 ou sem custo.",
    status: "Atualize sempre que a situação mudar. “Bloqueada” quando depende de algo fora do controle do responsável.",
    progress: "Percentual aproximado já executado, de 0 a 100.",
    evidence: "O que comprova a execução. Ex.: Ata do NDE de 12/10/2026, portaria nº 15, link do documento interno.",
  },
  diagnosis: {
    dimension: "A área avaliada. Agrupa os critérios para mostrar onde estão as fragilidades.",
    course_id: "O curso avaliado. Em branco quando o critério é institucional.",
    criterion: "O que está sendo verificado, em forma de afirmação. Ex.: O PPC está atualizado às DCNs vigentes.",
    reference: "A norma ou indicador que serve de régua. Ex.: Instrumento de avaliação do INEP, indicador 1.1.",
    score: "De 1 (muito frágil) a 5 (excelente), na mesma lógica dos instrumentos do INEP. Use 0,5 se precisar.",
    priority: "Alta: risco regulatório ou impacto imediato. Média: precisa de plano. Baixa: melhoria desejável.",
    status: "Aberto até haver ação; “Em tratamento” enquanto a ação corre; “Resolvido” quando a evidência confirma.",
    assessed_on: "Quando a verificação foi feita.",
    finding: "O que foi encontrado, em linguagem objetiva. Ex.: A matriz não registra a extensão curricularizada.",
    evidence: "O documento ou fonte consultada para chegar à nota. Ex.: PPC 2022, atas do NDE de 2025.",
  },
};

export function withHelp(fields: Field[], help: HelpMap): Field[] {
  return fields.map(f => (help[f.name] && !f.help ? { ...f, help: help[f.name] } : f));
}

export const TAB_HELP: Record<string, { title: string; text: string[] }> = {
 novo_instrumento:{title:"Preparação para o Novo Instrumento INEP 2026",text:["Este módulo acompanha a preparação da IES para os novos instrumentos de avaliação in loco, com ciclo trienal obrigatório a partir de 2026.","Use o Checklist para mapear a conformidade de cada objeto de avaliação (Dimensões 1 a 4), vincule evidências, acompanhe o cronograma do ciclo (ENADE → CPA → Visita) e monitore a prontidão da CPA.","Os objetos de avaliação seguem a proposta do INEP apresentada nas consultas públicas de 2025-2026. Títulos marcados como 'a confirmar' serão atualizados quando o instrumento definitivo for publicado."]},
 repositorio:{title:"Da meta à evidência documental",text:["A gestão define o documento, a meta, o curso, o responsável e o prazo. Use um dos modelos do catálogo ou uma exigência personalizada.","O responsável envia a evidência e a gestão valida ou devolve com parecer. Cada nova versão preserva as anteriores. A IES tem seu próprio repositório, acessível somente às contas vinculadas e à administração Vértice.","Nas metas, use Documentos da meta para acompanhar as entregas. Documento enviado não significa meta cumprida; as medições da meta continuam separadas."]},
  geral: {
    title: "O que esta visão mostra",
    text: [
      "Um retrato da instituição a partir dos dados lançados no painel: matrículas importadas, progresso das metas, situação do plano de ação e notas do diagnóstico.",
      "Os números se atualizam assim que alguém registra uma medição, uma ação ou um critério. Use os atalhos de cada quadro para abrir a aba correspondente.",
    ],
  },
  cadastro: {
    title: "Para que serve esta aba",
    text: [
      "Reúne os dados de identificação da instituição e a lista de cursos. Tudo o que é registrado nas outras abas pode ser ligado a um destes cursos.",
      "Mantenha os códigos do e-MEC e as modalidades corretos: eles são a base para cruzar relatórios.",
    ],
  },
  metas: {
    title: "Como funcionam as metas",
    text: [
      "Comece pelo resumo da alta gestão: cartões com semáforo, distribuição dos alertas e cobertura de medições, responsáveis e prazos. Clique em uma cor para filtrar os cursos e as metas.",
      "Sempre que houver um novo número, use “Registrar medição”. A barra mostra quanto do caminho entre a linha de base e o alvo já foi percorrido.",
      "Abra um curso para consultar o motivo de cada alerta. O verde indica ausência dos alertas definidos ou conclusão registrada; não comprova validação documental nem resultado por si só.",
    ],
  },
  plano: {
    title: "Como funciona o plano 5W2H",
    text: [
      "Cada linha é uma ação respondendo a sete perguntas: o quê, por quê, onde, quem, quando, como e quanto custa.",
      "Ligue a ação a uma meta ou a um achado do diagnóstico para saber por que ela existe. Atualize a situação, o avanço e a evidência à medida que avança.",
      "Ações vencidas e não concluídas aparecem destacadas como atrasadas.",
    ],
  },
  diagnostico: {
    title: "Como funciona o diagnóstico",
    text: [
      "Registre cada critério verificado com uma nota de 1 a 5, o achado e a evidência consultada. Os critérios são agrupados por dimensão, com a média de cada uma.",
      "Use “Criar ação” para levar um achado direto ao plano 5W2H.",
    ],
  },
  equipe: {
    title: "Como dar acesso",
    text: [
      "Informe o e-mail e escolha o perfil. Se a pessoa ainda não tiver conta, ela recebe um convite por e-mail para definir senha e segundo fator; o acesso é liberado no primeiro login.",
      "Gestores podem dar acesso como Equipe ou Leitura. Só a Vértice cadastra gestores.",
    ],
  },
};

export type GlossaryEntry = { term: string; text: string };
export const GLOSSARY: { group: string; entries: GlossaryEntry[] }[] = [
  {
    group: "Acesso e perfis",
    entries: [
      { term: "Master", text: "Perfil exclusivo da equipe Vértice. Acesso total a todas as instituições cadastradas: cria novas IES, cadastra gestores, configura módulos, altera contratos e visualiza dados cross-instituição. É o único perfil que pode conceder o papel de Gestor. Responsável pela integridade da plataforma e pelo suporte de primeiro nível." },
      { term: "Gestor", text: "Responsável operacional pela instituição no portal. Edita dados institucionais e de cursos, define e altera metas, gere a equipe (convida e remove perfis Equipe e Leitura), valida evidências, exclui registros e configura integrações. Vê apenas a(s) IES a que está vinculado. Pode ser o PI, a direção acadêmica ou quem a IES designar. Não vê dados de outras instituições — o isolamento é aplicado no banco, não apenas na interface." },
      { term: "Equipe", text: "Perfil operacional para quem executa o trabalho do dia a dia: registra medições de indicadores, cadastra ações no plano 5W2H, preenche critérios do diagnóstico, envia evidências documentais e atualiza andamento. Não pode alterar metas, excluir registros nem convidar novos membros. Indicado para coordenadores de curso, membros do NDE, secretaria acadêmica e CPA." },
      { term: "Leitura", text: "Acesso somente consulta, sem possibilidade de criar, editar ou excluir qualquer registro. Indicado para direção, mantenedora, conselhos superiores, auditoria interna ou parceiros que precisam acompanhar indicadores sem intervir nos dados. Vê as mesmas informações do Gestor, mas sem botões de ação." },
      { term: "Convite", text: "Mecanismo de entrada na plataforma. O gestor informa o e-mail da pessoa e o perfil desejado; o sistema envia um link para criação de senha e configuração do segundo fator (MFA). O vínculo com a instituição é criado no primeiro login bem-sucedido. Convites pendentes podem ser reenviados ou cancelados. Se o e-mail já tiver conta, o convite adiciona o vínculo institucional sem criar conta duplicada." },
      { term: "Segundo fator (MFA)", text: "Código de seis dígitos gerado por aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy) no celular do usuário. Exigido em todo acesso aos dados institucionais — não há perfil dispensado. Protege contra acesso não autorizado mesmo quando a senha é comprometida. O QR code é lido uma única vez no primeiro acesso; depois, o aplicativo gera códigos rotativos a cada 30 segundos." },
    ],
  },
  {
    group: "Metas e indicadores",
    entries: [
      { term: "Meta", text: "Resultado mensurável que a instituição se compromete a alcançar até uma data definida. Deve conter: indicador (o número), linha de base (ponto de partida), alvo (onde chegar), prazo, periodicidade de medição, responsável e fonte do dado. Exemplo: \"Reduzir a evasão do 1º ano do curso de Direito de 18% para 12% até dezembro de 2027, medida semestralmente pelo relatório de matrículas.\" Metas vagas (\"melhorar a qualidade\") não funcionam — sem número, não há como medir progresso." },
      { term: "Indicador", text: "Variável quantitativa que operacionaliza a meta. Define o que será medido, como será calculado e de onde virá o dado. Um bom indicador é específico (taxa de evasão, não \"evasão\"), mensurável (com fórmula declarada), temporal (com periodicidade) e rastreável (com fonte documentada). O indicador mede o fenômeno — não o confunda com a meta (que define o alvo) nem com a medição (que registra o valor numa data)." },
      { term: "Regra de cálculo", text: "Fórmula explícita que define como o indicador é calculado, para que todas as áreas cheguem ao mesmo número independentemente de quem calcula. Exemplo: \"Alunos que saíram durante o ano ÷ matriculados no início do ano × 100\". Sem regra declarada, cada setor pode calcular de forma diferente e os números divergem. Inclua o tratamento de transferências internas, trancamentos e reingresso." },
      { term: "Fonte", text: "Sistema, relatório ou documento de onde o valor do indicador é extraído. Exemplos: relatório de matrículas do sistema acadêmico, ata da CPA, relatório do INEP, planilha da secretaria. Mantenha a mesma fonte em todas as medições — mudar de fonte sem registrar invalida a comparação histórica. Se a fonte mudar, registre na observação da medição." },
      { term: "Linha de base", text: "Valor do indicador antes do início das ações de melhoria — o ponto de partida a partir do qual o progresso é medido. Sem linha de base, é impossível saber se houve melhoria ou piora, apenas se o alvo foi atingido. Use o último valor disponível e confiável. Se não houver dado anterior, deixe em branco e registre a primeira medição assim que tiver — a barra de progresso começa a funcionar a partir daí." },
      { term: "Alvo", text: "Valor que o indicador deve atingir no prazo da meta. Deve ser ambicioso mas realizável com as ações planejadas. Alvo sem plano é desejo; plano sem alvo é ativismo. Compare com benchmarks do setor (médias INEP, dados CENSUP) para calibrar a ambição, mas não copie alvos de outras IES sem considerar contexto, porte e histórico." },
      { term: "Sentido desejado", text: "Indica se o bom resultado é o indicador subir (aumentar — ex.: taxa de aprovação), cair (reduzir — ex.: evasão, inadimplência) ou permanecer estável (manter — ex.: nota de satisfação já alta). O semáforo e a barra de progresso usam essa informação para calcular se a meta está no caminho certo ou não." },
      { term: "Medição", text: "Registro do valor do indicador numa data específica, com indicação da fonte e observações relevantes. A data é a referência do dado (\"final do semestre 2026/1\"), não a data em que foi digitado. A sequência de medições forma o histórico — é o que torna o indicador vivo. Sem medições periódicas, a meta vira papel." },
      { term: "Periodicidade", text: "Intervalo em que o indicador é medido novamente: mensal, bimestral, semestral, anual ou por evento. Deve ser compatível com o ciclo do fenômeno medido — evasão semestral não faz sentido ser medida semanalmente; satisfação do aluno pode ser medida por semestre ou por campanha da CPA." },
      { term: "Progresso", text: "Percentual do caminho percorrido entre a linha de base e o alvo, calculado pela última medição. Exemplo: se a evasão era 18% (base), o alvo é 12%, e a última medição deu 15%, o progresso é 50% — metade do caminho foi percorrida. Progresso de 100% significa que o alvo foi atingido, não que a meta está encerrada (pode haver medições futuras). Progresso negativo significa que piorou em relação à base." },
    ],
  },
  {
    group: "Plano de ação",
    entries: [
      { term: "5W2H", text: "Método de planejamento que estrutura cada ação por sete dimensões: What (O quê — a ação concreta), Why (Por quê — o achado, meta ou necessidade que justifica), Where (Onde — setor, campus ou instância em que acontece), Who (Quem — pessoa ou setor responsável pela entrega), When (Quando — prazo com data), How (Como — os passos principais de execução) e How much (Quanto custa — estimativa financeira ou \"sem custo direto\"). A força do método é a completude: ação sem responsável não anda, sem prazo não cobra, sem \"por quê\" não se justifica." },
      { term: "Ação", text: "Tarefa concreta, com verbo no infinitivo, responsável nomeado e prazo definido. Deve estar vinculada a uma meta (\"contribui para reduzir a evasão\") ou a um achado do diagnóstico (\"responde à fragilidade identificada no PPC\"). Uma boa ação é específica e verificável: \"Revisar o PPC do curso de Direito com o NDE até 15/03/2027\" — não \"Melhorar o PPC\". A evidência de conclusão deve permitir que qualquer pessoa confirme que a ação foi feita." },
      { term: "Avanço", text: "Percentual estimado de execução da ação, de 0 a 100, atualizado pelo responsável. Não é calculado automaticamente — depende de registro manual. Serve como sinal rápido de andamento para o gestor. Use com honestidade: 80% que ficam parados por meses indicam que a ação está travada, não quase pronta." },
      { term: "Ação atrasada", text: "Ação cujo prazo já passou e cuja situação não é \"Concluída\" nem \"Cancelada\". Aparece destacada em vermelho no painel. Atraso não é necessariamente falha — pode indicar dependência externa, mudança de prioridade ou escopo subestimado. O importante é que esteja documentado: registre o motivo, ajuste o prazo e informe o gestor." },
      { term: "Bloqueada", text: "Situação de uma ação que não pode avançar por depender de algo fora do controle do responsável: aprovação da direção, liberação orçamentária, conclusão de obra, entrega de outro setor. Registre o motivo do bloqueio. Ações bloqueadas não contam como atrasadas, mas exigem acompanhamento do gestor para destravar." },
      { term: "Evidência de execução", text: "Registro que comprova que a ação foi realizada. Deve ser verificável por terceiros: ata de reunião com data e participantes, portaria publicada, relatório entregue, foto do espaço reformado, link para documento interno. Não confunda evidência de execução (a ação foi feita) com evidência de resultado (a situação melhorou) — ambas importam, mas são coisas diferentes. Nunca inclua dados pessoais de alunos como evidência." },
    ],
  },
  {
    group: "Diagnóstico",
    entries: [
      { term: "Dimensão", text: "Grande área temática que agrupa critérios de avaliação. No INEP, as dimensões incluem organização didático-pedagógica (DIM 1), corpo docente e tutorial (DIM 2) e infraestrutura (DIM 3). A média por dimensão revela onde estão concentradas as fragilidades — um curso com nota 2 em infraestrutura e 4 em corpo docente tem prioridades claras. Compare dimensões entre cursos da mesma IES para identificar problemas sistêmicos vs pontuais." },
      { term: "Critério", text: "Ponto específico verificado dentro de uma dimensão. Formulado como afirmação verificável: \"O PPC está atualizado às DCNs vigentes\", \"A biblioteca possui acervo compatível com as ementas\", \"Os laboratórios atendem às necessidades das disciplinas práticas\". Cada critério recebe nota, achado e evidência. A granularidade do critério deve permitir ação — critérios genéricos demais (\"a infraestrutura é boa\") não orientam melhorias." },
      { term: "Referência", text: "Norma, instrumento ou indicador que serve como parâmetro para a nota. Exemplos: \"Indicador 1.1 do instrumento de avaliação do INEP — PDI\", \"Art. 12 da Resolução CNE/CES 2/2019 — DCN de Direito\", \"Meta 12 do PNE\". A referência explícita permite que a avaliação seja auditável e reprodutível por outra pessoa." },
      { term: "Nota", text: "Avaliação de 1 a 5 na escala dos instrumentos do INEP: 1 = não existe ou é insuficiente, 2 = insuficiente com ações pontuais, 3 = suficiente com lacunas, 4 = muito bom com evidências consistentes, 5 = excelente com práticas inovadoras e resultados comprovados. Use 0,5 quando necessário. A nota deve refletir o que foi encontrado na evidência, não a intenção ou o potencial. Uma nota alta sem evidência é indefensável numa avaliação in loco." },
      { term: "Achado", text: "Descrição factual e objetiva do que foi constatado na verificação do critério. Sem adjetivos vagos (\"razoável\", \"interessante\") ou juízos emocionais (\"péssimo\"). Exemplo bom: \"A matriz curricular não registra as 330 horas de extensão curricularizada exigidas pela Resolução 7/2018 do CNE\". Exemplo ruim: \"A extensão precisa melhorar\". O achado é a ponte entre a nota e a ação: se não está claro o que foi encontrado, não se sabe o que corrigir." },
      { term: "Prioridade", text: "Classificação da urgência do tratamento do achado. Alta: risco regulatório direto (pode comprometer conceito na avaliação in loco), impacto imediato sobre alunos ou descumprimento normativo. Média: fragilidade que precisa de plano de ação dentro do ciclo, sem risco imediato de sanção. Baixa: aprimoramento desejável que pode ser planejado para o ciclo seguinte. A prioridade orienta a alocação de recursos e a ordem de execução das ações." },
      { term: "Evidência consultada", text: "Documento, relatório, ata, sistema ou fonte que foi efetivamente consultado para fundamentar a nota e o achado. Não é o que \"deveria\" existir, é o que foi verificado. Registre com precisão: \"PPC versão 2022, aprovado em reunião do NDE de 12/04/2022, ata nº 3/2022\" — não apenas \"PPC\". A evidência consultada permite que outra pessoa chegue à mesma nota independentemente." },
    ],
  },
  {
    group: "Termos do ensino superior",
    entries: [
      { term: "e-MEC", text: "Sistema eletrônico do Ministério da Educação que constitui o cadastro oficial de instituições e cursos de educação superior no Brasil. Contém atos regulatórios (credenciamento, recredenciamento, autorização, reconhecimento, renovação), conceitos de avaliação (CI, CC, CPC, IGC, ENADE), tramitação de processos e dados cadastrais. É a fonte de verdade regulatória — divergências entre o painel e o e-MEC devem ser resolvidas no próprio e-MEC pela Procuradoria Institucional." },
      { term: "PPC", text: "Projeto Pedagógico do Curso: documento central que define a identidade acadêmica do curso — objetivos, perfil do egresso, competências, matriz curricular com ementas e bibliografias, organização didático-pedagógica, estágio, TCC, extensão, atividades complementares, corpo docente, infraestrutura e sistema de avaliação da aprendizagem. Deve estar alinhado às DCNs vigentes e ao PDI da instituição. Atualizado pelo NDE com aprovação do colegiado do curso." },
      { term: "NDE", text: "Núcleo Docente Estruturante: grupo de docentes do curso (mínimo 5, maioria com titulação stricto sensu e regime de trabalho parcial ou integral) responsável pela concepção, consolidação e atualização contínua do PPC. Criado pela Resolução CONAES 1/2010. Diferente do colegiado (que delibera), o NDE concebe e acompanha o projeto do curso. Precisa ter reuniões regulares, atas e produção efetiva — existir no papel sem atuar é fragilidade em qualquer avaliação." },
      { term: "CPA", text: "Comissão Própria de Avaliação: órgão autônomo previsto na Lei 10.861/2004 (SINAES) que conduz a autoavaliação institucional. Deve ter representação de todos os segmentos (docentes, discentes, técnicos e sociedade civil), autonomia em relação à gestão, mandatos definidos e atuação contínua. Não é subordinada à reitoria nem é uma comissão para avaliações externas — é o instrumento da comunidade acadêmica para avaliar e melhorar a própria instituição. Seus relatórios alimentam o PDI e devem gerar ações concretas de melhoria." },
      { term: "PDI", text: "Plano de Desenvolvimento Institucional: documento estratégico que define a missão, visão, objetivos, metas e ações da IES para um período de cinco anos. É obrigatório (Lei 10.861/2004) e avaliado nos processos regulatórios. Deve ser coerente com os PPCs dos cursos, o relatório da CPA e a realidade orçamentária. PDI genérico ou desconectado da prática é fragilidade recorrente em avaliações in loco." },
      { term: "DCNs", text: "Diretrizes Curriculares Nacionais: resoluções do Conselho Nacional de Educação que estabelecem os princípios, fundamentos, condições e procedimentos para a organização de cada curso de graduação. Definem competências mínimas, carga horária, estágio, extensão e perfil do egresso. Cada área tem suas DCNs — Direito (Resolução CNE/CES 5/2018), Medicina (Resolução CNE/CES 3/2014), Pedagogia (Resolução CNE/CP 1/2006). PPC desalinhado das DCNs vigentes é irregularidade." },
      { term: "SINAES", text: "Sistema Nacional de Avaliação da Educação Superior (Lei 10.861/2004). Integra três componentes: avaliação das instituições (incluindo autoavaliação pela CPA), avaliação dos cursos (avaliação in loco) e avaliação do desempenho dos estudantes (ENADE). Os resultados alimentam os indicadores de qualidade (CPC, IGC) que orientam os atos regulatórios do MEC." },
      { term: "Modalidade", text: "Forma de oferta do curso conforme o cadastro no e-MEC: presencial (aulas no campus), semipresencial (parte presencial, parte a distância, conforme Portaria 2.117/2019 que permite até 40% de EaD em cursos presenciais) ou educação a distância — EAD (mediada por tecnologia, com polos de apoio presencial). A modalidade impacta infraestrutura exigida, corpo docente e indicadores regulatórios." },
      { term: "Conceito MEC", text: "Nota atribuída pelo INEP a cursos e instituições em avaliações in loco ou calculada a partir de indicadores. Escala de 1 a 5. Conceito 1 e 2: insatisfatório (pode resultar em medida cautelar, termo de saneamento ou descredenciamento). Conceito 3: satisfatório (referência mínima). Conceitos 4 e 5: acima da referência. Principais: CI (institucional), CC (curso in loco), CPC (preliminar de curso, calculado), IGC (geral da IES, calculado), ENADE (desempenho dos estudantes)." },
      { term: "Avaliação in loco", text: "Visita de comissão de avaliadores do INEP à instituição ou ao curso para verificação presencial das condições de oferta. Segue instrumento padronizado com indicadores e descritores. A comissão atribui conceitos de 1 a 5 por indicador e gera relatório. A IES pode interpor recurso. As condições observadas devem ser comprovadas por evidências documentais e físicas — o que não está documentado é como se não existisse na lógica da avaliação." },
      { term: "Procuradoria Institucional (PI)", text: "Representante oficial da IES perante o MEC e o INEP. Responsável por manter atualizados os dados no e-MEC, acompanhar processos regulatórios, protocolar documentos e ser o interlocutor nos atos de supervisão. A PI deve conhecer profundamente a legislação educacional e os prazos regulatórios. Na Vértice, os dados regulatórios do módulo e-MEC são de responsabilidade da PI." },
    ],
  },
  {
    group: "Autoavaliação e CPA",
    entries: [
      { term: "Ciclo avaliativo", text: "Período completo de autoavaliação institucional, tipicamente coincidente com o ciclo do ENADE (trienal) ou com o período do PDI. Inclui as fases de planejamento, coleta de dados, análise, relatório, devolutiva à comunidade e meta-avaliação. Cada ciclo deve usar referencial versionado para permitir comparação entre ciclos." },
      { term: "Instrumento de autoavaliação", text: "Questionário ou roteiro estruturado usado pela CPA para coletar dados dos diversos públicos (estudantes, docentes, técnicos, egressos, sociedade). Deve ser versionado — uma versão publicada não muda durante a campanha. Inclua opções 'Não se aplica', 'Não sei avaliar' e 'Prefiro não responder' — nenhuma delas equivale a zero ou a resposta neutra." },
      { term: "Dimensão do SINAES", text: "As dez dimensões originais da Lei 10.861/2004: missão e PDI, políticas de ensino/pesquisa/extensão, responsabilidade social, comunicação, políticas de pessoal, organização e gestão, infraestrutura, planejamento e autoavaliação, políticas de atendimento ao estudante e sustentabilidade financeira. A proposta de novo instrumento (2026) reorganiza essas dimensões em eixos." },
      { term: "Achado da CPA", text: "Constatação resultante da análise dos dados coletados, vinculada a uma dimensão ou eixo e sustentada por evidências. Pode ser fragilidade (algo que precisa melhorar), potencialidade (ponto forte a manter ou ampliar) ou oportunidade (espaço para inovação). Um achado recusado pela gestão não é apagado — fica registrado com a justificativa da recusa para rastreabilidade." },
      { term: "Devolutiva", text: "Comunicação dos resultados da autoavaliação à comunidade acadêmica. Pode ser feita por relatório, apresentação, painel, e-mail ou evento. A devolutiva fecha o ciclo avaliativo e demonstra que a CPA não apenas coleta dados, mas produz resultados visíveis. Sem devolutiva, os respondentes não veem impacto, e a participação no próximo ciclo cai." },
      { term: "Meta-avaliação", text: "Avaliação do próprio processo de autoavaliação: a CPA avalia se o instrumento funcionou, se a participação foi representativa, se os achados geraram ações efetivas, se o custo foi proporcional ao resultado e o que melhorar no próximo ciclo. É o indicador 1.13 da proposta 2026 e uma exigência crescente nas avaliações in loco." },
      { term: "Triangulação", text: "Cruzamento de dados de diferentes fontes (opinião de alunos, documentos institucionais, dados acadêmicos, relatórios externos) para validar um achado. Um resultado de pesquisa isolado não comprova uma fragilidade — precisa ser corroborado por outras evidências. A triangulação fortalece a credibilidade da autoavaliação." },
    ],
  },
  {
    group: "Egressos",
    entries: [
      { term: "Egresso", text: "Pessoa que concluiu um curso em uma IES. Pode ter status de formado (colação), diplomado (diploma emitido), integralizado (cumpriu toda a carga mas sem colação) ou em acompanhamento. Uma mesma pessoa pode ser egressa de mais de um curso — o sistema identifica a pessoa e vincula múltiplas formações sem duplicar." },
      { term: "Aderência à área", text: "Indicador que mede se o egresso atua profissionalmente na área de formação, em área correlata ou em área diferente. É autodeclarado e subjetivo — \"área correlata\" depende da percepção do respondente. O denominador são apenas os ocupados que responderam à pergunta sobre aderência, não o total de egressos." },
      { term: "Onda de acompanhamento", text: "Momento de aplicação da pesquisa de egressos: na conclusão, 6 meses, 12 meses, 24 meses após a formatura. Permite acompanhar a trajetória longitudinal da mesma pessoa ao longo do tempo. Compare pesquisas da mesma onda — pesquisas de conclusão e de 24 meses medem coisas diferentes." },
      { term: "Cobertura cadastral", text: "Percentual de egressos com contato válido (email ou telefone) sobre o total de elegíveis. Contato válido não garante alcançabilidade — emails podem estar desatualizados. Sem cobertura cadastral mínima, a pesquisa não alcança os egressos e os indicadores ficam vazios." },
    ],
  },
  {
    group: "TCC e Produção Acadêmica",
    entries: [
      { term: "Trabalho de Conclusão (TCC)", text: "Produção acadêmica obrigatória ou optativa que integra o currículo do curso. Pode ser monografia, artigo, relatório técnico, projeto aplicado ou produto. O sistema acompanha todo o ciclo: rascunho → submissão → análise → aprovação do projeto → execução → versão final → banca → depósito no acervo." },
      { term: "Etapa do trabalho", text: "Estado do trabalho no fluxo acadêmico — rascunho, submetido, em análise, ajustes solicitados, projeto aprovado, em execução, versão final submetida, banca agendada, avaliado, correções pós-banca, final validado, depositado. Transições são auditadas com motivo e versão. 'Atrasado' é condição calculada por prazo vencido, não uma etapa que substitui a etapa acadêmica." },
      { term: "Orientador e coorientador", text: "Orientador: docente responsável pelo acompanhamento da pesquisa, devoluções, reuniões e avaliação. Coorientador: um ou mais, com período e atribuições definidos. Substituição preserva o histórico do vínculo anterior. Uma pessoa pode ter mais de um papel, mas as ações registram em qual papel foram praticadas." },
      { term: "Versão do trabalho", text: "Cada submissão gera uma versão imutável com autor, data, tipo (projeto, rascunho, revisão, final, pós-banca), hash e referência à fonte documental. Distingue versão entregue, em revisão e final aprovada. O acervo guarda a versão depositada com visibilidade e embargo configuráveis." },
      { term: "Banca examinadora", text: "Comissão que avalia o trabalho — qualificação e/ou defesa final. Composição com presidente, examinadores, orientador e suplentes. Membros externos não precisam de conta; participam com registro de escopo temporário. Resultado: aprovado, aprovado com ressalvas, reprovado. A IA não atribui nota nem aprova banca." },
      { term: "Acervo híbrido", text: "O trabalho pode ser registrado como PDF privado, link externo a repositório institucional ou ambos. Link fora do ar não significa inexistência. PDF é validado por extensão, MIME, tamanho e hash. Visibilidade: privado, institucional, embargado ou público autorizado. Depósito não equivale a divulgação pública." },
      { term: "Cobertura documental", text: "Indicador que mede quantos elementos aplicáveis do referencial PPC (objetivos, competências do perfil do egresso) possuem ao menos uma evidência validada, vigente, de produto final. Numerador: elementos com evidência consistente validada por humano. Denominador: elementos aprovados como aplicáveis. NÃO é 'percentual de formação atingida' — evidência de produto coletivo não comprova formação individual de cada autor." },
      { term: "Livro Razão de horas", text: "Registro imutável de horas validadas. Fluxo: declaração → submissão → validação → lançamento no Livro Razão. Estorno é feito por lançamento negativo referenciado, nunca por exclusão. Minutos inteiros na persistência, conversão para horas na apresentação. Horas de TCC e extensão não duplicam — FK de origem cruzada impede dupla contagem da mesma pessoa na mesma atividade." },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Como recebo acesso ao sistema?", a: "O acesso é por convite. A Vértice cadastra o gestor da instituição; o gestor convida a própria equipe informando o e-mail e o perfil. Você recebe um e-mail com link para criar senha e configurar o segundo fator de autenticação (MFA). O vínculo com a instituição é ativado no primeiro login. Se o convite não chegou, peça para verificar spam e, se necessário, solicite reenvio ao gestor." },
  { q: "Por que o sistema pede um código do celular?", a: "Todos os dados institucionais são protegidos por segundo fator (MFA) — sem exceção de perfil. Instale Google Authenticator, Microsoft Authenticator ou Authy no celular, leia o QR code na primeira vez e informe o código de seis dígitos em todo acesso. O código muda a cada 30 segundos. Isso protege contra acesso não autorizado mesmo se a senha for comprometida." },
  { q: "Vejo os dados de outras instituições?", a: "Não. O isolamento entre instituições é aplicado no banco de dados (Row Level Security), não apenas na interface. Cada pessoa vê somente as IES a que está vinculada. Mesmo um gestor com acesso a duas IES vê cada uma separadamente. A equipe Vértice (Master) é a única que enxerga o panorama cross-institucional." },
  { q: "Qual a diferença entre meta e indicador?", a: "A meta é o resultado pretendido com prazo (\"reduzir a evasão do 1º ano para 12% até dezembro de 2027\"). O indicador é o número que operacionaliza a meta (\"taxa de evasão anual do 1º ano, calculada por alunos que saíram ÷ matriculados no início × 100\"). A medição é o registro do valor do indicador numa data. Os três são complementares: meta sem indicador não se mede, indicador sem meta não orienta, medição sem periodicidade não acompanha." },
  { q: "Não sei a linha de base. Posso cadastrar a meta assim mesmo?", a: "Pode. Deixe a linha de base em branco e registre a primeira medição assim que tiver o dado confiável. Sem linha de base, a barra de progresso indica apenas se o alvo foi atingido, sem calcular percentual de caminho percorrido. O ideal é ter a linha de base antes de iniciar as ações — é o ponto de partida que torna a melhoria mensurável." },
  { q: "Com que frequência devo registrar medições?", a: "Na periodicidade definida na meta: mensal, bimestral, semestral ou anual. O crucial é manter a mesma regra de cálculo, a mesma fonte e o mesmo recorte em todas as medições — mudar o critério sem registrar invalida a série histórica. Se a fonte mudar (ex.: migração de sistema acadêmico), registre na observação da medição." },
  { q: "Quem pode alterar uma meta?", a: "Somente o Gestor da instituição e a Vértice (Master). A equipe registra medições e atualiza ações, mas não pode alterar o alvo, o prazo, a fórmula nem excluir a meta. Essa restrição garante que a régua não mude no meio do jogo — alterações precisam ser deliberadas pela gestão." },
  { q: "Excluí um registro por engano. E agora?", a: "Toda inclusão, alteração e exclusão é registrada na trilha de auditoria com data, hora, usuário e conteúdo anterior. A Vértice pode avaliar a recuperação a partir desse histórico. Para registros críticos (metas, ações concluídas, evidências validadas), prefira cancelar em vez de excluir — o cancelamento preserva o histórico completo." },
  { q: "Posso anexar documentos como evidência?", a: "No módulo de Gestão Documental, sim — upload para bucket privado com limite de 50MB por arquivo. Nos campos de evidência das metas e ações, descreva em texto: nome do documento, data, número e localização (link interno ou sistema de origem). Nunca inclua dados pessoais de alunos (CPF, notas individuais, frequência nominativa) como evidência em campos de texto." },
  { q: "Os números de matrícula são editáveis?", a: "Não. Os quantitativos da aba Matrículas vêm de relatórios importados do sistema acadêmico da instituição e são preservados exatamente como na origem. Se houver divergência, confira com a secretaria e corrija na fonte (sistema acadêmico), não no painel. Quando o total do relatório e a soma das turmas diferem, o painel sinaliza a divergência para conferência." },
  { q: "O que acontece quando um módulo é desativado?", a: "O módulo fica inacessível na interface, mas os dados permanecem no banco de dados para reativação futura. Não há perda de dados. A ativação é por chave — liga e desliga sem reinstalação nem migração." },
  { q: "O que é a degustação de módulo?", a: "Ao clicar em um módulo bloqueado, a IES pode experimentá-lo por 15 dias gratuitamente. Durante a degustação, o módulo funciona normalmente com dados reais da IES. Após 15 dias, se não cancelar, o módulo é ativado com cobrança no próximo ciclo de faturamento. A IES pode cancelar a degustação a qualquer momento durante os 15 dias." },
  { q: "A pesquisa de egressos ou CPA garante anonimato?", a: "Depende do modo escolhido. A coleta confidencial protege a identidade com pseudonimização, mas mantém vínculo técnico para permitir retomada multicanal. O formulário com proteção reforçada usa WhatsApp e e-mail apenas para convocação, com desenho de desvinculação. Respostas pelo WhatsApp chegam associadas ao número do remetente — ocultar o nome no painel não torna a coleta anônima. Leia o aviso de privacidade da campanha antes de responder." },
  { q: "Os indicadores de egressos usam amostra probabilística?", a: "Não. As pesquisas de egressos e CPA são voluntárias — quem responde não é uma amostra aleatória da população. Isso significa que os percentuais descrevem os respondentes, não necessariamente todos os egressos. Não calcule margem de erro ou intervalo de confiança como se fosse amostra probabilística. Informe sempre a taxa de participação junto com o resultado." },
];

// Perguntas frequentes exibidas embaixo de cada aba do painel (e no guia).
export const TAB_FAQ: Record<string, { label: string; items: { q: string; a: string }[] }> = {
  visao: {
    label: "Matrículas",
    items: [
      { q: "De onde vêm estes números?", a: "De relatórios importados do sistema acadêmico da própria instituição. Eles não são digitados no painel e são preservados como na origem." },
      { q: "Por que o total do relatório e a soma das turmas às vezes diferem?", a: "Porque a própria origem pode trazer divergências. O painel mostra os dois valores e sinaliza a diferença, para conferência com a secretaria." },
      { q: "Matriculado é o mesmo que aluno único?", a: "Não necessariamente. Os quantitativos são por turma; um mesmo aluno pode aparecer em mais de uma. Retenção e evasão exigem cruzamento individual." },
    ],
  },
  cadastro: {
    label: "Cadastro e cursos",
    items: [
      { q: "Quem pode editar os dados da instituição?", a: "O gestor da instituição e a Vértice. Equipe e Leitura apenas consultam." },
      { q: "Onde encontro o código e-MEC?", a: "No cadastro público do e-MEC (emec.mec.gov.br), buscando pelo nome da instituição ou do curso." },
      { q: "Posso apagar um curso?", a: "Somente a Vértice, e apenas se o curso não tiver dados ligados a ele. Para cursos encerrados, use a situação “Em extinção” ou “Extinto”, que preserva o histórico." },
      { q: "Preciso cadastrar todos os cursos?", a: "Cadastre ao menos os cursos que terão metas, ações ou diagnóstico. Os demais podem ser incluídos depois." },
    ],
  },
  metas: {
    label: "Metas e indicadores",
    items: [
      { q: "O que significam as cores do semáforo?", a: "Vermelho: prazo vencido. Amarelo: prazo em até 14 dias, meta planejada ou pendências de dados. Verde: ausência desses alertas ou conclusão registrada no cadastro. Cinza: cancelada. A regra completa e o motivo de cada alerta aparecem no painel." },
      { q: "Qual a diferença entre meta e indicador?", a: "A meta é o resultado pretendido (reduzir a evasão). O indicador é o número que mostra se ele está acontecendo (taxa de evasão anual)." },
      { q: "Não sei a linha de base. E agora?", a: "Deixe em branco e registre a primeira medição assim que tiver o dado. Sem linha de base, a barra indica apenas se o alvo foi atingido." },
      { q: "Como a barra de progresso é calculada?", a: "Pela distância entre a linha de base e o alvo: se a evasão era 18%, o alvo é 12% e a última medição foi 15%, o caminho percorrido é 50%." },
      { q: "Quem pode criar ou alterar metas?", a: "O gestor e a Vértice. A equipe registra as medições, mas não muda alvo nem prazo." },
      { q: "Quantas metas devo cadastrar?", a: "Poucas e bem medidas. Três a cinco metas por instituição ou curso costumam bastar para orientar a gestão." },
    ],
  },
  plano: {
    label: "Plano de ação 5W2H",
    items: [
      { q: "O que significa 5W2H?", a: "Sete perguntas que descrevem cada ação: o quê, por quê, onde, quem, quando, como e quanto custa." },
      { q: "Preciso ligar toda ação a uma meta?", a: "Não é obrigatório, mas é recomendado: ligar a ação a uma meta ou a um achado mostra por que ela existe e ajuda a priorizar." },
      { q: "Quando uma ação aparece como atrasada?", a: "Quando o prazo já passou e a situação não é “Concluída” nem “Cancelada”." },
      { q: "O que coloco em evidência?", a: "O registro que comprova a execução: nome e data da ata, número da portaria, relatório ou link interno. Não inclua dados pessoais." },
      { q: "Quem pode excluir uma ação?", a: "O gestor e a Vértice. A equipe cria e atualiza ações, mas não exclui." },
    ],
  },
  diagnostico: {
    label: "Diagnóstico",
    items: [
      { q: "Que nota devo dar?", a: "De 1 (muito frágil) a 5 (excelente), na mesma lógica dos instrumentos de avaliação do INEP. Use meio ponto se necessário." },
      { q: "O que diferencia achado de evidência?", a: "O achado é o que foi constatado. A evidência é o documento ou fonte que sustenta essa constatação." },
      { q: "Como transformo um achado em ação?", a: "Clique em “Criar ação” na linha do critério. O plano 5W2H abre com o achado já vinculado." },
      { q: "Quando marco um critério como resolvido?", a: "Quando a ação foi executada e há evidência de que a situação mudou, não apenas quando a ação foi planejada." },
    ],
  },
  equipe: {
    label: "Equipe",
    items: [
      { q: "A pessoa precisa ter conta antes?", a: "Não. Se não tiver, ela recebe um convite por e-mail para criar senha e segundo fator; o acesso é liberado no primeiro login." },
      { q: "Quem pode dar acesso?", a: "A Vértice dá acesso com qualquer perfil, em qualquer instituição. O gestor dá acesso apenas à própria equipe, com os perfis Equipe ou Leitura." },
      { q: "O convite não chegou. O que fazer?", a: "Peça para verificar a caixa de spam. Se não estiver lá, cancele o convite pendente e envie de novo, conferindo o e-mail digitado." },
      { q: "Como retiro o acesso de alguém?", a: "Use “Retirar acesso” na linha da pessoa. A conta continua existindo, mas deixa de ver esta instituição." },
    ],
  },
};
