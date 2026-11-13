import { HelpLabel } from '@/components/ContextHelp';
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  Info,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PilotLayout";
import { downloadFile, usePilot, migratePilot } from "@/contexts/PilotContext";
import { initialState } from "@/lib/pilot";

export default function Assumptions() {
  const { state, setState } = usePilot();
  const done = state.pending.filter(p => p.done).length;
  const reset = () => {
    if (
      window.confirm(
        "Restaurar os exemplos iniciais? Suas respostas, critérios, metas, ações e pendências locais serão substituídos. Exporte uma cópia antes, se quiser preservá-los."
      )
    ) {
      setState(migratePilot(initialState));
      toast.success("Cenário inicial restaurado.");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="LIMITES E PRÓXIMOS PASSOS"
        title="Antes de levar para a vida real."
        description="Registre o que já sabemos, o que ainda falta e o que deve ser autorizado."
      >
        <button
          className="button secondary"
          onClick={() =>
            downloadFile(
              JSON.stringify({ ...state, simulation: true }, null, 2),
              "vertice-copia-demonstrativa.json"
            )
          }
        >
          <Download size={16} />
          Exportar cópia local
        </button>
      </PageHeader>
      <section className="panel assumptions-context">
        <span className="context-icon">
          <Info size={24} />
        </span>
        <div>
          <h3>Um exemplo de gestão, não um caso de cliente</h3>
          <p>
            Esta demonstração usa uma instituição fictícia e números
            independentes. Não descreve uma faculdade cliente nem reaproveita
            dados de trabalhos anteriores. Fontes, critérios e escopo precisam
            ser validados antes de qualquer uso com informações reais.
          </p>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Pendências para validar a proposta</h2>
          <p>
            A marcação representa sua anotação local, não uma aprovação externa.
          </p>
        </div>
        <span className="completion-pill">
          {done}/{state.pending.length} revisadas
        </span>
      </div>
      <div className="pending-list">
        {state.pending.map((p, i) => (
          <article
            className={`panel pending-card ${p.done ? "done" : ""}`}
            key={p.id}
          >
            <button
              className="pending-checkbox"
              onClick={() =>
                setState(s => ({
                  ...s,
                  pending: s.pending.map(item =>
                    item.id === p.id ? { ...item, done: !item.done } : item
                  ),
                }))
              }
              aria-label={`${p.done ? "Desmarcar" : "Marcar como revisada"}: ${p.title}`}
              aria-pressed={p.done}
            >
              {p.done ? <CheckCircle2 size={24} /> : <Circle size={24} />}
            </button>
            <div>
              <span className="eyebrow">
                PENDÊNCIA {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{p.title}</h3>
              <HelpLabel className="field-label">
                <span className="sr-only">Anotações sobre {p.title}</span>
                <textarea
                  value={p.detail}
                  onChange={e =>
                    setState(s => ({
                      ...s,
                      pending: s.pending.map(item =>
                        item.id === p.id
                          ? { ...item, detail: e.target.value }
                          : item
                      ),
                    }))
                  }
                  maxLength={3000}
                />
              </HelpLabel>
            </div>
            <span className={`badge ${p.done ? "green" : "gray"}`}>
              {p.done ? "Revisada localmente" : "A confirmar"}
            </span>
          </article>
        ))}
      </div>
      <section className="panel storage-panel">
        <ShieldCheck size={24} />
        <div>
          <h3>
            Este é um piloto local, não um sistema institucional em produção
          </h3>
          <p>
            Dados e alterações ficam no armazenamento deste navegador. Não há
            login, banco de dados, anexos nem sincronização entre dispositivos.
            Limpar o navegador pode apagar o trabalho. A cópia JSON preserva os
            dados como arquivo, mas sua reimportação ainda não está
            implementada.
          </p>
          <p>
            Não insira dados de alunos, informações pessoais ou documentos
            confidenciais. A versão real precisará de controle de acesso,
            segregação entre instituições, política de retenção e análise de
            proteção de dados.
          </p>
        </div>
      </section>
      <div className="reset-panel">
        <div>
          <h3>Voltar ao cenário inicial</h3>
          <p>Substitui apenas as alterações deste piloto no navegador atual.</p>
        </div>
        <button className="button danger-outline" onClick={reset}>
          <RotateCcw size={15} />
          Restaurar exemplos
        </button>
      </div>
    </>
  );
}
