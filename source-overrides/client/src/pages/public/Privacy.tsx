import React from "react";
import { PublicHeading } from "@/components/PublicLayout";
export default function Privacy() {
  return (
    <>
      <PublicHeading
        eyebrow="PRIVACIDADE E LIMITES"
        title="Informação protegida começa por limites claros."
        text="Esta página descreve o funcionamento desta versão do site público e da demonstração Vértice. Atualizada em 1º de novembro de 2026."
      />
      <article className="corp-container corp-section legal-copy">
        <section><h2>Calculadora de EBITDA e DRE reservada</h2><p>Na área pública do reitor, os valores digitados são calculados no navegador e não são enviados nem guardados pela calculadora. O download da memória é feito no próprio dispositivo. Ao sair da página, o preenchimento público não é preservado.</p><p>Na área reservada, Gestores vinculados à instituição e o Master, autenticados com segundo fator, podem registrar valores e anexar a DRE. Os cálculos, versões, identificação da conta, data, nome, tamanho e hash do arquivo ficam no Supabase. A DRE é armazenada em bucket privado; downloads temporários exigem autorização e são registrados. Os dados não são enviados a IA. O Render hospeda a interface e o Supabase processa autenticação, registros e arquivos.</p><p>As versões anteriores são preservadas para rastreabilidade. A gestão de retenção ou exclusão deve ser tratada com a administração no contexto do serviço contratado. Envie apenas a documentação necessária ao cálculo. O anexo não é lido automaticamente e não certifica os valores.</p></section>
        <section>
          <h2>Criação de conta e acesso autenticado</h2>
          <p>O acesso utiliza Supabase Auth para validar e-mail, senha e segundo fator. A senha digitada nesta página é transmitida por HTTPS ao Supabase para autenticação e não é gravada no código do site. A aplicação recebe o identificador da conta, e-mail e tokens de sessão. O cadastro público está fechado; a ativação de contas depende da administração. Não envie dados de estudantes durante a ativação.</p>
          <p>Esses dados são usados para identificar a conta, manter a sessão e verificar as permissões. O tratamento necessário à prestação do serviço deve ser delimitado no contrato; obrigações legais e medidas de segurança possuem finalidades próprias. A ciência deste aviso não constitui consentimento genérico. Não há autorização de marketing nesta etapa.</p>
          <h2>Cookies, fornecedores e conservação</h2>
          <p>A sessão de autenticação é armazenada no localStorage deste navegador, acessível ao código da aplicação, com renovação de tokens pelo Supabase; assim, um único login vale para todas as abas do painel. Não se trata de cookie HttpOnly. Use Sair ao concluir o acesso em computadores compartilhados. O site é hospedado no Render; o projeto Supabase está configurado na região East US (Ohio), Estados Unidos. Os provedores podem processar registros técnicos. Os prazos de retenção e o enquadramento das transferências internacionais devem ser formalizados pelo controlador antes da operação com dados institucionais reais.</p>
          <h2>Seus direitos</h2>
          <p>Nos termos da LGPD, o titular pode solicitar confirmação do tratamento, acesso, correção, informação sobre compartilhamento e, nas hipóteses aplicáveis, anonimização, bloqueio, eliminação, portabilidade e revogação de consentimento. Pode também peticionar à ANPD. A exclusão pode estar sujeita às hipóteses legais de conservação.</p>
          <p>A identificação jurídica do controlador e o canal oficial para exercício desses direitos ainda estão pendentes de confirmação. O cadastro público permanece fechado enquanto essas informações não estiverem publicadas.</p>
          <h2>Medidas e limites de proteção</h2>
          <p>A área autenticada utiliza identidade validada pelo Supabase e políticas de acesso no banco (RLS). A consulta de instituições e cursos exige segundo fator e vínculo autorizado ou perfil de proprietário. O usuário comum não pode atribuir a si mesmo perfil de proprietário nem vínculos. O demonstrador é separado dessa área e não deve receber dados pessoais reais. Este aviso não atesta backups, testes de restauração nem proteção absoluta contra incidentes. Recursos da versão anterior de servidor MySQL não devem ser confundidos com os serviços ativos desta implantação.</p>
        </section>
        <section>
          <h2>Site público e briefing</h2>
          <p>
            As páginas apresentam a proposta e os serviços da consultoria. O
            formulário de contato apenas prepara texto na memória da página,
            para cópia manual. Não existe envio de mensagem ao servidor,
            cadastro de leads ou armazenamento do briefing pelo aplicativo. Os
            campos desaparecem ao sair ou recarregar a página.
          </p>
          <p>
            O canal comercial ainda está em configuração. Não há garantia de
            recebimento de solicitações a partir do formulário desta versão.
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
            instala analytics, publicidade ou rastreamento de visitantes nesta
            versão. A infraestrutura de hospedagem pode processar dados técnicos
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
            O canal oficial será acrescentado após confirmação pelo responsável
            pela Vértice. Enquanto estiver pendente, não use o demonstrador como
            repositório de informação sensível ou como canal de atendimento.
          </p>
        </section>
      </article>
    </>
  );
}
