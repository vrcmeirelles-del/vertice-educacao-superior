import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { PublicHeading } from "@/components/PublicLayout";
import { FAQ, GLOSSARY, TAB_FAQ } from "@/lib/help";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Guide() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const groups = useMemo(
    () =>
      GLOSSARY.map(g => ({
        ...g,
        entries: g.entries.filter(e => !query || `${e.term} ${e.text}`.toLowerCase().includes(query)),
      })).filter(g => g.entries.length),
    [query]
  );
  const match = (f: { q: string; a: string }) => !query || `${f.q} ${f.a}`.toLowerCase().includes(query);
  const faq = FAQ.filter(match);
  const tabFaq = Object.values(TAB_FAQ).map(t => ({ ...t, items: t.items.filter(match) })).filter(t => t.items.length);

  return (
    <>
      <PublicHeading
        eyebrow="GUIA DO SISTEMA"
        title="Guia e glossário da área de gestão."
        text="O que significa cada termo usado no painel da Vértice, como preencher metas, plano de ação e diagnóstico, e respostas para as dúvidas mais comuns."
      />
      <section className="corp-container corp-section guide">
        <div className="guide-search">
          <label htmlFor="guide-q">Buscar um termo ou dúvida</label>
          <input id="guide-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: linha de base, 5W2H, convite" />
        </div>

        <nav className="guide-index" aria-label="Seções do guia">
          {GLOSSARY.map(g => (
            <a key={g.group} href={`#${slug(g.group)}`}>{g.group}</a>
          ))}
          <a href="#perguntas-frequentes">Perguntas frequentes</a>
        </nav>

        <div className="guide-steps">
          <h2>O ciclo em quatro passos</h2>
          <ol>
            <li><strong>Diagnóstico.</strong> Avalie os critérios com nota, achado e evidência.</li>
            <li><strong>Metas.</strong> Escolha o que precisa mudar, com indicador, linha de base, alvo e prazo.</li>
            <li><strong>Plano 5W2H.</strong> Transforme achados e metas em ações com responsável e prazo.</li>
            <li><strong>Acompanhamento.</strong> Registre medições e evidências e revise o que não avançou.</li>
          </ol>
        </div>

        {groups.map(g => (
          <section key={g.group} id={slug(g.group)} className="guide-group">
            <h2>{g.group}</h2>
            <dl>
              {g.entries.map(e => (
                <div key={e.term} id={slug(e.term)}>
                  <dt>{e.term}</dt>
                  <dd>{e.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {(faq.length > 0 || tabFaq.length > 0) && (
          <section id="perguntas-frequentes" className="guide-group">
            <h2>Perguntas frequentes</h2>
            {faq.length > 0 && <h3 className="guide-faq-group">Acesso e uso geral</h3>}
            {faq.map(f => (
              <details key={f.q} className="guide-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
            {tabFaq.map(t => (
              <div key={t.label}>
                <h3 className="guide-faq-group">{t.label}</h3>
                {t.items.map(f => (
                  <details key={f.q} className="guide-faq">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </section>
        )}

        {!groups.length && !faq.length && !tabFaq.length && <p>Nenhum resultado para “{q}”.</p>}

        <p className="guide-foot">
          Já tem acesso? <Link href="/entrar" className="corp-text-link">Entrar no painel <ArrowUpRight size={15} /></Link>
        </p>
      </section>
    </>
  );
}
