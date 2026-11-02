import React from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { services } from "@/lib/consultancy";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";
export default function Services() {
  return (
    <>
      <PublicHeading
        eyebrow="NOSSAS SOLUÇÕES"
        title="Uma visão institucional. Um escopo bem definido."
        text="Consultoria para conectar estratégia, regulação e gestão acadêmica. Cada trabalho parte de um desafio concreto e de fontes acordadas com a instituição."
      />
      <div className="corp-container services-list">
        {services.map(s => (
          <section className="service-detail" id={s.id} key={s.id}>
            <span className="service-number">{s.number}</span>
            <div className="service-detail-copy">
              <h2>{s.title}</h2>
              <p>{s.description}</p>
              <blockquote>{s.question}</blockquote>
              <Link
                href={`/contato.html?frente=${s.id}`}
                className="corp-text-link"
              >
                Preparar uma conversa sobre esta frente{" "}
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="service-deliverables">
              <span>ENTREGAS A DIMENSIONAR</span>
              {s.deliverables.map(d => (
                <p key={d}>
                  <Check size={17} />
                  {d}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="scope-band">
        <div className="corp-container">
          <div>
            <span className="corp-eyebrow">
              TRÊS FORMAS DE ORGANIZAR O TRABALHO
            </span>
            <h2>Do diagnóstico ao acompanhamento.</h2>
          </div>
          <div className="engagement-list">
            <article>
              <span>01</span>
              <h3>Diagnóstico delimitado</h3>
              <p>
                Um curso, processo ou frente de gestão. Leitura das fontes, mapa
                de lacunas e discussão de prioridades.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Projeto de estruturação</h3>
              <p>
                Apoio para definir indicadores, organizar evidências, implantar
                um plano e preparar as pessoas envolvidas.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Acompanhamento da gestão</h3>
              <p>
                Revisões periódicas, interpretação dos indicadores e apoio à
                execução. Frequência e entregas definidas em proposta.
              </p>
            </article>
          </div>
          <p className="corp-note">
            Escopo, prazo, investimento e critérios de aceite são definidos após
            a compreensão da demanda. Não há garantia de crescimento, conceito
            de avaliação ou aprovação regulatória.
          </p>
          <Link href="/metodo.html" className="corp-text-link">
            Veja como as etapas se conectam <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="corp-container corp-section"><span className="corp-eyebrow">AQUISIÇÕES E INCORPORAÇÕES</span><h2>Due diligence para compra e venda de instituições de ensino.</h2><p>Investigação de evidências em dez frentes, análise de riscos e acompanhamento das condições da operação.</p><Link className="corp-button" href="/aquisicoes">Conhecer o serviço de Aquisições →</Link></section>
      <ConsultCTA />
    </>
  );
}
