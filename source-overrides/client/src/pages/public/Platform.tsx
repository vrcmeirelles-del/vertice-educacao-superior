import React from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";
import { platformGroups, platformIntro } from "@/lib/platform";

export default function Platform() {
  return (
    <>
      <PublicHeading
        eyebrow="O PAINEL DA VÉRTICE"
        title="A consultoria entrega um diagnóstico. O painel mantém a leitura viva."
        text={platformIntro}
      />

      <div className="corp-container services-list">
        {platformGroups.map(g => (
          <section className="service-detail" id={g.id} key={g.id}>
            <span className="service-number">{g.number}</span>
            <div className="service-detail-copy">
              <h2>{g.title}</h2>
              <p>{g.intro}</p>
              <div className="situation-list" style={{ marginTop: 24 }}>
                {g.modules.map(m => (
                  <article className="situation-card" key={m.name}>
                    <div className="situation-head">
                      <h3>{m.name}</h3>
                    </div>
                    <div className="situation-body">
                      <div>
                        <span className="situation-label">O QUE FAZ</span>
                        <p>{m.summary}</p>
                      </div>
                      <div>
                        <span className="situation-label">NO PAINEL</span>
                        {m.features.map(f => (
                          <p key={f}>
                            <Check size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                            {f}
                          </p>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <Link
                href={`/contato.html?frente=${g.id}`}
                className="corp-text-link"
              >
                Ver este módulo em uma conversa <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>
        ))}
      </div>

      <section className="scope-band">
        <div className="corp-container">
          <div>
            <span className="corp-eyebrow">COMO O PAINEL ENTRA NA INSTITUIÇÃO</span>
            <h2>Sem troca de sistema, sem redigitação.</h2>
          </div>
          <div className="engagement-list">
            <article>
              <span>01</span>
              <h3>Escopo e fontes</h3>
              <p>
                Definição de quais relatórios entram, quem acessa o quê e qual
                indicador é considerado oficial antes da primeira carga.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Carga e conferência</h3>
              <p>
                Importação dos relatórios que a instituição já emite, com
                conciliação entre fontes antes de qualquer indicador ser publicado.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Rotina de uso</h3>
              <p>
                Metas, plano de ação e revisões periódicas. O painel acompanha a
                execução; a decisão continua nas instâncias da instituição.
              </p>
            </article>
          </div>
          <p className="corp-note">
            <ShieldCheck size={16} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Os módulos descrevem funcionalidades implantadas. Não há garantia de
            conceito de avaliação, aprovação regulatória ou resultado de captação:
            o painel organiza evidência e leitura, a execução é da instituição.
          </p>
          <Link href="/demonstracao" className="corp-text-link">
            Explore a demonstração guiada <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <ConsultCTA />
    </>
  );
}
