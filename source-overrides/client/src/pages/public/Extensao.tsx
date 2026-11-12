import React from "react";
import { Link } from "wouter";
import { ArrowRight, Target, Users, Clock, FileCheck, Globe, BookOpen } from "lucide-react";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";

const JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Vértice Impacto",
  "applicationCategory": "EducationalApplication",
  "description": "Gestão completa de projetos de extensão universitária: livro-razão de horas, competências, evidências, ODS e curricularização monitorada.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "BRL", "description": "90 dias grátis" },
  "operatingSystem": "Web",
  "provider": { "@type": "Organization", "name": "Vértice Educação Superior", "url": "https://www.verticesuperior.com.br" },
});

const ODS_COLORS = [
  '#E5243B','#DDA63A','#4C9F38','#C5192D','#FF3A21','#26BDE2','#FCC30B',
  '#A21942','#FD6925','#DD1367','#FD9D24','#BF8B2E','#3F7E44','#0A97D9',
  '#56C02B','#00689D','#19486A',
];

const FEATURES = [
  { icon: Target, title: 'Gestão por impacto', desc: 'Projetos vinculados a problemas sociais reais, com objetivos mensuráveis e metodologia definida.' },
  { icon: Clock, title: 'Livro-razão de horas', desc: '8 estados de rastreamento: da hora prevista à integralização no histórico acadêmico.' },
  { icon: Users, title: 'Competências e avaliação', desc: 'Catálogo de competências por curso com avaliação progressiva por estudante.' },
  { icon: FileCheck, title: 'Repositório de evidências', desc: 'Upload, versionamento, hash SHA-256 e workflow de validação com 5 estados.' },
  { icon: Globe, title: 'ODS e comunidade', desc: '17 objetivos e 169 metas da Agenda 2030, vinculados a cada projeto com justificativa.' },
  { icon: BookOpen, title: 'Curricularização monitorada', desc: 'Cobertura por curso, percentual de extensão e reconciliação com o sistema acadêmico.' },
];

const WORKFLOW_STEPS = [
  'Rascunho', 'Submetido', 'Em Análise', 'Aprovado', 'Em Execução',
  'Aguardando Evidências', 'Em Avaliação', 'Concluído',
];

export default function Extensao() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSONLD }} />
      <PublicHeading
        eyebrow="VÉRTICE IMPACTO"
        title="Extensão universitária com rastreabilidade e impacto social."
        text="Gestão completa de projetos de extensão: do planejamento à integralização de horas, com evidências, competências e alinhamento aos ODS da Agenda 2030."
      />

      {/* Features */}
      <section className="corp-container" style={{ padding: '3rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: 'rgba(11,145,133,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <f.icon size={22} color="#0b9185" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 .35rem', fontSize: '1.05rem' }}>{f.title}</h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '.9rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section style={{ background: '#f8fafc', padding: '3rem 1.5rem' }}>
        <div className="corp-container">
          <span className="corp-eyebrow">WORKFLOW DE PROJETOS</span>
          <h2 style={{ margin: '.5rem 0 1.5rem' }}>Do rascunho à conclusão, com rastreabilidade em cada etapa.</h2>
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
            {WORKFLOW_STEPS.map((s, i) => (
              <div key={s} style={{
                flex: '1 1 auto', minWidth: 90, padding: '.75rem .5rem', textAlign: 'center',
                background: '#fff', borderBottom: `3px solid #0b9185`,
                borderRadius: '6px 6px 0 0', fontSize: '.8rem', fontWeight: 500,
              }}>
                <span style={{ display: 'block', fontSize: '.65rem', color: '#9ca3af', marginBottom: '.2rem' }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          <p style={{ marginTop: '1rem', fontSize: '.85rem', color: '#6b7280' }}>
            Reprovação e ajustes retornam ao rascunho com justificativa registrada. Todo o histórico de transições é preservado.
          </p>
        </div>
      </section>

      {/* ODS */}
      <section className="corp-container" style={{ padding: '3rem 1.5rem' }}>
        <span className="corp-eyebrow">AGENDA 2030</span>
        <h2 style={{ margin: '.5rem 0 1.5rem' }}>Projetos alinhados aos Objetivos de Desenvolvimento Sustentável.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: '6px' }}>
          {ODS_COLORS.map((c, i) => (
            <div key={i} style={{
              background: c, color: '#fff', borderRadius: 6, padding: '.5rem',
              textAlign: 'center', fontWeight: 700, fontSize: '.9rem', aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i + 1}
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1rem', fontSize: '.85rem', color: '#6b7280' }}>
          Cada projeto pode ser vinculado a um ou mais ODS com justificativa obrigatória e tipo de contribuição (direto, indireto ou transversal).
        </p>
      </section>

      {/* Números */}
      <section style={{ background: '#0b9185', color: '#fff', padding: '3rem 1.5rem' }}>
        <div className="corp-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>17</div>
            <div style={{ fontSize: '.85rem', opacity: .85 }}>abas de gestão integrada</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>8</div>
            <div style={{ fontSize: '.85rem', opacity: .85 }}>estados no livro-razão</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>11</div>
            <div style={{ fontSize: '.85rem', opacity: .85 }}>fases no workflow</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>12</div>
            <div style={{ fontSize: '.85rem', opacity: .85 }}>perfis de acesso</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="corp-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 .75rem' }}>Sua IES precisa organizar a extensão?</h2>
        <p style={{ color: '#4b5563', maxWidth: 600, margin: '0 auto 1.5rem' }}>
          O módulo Impacto já está disponível dentro do painel Vértice. Ative em 90 dias gratuitos.
        </p>
        <Link href="/contato.html?frente=impacto" className="corp-button">
          Conversar sobre extensão <ArrowRight size={17} />
        </Link>
      </section>

      <ConsultCTA />
    </>
  );
}
