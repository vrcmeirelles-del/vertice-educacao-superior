import { useMemo, useState } from "react";
import {
  NIVEIS,
  conceitoInstitucional,
  filtrarIndicadores,
  instrumento,
  nomeDoEixo,
  pesoDoEixo,
  type Criterio,
  type IndicadorAvaliacao,
} from "@/lib/avaliacao-institucional";
import "./avaliacao-institucional.css";

const TOTAL_RESTRITOS = instrumento.indicators.filter((i) => i.applicability).length;

function formatarNota(valor: number | null): string {
  return valor === null ? "—" : valor.toFixed(2).replace(".", ",");
}

function Evidencias({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="aval-bloco">
      <h5>{titulo}</h5>
      <ul>
        {itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Indicador({ indicador }: { indicador: IndicadorAvaliacao }) {
  const [nivel, setNivel] = useState<keyof Criterio>("5");
  return (
    <details className="aval-indicador">
      <summary>
        <span className="aval-codigo">{indicador.code}</span>
        <span className="aval-titulo">{indicador.title}</span>
        <span className="aval-eixo-tag">Eixo {indicador.axis}</span>
        {indicador.applicability && <span className="aval-badge restrito">Aplicabilidade restrita</span>}
      </summary>
      <div className="aval-corpo">
        {indicador.applicability && (
          <p className="aval-nota">
            <strong>Aplicabilidade.</strong> {indicador.applicability}
          </p>
        )}
        {indicador.nota && (
          <p className="aval-nota">
            <strong>Nota de modalidade.</strong> {indicador.nota}
          </p>
        )}

        <div className="aval-escala" role="group" aria-label={`Escala do indicador ${indicador.code}`}>
          {NIVEIS.map((n) => (
            <button
              key={n}
              type="button"
              className={nivel === n ? "ativo" : ""}
              aria-pressed={nivel === n}
              onClick={() => setNivel(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="aval-criterio">
          <strong>Conceito {nivel}.</strong> {indicador.criteria[nivel]}
        </p>

        <div className="aval-grid">
          <Evidencias titulo="Evidências obrigatórias" itens={indicador.obrig} />
          <Evidencias titulo="Evidências complementares" itens={indicador.compl} />
          <Evidencias titulo="Evidência de resultado" itens={indicador.resultado} />
        </div>

        <p className="aval-alerta">
          <strong>O que reprova ou segura o conceito.</strong> {indicador.alerta}
        </p>
      </div>
    </details>
  );
}

export default function AvaliacaoInstitucional() {
  const [busca, setBusca] = useState("");
  const [eixo, setEixo] = useState("");
  const [somenteRestritos, setSomenteRestritos] = useState(false);
  const [notas, setNotas] = useState<Partial<Record<number, number | null>>>({});

  const resultados = useMemo(
    () => filtrarIndicadores(instrumento.indicators, { busca, eixo, somenteRestritos }),
    [busca, eixo, somenteRestritos]
  );

  const conceito = conceitoInstitucional(notas);

  return (
    <section className="aval" aria-labelledby="aval-title">
      <header>
        <div>
          <p className="aval-kicker">Avaliação institucional externa</p>
          <h3 id="aval-title">Recredenciamento Institucional</h3>
          <p>
            {instrumento.instrument}, edição {instrumento.edition}. Cinco eixos,{" "}
            {instrumento.total} indicadores, com o critério de conceito 5 transcrito do
            instrumento e as evidências que cada pasta deve conter.
          </p>
        </div>
        <span className="aval-contador">{resultados.length} de {instrumento.total}</span>
      </header>

      <p className="aval-aviso">
        Esta é uma mesa de trabalho. O conceito institucional é calculado pelo INEP na
        avaliação in loco; a calculadora abaixo serve para simular o efeito de cada eixo
        e não substitui a avaliação oficial. As notas que você digitar não são gravadas.
      </p>

      <div className="aval-kpis">
        <span><b>{instrumento.axes.length}</b> eixos</span>
        <span><b>{instrumento.total}</b> indicadores</span>
        <span><b>{TOTAL_RESTRITOS}</b> com aplicabilidade restrita</span>
        <span><b>{formatarNota(conceito)}</b> conceito simulado</span>
      </div>

      <div className="aval-simulador">
        <h4>Simulação do conceito institucional</h4>
        <p className="aval-nota">
          O CI é a média ponderada dos conceitos dos eixos. Os eixos 2 e 5 respondem por 60
          do total.
        </p>
        <div className="aval-eixos">
          {instrumento.axes.map((a) => (
            <label key={a.code}>
              <span>
                Eixo {a.code} · {nomeDoEixo(a.code)}
                <small>peso {pesoDoEixo(a.code)}</small>
              </span>
              <select
                value={notas[a.code] ?? ""}
                onChange={(e) =>
                  setNotas((atual) => ({
                    ...atual,
                    [a.code]: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              >
                <option value="">Sem nota</option>
                {NIVEIS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="aval-resultado">
          Conceito institucional simulado: <strong>{formatarNota(conceito)}</strong>
          {conceito === null && " — atribua nota aos cinco eixos"}
        </p>
      </div>

      <div className="aval-filtros">
        <label>
          Buscar
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Indicador, critério ou palavra-chave"
          />
        </label>
        <label>
          Eixo
          <select value={eixo} onChange={(e) => setEixo(e.target.value)}>
            <option value="">Todos</option>
            {instrumento.axes.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="aval-checkbox">
          <input
            type="checkbox"
            checked={somenteRestritos}
            onChange={(e) => setSomenteRestritos(e.target.checked)}
          />
          Somente com aplicabilidade restrita
        </label>
      </div>

      {resultados.length === 0 ? (
        <p>Nenhum indicador corresponde aos filtros.</p>
      ) : (
        <div className="aval-lista">
          {resultados.map((indicador) => (
            <Indicador key={indicador.code} indicador={indicador} />
          ))}
        </div>
      )}
    </section>
  );
}
