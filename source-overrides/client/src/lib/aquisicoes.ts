/**
 * Conteúdo público da frente de Aquisições e Incorporações.
 *
 * Regras editoriais (valem para todo texto deste arquivo):
 * - Nenhum número de cliente, nenhum caso identificável, nenhum alvo.
 * - Nenhuma promessa de resultado: "identificamos", "organizamos",
 *   "quantificamos" — não "garantimos".
 * - Toda afirmação sobre a lei precisa ser verificável; o que muda com
 *   frequência fica sem número de artigo no texto público.
 */

export const aquisicoes = {
  eyebrow: "AQUISIÇÕES E INCORPORAÇÕES",

  title: "Due diligence regulatória para quem compra ou vende instituição de ensino",

  lede: "Uma operação educacional exige examinar regulação, qualidade acadêmica, finanças e condições de continuidade. A Vértice conecta essa investigação às decisões e aos instrumentos da transação.",

  intro:
    "A Vértice estrutura e executa a due diligence de aquisição de instituições de ensino superior, do lado do comprador ou do vendedor. O trabalho organiza evidência por requisito, quantifica o risco e liga cada achado ao mecanismo contratual que o trata.",

  // Por que a DD educacional não é uma DD financeira com anexo regulatório.
  porQueMuda: {
    titulo: "Por que a due diligence educacional não é uma due diligence comum",
    pontos: [
      {
        titulo: "O ativo principal não é transferível por si",
        texto:
          "A continuidade da oferta depende da situação dos atos autorizativos e das exigências aplicáveis à estrutura da operação. Esses pontos precisam ser examinados antes do fechamento.",
      },
      {
        titulo: "A sanção regulatória não aparece no balanço",
        texto:
          "Medidas de supervisão e limitações de oferta podem afetar receitas futuras e o plano de integração. A análise regulatória complementa a leitura das demonstrações financeiras.",
      },
      {
        titulo: "Capacidade de oferta e demanda",
        texto:
          "Vagas, ocupação, evasão e infraestrutura ajudam a avaliar a capacidade de oferta. A expansão projetada exige premissas de demanda e viabilidade regulatória.",
      },
      {
        titulo: "A tributação pode mudar na própria operação",
        texto:
          "Imunidade e certificação de entidade beneficente podem não sobreviver a uma aquisição por veículo com fins lucrativos. Quando isso acontece, não é ajuste de preço: é outro negócio.",
      },
    ],
  },

  // As frentes trabalhadas, com o que se pergunta em cada uma.
  frentes: [
    {
      codigo: "REG",
      nome: "Regulatória",
      pergunta:
        "O credenciamento está vigente e o recredenciamento foi protocolado no prazo? Cada curso tem ato de reconhecimento? Há supervisão, termo de saneamento ou auto de infração aberto?",
    },
    {
      codigo: "QUA",
      nome: "Qualidade e avaliação",
      pergunta:
        "Qual o IGC e a tendência? Há curso com conceito baixo que bloqueie expansão, financiamento estudantil ou crédito bancário?",
    },
    {
      codigo: "ACA",
      nome: "Acadêmica",
      pergunta:
        "O corpo docente tem titulação e regime compatíveis? O registro acadêmico é exportável ou há dependência de fornecedor?",
    },
    {
      codigo: "FIN",
      nome: "Financeira",
      pergunta:
        "Qual o EBITDA normalizado, sem renegociação maquiando inadimplência? A necessidade de capital de giro no ciclo de matrícula é suportável?",
    },
    {
      codigo: "TRIB",
      nome: "Tributária e filantropia",
      pergunta:
        "A imunidade ou a certificação beneficente sobrevive à estrutura da operação? Qual o efeito tributário da própria aquisição?",
    },
    {
      codigo: "TRA",
      nome: "Trabalhista e previdenciária",
      pergunta:
        "Há professor contratado como pessoa jurídica? A hora-atividade fora de sala é remunerada? Qual o passivo oculto de folha?",
    },
    {
      codigo: "SOC",
      nome: "Societária e contratos",
      pergunta:
        "Quem controla de fato? Quais contratos terminam com a mudança de controle? A marca é da instituição ou de um sócio?",
    },
    {
      codigo: "IMO",
      nome: "Imobiliária e infraestrutura",
      pergunta:
        "O campus tem AVCB, acessibilidade e alvará? O imóvel é próprio, alugado ou de um sócio?",
    },
    {
      codigo: "CON",
      nome: "Alunos e consumidor",
      pergunta:
        "Como o reajuste foi aplicado? Há bolsa prometida que vira passivo? Existe ação coletiva ou caso de aluno formado em situação irregular?",
    },
    {
      codigo: "DAD",
      nome: "Dados e LGPD",
      pergunta:
        "Existe base legal para tratar e transferir a base? No cofre da operação há dado pessoal que não deveria estar ali?",
    },
  ] as const,

  // O que se entrega.
  entregas: [
    {
      titulo: "Instrumento de due diligence versionado",
      texto:
        "Checklist de 305 requisitos em dez frentes, com pergunta de verificação, documento esperado e criticidade. Cada requisito tem código estável — o mesmo citado no relatório e na cláusula.",
    },
    {
      titulo: "Cofre do mandato",
      texto:
        "Documento recebido com nome original, integridade verificada, classificação de sigilo e vínculo ao pedido que o originou. Acesso nominal, temporário e registrado.",
    },
    {
      titulo: "Matriz de risco por frente",
      texto:
        "Achado, valor em risco e mecanismo contratual. A severidade precisa de consequência descrita e mecanismo de tratamento; informações insuficientes permanecem registradas como limitações.",
    },
    {
      titulo: "Relatório de achados",
      texto:
        "Gerado da base de achados, não de um documento paralelo. É o mesmo dado que alimenta a negociação do preço.",
    },
    {
      titulo: "Triagem pública pré-NDA",
      texto:
        "Leitura de fonte pública — ato, portfólio, vagas, indicadores, certidões — em 12 a 15 pontos. Serve para decidir se a due diligence completa faz sentido antes de assinar carta de intenções.",
    },
    {
      titulo: "Plano de remediação dos 100 dias",
      texto:
        "O que ficou retido no contrato vira ação com responsável, prazo e custo. Achado não é diagnóstico: é trabalho.",
    },
  ],

  // Como a Vértice trata o conflito de atuar dos dois lados.
  parede: {
    titulo: "Atuação dos dois lados, com parede",
    texto:
      "A Vértice pode atuar no lado do comprador e no lado do vendedor. Quando isso ocorre no mesmo alvo, o isolamento é técnico, não apenas de conduta: equipes separadas, cofre separado e registro de acesso. Um mandato não vê o outro.",
    pontos: [
      "Nenhuma pessoa integra simultaneamente dois mandatos pareados.",
      "As autorizações identificam equipe, papel e prazo de acesso de cada pessoa.",
      "As solicitações de download passam por autorização e registro imutável.",
      "O consentimento informado dos dois lados é escrito e anterior ao segundo mandato.",
      "Quando o conflito é real e a análise de um lado exige a informação do outro, a Vértice atua em um só lado.",
    ],
  },

  // Limites, ditos antes da reunião.
  limites: [
    "A due diligence identifica e quantifica risco para precificar a decisão. Não é auditoria contábil, nem parecer de avaliação de empresa.",
    "Achado de risco não é fato consumado: a classificação depende de documento e de conferência, e é revista quando surge informação nova.",
    "Nenhum relatório garante conceito, aprovação regulatória ou preservação de autorização. Quem decide é o poder público.",
    "A coleta em fonte pública respeita os termos de uso e não acessa área autenticada.",
    "Dado pessoal de aluno e de empregado circula apenas dentro do cofre do mandato, com finalidade declarada e prazo de eliminação.",
  ],

  // Perguntas que o cliente costuma fazer.
  faq: [
    {
      q: "Vocês atuam para o comprador ou para o vendedor?",
      a: "Para os dois, com parede. A competência é a mesma: ler a operação pelo lado regulatório, acadêmico e financeiro. O recorte do relatório muda — o vendedor quer saber o que o comprador vai encontrar, o comprador quer saber o que vai ter de corrigir.",
    },
    {
      q: "Qual o prazo de uma due diligence?",
      a: "Depende do escopo. Uma frente, como regulatório e qualidade, sai em cerca de três semanas. As dez frentes levam de seis a oito semanas, e o prazo costuma ser definido pela velocidade com que o vendedor entrega documento, não pela análise.",
    },
    {
      q: "Como vocês tratam a informação sigilosa?",
      a: "Cofre separado por mandato, acesso nominal com prazo, registro de toda leitura e eliminação no prazo contratado. Nada de dado de alvo em pasta compartilhada geral.",
    },
    {
      q: "A Vértice substitui o escritório de M&A?",
      a: "Não. A Vértice entra na leitura regulatória, acadêmica e de risco operacional, e entrega a matriz de achado com o mecanismo contratual sugerido. A minuta, a negociação e a responsabilidade jurídica da operação ficam com o advogado que conduz o negócio.",
    },
    {
      q: "Dá para fazer sem envolver a instituição-alvo?",
      a: "Dá a triagem pública: 12 a 15 pontos obtidos de fonte oficial, que mostram se a operação merece due diligence completa. A due diligence de fato exige data room — e, sem ele, o que existe é risco não esclarecido, que também se registra.",
    },
    {
      q: "E se o alvo recusar documento?",
      a: "Vira achado de 'não fornecido'. Existe um recorte específico para isso: documento pedido e não entregue é risco não esclarecido, e o contrato precisa tratar por declaração expressa ou indenização.",
    },
  ],

  cta: {
    titulo: "Tem uma operação em vista?",
    texto:
      "A conversa começa pela triagem pública do alvo. Em alguns dias é possível dizer se a operação merece due diligence completa — e o que provavelmente vai aparecer nela.",
    botao: "Preparar uma conversa",
  },
};

export type Aquisicoes = typeof aquisicoes;
