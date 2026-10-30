import React from "react";
import { Link } from "wouter";
import { ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { PublicHeading, ConsultCTA } from "@/components/PublicLayout";

const steps = [
  {
    step: "01 · CONTEXTO",
    title: "Um curso real, com pressão regulatória concreta",
    text: "O trabalho desenvolvido junto ao curso de Direito do Centro Universitário UNITOP partiu de documentos reais: projeto pedagógico, matriz curricular, registros do NDE, atas de colegiado e evidências de corpo docente.",
  },
  {
    step: "02 · DIAGNÓSTICO",
    title: "Leitura dos fatos antes de qualquer recomendação",
    text: "A análise confrontou o que estava documentado com o que era efetivamente praticado — incluindo sustentabilidade operacional, ocupação de turmas, permanência e aderência aos requisitos avaliativos.",
  },
  {
    step: "03 · PRIORIDADES",
    title: "Separação entre urgência, risco e oportunidade",
    text: "Nem todo achado tem o mesmo peso. O diagnóstico organizou lacunas por criticidade regulatória, esforço de execução e impacto sobre a experiência do estudante.",
  },
  {
    step: "04 · INDICADORES",
    title: "Medir o que a instituição consegue sustentar",
    text: "Cada prioridade recebeu indicador, fonte de dados, responsável e periodicidade — evitando métricas que a instituição não consegue manter atualizadas.",
  },
  {
    step: "05 · PLANO",
    title: "5W2H com responsável, prazo e evidência",
    text: "O plano de ação descreve o que será feito, por quem, até quando e com qual evidência comprobatória, permitindo acompanhamento e auditoria posterior.",
  },
];

const evidenceBase = [
  "Dossiê de consultoria e diagnóstico de sustentabilidade do curso de Direito",
  "Confronto entre relatórios de auditoria e documentos de reconhecimento",
  "Instrumento de avaliação do INEP organizado por eixos",
  "Registros de NDE, colegiado e adequação do corpo docente",
];

const auditedIndicators = [
  { code: "1.1", name: "Projeto Pedagógico de Curso", weight: 2 },
  { code: "1.2", name: "Monitoria", weight: 1 },
  { code: "1.4", name: "Extensão Curricularizada", weight: 2 },
  { code: "2.1", name: "Núcleo Docente Estruturante", weight: 2 },
  { code: "3.1", name: "Laboratório e Infraestrutura", weight: 2 },
  { code: "3.2", name: "Bibliografia Básica e Complementar", weight: 2 },
];

const iconStyle = { verticalAlign: "-3px", marginRight: 8 };

export default function CaseStudy() {
  return (
    <>
      <PublicHeading
        eyebrow="CASO REAL → MÉTODO → OFERTA"
        title="O método nasceu de um problema concreto."
        text="A Vértice não parte de uma teoria genérica de gestão. Parte de um curso real, com documentos reais, prazos reais e uma exigência regulatória específica — e generaliza o que funcionou."
      />

      <section className="corp-container corp-section">
        <div className="section-heading">
          <div>
            <span className="corp-eyebrow">COMO O TRABALHO ACONTECEU</span>
            <h2>Do documento ao plano de ação.</h2>
          </div>
          <p>
            Cinco etapas aplicadas no contexto UNITOP/Direito, hoje organizadas
            como método replicável para outras instituições.
          </p>
        </div>
        <div className="case-flow">
          {steps.map(s => (
            <article className="case-step" key={s.step}>
              <span>{s.step}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
        <div className="case-evidence">
          <h3>
            <FileText size={17} style={iconStyle} />
            Base documental que sustentou o diagnóstico
          </h3>
          <ul>
            {evidenceBase.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="case-evidence" style={{ marginTop: 24 }}>
          <h3>
            <ShieldCheck size={17} style={iconStyle} />
            Matriz de indicadores auditados (Instrução QUA-INT-08)
          </h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Indicador</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                {auditedIndicators.map(i => (
                  <tr key={i.code}>
                    <td>{i.code}</td>
                    <td>{i.name}</td>
                    <td>{i.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="corp-note" style={{ marginTop: 16, fontSize: 13 }}>
            A pontuação varia de 1 a 5, com critérios objetivos de conformidade
            documental e prática.
          </p>
        </div>
      </section>

      <section className="scope-band">
        <div className="corp-container">
          <span className="corp-eyebrow">O QUE ISSO PERMITE OFERECER</span>
          <h2>Um método testado, não uma promessa.</h2>
          <p>
            A experiência prática reduz o tempo de leitura institucional e
            permite reconhecer padrões recorrentes: evidências desatualizadas,
            indicadores sem fonte, planos de ação sem responsável e decisões
            tomadas sem base documental comparável.
          </p>
          <p style={{ marginTop: 12 }}>
            É essa leitura que a Vértice leva para outras instituições — com
            adaptação ao contexto, e não por cópia de modelo.
          </p>
          <Link
            href="/servicos.html"
            className="corp-text-link"
            style={{ marginTop: 16, display: "inline-block" }}
          >
            Conheça as frentes de atuação <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>

      <section className="corp-container corp-section">
        <div className="section-heading">
          <div>
            <span className="corp-eyebrow">LIMITES E CUIDADOS</span>
            <h2>Confidencialidade faz parte do método.</h2>
          </div>
          <p>
            O caso é apresentado como referência de método, não como prova
            social. Nenhum dado sensível, indicador nominal ou documento interno
            da instituição é divulgado.
          </p>
        </div>
        <p className="corp-note">
          <ShieldCheck size={16} style={iconStyle} />
          O uso público de qualquer referência institucional depende de
          autorização expressa da instituição envolvida.
        </p>
      </section>

      <ConsultCTA />
    </>
  );
}
