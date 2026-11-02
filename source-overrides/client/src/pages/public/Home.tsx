import React from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Layers3,
  ShieldCheck,
  Target,
} from "lucide-react";
import { services, cycle, faqs } from "@/lib/consultancy";
import { ConsultCTA } from "@/components/PublicLayout";
import { DeliverableCards } from "@/components/DeliverableCards";

export default function Home() {
  return (
    <>
      <section className="corp-hero">
        <div className="corp-container hero-composition">
          <div className="hero-editorial">
            <span className="corp-eyebrow">
              <span />
              CONSULTORIA PARA O ENSINO SUPERIOR
            </span>
            <h1>
              Clareza regulatória.
              <br />
              <em>Solidez institucional.</em>
            </h1>
            <p>
              Conectamos estratégia, qualidade acadêmica e gestão para
              transformar desafios da educação superior em prioridades, ações e
              decisões fundamentadas.
            </p>
            <div className="corp-actions">
              <Link href="/servicos.html" className="corp-button">
                Conheça nossas soluções <ArrowUpRight size={18} />
              </Link>
              <Link href="/metodo.html" className="corp-text-link">
                Como trabalhamos <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-detail">
              <span />
              <p>
                O software organiza.
                <br />
                <strong>A consultoria dá direção.</strong>
              </p>
            </div>
          </div>
          <div
            className="strategy-board"
            aria-label="O ciclo de gestão da Vértice"
          >
            <div className="board-header">
              <span>MÉTODO VÉRTICE</span>
              <span className="board-small-label">DA LEITURA À AÇÃO</span>
            </div>
            <div className="board-title">
              <Compass size={28} strokeWidth={1.3} />
              <h2>
                Uma visão integrada.
                <br />
                Um próximo passo claro.
              </h2>
            </div>
            <ol className="board-cycle">
              {cycle.map((s, i) => (
                <li key={s.number}>
                  <span>{s.number}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {
                        [
                          "Evidências e contexto",
                          "Objetivos e indicadores",
                          "Responsáveis e recursos",
                          "Pessoas e competências",
                          "Aprendizado e decisões",
                        ][i]
                      }
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </li>
              ))}
            </ol>
            <Link href="/demonstracao" className="board-link">
              Veja o método na prática <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="aq-home-highlight" aria-labelledby="aquisicoes-title">
        <div className="corp-container aq-home-grid">
          <div>
            <span className="corp-eyebrow">AQUISIÇÕES E INCORPORAÇÕES</span>
            <h2 id="aquisicoes-title">Clareza para comprar.<br />Preparo para vender.</h2>
            <p>A Vértice conduz a due diligence de instituições de ensino: organiza evidências, identifica riscos e apoia a avaliação das condições da operação.</p>
            <div className="corp-actions">
              <Link className="corp-button" href="/aquisicoes">Conhecer o serviço <ArrowUpRight size={18} /></Link>
              <Link className="corp-text-link" href="/contato.html?frente=aquisicoes">Conversar sobre uma operação <ArrowRight size={17} /></Link>
            </div>
          </div>
          <div className="aq-home-proof">
            <strong>305<span>requisitos de investigação</span></strong>
            <p>10 frentes de análise, do cenário regulatório à sustentabilidade financeira.</p>
            <ul><li>Diagnóstico para comprador ou vendedor</li><li>Riscos ligados às condições contratuais</li><li>Cofre reservado e acompanhamento por mandato</li></ul>
          </div>
        </div>
      </section>
      <section
        className="corp-principle-strip"
        aria-label="Princípios de atuação"
      >
        <div className="corp-container">
          <span>
            <Compass size={20} />
            Direção antes da expansão
          </span>
          <span>
            <ShieldCheck size={20} />
            Evidências antes das conclusões
          </span>
          <span>
            <Target size={20} />
            Execução com responsabilidade
          </span>
        </div>
      </section>
      <section className="corp-section corp-container">
        <div className="corp-section-heading">
          <div>
            <span className="corp-eyebrow">ONDE PODEMOS CONTRIBUIR</span>
            <h2>
              Desafios diferentes.
              <br />
              Uma gestão conectada.
            </h2>
          </div>
          <p>
            Do curso à instituição, organizamos as questões que precisam ser
            compreendidas e as decisões que precisam sair do papel.
          </p>
        </div>
        <div className="service-preview">
          {services.slice(0, 3).map((s, i) => (
            <Link
              key={s.id}
              href={`/servicos.html#${s.id}`}
              className="service-preview-card"
            >
              <div className="service-card-top">
                <span>{s.number}</span>
                {i === 0 ? (
                  <Compass size={25} />
                ) : i === 1 ? (
                  <ShieldCheck size={25} />
                ) : (
                  <Layers3 size={25} />
                )}
              </div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <span className="service-card-link">
                Explore esta frente <ArrowUpRight size={17} />
              </span>
            </Link>
          ))}
        </div>
        <Link className="corp-text-link see-all" href="/servicos.html">
          Conheça as seis frentes de atuação <ArrowRight size={17} />
        </Link>
      </section>
      <section className="corp-method-band">
        <div className="corp-container method-composition">
          <div>
            <span className="corp-eyebrow">
              A GESTÃO PRECISA FECHAR O CICLO
            </span>
            <h2>
              Não basta medir.
              <br />
              <em>É preciso agir e revisar.</em>
            </h2>
            <p>
              Um indicador tem valor quando a equipe entende o que ele mede,
              como foi calculado e qual decisão pode apoiar.
            </p>
            <Link href="/metodo.html" className="corp-text-link">
              Conheça nosso método <ArrowRight size={17} />
            </Link>
          </div>
          <div className="method-explanation">
            <article>
              <span>01</span>
              <div>
                <h3>Uma definição que todos entendem</h3>
                <p>
                  Objetivo, fonte, unidade, período e regra de cálculo. Sem
                  confundir estimativa com resultado.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Uma ação que alguém conduz</h3>
                <p>
                  Responsável, prazo e recursos ligados à prioridade. A
                  evidência acompanha a execução.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Uma revisão que gera aprendizado</h3>
                <p>
                  Reuniões de acompanhamento, investigação de causas e apoio ao
                  desenvolvimento da equipe.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="corp-section corp-container demo-composition">
        <div className="demo-feature">
          <span className="corp-eyebrow">
            EXPERIMENTE O RACIOCÍNIO DE GESTÃO
          </span>
          <h2>
            Veja a estratégia
            <br />
            ganhar estrutura.
          </h2>
          <p>
            Escolha seu desafio: regulação e gestão, aquisições de instituições
            ou captação e permanência. Experimente cenários e prepare uma conversa com contexto.
          </p>
          <Link href="/demonstracao" className="corp-button">
            Experimente a Vértice <ArrowUpRight size={18} />
          </Link>
          <small>
            Sem cadastro para explorar. Dados fictícios. IA e memória do percurso opcionais.
          </small>
        </div>
        <div className="demo-feature-list">
          {[
            {
              n: "01",
              title: "Diagnóstico e evidências",
              text: "Entender antes de concluir.",
            },
            {
              n: "02",
              title: "Metas e indicadores",
              text: "Definir antes de comparar.",
            },
            {
              n: "03",
              title: "Planos de ação 5W2H",
              text: "Organizar antes de executar.",
            },
          ].map(s => (
            <div key={s.n}>
              <span>{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
              <Check size={21} />
            </div>
          ))}
          <p>
            A demonstração não é um sistema acadêmico nem uma avaliação oficial.
          </p>
        </div>
      </section>
      <section className="corp-section corp-container">
        <div className="corp-section-heading">
          <div>
            <span className="corp-eyebrow">O QUE VOCÊ RECEBE</span>
            <h2>
              Entregáveis claros.
              <br />
              Decisões fundamentadas.
            </h2>
          </div>
          <p>
            Cada etapa da consultoria gera um artefato concreto que organiza a
            informação e apoia a gestão institucional.
          </p>
        </div>
        <DeliverableCards />
      </section>
      <section className="corp-faq-section corp-container">
        <div>
          <span className="corp-eyebrow">PERGUNTAS IMPORTANTES</span>
          <h2>Antes de começar.</h2>
        </div>
        <div className="corp-faq">
          {faqs.map(f => (
            <details key={f.question}>
              <summary>
                {f.question}
                <span>+</span>
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="corp-container corp-section" id="gestao-de-valor">
        <span className="corp-eyebrow">GESTÃO DE VALOR · ACOMPANHAMENTO CONTÍNUO</span>
        <h2>Uma base para organizar a instituição e acompanhar sua evolução.</h2>
        <p>A Base da organização reúne documentos, ciclos anuais, obrigações e decisões, conectados à biblioteca INEP, ao EBITDA e aos cenários de valuation. A preparação institucional pode começar mesmo sem intenção de venda.</p>
        <p>Converse com o assistente de IA para organizar o trabalho e preparar minutas. As fontes, premissas e conclusões permanecem sujeitas à conferência do responsável. Aquisições mantém equipes e informações reservadas por mandato.</p>
        <div className="corp-actions"><Link className="corp-button" href="/master">Acessar minha organização <ArrowRight size={17}/></Link><Link className="corp-text-link" href="/demonstracao">Explorar a demonstração</Link></div>
      </section>
      <ConsultCTA />
    </>
  );
}
