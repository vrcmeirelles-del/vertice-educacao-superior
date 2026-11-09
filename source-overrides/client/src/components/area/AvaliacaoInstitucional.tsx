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
import {Recred2017Overview,Recred2017IndicatorDocs,useRecredenciamentoDocs2017,type RecredDocsState} from "./RecredenciamentoDocumental2017";
import type {Role} from "@/lib/area";

const TOTAL_RESTRITOS = instrumento.indicators.filter((i) => i.applicability).length;

function formatarNota(valor: number | null): string {
  return valor === null ? "—" : valor.toFixed(2).replace(".", ",");
}

type Parte = { value: number; color: string; label: string };
function DonutAval({ parts, center, caption, size = 96 }: { parts: Parte[]; center: string; caption: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  return (
    <svg className="aval-donut" viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={caption}>
      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e7ecf1" strokeWidth="5" />
      {total > 0 && parts.filter(p => p.value > 0).map(p => {
        const len = (p.value / total) * 100;
        const el = <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />;
        acc += len;
        return el;
      })}
      <text x="21" y="23" textAnchor="middle" className="aval-donut-text">{center}</text>
    </svg>
  );
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

function Indicador({ indicador, institutionId, role, documents }: { indicador: IndicadorAvaliacao; institutionId:string; role:Role|null; documents:RecredDocsState }) {
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
        <Recred2017IndicatorDocs institutionId={institutionId} role={role} indicador={indicador} state={documents}/>
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

export default function AvaliacaoInstitucional({ institutionId,role }: { institutionId:string;role:Role|null }) {
  const documents=useRecredenciamentoDocs2017(institutionId,role);
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
          <h3 id="aval-title">Recredenciamento Institucional · Instrumento 2017</h3>
          <p className="aval-nota">Evidências cadastradas por indicador no acervo exclusivo de Recredenciamento 2017. O Reconhecimento de Curso utiliza outro repositório.</p>
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

      <Recred2017Overview state={documents}/>
      <div className="aval-resumo">
        <div className="aval-resumo-main">
          <DonutAval parts={[
            {value: Object.values(notas).filter(n=>n!==null&&n!==undefined&&n>=4).length, color:'#4f9a76', label:'≥ 4'},
            {value: Object.values(notas).filter(n=>n!==null&&n!==undefined&&n!==undefined&&n>=3&&n<4).length, color:'#d1a54a', label:'3'},
            {value: Object.values(notas).filter(n=>n!==null&&n!==undefined&&n<3).length, color:'#c0594f', label:'< 3'},
            {value: instrumento.axes.length - Object.values(notas).filter(n=>n!==null&&n!==undefined).length, color:'#a9b6c4', label:'Sem nota'},
          ]} center={formatarNota(conceito)} caption="Conceito institucional simulado" />
          <div>
            <strong style={{fontSize:'1.15rem'}}>{formatarNota(conceito)} conceito simulado</strong>
            <ul className="aval-legenda">
              <li><i style={{background:'#4f9a76'}}/> Conceito ≥ 4 <b>{Object.values(notas).filter(n=>n!==null&&n!==undefined&&n>=4).length}</b></li>
              <li><i style={{background:'#d1a54a'}}/> Conceito 3 <b>{Object.values(notas).filter(n=>n!==null&&n!==undefined&&n>=3&&n<4).length}</b></li>
              <li><i style={{background:'#c0594f'}}/> Conceito {'<'} 3 <b>{Object.values(notas).filter(n=>n!==null&&n!==undefined&&n<3).length}</b></li>
              <li><i style={{background:'#a9b6c4'}}/> Sem nota <b>{instrumento.axes.length - Object.values(notas).filter(n=>n!==null&&n!==undefined).length}</b></li>
            </ul>
          </div>
        </div>
        <div className="aval-eixo-cards">
          {instrumento.axes.map(a => {
            const nota = notas[a.code];
            const pct = nota !== null && nota !== undefined ? Math.round((nota/5)*100) : 0;
            return (
              <div key={a.code} className="aval-eixo-card">
                <DonutAval parts={[{value:pct,color:nota!==null&&nota!==undefined?(nota>=4?'#4f9a76':nota>=3?'#d1a54a':'#c0594f'):'#a9b6c4',label:''},{value:100-pct,color:'#e7ecf1',label:''}]} center={nota!==null&&nota!==undefined?String(nota):'—'} caption={`Eixo ${a.code}`} size={52} />
                <div>
                  <strong>Eixo {a.code}</strong>
                  <p className="area-muted" style={{margin:0,fontSize:'.78rem'}}>{a.name}<br/>peso {pesoDoEixo(a.code)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
            <Indicador key={indicador.code} indicador={indicador} institutionId={institutionId} role={role} documents={documents} />
          ))}
        </div>
      )}
    </section>
  );
}
