import { HelpLabel } from '@/components/ContextHelp';
import React from "react";
import { useState } from "react";
import { Copy, Check, Mail, ShieldCheck } from "lucide-react";
import { company, services } from "@/lib/consultancy";
import { PublicHeading } from "@/components/PublicLayout";
export default function Contact() {
  const [institution, setInstitution] = useState("");
  const [front, setFront] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("frente") || ""
      : ""
  );
  const [challenge, setChallenge] = useState("");
  const [scope, setScope] = useState("");
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState(false);
  const prepare = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `BRIEFING — VÉRTICE EDUCAÇÃO SUPERIOR\n\nInstituição: ${institution.trim() || "A informar"}\nFrente: ${services.find(s => s.id === front)?.title || "A definir"}\nDesafio: ${challenge.trim()}\nRecorte pretendido: ${scope.trim() || "A delimitar em conjunto"}\n\nSolicitação: conversar sobre escopo, fontes, entregas e acompanhamento.`;
    setBrief(text);
    setCopied(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <PublicHeading
        eyebrow="VAMOS CONVERSAR"
        title="Um bom trabalho começa por uma boa pergunta."
        text="Qual desafio sua instituição precisa compreender? Prepare um briefing curto para organizar a primeira conversa, sem incluir informações confidenciais."
      />
      <section className="corp-container corp-section contact-composition">
        <aside>
          <span className="corp-eyebrow">O QUE PRECISAMOS ENTENDER</span>
          <h2>
            O contexto vem
            <br />
            antes da solução.
          </h2>
          <p>
            Uma descrição do desafio, um recorte inicial e uma frente de
            interesse já ajudam a definir o próximo passo.
          </p>
          <div className="contact-status">
            <Mail size={22} />
            <div>
              <strong>
                {company.email
                  ? "Canal de contato"
                  : "Canal comercial em configuração"}
              </strong>
              <p>
                {company.email ? (
                  <a href={`mailto:${company.email}`}>{company.email}</a>
                ) : (
                  "O e-mail e o WhatsApp da Vértice serão publicados após confirmação. Neste momento, este formulário apenas prepara uma mensagem para você copiar."
                )}
              </p>
            </div>
          </div>
          <div className="contact-security">
            <ShieldCheck size={20} />
            <p>
              Não inclua nomes de alunos, documentos, dados de saúde ou
              informações financeiras individuais.
            </p>
          </div>
        </aside>
        <div className="briefing-card">
          <form onSubmit={prepare}>
            <h2>Prepare seu briefing</h2>
            <p>Os campos não são enviados nem armazenados pelo formulário.</p>
            <HelpLabel>
              Instituição <span>(opcional)</span>
              <input
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                maxLength={120}
                placeholder="Nome ou tipo de instituição"
                autoComplete="organization"
              />
            </HelpLabel>
            <HelpLabel>
              Frente de interesse
              <select value={front} onChange={e => setFront(e.target.value)}>
                <option value="">Vamos definir em conjunto</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </HelpLabel>
            <HelpLabel>
              Qual é o desafio? <span>(obrigatório)</span>
              <textarea
                required
                value={challenge}
                onChange={e => setChallenge(e.target.value)}
                maxLength={1200}
                placeholder="Descreva a decisão ou o problema que deseja compreender."
                rows={5}
              />
            </HelpLabel>
            <HelpLabel>
              Recorte pretendido <span>(opcional)</span>
              <input
                value={scope}
                onChange={e => setScope(e.target.value)}
                maxLength={240}
                placeholder="Ex.: um curso, uma unidade ou um processo"
              />
            </HelpLabel>
            <button className="corp-button" type="submit">
              Preparar mensagem <Copy size={17} />
            </button>
          </form>
          {brief && (
            <div className="briefing-result" role="status">
              <h3>Mensagem preparada — não enviada</h3>
              <textarea
                readOnly
                value={brief}
                rows={9}
                aria-label="Briefing preparado para copiar"
              />
              <button type="button" className="corp-button" onClick={copy}>
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? "Briefing copiado" : "Copiar briefing"}
              </button>
              <p>
                Se o navegador bloquear a cópia, selecione o texto acima e copie
                manualmente. O envio depende de um canal comercial confirmado.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
