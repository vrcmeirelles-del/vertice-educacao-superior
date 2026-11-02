import React from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { aquisicoes } from "@/lib/aquisicoes";

export default function Aquisicoes() {
  const a = aquisicoes;

  return (
    <>
      <section className="corp-page-head">
        <div className="corp-container">
          <span className="corp-eyebrow">{a.eyebrow}</span>
          <h1>{a.title}</h1>
          <p className="aq-lede">{a.lede}</p>
          <p>{a.intro}</p>
          <div className="corp-actions" style={{ marginTop: 28 }}>
            <Link href="/contato.html?frente=aquisicoes" className="corp-button">
              Preparar uma conversa <ArrowUpRight size={18} />
            </Link>
            <Link href="/aquisicoes#frentes" className="corp-text-link">
              Ver as dez frentes <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="corp-section">
        <div className="corp-container">
          <h2>{a.porQueMuda.titulo}</h2>
          <div className="aq-grid">
            {a.porQueMuda.pontos.map(p => (
              <article className="aq-card" key={p.titulo}>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="corp-section alt" id="frentes">
        <div className="corp-container">
          <h2>Dez frentes, uma pergunta por frente</h2>
          <p className="section-lede">
            O instrumento tem 305 requisitos. Estes são os eixos que cada frente
            persegue antes de entrar no detalhe.
          </p>
          <div className="aq-frentes">
            {a.frentes.map(f => (
              <article className="aq-frente" key={f.codigo}>
                <div className="aq-frente-head">
                  <span className="aq-codigo">{f.codigo}</span>
                  <h3>{f.nome}</h3>
                </div>
                <p>{f.pergunta}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="corp-section">
        <div className="corp-container">
          <h2>O que se entrega</h2>
          <div className="aq-entregas">
            {a.entregas.map(e => (
              <article key={e.titulo}>
                <h3>{e.titulo}</h3>
                <p>{e.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="corp-section alt">
        <div className="corp-container aq-parede">
          <div>
            <span className="corp-eyebrow">
              <span />
              <ShieldCheck size={15} /> CONFLITO DE INTERESSES
            </span>
            <h2>{a.parede.titulo}</h2>
            <p>{a.parede.texto}</p>
          </div>
          <ul className="aq-lista">
            {a.parede.pontos.map(p => (
              <li key={p}>
                <Check size={17} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="corp-section">
        <div className="corp-container">
          <h2>Perguntas frequentes</h2>
          <div className="aq-faq">
            {a.faq.map(item => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="corp-section alt">
        <div className="corp-container">
          <h2>Limites, ditos antes da reunião</h2>
          <ul className="aq-lista aq-limites">
            {a.limites.map(l => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="corp-cta">
        <div className="corp-container">
          <div>
            <span className="corp-eyebrow">AQUISIÇÕES E INCORPORAÇÕES</span>
            <h2>{a.cta.titulo}</h2>
            <p>{a.cta.texto}</p>
          </div>
          <Link
            href="/contato.html?frente=aquisicoes"
            className="corp-button light"
          >
            {a.cta.botao} <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
