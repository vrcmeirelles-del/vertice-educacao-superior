import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
/**
 * Painel e-ORBIT — Espelho Acadêmico
 *
 * Exibe dados espelhados do portal e-ORBIT da UNITOP:
 * quantitativo, compliance, ENADE, vestibular, diário de classe,
 * frequência de conteúdo, professores e biblioteca.
 *
 * Dados reais via Supabase (RLS ativo).
 * Somente leitura — o painel NUNCA altera dados no e-ORBIT.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Q from '@/lib/eorbit/queries';
import type {
  Semestre, CursoEorbit, Enade, Professor,
  VestibularEdital, VestibularCurso,
  BibliotecaResumo, BibliotecaCDD, BibliotecaDecada,
  ResumoQuantitativo, ResumoCompliance, ResumoDiario,
  FrequenciaConteudo,
} from '@/lib/eorbit/types';
import './painel-eorbit.css';

// ================================================================
// Helpers
// ================================================================

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function Skeleton({ height = 40 }: { height?: number }) {
  return <div className="eo-skeleton" style={{ height }} />;
}

function Erro({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="eo-erro">
      {msg}
      <br />
      <button type="button" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
}

function Vazio({ msg }: { msg: string }) {
  return <p className="eo-vazio">{msg}</p>;
}

function ComplianceBar({ pct }: { pct: number }) {
  const cls = pct >= 80 ? 'ok' : pct >= 50 ? 'atencao' : 'critico';
  return (
    <span>
      <span className="eo-bar-track">
        <span className={`eo-bar-fill ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {fmtPct(pct)}
    </span>
  );
}

function Badge({ tipo }: { tipo: 'ok' | 'atencao' | 'critico'; }) {
  const label = tipo === 'ok' ? 'Conforme' : tipo === 'atencao' ? 'Atenção' : 'Crítico';
  return <span className={`eo-badge eo-badge-${tipo}`}>{label}</span>;
}

// ================================================================
// Tabs
// ================================================================

type TabKey = 'quantitativo' | 'compliance' | 'enade' | 'vestibular' | 'diario' | 'professores' | 'biblioteca';

const TAB_LABELS: [TabKey, string][] = [
  ['quantitativo', 'Quantitativo'],
  ['compliance', 'Compliance'],
  ['enade', 'ENADE'],
  ['vestibular', 'Vestibular'],
  ['diario', 'Diário de Classe'],
  ['professores', 'Professores'],
  ['biblioteca', 'Biblioteca'],
];

// ================================================================
// Aba: Quantitativo
// ================================================================

function TabQuantitativo({
  resumo, cursos, semestres, loading, error, onRetry,
}: {
  resumo: ResumoQuantitativo[] | null;
  cursos: CursoEorbit[];
  semestres: Semestre[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !resumo) return <Skeleton height={200} />;
  if (!resumo.length) return <Vazio msg="Nenhum dado quantitativo carregado." />;

  const ultimo = resumo[resumo.length - 1];
  const penultimo = resumo.length > 1 ? resumo[resumo.length - 2] : null;
  const variacao = penultimo && penultimo.totalMatriculados > 0
    ? ((ultimo.totalMatriculados - penultimo.totalMatriculados) / penultimo.totalMatriculados * 100)
    : null;

  return (
    <>
      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Matriculados (último semestre)</p>
          <p className="eo-kpi-valor">{fmt(ultimo.totalMatriculados)}</p>
          {variacao !== null && (
            <p className="eo-kpi-sub" style={{ color: variacao >= 0 ? 'var(--eo-ok)' : 'var(--eo-erro)' }}>
              {variacao >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(variacao))} vs. semestre anterior
            </p>
          )}
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Total de vínculos</p>
          <p className="eo-kpi-valor">{fmt(ultimo.totalVinculos)}</p>
          <p className="eo-kpi-sub">{ultimo.semestre}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Trancados</p>
          <p className="eo-kpi-valor">{fmt(ultimo.trancado)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Abandono</p>
          <p className="eo-kpi-valor">{fmt(ultimo.abandono)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Concluídos</p>
          <p className="eo-kpi-valor">{fmt(ultimo.concluido)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Semestres carregados</p>
          <p className="eo-kpi-valor">{resumo.length}</p>
        </div>
      </div>

      <h3>Série histórica — Matriculados por semestre</h3>
      <div className="eo-tabela-wrap">
        <table className="eo-tabela">
          <thead>
            <tr>
              <th>Semestre<ContextHelp title="Semestre" /></th>
              <th>Matriculados</th>
              <th>Vínculos</th>
              <th>Pré-matric.</th>
              <th>Trancados</th>
              <th>Abandono</th>
              <th>Concluídos</th>
              <th>Transferidos</th>
              <th>Cancelados</th>
            </tr>
          </thead>
          <tbody>
            {[...resumo].reverse().map(r => (
              <tr key={r.semestreId}>
                <td><strong>{r.semestre}</strong></td>
                <td>{fmt(r.totalMatriculados)}</td>
                <td>{fmt(r.totalVinculos)}</td>
                <td>{fmt(r.preMatriculado)}</td>
                <td>{fmt(r.trancado)}</td>
                <td>{fmt(r.abandono)}</td>
                <td>{fmt(r.concluido)}</td>
                <td>{fmt(r.transferido)}</td>
                <td>{fmt(r.cancelado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Evolução por semestre</h3>
      {resumo.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          {resumo.map(r => {
            const max = Math.max(...resumo.map(x => x.totalMatriculados), 1);
            return (
              <div className="eo-hbar-row" key={r.semestreId}>
                <span className="eo-hbar-label">{r.semestre}</span>
                <div className="eo-hbar-track">
                  <div className="eo-hbar-fill" style={{ width: `${(r.totalMatriculados / max) * 100}%` }} />
                </div>
                <span className="eo-hbar-value">{fmt(r.totalMatriculados)}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ================================================================
// Aba: Compliance
// ================================================================

function TabCompliance({
  resumo, loading, error, onRetry,
}: {
  resumo: ResumoCompliance[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !resumo) return <Skeleton height={160} />;
  if (!resumo.length) return <Vazio msg="Nenhum dado de compliance carregado." />;

  const planos = resumo.filter(r => r.tipo === 'plano');
  const notas = resumo.filter(r => r.tipo === 'notas');

  return (
    <div className="eo-grid-2">
      <div>
        <h3>Plano de Ensino</h3>
        {planos.length === 0 ? <Vazio msg="Sem dados de plano de ensino." /> : (
          <div className="eo-tabela-wrap">
            <table className="eo-tabela">
              <thead>
                <tr>
                  <th>Semestre<ContextHelp title="Semestre" /></th>
                  <th>Total</th>
                  <th>Enviados</th>
                  <th>Envio</th>
                </tr>
              </thead>
              <tbody>
                {[...planos].reverse().map(r => (
                  <tr key={r.semestreId}>
                    <td><strong>{r.semestre}</strong></td>
                    <td>{fmt(r.totalDisciplinas)}</td>
                    <td>{fmt(r.conformes)}</td>
                    <td><ComplianceBar pct={r.percentual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <h3>Postagem de Notas</h3>
        {notas.length === 0 ? <Vazio msg="Sem dados de postagem de notas." /> : (
          <div className="eo-tabela-wrap">
            <table className="eo-tabela">
              <thead>
                <tr>
                  <th>Semestre<ContextHelp title="Semestre" /></th>
                  <th>Total</th>
                  <th>Postadas</th>
                  <th>Postagem</th>
                </tr>
              </thead>
              <tbody>
                {[...notas].reverse().map(r => (
                  <tr key={r.semestreId}>
                    <td><strong>{r.semestre}</strong></td>
                    <td>{fmt(r.totalDisciplinas)}</td>
                    <td>{fmt(r.conformes)}</td>
                    <td><ComplianceBar pct={r.percentual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// Aba: ENADE
// ================================================================

function TabEnade({
  dados, loading, error, onRetry,
}: {
  dados: Enade[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !dados) return <Skeleton height={160} />;
  if (!dados.length) return <Vazio msg="Nenhum dado ENADE carregado." />;

  const semestres = [...new Set(dados.map(d => d.semestre))].sort();
  const [semSel, setSemSel] = useState(semestres[semestres.length - 1] ?? '');
  const filtered = dados.filter(d => d.semestre === semSel).sort((a, b) => b.habilitados - a.habilitados);
  const totalHab = filtered.reduce((s, d) => s + d.habilitados, 0);

  return (
    <>
      <div className="eo-filtros">
        <HelpLabel>
          Semestre ENADE
          <select value={semSel} onChange={e => setSemSel(e.target.value)}>
            {semestres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </HelpLabel>
      </div>

      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Total habilitados</p>
          <p className="eo-kpi-valor">{fmt(totalHab)}</p>
          <p className="eo-kpi-sub">{semSel}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Cursos com habilitados</p>
          <p className="eo-kpi-valor">{filtered.length}</p>
        </div>
      </div>

      <div className="eo-tabela-wrap">
        <table className="eo-tabela">
          <thead>
            <tr>
              <th>Curso<ContextHelp title="Curso" /></th>
              <th>Habilitados</th>
              <th>Participação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={`${d.semestre}-${d.curso_nome}`}>
                <td>{d.curso_nome}</td>
                <td>{fmt(d.habilitados)}</td>
                <td>{totalHab > 0 ? fmtPct((d.habilitados / totalHab) * 100) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ================================================================
// Aba: Vestibular
// ================================================================

function TabVestibular({
  editais, cursos, loading, error, onRetry,
}: {
  editais: VestibularEdital[] | null;
  cursos: VestibularCurso[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !editais || !cursos) return <Skeleton height={160} />;
  if (!editais.length) return <Vazio msg="Nenhum edital de vestibular carregado." />;

  const totalVagas = cursos.reduce((s, c) => s + c.vagas, 0);

  return (
    <>
      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Editais</p>
          <p className="eo-kpi-valor">{editais.length}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Cursos ofertados</p>
          <p className="eo-kpi-valor">{cursos.length}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Vagas totais</p>
          <p className="eo-kpi-valor">{fmt(totalVagas)}</p>
        </div>
      </div>

      <h3>Editais</h3>
      <div className="eo-tabela-wrap">
        <table className="eo-tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {editais.map(e => (
              <tr key={e.id}>
                <td>{e.codigo}</td>
                <td>{e.descricao}</td>
                <td>{e.situacao ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Cursos por vagas ofertadas</h3>
      {cursos.slice(0, 15).map(c => {
        const max = Math.max(...cursos.map(x => x.vagas), 1);
        return (
          <div className="eo-hbar-row" key={c.id}>
            <span className="eo-hbar-label" title={c.curso_nome}>{c.curso_nome}</span>
            <div className="eo-hbar-track">
              <div className="eo-hbar-fill" style={{ width: `${(c.vagas / max) * 100}%` }} />
            </div>
            <span className="eo-hbar-value">{fmt(c.vagas)}</span>
          </div>
        );
      })}
    </>
  );
}

// ================================================================
// Aba: Diário de Classe
// ================================================================

function TabDiario({
  resumo, loading, error, onRetry,
}: {
  resumo: ResumoDiario[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !resumo) return <Skeleton height={160} />;
  if (!resumo.length) return <Vazio msg="Nenhum dado de diário de classe carregado." />;

  const ultimo = resumo[resumo.length - 1];

  return (
    <>
      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Registros no semestre</p>
          <p className="eo-kpi-valor">{fmt(ultimo.totalRegistros)}</p>
          <p className="eo-kpi-sub">{ultimo.semestre}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Plano postado</p>
          <p className="eo-kpi-valor">{fmtPct(ultimo.totalRegistros > 0 ? (ultimo.planoOk / ultimo.totalRegistros) * 100 : 0)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Notas postadas</p>
          <p className="eo-kpi-valor">{fmtPct(ultimo.totalRegistros > 0 ? (ultimo.notasOk / ultimo.totalRegistros) * 100 : 0)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Conteúdo postado</p>
          <p className="eo-kpi-valor">{fmtPct(ultimo.totalRegistros > 0 ? (ultimo.conteudoOk / ultimo.totalRegistros) * 100 : 0)}</p>
        </div>
      </div>

      <h3>Evolução por semestre</h3>
      <div className="eo-tabela-wrap">
        <table className="eo-tabela">
          <thead>
            <tr>
              <th>Semestre<ContextHelp title="Semestre" /></th>
              <th>Registros</th>
              <th>Plano</th>
              <th>Notas</th>
              <th>Conteúdo</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {[...resumo].reverse().map(r => (
              <tr key={r.semestreId}>
                <td><strong>{r.semestre}</strong></td>
                <td>{fmt(r.totalRegistros)}</td>
                <td><ComplianceBar pct={r.totalRegistros > 0 ? (r.planoOk / r.totalRegistros) * 100 : 0} /></td>
                <td><ComplianceBar pct={r.totalRegistros > 0 ? (r.notasOk / r.totalRegistros) * 100 : 0} /></td>
                <td><ComplianceBar pct={r.totalRegistros > 0 ? (r.conteudoOk / r.totalRegistros) * 100 : 0} /></td>
                <td><ComplianceBar pct={r.totalRegistros > 0 ? (r.cadastroOk / r.totalRegistros) * 100 : 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ================================================================
// Aba: Professores
// ================================================================

function TabProfessores({
  dados, loading, error, onRetry,
}: {
  dados: Professor[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading || !dados) return <Skeleton height={160} />;
  if (!dados.length) return <Vazio msg="Nenhum professor carregado." />;

  const [query, setQuery] = useState('');
  const filtered = dados.filter(p =>
    p.nome.toLowerCase().includes(query.toLowerCase()) ||
    (p.titulacao ?? '').toLowerCase().includes(query.toLowerCase())
  );

  // Resumo por titulação
  const porTitulacao = new Map<string, number>();
  for (const p of dados) {
    const t = p.titulacao ?? 'Não informado';
    porTitulacao.set(t, (porTitulacao.get(t) ?? 0) + 1);
  }
  const titulacoes = [...porTitulacao.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Total de professores</p>
          <p className="eo-kpi-valor">{dados.length}</p>
        </div>
        {titulacoes.slice(0, 4).map(([tit, qtd]) => (
          <div className="eo-kpi-card" key={tit}>
            <p className="eo-kpi-label">{tit}</p>
            <p className="eo-kpi-valor">{qtd}</p>
            <p className="eo-kpi-sub">{fmtPct((qtd / dados.length) * 100)}</p>
          </div>
        ))}
      </div>

      <HelpLabel style={{ display: 'block', marginBottom: 12 }}>
        Buscar professor
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nome ou titulação"
          style={{ marginLeft: 8, padding: '5px 10px', border: '1px solid var(--eo-borda)', borderRadius: 'var(--eo-radius)' }}
        />
      </HelpLabel>

      <div className="eo-tabela-wrap">
        <table className="eo-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Titulação</th>
              <th>Regime</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(p => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.titulacao ?? '—'}</td>
                <td>{p.regime ?? '—'}</td>
              </tr>
            ))}
            {filtered.length > 50 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--eo-tinta-fraca)' }}>
                Mostrando 50 de {filtered.length} professores. Refine a busca.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ================================================================
// Aba: Biblioteca
// ================================================================

function TabBiblioteca({
  resumo, cdd, decada, loading, error, onRetry,
}: {
  resumo: BibliotecaResumo | null;
  cdd: BibliotecaCDD[] | null;
  decada: BibliotecaDecada[] | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (error) return <Erro msg={error} onRetry={onRetry} />;
  if (loading) return <Skeleton height={160} />;
  if (!resumo) return <Vazio msg="Nenhum dado de biblioteca carregado." />;

  return (
    <>
      <div className="eo-kpi-strip">
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Títulos</p>
          <p className="eo-kpi-valor">{fmt(resumo.total_titulos)}</p>
        </div>
        <div className="eo-kpi-card">
          <p className="eo-kpi-label">Exemplares</p>
          <p className="eo-kpi-valor">{fmt(resumo.total_exemplares)}</p>
        </div>
      </div>

      <div className="eo-grid-2">
        <div>
          <h3>Distribuição por CDD</h3>
          {(!cdd || !cdd.length) ? <Vazio msg="Sem classificação CDD." /> : (
            <>
              {cdd.map(c => {
                const max = Math.max(...cdd.map(x => x.quantidade), 1);
                return (
                  <div className="eo-hbar-row" key={c.id}>
                    <span className="eo-hbar-label" title={`${c.codigo_cdd} — ${c.descricao}`}>
                      {c.codigo_cdd} — {c.descricao}
                    </span>
                    <div className="eo-hbar-track">
                      <div className="eo-hbar-fill" style={{ width: `${(c.quantidade / max) * 100}%` }} />
                    </div>
                    <span className="eo-hbar-value">{fmt(c.quantidade)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div>
          <h3>Acervo por década de publicação</h3>
          {(!decada || !decada.length) ? <Vazio msg="Sem dados por década." /> : (
            <>
              {decada.map(d => {
                const max = Math.max(...decada.map(x => x.quantidade), 1);
                return (
                  <div className="eo-hbar-row" key={d.id}>
                    <span className="eo-hbar-label">{d.decada}</span>
                    <div className="eo-hbar-track">
                      <div className="eo-hbar-fill" style={{ width: `${(d.quantidade / max) * 100}%` }} />
                    </div>
                    <span className="eo-hbar-value">{fmt(d.quantidade)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ================================================================
// Componente principal
// ================================================================

type Props = {
  instituicaoId: string;
  instituicaoNome?: string;
};

export default function PainelEorbit({ instituicaoId, instituicaoNome }: Props) {
  const [tab, setTab] = useState<TabKey>('quantitativo');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Data
  const [semestres, setSemestres] = useState<Semestre[] | null>(null);
  const [cursos, setCursos] = useState<CursoEorbit[] | null>(null);
  const [resumoQuant, setResumoQuant] = useState<ResumoQuantitativo[] | null>(null);
  const [resumoCompliance, setResumoCompliance] = useState<ResumoCompliance[] | null>(null);
  const [resumoDiario, setResumoDiario] = useState<ResumoDiario[] | null>(null);
  const [enade, setEnade] = useState<Enade[] | null>(null);
  const [vestEditais, setVestEditais] = useState<VestibularEdital[] | null>(null);
  const [vestCursos, setVestCursos] = useState<VestibularCurso[] | null>(null);
  const [professores, setProfessores] = useState<Professor[] | null>(null);
  const [bibResumo, setBibResumo] = useState<BibliotecaResumo | null>(null);
  const [bibCDD, setBibCDD] = useState<BibliotecaCDD[] | null>(null);
  const [bibDecada, setBibDecada] = useState<BibliotecaDecada[] | null>(null);

  // Errors
  const [erros, setErros] = useState<Record<string, string>>({});
  const setErro = (k: string, v: string) => setErros(prev => ({ ...prev, [k]: v }));
  const clearErro = (k: string) => setErros(prev => { const n = { ...prev }; delete n[k]; return n; });

  // Loading flags
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const setLoad = (k: string, v: boolean) => setLoading(prev => ({ ...prev, [k]: v }));

  const loadAll = useCallback(async () => {
    if (!instituicaoId) return;
    setLastUpdate(new Date());

    // Semestres + Cursos (needed by others)
    setLoad('base', true);
    clearErro('base');
    try {
      const [sems, crs] = await Promise.all([
        Q.getSemestres(instituicaoId),
        Q.getCursos(instituicaoId),
      ]);
      setSemestres(sems);
      setCursos(crs);

      // Quantitativo
      setLoad('quantitativo', true);
      clearErro('quantitativo');
      Q.getResumoQuantitativo(instituicaoId, sems)
        .then(setResumoQuant)
        .catch(() => setErro('quantitativo', 'Não foi possível carregar o quantitativo.'))
        .finally(() => setLoad('quantitativo', false));

      // Compliance
      setLoad('compliance', true);
      clearErro('compliance');
      Q.getResumoCompliance(instituicaoId, sems)
        .then(setResumoCompliance)
        .catch(() => setErro('compliance', 'Não foi possível carregar compliance.'))
        .finally(() => setLoad('compliance', false));

      // Diário
      setLoad('diario', true);
      clearErro('diario');
      Q.getResumoDiario(instituicaoId, sems)
        .then(setResumoDiario)
        .catch(() => setErro('diario', 'Não foi possível carregar diário de classe.'))
        .finally(() => setLoad('diario', false));

    } catch {
      setErro('base', 'Não foi possível carregar semestres e cursos.');
    } finally {
      setLoad('base', false);
    }

    // ENADE
    setLoad('enade', true);
    clearErro('enade');
    Q.getEnade(instituicaoId)
      .then(setEnade)
      .catch(() => setErro('enade', 'Não foi possível carregar dados ENADE.'))
      .finally(() => setLoad('enade', false));

    // Vestibular
    setLoad('vestibular', true);
    clearErro('vestibular');
    Promise.all([
      Q.getVestibularEditais(instituicaoId),
      Q.getVestibularCursos(instituicaoId),
    ])
      .then(([ed, cr]) => { setVestEditais(ed); setVestCursos(cr); })
      .catch(() => setErro('vestibular', 'Não foi possível carregar vestibular.'))
      .finally(() => setLoad('vestibular', false));

    // Professores
    setLoad('professores', true);
    clearErro('professores');
    Q.getProfessores(instituicaoId)
      .then(setProfessores)
      .catch(() => setErro('professores', 'Não foi possível carregar professores.'))
      .finally(() => setLoad('professores', false));

    // Biblioteca
    setLoad('biblioteca', true);
    clearErro('biblioteca');
    Promise.all([
      Q.getBibliotecaResumo(instituicaoId),
      Q.getBibliotecaCDD(instituicaoId),
      Q.getBibliotecaDecada(instituicaoId),
    ])
      .then(([res, cdd, dec]) => { setBibResumo(res); setBibCDD(cdd); setBibDecada(dec); })
      .catch(() => setErro('biblioteca', 'Não foi possível carregar biblioteca.'))
      .finally(() => setLoad('biblioteca', false));

  }, [instituicaoId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="eorbit" aria-label="Painel e-ORBIT — Espelho Acadêmico">
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <h1>Espelho Acadêmico e-ORBIT</h1>
      <p className="eo-meta">
        {instituicaoNome ?? 'UNITOP'} · dados espelhados do portal e-ORBIT · atualizado {fmtTime(lastUpdate)}
      </p>

      {/* Tabs */}
      <div className="eo-tabs" role="tablist">
        {TAB_LABELS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            className="eo-tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {erros.base && <Erro msg={erros.base} onRetry={loadAll} />}

      {tab === 'quantitativo' && (
        <TabQuantitativo
          resumo={resumoQuant}
          cursos={cursos ?? []}
          semestres={semestres ?? []}
          loading={loading.quantitativo ?? true}
          error={erros.quantitativo ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'compliance' && (
        <TabCompliance
          resumo={resumoCompliance}
          loading={loading.compliance ?? true}
          error={erros.compliance ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'enade' && (
        <TabEnade
          dados={enade}
          loading={loading.enade ?? true}
          error={erros.enade ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'vestibular' && (
        <TabVestibular
          editais={vestEditais}
          cursos={vestCursos}
          loading={loading.vestibular ?? true}
          error={erros.vestibular ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'diario' && (
        <TabDiario
          resumo={resumoDiario}
          loading={loading.diario ?? true}
          error={erros.diario ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'professores' && (
        <TabProfessores
          dados={professores}
          loading={loading.professores ?? true}
          error={erros.professores ?? ''}
          onRetry={loadAll}
        />
      )}

      {tab === 'biblioteca' && (
        <TabBiblioteca
          resumo={bibResumo}
          cdd={bibCDD}
          decada={bibDecada}
          loading={loading.biblioteca ?? true}
          error={erros.biblioteca ?? ''}
          onRetry={loadAll}
        />
      )}

      <p className="eo-fonte">
        Fonte: espelhamento do portal e-ORBIT (itop.eorbit.com.br). O painel Vértice é somente leitura
        e nunca altera dados no sistema de origem. Dados nominais de professores e disciplinas
        conforme registrado no e-ORBIT. Dados pessoais de alunos (CPF, RG, documentos) nunca
        são armazenados.
      </p>
    </section>
  );
}
