import React from "react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "./Brand";
import { company, publicPages } from "@/lib/consultancy";

const links = [
  { href: "/servicos.html", label: "Soluções" },
  { href: "/metodo.html", label: "Nosso método" },
  { href: "/caso-real.html", label: "Caso real" },
  { href: "/fundador.html", label: "Quem conduz" },
];
export default function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    const page = publicPages.find(
      p => p.path === location.replace(/\.html$/, "")
    );
    if (page) document.title = page.title;
    if (window.location.hash) {
      requestAnimationFrame(() =>
        document
          .getElementById(decodeURIComponent(window.location.hash.slice(1)))
          ?.scrollIntoView({ block: "start" })
      );
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="corporate-site">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="corp-header">
        <div className="corp-container corp-nav">
          <Link
            href="/"
            className="corp-brand-link"
            aria-label="Vértice Educação Superior, início"
          >
            <Brand />
          </Link>
          <button
            className="corp-menu-toggle"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="corp-navigation"
            aria-label={open ? "Fechar navegação" : "Abrir navegação"}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="corp-navigation"
            className={open ? "corp-navigation open" : "corp-navigation"}
            aria-label="Navegação empresarial"
          >
            {links.map(l => (
              <Link
                href={l.href}
                key={l.href}
                aria-current={
                  location === l.href ||
                  location === l.href.replace(/\.html$/, "")
                    ? "page"
                    : undefined
                }
              >
                {l.label}
              </Link>
            ))}
            <Link href="/demonstracao" className="corp-demo-link">
              Demonstração <ArrowUpRight size={15} />
            </Link>
            <Link href="/entrar" className="corp-button small">
              Entrar <ArrowUpRight size={15} />
            </Link>
            <Link href="/contato.html" className="corp-demo-link">
              Vamos conversar <ArrowUpRight size={15} />
            </Link>
          </nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="corp-footer">
        <div className="corp-container footer-main">
          <div className="footer-brand">
            <Brand />
            <p>{company.descriptor}</p>
            <strong>{company.slogan}</strong>
          </div>
          <div className="footer-links">
            <span>Explore</span>
            {links.map(l => (
              <Link href={l.href} key={l.href}>
                {l.label}
              </Link>
            ))}
            <Link href="/demonstracao">Demonstração</Link>
            <Link href="/guia.html">Guia e glossário</Link>
            <Link href="/entrar">Entrar</Link>
          </div>
          <div className="footer-note">
            <span>Uma atuação com responsabilidade</span>
            <p>
              Diagnóstico, planejamento e acompanhamento. Sem promessas de
              crescimento ou aprovação regulatória.
            </p>
            <Link href="/contato.html">
              Prepare uma conversa <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="corp-container footer-bottom">
          <span>© {new Date().getFullYear()} Vértice Educação Superior</span>
          <span>Professor Virgílio Meirelles</span>
          <Link href="/privacidade.html">Privacidade e limites de uso</Link>
        </div>
      </footer>
    </div>
  );
}

export function PublicHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="corp-page-head">
      <div className="corp-container">
        <span className="corp-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}
export function ConsultCTA() {
  return (
    <section className="corp-cta">
      <div className="corp-container">
        <div>
          <span className="corp-eyebrow">UM PRIMEIRO PASSO BEM DEFINIDO</span>
          <h2>
            Qual decisão sua instituição
            <br />
            precisa tomar agora?
          </h2>
          <p>Comece por um recorte claro. O escopo vem antes da solução.</p>
        </div>
        <Link href="/contato.html" className="corp-button light">
          Preparar uma conversa <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
