import React from "react";
import { PublicHeading } from "@/components/PublicLayout";
export default function Privacy() {
  return (
    <>
      <PublicHeading
        eyebrow="PRIVACIDADE E LIMITES"
        title="Informação protegida começa por limites claros."
        text="Esta página descreve o funcionamento do site público, da experiência comercial e dos ambientes de gestão da Vértice. Atualizada em 2 de novembro de 2026."
      />
      <article className="corp-container corp-section legal-copy">
        <section>
          <h2>Experimente a Vértice: assistência e memória opcionais</h2>
          <p>A experiência comercial pode ser explorada sem cadastro e sem ativar a memória ou a IA. Os cenários são fictícios. Antes da ativação, a seleção de cenários e os textos ficam na memória da página. O site não procura descobrir automaticamente seu nome ou sua instituição.</p>
          <p>Ao ativar um percurso, é criado um identificador aleatório protegido por um segredo de acesso. Sem a opção de memória, esse segredo fica no sessionStorage da aba e o percurso no servidor expira em uma hora. Ao escolher a memória, o segredo fica no localStorage e o percurso permanece acessível por até 90 dias desde a ativação. O reconhecimento vale para esse navegador e domínio; não vincula outros dispositivos nem identifica uma pessoa. Remover o armazenamento do navegador perde o vínculo, mas não apaga por si só a cópia no servidor.</p>
          <p>Durante o percurso ativado, são registrados cenários e módulos escolhidos, simulações acionadas, páginas públicas permitidas, horários, retornos à demonstração e uma estimativa limitada do tempo entre navegações. Não há captura de tela, gravação de teclado, fingerprinting ou leitura de formulários de outras áreas. Um acesso sugere interesse; não comprova uma necessidade institucional. A equipe Master com segundo fator pode analisar os percursos com memória autorizada e os contatos solicitados.</p>
          <p>A conversa por IA exige ativação própria. Texto, contexto declarado, cenário aberto, últimas interações e até oito mensagens anteriores são enviados à OpenAI para responder à conversa. São preservadas até dez mensagens recentes no percurso. Não envie documentos de alunos, senhas, dados sensíveis, detalhes confidenciais de alvos de aquisição ou documentos institucionais. As respostas podem conter erros e devem ser conferidas. A aplicação solicita que as respostas não sejam armazenadas para recuperação na API; isso não representa promessa de ausência de registros técnicos ou retenção pelo fornecedor.</p>
          <p>O uso da memória para personalização e análise comercial depende da escolha apresentada na demonstração; é possível explorar sem essa escolha. A experiência usa o percurso para ajustar o cenário e orientar a conversa, não para alterar automaticamente contratos, ofertas ou serviços. Os fornecedores envolvidos são Render (interface), Supabase (registros e acesso) e, quando ativada, OpenAI (conversa). O contato e o e-mail do formulário não são adicionados automaticamente ao contexto da IA.</p>
          <p>Ao solicitar uma conversa, você revisa o briefing e confirma o compartilhamento de nome, instituição, e-mail e resumo para responder à demanda. O registro expira em 90 dias a partir dessa solicitação, sem autorização para campanhas futuras. O botão de e-mail prepara uma mensagem no seu aplicativo; o envio depende de sua ação. A expiração bloqueia a leitura pelo aplicativo; registros expirados são removidos na próxima operação de percurso. Registros técnicos dos fornecedores seguem suas políticas próprias.</p>
          <p>O comando “Apagar meu percurso” remove o registro da demonstração, a conversa recente e o contato vinculado no servidor, além do segredo neste navegador. Para solicitações sem acesso ao navegador de origem, escreva para <a href="mailto:vertice@verticesuperior.com.br">vertice@verticesuperior.com.br</a>, informando a referência do briefing quando disponível. Não enviamos o histórico a outras instituições nem reutilizamos as conversas para treinar um modelo próprio.</p>
        </section>
        <section><h2>Calculadora de EBITDA e DRE reservada</h2><p>Na área pública do reitor, os valores digitados são calculados no navegador e não são enviados nem guardados pela calculadora. O download da memória é feito no próprio dispositivo. Ao sair da página, o preenchimento público não é preservado.</p><p>Na área reservada, Gestores vinculados à instituição e o Master, autenticados com segundo fator, podem registrar valores e anexar a DRE. Os cálculos, versões, identificação da conta, data, nome, tamanho e hash do arquivo ficam no Supabase. A DRE é armazenada em bucket privado; downloads temporários exigem autorização e são registrados. Os dados não são enviados a IA. O Render hospeda a interface e o Supabase processa autenticação, registros e arquivos.</p><p>As versões anteriores são preservadas para rastreabilidade. A gestão de retenção ou exclusão deve ser tratada com a administração no contexto do serviço contratado. Envie apenas a documentação necessária ao cálculo. O anexo não é lido automaticamente e não certifica os valores.</p></section>
        <section>
          <h2>Criação de conta e acesso autenticado</h2>
          <p>O acesso utiliza Supabase Auth para validar e-mail, senha e segundo fator. A senha digitada nesta página é transmitida por HTTPS ao Supabase para autenticação e não é gravada no código do site. A aplicação recebe o identificador da conta, e-mail e tokens de sessão. O cadastro público está fechado; a ativação de contas depende da administração. Não envie dados de estudantes durante a ativação.</p>
          <p>Esses dados são usados para identificar a conta, manter a sessão e verificar as permissões. O tratamento necessário à prestação do serviço deve ser delimitado no contrato; obrigações legais e medidas de segurança possuem finalidades próprias. A ciência deste aviso não constitui consentimento genérico. Não há autorização de marketing nesta etapa.</p>
          <h2>Cookies, fornecedores e conservação</h2>
          <p>A sessão de autenticação é armazenada no localStorage deste navegador, acessível ao código da aplicação, com renovação de tokens pelo Supabase; assim, um único login vale para todas as abas do painel. Não se trata de cookie HttpOnly. Use Sair ao concluir o acesso em computadores compartilhados. O site é hospedado no Render; o projeto Supabase está configurado na região East US (Ohio), Estados Unidos. Os provedores podem processar registros técnicos. Os prazos de retenção e o enquadramento das transferências internacionais devem ser formalizados pelo controlador antes da operação com dados institucionais reais.</p>
          <h2>Seus direitos</h2>
          <p>Nos termos da LGPD, o titular pode solicitar confirmação do tratamento, acesso, correção, informação sobre compartilhamento e, nas hipóteses aplicáveis, anonimização, bloqueio, eliminação, portabilidade e revogação de consentimento. Pode também peticionar à ANPD. A exclusão pode estar sujeita às hipóteses legais de conservação.</p>
          <p>Solicitações podem ser encaminhadas a vertice@verticesuperior.com.br. A identificação jurídica completa do controlador e o enquadramento das transferências devem ser complementados pela administração. O cadastro público de usuários da área de gestão permanece fechado.</p>
          <h2>Medidas e limites de proteção</h2>
          <p>A área autenticada utiliza identidade validada pelo Supabase e políticas de acesso no banco (RLS). A consulta de instituições e cursos exige segundo fator e vínculo autorizado ou perfil de proprietário. O usuário comum não pode atribuir a si mesmo perfil de proprietário nem vínculos. O demonstrador é separado dessa área e não deve receber dados pessoais reais. Este aviso não atesta backups, testes de restauração nem proteção absoluta contra incidentes. Recursos da versão anterior de servidor MySQL não devem ser confundidos com os serviços ativos desta implantação.</p>
        </section>
        <section>
          <h2>Site público e briefing</h2>
          <p>
            As páginas apresentam a proposta e os serviços da consultoria. O
            formulário de contato apenas prepara texto na memória da página,
            para cópia manual. Não existe envio de mensagem ao servidor,
            cadastro de leads ou armazenamento do briefing por esse formulário. Os
            campos desaparecem ao sair ou recarregar a página.
          </p>
          <p>
            O contato comercial está disponível em vertice@verticesuperior.com.br. A experiência “Experimente a Vértice” possui um formulário próprio para compartilhar um briefing revisado e solicitar retorno, descrito acima.
          </p>
        </section>
        <section>
          <h2>Armazenamento da demonstração</h2>
          <p>
            O demonstrador utiliza o armazenamento local do navegador, chamado
            localStorage, para manter critérios, metas, planos de ação e
            pendências fictícios que você edita. A chave é “vertice-piloto-v1”. Na primeira atualização de um cenário antigo, pode ser preservada uma cópia de histórico na chave “vertice-piloto-v1-antes-empresarial”. Remover os dados do site nas configurações do navegador apaga também esse histórico local.
            As alterações ficam no navegador e na origem do site em que foram
            feitas; não são sincronizadas entre pessoas, dispositivos ou
            domínios.
          </p>
          <p>
            Você pode exportar uma cópia JSON. A reimportação ainda não está
            disponível. Para restaurar os exemplos, utilize o comando da página
            de premissas, que pede confirmação. Também é possível remover o
            armazenamento local pelas configurações do navegador.
          </p>
        </section>
        <section>
          <h2>Dados que não devem ser inseridos</h2>
          <p>
            Não insira nomes de estudantes, documentos de identificação, dados
            de saúde, informações financeiras pessoais, avaliações individuais
            de funcionários ou documentos institucionais confidenciais. As
            referências de evidência são apenas texto; não há upload de anexos,
            proteção por conta ou ambiente multiusuário nesta demonstração.
          </p>
        </section>
        <section>
          <h2>Infraestrutura e fontes</h2>
          <p>
            A fonte Inter e a marca são servidas com o site. O aplicativo não
            não instala ferramentas de publicidade ou analytics de terceiros. O acompanhamento opcional do percurso comercial está descrito acima. A infraestrutura de hospedagem pode processar dados técnicos
            necessários ao acesso, segurança e operação; essa descrição não
            afirma que o provedor não mantém registros técnicos ou mecanismos
            próprios.
          </p>
          <p>
            Links externos levam a serviços com políticas próprias. A Vértice
            não representa nem integra plataformas externas de gestão.
            de outras instituições não são disponibilizados pelo site.
          </p>
        </section>
        <section>
          <h2>Uso real e contratação</h2>
          <p>
            Uma aplicação real com dados de instituições exige escopo
            contratado, definição de responsabilidades, finalidade, base legal,
            controle de acesso, retenção e medidas de segurança. Esses elementos
            não estão implementados no demonstrador. O site não oferece
            certificação, decisão regulatória nem promessa de resultado.
          </p>
        </section>
        <section>
          <h2>Contato sobre privacidade</h2>
          <p>
            Entre em contato por vertice@verticesuperior.com.br. Não use o demonstrador como repositório de informações sensíveis.
          </p>
        </section>
      </article>
    </>
  );
}
