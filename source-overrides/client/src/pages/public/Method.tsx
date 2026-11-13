import { ContextHelp } from '@/components/ContextHelp';
import React from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { cycle, managementAxes } from "@/lib/consultancy";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";
export default function Method() {
  return (
    <>
      <PublicHeading
        eyebrow="NOSSO MÉTODO"
        title="Da estratégia à execução. Da execução ao aprendizado."
        text="A consultoria organiza um ciclo contínuo: compreender a realidade, pactuar prioridades, executar com responsabilidade e revisar com evidências."
      />
      <section className="corp-container corp-section cycle-detail">
        {cycle.map(s => (
          <article key={s.number}>
            <span className="cycle-number">{s.number}</span>
            <div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <span className="cycle-output">Entrega: {s.output}</span>
            </div>
          </article>
        ))}
      </section>
      <section className="corp-method-band">
        <div className="corp-container">
          <div className="corp-section-heading">
            <div>
              <span className="corp-eyebrow">
                O QUE A GESTÃO PRECISA ENXERGAR
              </span>
              <h2>
                Sete eixos.
                <br />
                Uma leitura integrada.
              </h2>
            </div>
            <p>
              As prioridades dependem do contexto. Estes eixos organizam o
              diálogo, sem impor a mesma meta a instituições diferentes.
            </p>
          </div>
          <div className="axes-list">
            {managementAxes.map((a, i) => (
              <article key={a.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="corp-container corp-section method-terms">
        <div>
          <span className="corp-eyebrow">CONCEITOS, EM LINGUAGEM CLARA</span>
          <h2>
            O método não precisa
            <br />
            ser uma caixa-preta.
          </h2>
        </div>
        <div>
          <article>
            <h3>Objetivo e resultado-chave</h3>
            <p>
              O objetivo descreve a mudança desejada. O resultado-chave
              estabelece como verificar seu avanço. Essa organização é conhecida
              como OKR; não substitui o contexto nem deve ser confundida com uma
              tarefa concluída.
            </p>
          </article>
          <article>
            <h3>Indicador-chave de desempenho</h3>
            <p>
              Conhecido como KPI, é uma medida acompanhada ao longo do tempo.
              Precisa de definição, fonte, unidade, período e regra de cálculo.
              Uma meta é o patamar pretendido; o realizado é o valor observado.
            </p>
          </article>
          <article>
            <h3>Plano de ação 5W2H<ContextHelp title="Plano de ação 5W2H" /></h3>
            <p>
              Organiza o quê, por quê, quem, onde, quando, como e quanto. Na
              Vértice, o plano também explicita o objetivo relacionado, as
              evidências e a próxima revisão. Valores desconhecidos não viram
              custo zero.
            </p>
          </article>
          <article>
            <h3>Desenvolvimento individual e feedback</h3>
            <p>
              O plano de desenvolvimento individual, ou PDI, relaciona
              competências, ações de aprendizagem e acompanhamento. Feedback é
              uma conversa estruturada sobre o observado e o próximo passo, não
              apenas uma nota.
            </p>
          </article>
          <article>
            <h3>Risco, evidência e resultado</h3>
            <p>
              Um sinal de risco exige investigação; não prova que o evento
              ocorrerá. Uma intenção de saída não é evasão efetiva. Correlação
              entre indicadores e ações não demonstra, sozinha, que uma ação
              causou o resultado.
            </p>
          </article>
        </div>
      </section>
      <section className="corp-container method-limits">
        <h2>Rigor também é saber o que não afirmar.</h2>
        <p>
          Um diagnóstico não certifica conformidade. Uma auditoria exige
          critérios formais, evidências, escopo e responsabilidades. Preparação
          para processos regulatórios ou stricto sensu não garante aprovação. As
          instâncias competentes mantêm suas atribuições.
        </p>
        <p>
          A Vértice utiliza princípios gerais de gestão de desempenho, como
          metas, planos, desenvolvimento e revisão contínua, com uma adaptação
          própria à educação superior. Não há parceria, certificação ou
          integração técnica com plataformas externas nesta versão.
        </p>
        <Link href="/metas" className="corp-text-link">
          Explore o cálculo na demonstração <ArrowUpRight size={17} />
        </Link>
      </section>
      <ConsultCTA />
    </>
  );
}
