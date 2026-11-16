export type FieldSpec={key:string;label:string;help:string;kind?:'text'|'date'|'url'|'number'|'textarea'|'select'|'email'|'tel';required?:boolean;max?:number;min?:number;options?:[string,string][]};
export const stages:[string,string][]=[['estudante','Estudante'],['estagiario','Estagiário'],['concluinte','Concluinte'],['egresso','Egresso'],['formacao_continuada','Formação continuada'],['mentor','Mentor']];
export const profileFields:FieldSpec[]=[
 {key:'stage',label:'Etapa de relacionamento',kind:'select',options:stages,help:'Organiza o relacionamento no Conecta. Não altera a situação acadêmica da matrícula.'},
 {key:'contact_email',label:'E-mail de contato atualizado',kind:'email',max:254,help:'Opcional. Pode ser alterado a qualquer momento; não é exigido para acessar o perfil e não altera o cadastro acadêmico.'},
 {key:'contact_phone',label:'Telefone / WhatsApp atualizado',kind:'tel',max:25,help:'Opcional. Informe DDD e telefone. Preferências de mensagens são registradas separadamente.'},
 {key:'headline',label:'Apresentação profissional',max:250,help:'Opcional. Exemplo: estudante de Direito com interesse em mediação.'},
 {key:'linkedin',label:'LinkedIn',kind:'url',max:500,help:'Opcional. Use https://www.linkedin.com/in/seu-perfil. Pode ser removido; não inicia coleta externa.'},
 {key:'lattes',label:'Lattes',kind:'url',max:500,help:'Opcional. Use https://lattes.cnpq.br/ seguido dos 16 dígitos do currículo.'},
 {key:'employment',label:'Situação profissional',kind:'select',options:[['desconhecido','Informação desconhecida'],['empregado','Empregado'],['autonomo','Autônomo'],['empreendedor','Empreendedor'],['servidor','Servidor público'],['estagiario','Estagiário'],['buscando','Buscando oportunidade'],['nao_exerce','Não exerce atividade'],['prefiro_nao_informar','Prefiro não informar']],help:'Desconhecido e prefiro não informar não entram no denominador das respostas válidas.'},
 {key:'in_field',label:'Atuação na área de formação',kind:'select',options:[['','Não informado'],['true','Sim'],['false','Não']],help:'Indique se o trabalho se relaciona à formação. Não informado é diferente de resposta negativa.'},
 ...([['interests','Interesses','Ex.: mediação, advocacia pública ou pesquisa.'],['skills','Competências','Registre habilidades e a atividade em que foram desenvolvidas. Não representa certificação automática.'],['strengths','Forças pessoais','Experiências e recursos que favorecem o objetivo profissional.'],['weaknesses','Pontos a desenvolver','Habilidades que precisam de apoio. Não inclua diagnósticos clínicos.'],['opportunities','Oportunidades de desenvolvimento','Ex.: mentoria, projeto de extensão ou certificação.'],['threats','Dificuldades externas','Ex.: falta de tempo ou poucas vagas na região.'],['objective','Meta profissional','Descreva um objetivo observável, o resultado esperado e, se possível, um prazo.']] as string[][]).map(([key,label,help])=>({key,label,help,kind:'textarea' as const,max:4000})),
 {key:'deadline',label:'Prazo da meta',kind:'date',help:'Opcional. Data para reavaliar o objetivo; não muda prazos acadêmicos obrigatórios.'}
];
export const opportunityFields:FieldSpec[]=[
 {key:'title',label:'Título',required:true,min:3,max:250,help:'Identifique a vaga ou atividade. Ex.: estágio em escritório de advocacia.'},
 {key:'employer',label:'Organização',required:true,min:2,max:250,help:'Empregador ou parceiro responsável. Este registro não cria convênio acadêmico.'},
 {key:'kind',label:'Categoria',kind:'select',options:['emprego','estagio','mentoria','evento','formacao'].map(v=>[v,v]),help:'Selecione o tipo da oportunidade.'},
 {key:'status',label:'Situação de divulgação',kind:'select',options:[['rascunho','Rascunho'],['publicada','Publicada'],['encerrada','Encerrada']],help:'Rascunho mantém a oferta em preparação; publicada permite acompanhamento de interessados.'},
 {key:'description',label:'Descrição',kind:'textarea',max:8000,help:'Informe requisitos, atividades, local e condições. Não inclua dados pessoais de candidatos.'},
 {key:'url',label:'Endereço da oportunidade',kind:'url',max:1000,help:'Opcional. Endereço HTTPS da organização. Não envia candidatura automaticamente.'},
 {key:'deadline',label:'Prazo',kind:'date',help:'Opcional. Após a data, novos registros de interesse ficam indisponíveis.'}
];
export const preferenceFields:FieldSpec[]=[
 {key:'channel',label:'Canal',kind:'select',options:['portal','email','whatsapp'].map(v=>[v,v]),help:'Meio para o qual a preferência foi registrada.'},
 {key:'purpose',label:'Finalidade',kind:'select',options:[['pesquisa','Pesquisa institucional'],['oportunidades','Oportunidades profissionais'],['promocional','Comunicação promocional']],help:'Autorizar uma pesquisa não significa autorizar publicidade.'},
 {key:'allowed',label:'Preferência',kind:'select',options:[['false','Não autorizado / recusado'],['true','Permitido pelo titular']],help:'Mantenha não autorizado quando não houver confirmação do titular.'},
 {key:'basis',label:'Origem da preferência',required:true,min:10,max:2000,kind:'textarea',help:'Informe quando, como e para qual finalidade o titular forneceu a preferência. Ex.: formulário respondido em 15/11/2026.'}
];
export const evidenceFields:FieldSpec[]=[
 {key:'title',label:'Título',required:true,min:3,max:250,help:'Nome da experiência ou competência. Ex.: projeto de mediação comunitária.'},
 {key:'kind',label:'Tipo',kind:'select',options:['competencia','estagio','tcc','extensao','ac','certificacao','publicacao','experiencia'].map(v=>[v,v]),help:'Classifique conforme a origem. O registro não credita horas nem aprova atividades.'},
 {key:'document_id',label:'Documento institucional',help:'Opcional. Identificador UUID de documento já cadastrado na Mesa Digital da mesma instituição e curso. A vinculação documental exige gestão autorizada.'},
 {key:'description',label:'Descrição',kind:'textarea',max:4000,help:'Atividade realizada e competências desenvolvidas. Sem documento aprovado, a informação permanece não verificada.'}
];
export const actionFields:FieldSpec[]=[
 ...([['what','O que fazer',500,'Ação concreta e verificável.'],['why','Por quê',2000,'Indicador, desvio ou evidência que justifica a ação.'],['where_at','Onde',250,'Local ou ambiente da execução.'],['who','Responsável',250,'Pessoa ou equipe responsável.'],['how','Como',4000,'Etapas, método de execução e critério de verificação.'],['how_much','Custo previsto',250,'Valor estimado ou sem custo adicional, quando conhecido.']] as [string,string,number,string][]).map(([key,label,max,help])=>({key,label,max,help,required:true})),
 {key:'start_date',label:'Início',kind:'date',required:true,help:'Data prevista de início.'},
 {key:'due_date',label:'Prazo',kind:'date',required:true,help:'Data prevista de conclusão, igual ou posterior ao início.'}
];
