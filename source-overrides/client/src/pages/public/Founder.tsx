import { ContextHelp } from '@/components/ContextHelp';
import React from "react";
import { Link } from "wouter";
import { ArrowUpRight, BookOpen, FileText, ShieldCheck } from "lucide-react";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";
import { founder, typicalSituations } from "@/lib/founder";
import { services } from "@/lib/consultancy";

const serviceTitle = (id: string) =>
  services.find(s => s.id === id)?.title ?? "";

export default function Founder() {
  const hasTrajectory = founder.trajectory.length > 0;
  const hasPublications = founder.publications.length > 0;
  const hasCredentials = founder.credentials.length > 0;

  return (
    <>
      <PublicHeading
        eyebrow="QUEM CONDUZ O TRABALHO"
        title={founder.headline}
        text={founder.intro}
      />

      <section className="corp-container corp-section founder-composition">
        <aside className="founder-panel">
          <img
            src="/brand/vertice-identidade-original.webp"
            alt="Identidade Vértice Educação Superior — Consultoria Estratégica e Regulatória"
            width="2048"
            height="1365"
          />
          <div className="founder-signature">
            <strong>{founder.shortName}</strong>
            <span>{founder.role}</span>
          </div>
        </aside>
        <div className="founder-copy">
          <span className="corp-eyebrow">COMO O TRABALHO É CONDUZIDO</span>
          <h2>
            Ler o documento.
            <br />
            Ouvir a gestão.
            <br />
            Sustentar a decisão.
          </h2>
          <p>
            O trabalho começa pela leitura das fontes que a instituição já
            possui e pela escuta de quem executa. Nenhuma conclusão é
            apresentada antes de o critério estar explícito e acordado.
          </p>
          <p>
            A Vértice não assume as instâncias de decisão da instituição. O papel
            é organizar a evidência, explicitar o raciocínio e apoiar a escolha —
            preservando a autonomia de cada órgão e a titularidade dos dados.
          </p>
          {hasCredentials && (
            <ul className="founder-credentials">
              {founder.credentials.map(c => (
                <li key={c.label}>
                  <ShieldCheck size={18} />
                  <div>
                    <strong>{c.label}</strong>
                    <span>{c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/metodo.html" className="corp-text-link">
            Conheça o ciclo de trabalho <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>

      {hasTrajectory && (
        <section className="scope-band">
          <div className="corp-container">
            <span className="corp-eyebrow">TRAJETÓRIA</span>
            <h2>Onde a experiência foi construída.</h2>
            <div className="trajectory-list">
              {founder.trajectory.map(t => (
                <article key={`${t.period}-${t.role}`}>
                  <span className="trajectory-period">{t.period}</span>
                  <div>
                    <h3>{t.role}</h3>
                    <strong>{t.institution}</strong>
                    {t.summary && <p>{t.summary}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="corp-container corp-section">
        <div className="corp-section-heading">
          <div>
            <span className="corp-eyebrow">SITUAÇÕES TÍPICAS</span>
            <h2>
              O problema costuma aparecer
              <br />
              antes do sintoma.
            </h2>
          </div>
          <p>
            Quatro situações recorrentes em instituições de ensino superior, com
            a leitura que orienta o trabalho e a entrega correspondente. São
            descrições de método, não casos de clientes.
          </p>
        </div>
        <div className="situation-list">
          {typicalSituations.map(s => (
            <article key={s.number} className="situation-card">
              <div className="situation-head">
                <span>{s.number}</span>
                <h3>{s.situation}</h3>
              </div>
              <div className="situation-body">
                <div>
                  <span className="situation-label">LEITURA<ContextHelp title="LEITURA" /></span>
                  <p>{s.reading}</p>
                </div>
                <div>
                  <span className="situation-label">ENTREGA</span>
                  <p>{s.delivery}</p>
                </div>
              </div>
              <Link
                href={`/servicos.html#${s.serviceId}`}
                className="situation-link"
              >
                {serviceTitle(s.serviceId)} <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        <p className="corp-note">
          As situações acima descrevem abordagens de trabalho. Não representam
          instituições atendidas, resultados obtidos nem aprovação regulatória.
        </p>
      </section>

      {hasPublications && (
        <section className="scope-band">
          <div className="corp-container">
            <span className="corp-eyebrow">PUBLICAÇÕES</span>
            <h2>Produção acadêmica e técnica.</h2>
            <div className="publication-list">
              {founder.publications.map(p => (
                <article key={`${p.year}-${p.title}`}>
                  <span className="publication-year">{p.year}</span>
                  <div>
                    <h3>
                      {p.href ? (
                        <a href={p.href} target="_blank" rel="noreferrer">
                          {p.title} <FileText size={15} />
                        </a>
                      ) : (
                        p.title
                      )}
                    </h3>
                    <p>{p.venue}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {founder.links.length > 0 && (
        <section className="corp-container corp-section founder-links">
          <span className="corp-eyebrow">REFERÊNCIAS VERIFICÁVEIS</span>
          <div>
            {founder.links.map(l => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                <BookOpen size={17} />
                {l.label} <ArrowUpRight size={15} />
              </a>
            ))}
          </div>
        </section>
      )}

      <ConsultCTA />
    </>
  );
}
