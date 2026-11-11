import React, { useState } from "react";
import { Link } from "wouter";
import "./plataforma-ies.css";

const PACKAGES = [
  {
    name: "Essencial",
    price: "1,50",
    floor: "1.500",
    impl: "3.000",
    highlight: false,
    modules: [
      "Cadastro e estrutura institucional",
      "BI Institucional — visão da direção",
      "BI por Curso — desempenho acadêmico",
      "Central de integrações",
    ],
  },
  {
    name: "Regulação",
    price: "2,00",
    floor: "1.800",
    impl: "5.000",
    highlight: false,
    modules: [
      "Tudo do Essencial +",
      "COMPLY — compliance regulatório",
      "Biblioteca Regulatória INEP",
      "ENADE 360° — indicadores e elegibilidade",
      "Novo Instrumento 2026",
      "Instrumento 2017",
    ],
  },
  {
    name: "Gestão 360°",
    price: "2,50",
    floor: "2.000",
    impl: "8.000",
    highlight: true,
    modules: [
      "Tudo do Regulação +",
      "Governança 360° — colegiados e deliberações",
      "Inclusão 360° + PEI",
      "Egressos 360°",
      "Acompanhamento Especial",
      "Aquisições 360°",
      "Plano de Ação 5W2H",
      "Simulador de Custo por Curso",
      "Resultado por Curso",
    ],
  },
  {
    name: "Completo",
    price: "3,00",
    floor: "2.500",
    impl: "12.000",
    highlight: false,
    modules: [
      "Tudo do Gestão 360° +",
      "Fato & Ordem — preparação para exames",
      "Sincronização avançada",
      "Modo TV — monitor da direção",
      "Captação BI",
      "Aprendizagem Conectada",
      "Todos os módulos presentes e futuros",
    ],
  },
];

const DIFFERENTIALS = [
  {
    icon: "🔗",
    title: "Integração, não substituição",
    text: "Conecta ao sistema acadêmico que a IES já usa. Nenhuma migração necessária.",
  },
  {
    icon: "📊",
    title: "Dados reais desde o dia 1",
    text: "Importa o histórico completo da IES. Nada de começar do zero.",
  },
  {
    icon: "🔒",
    title: "LGPD nativa",
    text: "Criptografia TLS 1.3, AES-256, Row Level Security. IES A nunca vê dados da IES B.",
  },
  {
    icon: "📋",
    title: "Regulação integrada",
    text: "Checklists INEP, simuladores de conceito, biblioteca regulatória e dossiê de evidências.",
  },
  {
    icon: "🎯",
    title: "Módulos sob demanda",
    text: "24 módulos. Ativa o que precisa, quando precisa. Degustação de 15 dias em qualquer módulo.",
  },
  {
    icon: "✍️",
    title: "Contrato inteligente",
    text: "Assinatura digital no portal. Faturamento automático. 7 dias para arrependimento. Trial de 90 dias.",
  },
];

const TESTIMONIAL_DATA = [
  { metric: "24", label: "módulos disponíveis" },
  { metric: "90", label: "dias de trial grátis" },
  { metric: "15", label: "dias de degustação por módulo" },
  { metric: "99,5%", label: "SLA de disponibilidade" },
];

export default function PlataformaIES() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Preciso trocar de sistema acadêmico?",
      a: "Não. A Vértice se conecta ao sistema que sua IES já usa — qualquer um. API, banco SQL, CSV, agente ou pasta cloud.",
    },
    {
      q: "Quanto tempo leva para começar?",
      a: "A integração inicial leva de 5 a 10 dias úteis, dependendo do porte da IES. Os dados aparecem no painel conforme são sincronizados.",
    },
    {
      q: "Como funciona o trial de 90 dias?",
      a: "A IES tem 90 dias com acesso completo ao pacote escolhido, sem pagar mensalidade. A taxa de implementação é cobrada (investimento na configuração). Ao final, converte automaticamente em contrato pago. Cancele a qualquer momento.",
    },
    {
      q: "E a degustação de módulo avulso?",
      a: "Qualquer módulo fora do seu pacote pode ser experimentado por 15 dias grátis. Ao final, ativa automaticamente com cobrança mensal. Cancelamento livre durante a degustação.",
    },
    {
      q: "Meus dados ficam seguros?",
      a: "Criptografia TLS 1.3 em trânsito, AES-256 em repouso, Row Level Security (IES isoladas), backups automatizados. Subprocessadores: Supabase (AWS) e Render. Notificação em 72h em caso de incidente.",
    },
    {
      q: "E se eu quiser cancelar?",
      a: "Direito de arrependimento: 7 dias após a assinatura, cancelamento sem custo e reembolso integral. Após isso, respeitamos a carência mínima de 90 dias. Cancelamento a qualquer tempo, efetivo ao fim do ciclo.",
    },
  ];

  return (
    <div className="pies">
      {/* HERO */}
      <section className="pies-hero">
        <div className="pies-container">
          <p className="pies-eyebrow">VÉRTICE EDUCAÇÃO SUPERIOR</p>
          <h1>
            Sua IES toma decisão <br />
            <span className="pies-gradient">com dados ou com sorte?</span>
          </h1>
          <p className="pies-hero-sub">
            Plataforma de gestão integrada que conecta seus dados acadêmicos, regulatórios e
            financeiros num só painel — com inteligência que o sistema acadêmico não entrega.
          </p>
          <div className="pies-hero-actions">
            <a className="pies-btn primary" href="/contato.html?frente=plataforma">
              Agendar demonstração
            </a>
            <Link className="pies-btn secondary" href="/demonstracao">
              Ver painel ao vivo
            </Link>
          </div>
          <div className="pies-hero-metrics">
            {TESTIMONIAL_DATA.map((d) => (
              <div key={d.label}>
                <strong>{d.metric}</strong>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="pies-section pies-problem">
        <div className="pies-container">
          <p className="pies-eyebrow">O PROBLEMA</p>
          <h2>A maioria das IES opera no escuro</h2>
          <div className="pies-problem-grid">
            {[
              ["📉", "Evasão", "Detectada tarde demais. Quando percebe, o aluno já saiu."],
              ["📋", "Regulação", "Evidências montadas às pressas antes da visita do INEP."],
              ["🤷", "Decisões", "Baseadas em intuição, não em dados consolidados."],
              ["📊", "Indicadores", "Dispersos em planilhas, sistemas isolados e cabeças de coordenadores."],
              ["🏛", "Governança", "Colegiados sem rastreabilidade. Deliberações que se perdem."],
              ["📣", "Captação", "Sem métricas de conversão. Gasta sem saber o retorno."],
            ].map(([icon, title, text]) => (
              <div className="pies-problem-card" key={title as string}>
                <span className="pies-problem-icon">{icon}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="pies-section pies-how">
        <div className="pies-container">
          <p className="pies-eyebrow">COMO FUNCIONA</p>
          <h2>3 passos para enxergar sua IES de verdade</h2>
          <div className="pies-steps">
            {[
              ["1", "Conecte seus dados", "A Vértice se integra ao seu sistema acadêmico. Qualquer um. Sem trocar, sem migrar."],
              ["2", "Ative os módulos", "Escolha o pacote. Ative módulos adicionais com degustação de 15 dias. Os dados já estão lá — só o acesso muda."],
              ["3", "Decida com dados", "BI da direção, compliance, governança, egressos, captação — tudo num painel com dados reais da sua IES."],
            ].map(([num, title, text]) => (
              <div className="pies-step" key={num as string}>
                <span className="pies-step-num">{num}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÓDULOS BORRADOS */}
      <section className="pies-section pies-blur-demo">
        <div className="pies-container">
          <p className="pies-eyebrow">A SACADA</p>
          <h2>Seus dados já estão na plataforma</h2>
          <p className="pies-blur-sub">
            Módulos que você ainda não contratou aparecem com seus dados reais borrados.
            Ao ativar, o blur sai — e os dados estão lá, prontos. Sem espera, sem carga, sem surpresa.
          </p>
          <div className="pies-blur-visual">
            <div className="pies-blur-box blurred">
              <div className="pies-blur-label">🔒 Módulo bloqueado</div>
              <div className="pies-blur-content">
                <div className="pies-blur-line w80"></div>
                <div className="pies-blur-line w60"></div>
                <div className="pies-blur-line w90"></div>
                <div className="pies-blur-line w40"></div>
                <div className="pies-blur-line w70"></div>
              </div>
            </div>
            <div className="pies-blur-arrow">→</div>
            <div className="pies-blur-box active">
              <div className="pies-blur-label">✅ Módulo ativo</div>
              <div className="pies-blur-content">
                <div className="pies-blur-real">Governança 360°</div>
                <div className="pies-blur-real small">3 órgãos · 12 deliberações · 4 reuniões</div>
                <div className="pies-blur-real small">Última ata: 08/11/2026</div>
                <div className="pies-blur-real small">→ 2 ações pendentes no 5W2H</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="pies-section pies-diff">
        <div className="pies-container">
          <p className="pies-eyebrow">DIFERENCIAIS</p>
          <h2>Por que a Vértice?</h2>
          <div className="pies-diff-grid">
            {DIFFERENTIALS.map((d) => (
              <div className="pies-diff-card" key={d.title}>
                <span className="pies-diff-icon">{d.icon}</span>
                <h3>{d.title}</h3>
                <p>{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACOTES */}
      <section className="pies-section pies-pricing" id="pacotes">
        <div className="pies-container">
          <p className="pies-eyebrow">PACOTES</p>
          <h2>Escolha o que sua IES precisa</h2>
          <p className="pies-pricing-sub">
            Todos com trial de 90 dias grátis. Upgrade a qualquer momento — módulos incluídos no novo pacote
            ativam sem custo adicional.
          </p>
          <div className="pies-pricing-grid">
            {PACKAGES.map((pkg) => (
              <div className={`pies-pkg ${pkg.highlight ? "featured" : ""}`} key={pkg.name}>
                {pkg.highlight && <span className="pies-pkg-badge">MAIS POPULAR</span>}
                <h3>{pkg.name}</h3>
                <div className="pies-pkg-price">
                  <span className="pies-pkg-currency">R$</span>
                  <span className="pies-pkg-amount">{pkg.price}</span>
                  <span className="pies-pkg-unit">/aluno/mês</span>
                </div>
                <p className="pies-pkg-floor">Piso: R$ {pkg.floor}/mês</p>
                <ul>
                  {pkg.modules.map((m, i) => (
                    <li key={i}>
                      <span className="pies-check">✓</span> {m}
                    </li>
                  ))}
                </ul>
                <p className="pies-pkg-impl">Implementação: R$ {pkg.impl}</p>
                <a className="pies-btn primary full" href="/contato.html?frente=plataforma&pacote={pkg.name}">
                  Começar trial grátis
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pies-section pies-faq">
        <div className="pies-container">
          <p className="pies-eyebrow">PERGUNTAS FREQUENTES</p>
          <h2>Dúvidas comuns</h2>
          <div className="pies-faq-list">
            {faqs.map((f, i) => (
              <div className={`pies-faq-item ${openFaq === i ? "open" : ""}`} key={i}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <span className="pies-faq-toggle">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="pies-section pies-cta-final">
        <div className="pies-container">
          <h2>Pronto para enxergar sua IES?</h2>
          <p>90 dias grátis. Dados reais desde o primeiro dia. Cancele quando quiser.</p>
          <div className="pies-hero-actions">
            <a className="pies-btn primary" href="/contato.html?frente=plataforma">
              Agendar demonstração
            </a>
            <Link className="pies-btn secondary" href="/demonstracao">
              Ver painel ao vivo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
