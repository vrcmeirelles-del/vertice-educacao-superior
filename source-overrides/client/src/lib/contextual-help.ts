import { FIELD_HELP, GLOSSARY } from './help';
import { MODULE_HELP } from './module-help';
import { ebitdaFields } from './ebitda/engine.js';

export const normalizeHelp = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
export const helpSlug = (value: string) => normalizeHelp(value).replace(/ /g, '-');
export const INDICATOR_HELP = [
  { term: 'Vínculos', text: 'Registros acadêmicos vinculados aos cursos. Um estudante pode ter mais de um vínculo; confira se o painel conta vínculos ou pessoas únicas.' },
  { term: 'Matriculados', text: 'Registros com situação de matrícula considerada ativa no recorte do painel. Confira período, modalidade e data da fonte.' },
  { term: 'Taxa de renovação', text: 'Proporção de estudantes ou vínculos da base acompanhada que renovaram a matrícula. Confira a base e os semestres utilizados.' },
  { term: 'Cursos ativos', text: 'Cursos que aparecem como ativos no cadastro ou fonte selecionada. O status cadastral deve ser distinguido da existência de turmas e matrículas.' },
  { term: 'Taxa de matrícula', text: 'Percentual de matrículas em relação à base utilizada no painel. Confira a população e o período antes de comparar.' },
  { term: 'Por falta', text: 'Reprovações classificadas por frequência insuficiente na fonte acadêmica. A unidade pode ser ocorrência em disciplina, não estudante único.' },
  { term: 'Por nota', text: 'Reprovações classificadas por desempenho insuficiente na fonte acadêmica. A unidade pode ser ocorrência em disciplina, não estudante único.' },
  { term: 'Após exame', text: 'Ocorrências classificadas como reprovação após exame na fonte acadêmica. Confira as regras e a legenda do sistema de origem.' },
  { term: 'EBITDA', text: 'Resultado antes de juros, tributos sobre o lucro, depreciação e amortização. Confira a memória de cálculo e a DRE do mesmo período. Não representa caixa disponível nem preço de venda.' },
  { term: 'Margem EBITDA', text: 'Relação percentual entre EBITDA e receita líquida do mesmo período. Confira a receita utilizada e os ajustes na memória de cálculo.' },
  { term: 'DRE', text: 'Demonstração do Resultado do Exercício. Reúne receitas, custos, despesas e resultado de um período. Utilize valores do mesmo período e da mesma abrangência.' },
  { term: 'Overhead', text: 'Custos indiretos ou compartilhados, como administração central e serviços comuns. Confira o critério de rateio antes de comparar cursos.' },
  { term: 'Taxa de ocupação', text: 'Indica o uso das vagas ou da capacidade considerada no painel. Confira o denominador, o período e a modalidade: vagas autorizadas, ofertadas e capacidade de turma não são a mesma medida.' },
  { term: 'Evasão', text: 'Saída de estudantes da população acompanhada. Confira a definição, o período e as situações incluídas no indicador antes de comparar resultados.' },
  { term: 'Grupo de ingresso', text: 'Estudantes agrupados pelo período em que ingressaram. Permite acompanhar a trajetória do mesmo grupo ao longo dos semestres.' },
  { term: 'Coorte', text: 'Grupo de estudantes com um marco comum, geralmente o semestre de ingresso. Compare o mesmo tempo de acompanhamento entre os grupos.' },
  { term: 'Inadimplência', text: 'Obrigações vencidas e não pagas segundo a base financeira. Confira vencimento, acordos e data de atualização antes de interpretar o valor.' },
  { term: 'Ticket médio', text: 'Valor médio por aluno ou contrato no recorte mostrado. Confira se o painel considera receita bruta, líquida, faturada ou recebida.' },
  { term: 'Superávit', text: 'Resultado positivo quando as receitas superam os custos e despesas considerados. Confira o período, a abrangência e os rateios.' },
  { term: 'Déficit', text: 'Resultado negativo quando os custos e despesas considerados superam as receitas. Confira o período, a abrangência e os rateios.' },
  { term: 'MRR', text: 'Receita mensal recorrente dos contratos considerados no painel. Não equivale necessariamente ao valor recebido no mês.' },
  { term: 'Reprovação', text: 'Resultado acadêmico de não aprovação. Confira o semestre e se o filtro considera nota, frequência ou ambas as situações.' },
  { term: 'Pré-validação', text: 'Etapa de análise preliminar da evidência. As sugestões devem ser conferidas antes da validação definitiva pelo responsável.' },
  { term: 'Espelhamento', text: 'Vinculação de uma evidência a outros indicadores em que ela também se aplica. Confira a pertinência e a versão do documento em cada vínculo.' },
  { term: 'PEI', text: 'Plano Educacional Individualizado. Organiza objetivos, adaptações, apoios, responsáveis e acompanhamento pedagógico do estudante.' },
  { term: 'NDE', text: 'Núcleo Docente Estruturante. Consulte membros, reuniões e encaminhamentos relativos à concepção e atualização do projeto pedagógico do curso.' },
  { term: 'CPA', text: 'Comissão Própria de Avaliação. A área organiza a autoavaliação, participação, resultados, planos e devolutivas à comunidade.' },
  { term: 'PPC', text: 'Projeto Pedagógico do Curso. Documento de referência da organização acadêmica do curso; confira a versão e a vigência.' },
  { term: 'ODS', text: 'Objetivos de Desenvolvimento Sustentável. Nos projetos, registre os objetivos relacionados e as evidências das entregas, sem confundir vínculo declarado com impacto comprovado.' },
  { term: 'ENAMED', text: 'Módulo de avaliação da formação médica. Acompanhe os resultados disponíveis no Fato & Ordem e seu vínculo com a instituição de ensino superior.' },
  { term: 'Residência Médica', text: 'Módulo de preparação e acompanhamento de resultados para residência médica, vinculado ao ensino superior na integração com o Fato & Ordem.' },
  { term: 'ENEM', text: 'Módulo de preparação e acompanhamento por área e competência. A integração institucional deste módulo é com a Vértice Escolas.' },
  { term: 'ENADE', text: 'Acompanhamento de resultados e aprendizagem dos cursos de graduação. Confira curso, edição e população antes de comparar indicadores.' },
  { term: 'Sincronização', text: 'Atualização dos dados a partir de uma fonte integrada. Confira a última execução concluída, a origem e os erros; estar configurada não significa estar atualizada.' },
  { term: 'Perguntar à IA', text: 'Use o campo de IA quando precisar esclarecer uma dúvida adicional ou solicitar uma análise. Os botões de interrogação exibem textos prontos e não acionam a IA.' },
  { term: 'Sem dados', text: 'Não há valores disponíveis para o recorte selecionado. Isso não significa resultado zero. Confira os filtros, a origem e a sincronização.' },
  { term: 'Responsável', text: 'Pessoa ou setor que acompanha e responde pela entrega. Selecione o responsável vinculado à instituição quando a tela oferecer essa opção.' },
  { term: 'Período', text: 'Intervalo de referência dos registros. Compare períodos equivalentes e confira se os dados são semestrais, anuais ou de outra duração.' },
  { term: 'Semestre', text: 'Período letivo de referência, como 2026/1 ou 2026/2. Confira o mesmo semestre em todos os filtros da comparação.' },
  { term: 'Modalidade', text: 'Forma de oferta do curso, conforme o cadastro institucional. Use o mesmo recorte de modalidade nas comparações.' },
  { term: 'Instituição', text: 'Instituição a que pertencem os dados desta tela. Confira o vínculo antes de preencher ou comparar registros.' },
  { term: 'Curso', text: 'Curso a que se refere o cadastro, filtro ou indicador. Confira o código e a instituição para evitar vínculos com cursos homônimos.' },
  { term: 'E-mail', text: 'Endereço eletrônico de contato. Confira a grafia antes de salvar ou enviar um convite.' },
  { term: 'Telefone', text: 'Número de contato com DDD. Confira os dígitos e o país quando o campo solicitar.' },
  { term: 'CNPJ', text: FIELD_HELP.institution.cnpj },
  { term: 'Código e-MEC', text: FIELD_HELP.institution.emec_code },
];

const groupNames: Record<string,string> = {institution:'Instituição',course:'Curso',goal:'Meta',measurement:'Medição',action:'Plano de ação',diagnosis:'Diagnóstico'};
const fieldNames: Record<string,string> = {name:'Nome',acronym:'Sigla',cnpj:'CNPJ',emec_code:'Código e-MEC',maintainer:'Mantenedora',city:'Município',state:'UF',status:'Situação',notes:'Observações',code:'Código do curso',degree:'Grau',modality:'Modalidade',vacancies:'Vagas',coordinator:'Coordenador',title:'Título',indicator:'Indicador',course_id:'Curso',unit:'Unidade de medida',direction:'Sentido desejado',baseline:'Linha de base',baseline_date:'Data da linha de base',target:'Alvo',due_date:'Prazo',frequency:'Periodicidade',owner_user_id:'Conta do responsável',owner_name:'Responsável',source:'Fonte',formula:'Regra de cálculo',measured_on:'Data da medição',value:'Valor',note:'Observação',what:'O quê',why:'Por quê',goal_id:'Meta vinculada',finding_id:'Achado vinculado',who:'Quem',where_at:'Onde',start_date:'Data de início',how:'Como',how_much:'Quanto custa',progress:'Avanço',evidence:'Evidência',dimension:'Dimensão',criterion:'Critério',reference:'Referência',score:'Nota',priority:'Prioridade',assessed_on:'Data da avaliação',finding:'Achado'};
export const FIELD_GUIDE = Object.entries(FIELD_HELP).flatMap(([group, fields]) => Object.entries(fields).map(([key, text]) => ({term:`${groupNames[group]} · ${fieldNames[key] || key}`,text})));
export const HELP_GROUPS = [
  ...GLOSSARY,
  {group:'Módulos e funcionalidades',entries:MODULE_HELP},
  {group:'Indicadores e termos da plataforma',entries:INDICATOR_HELP},
  {group:'Campos dos formulários',entries:FIELD_GUIDE},
  {group:'Campos da DRE e EBITDA',entries:ebitdaFields.map(([,term,text])=>({term:String(term),text:String(text)}))},
];
const definitions = new Map(HELP_GROUPS.flatMap(group=>group.entries.map(e=>[normalizeHelp(e.term),e.text] as const)));
// Exact aliases only: avoid assigning financial or regulatory meanings to unrelated labels.
const aliases: Record<string,string> = {'total de vinculos':'vinculos','total matriculados':'matriculados','taxa de evasao':'evasao','rf falta':'por falta','rn nota':'por nota','ra apos exame':'apos exame','ocupacao de vagas':'taxa de ocupacao','margem ebitda %':'margem ebitda','grupo de entrada':'grupo de ingresso','email':'e mail','data limite':'prazo'};
export function findHelp(term: string) {
  const key=normalizeHelp(term.replace(/\s*\*\s*$/, '').replace(/\s*\((?:R\$|%|opcional)\)\s*$/i,''));
  return definitions.get(aliases[key] || key);
}
export function fieldGuidance(title: string, type='text', required=false) {
  const specific=findHelp(title);
  if(specific)return specific;
  const instruction = type==='select' ? 'Escolha uma das opções disponíveis para este campo.'
    : type==='checkbox' || type==='radio' ? 'Marque ou desmarque a opção conforme o registro que deseja informar.'
    : type==='date' || type==='datetime-local' ? 'Informe a data de referência solicitada no campo.'
    : type==='number' || type==='range' ? 'Informe o valor numérico na unidade indicada na tela. Confira os limites disponíveis.'
    : type==='file' ? 'Selecione o arquivo solicitado. Confira o formato e os limites informados na tela antes de enviar.'
    : type==='password' ? 'Informe sua credencial neste campo. Não compartilhe senhas ou códigos no campo de perguntas à IA.'
    : type==='search' ? 'Digite o termo que deseja localizar. Confira os filtros disponíveis para refinar a busca.'
    : 'Preencha a informação indicada no rótulo e confira os dados antes de salvar.';
  return instruction+(required?' O preenchimento é obrigatório.':'')+' Se precisar de uma orientação adicional, use o campo de perguntar à IA disponível na plataforma.';
}

export function helpAnchor(term:string) { const key=normalizeHelp(term.replace(/\s*\((?:R\$|%|opcional)\)\s*$/i,'')); return (aliases[key]||key).replace(/ /g,'-'); }
