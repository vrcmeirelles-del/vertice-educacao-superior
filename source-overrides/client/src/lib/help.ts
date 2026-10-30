// Textos de ajuda da área real: campos, abas, glossário e perguntas frequentes.
// Fonte única para o painel e para a página pública /guia.
import type { Field } from "@/lib/area";

type HelpMap = Record<string, string>;

export const FIELD_HELP: Record<"institution" | "course" | "goal" | "measurement" | "action" | "diagnosis", HelpMap> = {
  institution: {
    name: "Nome oficial, exatamente como aparece no cadastro e-MEC.",
    acronym: "Como a instituição é conhecida no dia a dia. Ex.: UNITOP.",
    cnpj: "Apenas os 14 números, sem pontos, barra ou traço. Ex.: 12345678000199.",
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
      "Cada meta tem um indicador (o número acompanhado), uma linha de base (o valor de partida), um alvo e um prazo.",
      "Sempre que houver um novo número, use “Registrar medição”. A barra mostra quanto do caminho entre a linha de base e o alvo já foi percorrido.",
      "Prefira poucas metas bem medidas a muitas metas sem dado.",
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
      { term: "Master", text: "Perfil da equipe Vértice. Vê e administra todas as instituições, cria instituições e cadastra gestores." },
      { term: "Gestor", text: "Responsável pela instituição no sistema. Edita dados da instituição e dos cursos, define metas, gere a equipe (perfis Equipe e Leitura) e pode excluir registros." },
      { term: "Equipe", text: "Quem executa o trabalho: registra medições, ações do plano e critérios do diagnóstico. Não altera metas nem exclui registros." },
      { term: "Leitura", text: "Apenas consulta. Indicado para reitoria, mantenedora ou conselhos que acompanham sem lançar dados." },
      { term: "Convite", text: "E-mail enviado a quem ainda não tem conta. A pessoa define senha e segundo fator; o vínculo com a instituição é criado no primeiro acesso." },
      { term: "Segundo fator (MFA)", text: "Código de seis dígitos gerado por um aplicativo autenticador no celular. É exigido em todo acesso aos dados das instituições." },
    ],
  },
  {
    group: "Metas e indicadores",
    entries: [
      { term: "Meta", text: "Resultado que a instituição se compromete a alcançar até uma data. Ex.: reduzir a evasão do 1º ano." },
      { term: "Indicador", text: "Número que mostra se a meta está sendo cumprida. Ex.: taxa de evasão anual." },
      { term: "Regra de cálculo", text: "Fórmula que define como o indicador é calculado, para que todas as áreas cheguem ao mesmo número." },
      { term: "Fonte", text: "Sistema, relatório ou documento de onde o número é extraído." },
      { term: "Linha de base", text: "Valor do indicador no início do acompanhamento. É a referência para medir a evolução." },
      { term: "Alvo", text: "Valor que se pretende atingir no prazo da meta." },
      { term: "Sentido desejado", text: "Se o bom resultado é o indicador subir (aumentar), cair (reduzir) ou permanecer estável (manter)." },
      { term: "Medição", text: "Registro do valor do indicador numa data. A sequência de medições forma o histórico da meta." },
      { term: "Periodicidade", text: "Intervalo em que o indicador é medido de novo: mensal, semestral, anual etc." },
      { term: "Progresso", text: "Quanto do caminho entre a linha de base e o alvo já foi percorrido, segundo a última medição." },
    ],
  },
  {
    group: "Plano de ação",
    entries: [
      { term: "5W2H", text: "Método de planejamento que descreve cada ação por sete perguntas: What (o quê), Why (por quê), Where (onde), Who (quem), When (quando), How (como) e How much (quanto custa)." },
      { term: "Ação", text: "Tarefa concreta, com responsável e prazo, que contribui para uma meta ou responde a um achado." },
      { term: "Avanço", text: "Percentual aproximado de execução da ação, de 0 a 100." },
      { term: "Ação atrasada", text: "Ação com prazo vencido que não está concluída nem cancelada." },
      { term: "Bloqueada", text: "Ação parada por depender de algo fora do controle do responsável (aprovação, orçamento, outro setor)." },
      { term: "Evidência de execução", text: "Registro que comprova que a ação foi feita: ata, portaria, relatório, documento interno." },
    ],
  },
  {
    group: "Diagnóstico",
    entries: [
      { term: "Dimensão", text: "Grande área avaliada, como organização didático-pedagógica, corpo docente ou infraestrutura." },
      { term: "Critério", text: "Ponto específico verificado dentro de uma dimensão. Ex.: o PPC está atualizado às DCNs." },
      { term: "Referência", text: "Norma ou indicador usado como régua. Ex.: indicador 1.1 do instrumento de avaliação do INEP." },
      { term: "Nota", text: "Avaliação do critério de 1 (muito frágil) a 5 (excelente), na lógica dos instrumentos do INEP." },
      { term: "Achado", text: "Descrição objetiva do que foi encontrado na verificação." },
      { term: "Prioridade", text: "Urgência do tratamento: alta (risco regulatório ou impacto imediato), média ou baixa." },
      { term: "Evidência consultada", text: "Documento ou fonte que sustenta a nota e o achado." },
    ],
  },
  {
    group: "Termos do ensino superior usados no sistema",
    entries: [
      { term: "e-MEC", text: "Sistema do Ministério da Educação com o cadastro oficial de instituições e cursos e os processos regulatórios." },
      { term: "PPC", text: "Projeto Pedagógico do Curso: documento que descreve objetivos, perfil do egresso, matriz curricular e organização do curso." },
      { term: "NDE", text: "Núcleo Docente Estruturante: grupo de professores responsável pela concepção e atualização do PPC." },
      { term: "CPA", text: "Comissão Própria de Avaliação: conduz a autoavaliação institucional." },
      { term: "DCNs", text: "Diretrizes Curriculares Nacionais: normas que orientam a organização de cada curso de graduação." },
      { term: "Modalidade", text: "Forma de oferta do curso: presencial, semipresencial ou a distância (EAD)." },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: "Como recebo acesso ao sistema?", a: "O acesso é por convite. A Vértice cadastra o gestor da instituição, e o gestor convida a própria equipe. Você recebe um e-mail para definir sua senha e configurar o segundo fator." },
  { q: "Por que o sistema pede um código do celular?", a: "Os dados das instituições são protegidos por segundo fator. Instale um aplicativo autenticador (como Google Authenticator ou Microsoft Authenticator), leia o QR code no primeiro acesso e informe o código de seis dígitos sempre que entrar." },
  { q: "Vejo os dados de outras instituições?", a: "Não. Cada pessoa vê apenas as instituições a que está vinculada. A regra é aplicada no banco de dados, não só na tela." },
  { q: "Qual a diferença entre meta e indicador?", a: "A meta é o resultado pretendido (reduzir a evasão). O indicador é o número que permite verificar se ele está acontecendo (taxa de evasão anual)." },
  { q: "Não sei a linha de base. Posso cadastrar a meta assim mesmo?", a: "Pode. Deixe o campo em branco e registre a primeira medição assim que tiver o dado; o progresso passa a ser calculado a partir daí. Sem linha de base, a barra só indica se o alvo foi atingido." },
  { q: "Com que frequência devo registrar medições?", a: "Na periodicidade definida na meta. O importante é manter a mesma regra de cálculo e a mesma fonte em todas as medições." },
  { q: "Quem pode alterar uma meta?", a: "Somente o gestor da instituição e a Vértice. A equipe registra medições e ações, mas não muda o alvo nem o prazo." },
  { q: "Excluí um registro por engano. E agora?", a: "Toda inclusão, alteração e exclusão fica registrada na auditoria do sistema. Fale com a Vértice para avaliar a recuperação." },
  { q: "Posso anexar documentos como evidência?", a: "Nesta versão, a evidência é descrita em texto: nome do documento, data, número ou link interno. Não envie documentos com dados pessoais pelo sistema." },
  { q: "Os números de matrícula são editáveis?", a: "Não. Os quantitativos da aba Matrículas vêm de relatórios importados dos sistemas acadêmicos e são preservados como na origem." },
];

// Perguntas frequentes exibidas embaixo de cada aba do painel (e no guia).
export const TAB_FAQ: Record<string, { label: string; items: { q: string; a: string }[] }> = {
  visao: {
    label: "Matrículas",
    items: [
      { q: "De onde vêm estes números?", a: "De relatórios importados do sistema acadêmico da instituição (no caso da UNITOP, o e-ORBIT). Eles não são digitados no painel e são preservados como na origem." },
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
