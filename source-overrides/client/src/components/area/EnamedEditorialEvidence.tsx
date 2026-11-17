import { useMemo, useState } from 'react';
import evidence from '@/data/enamed-editorial-evidence.json';

const panel = { border: '1px solid #ccd9e6', borderRadius: 10, padding: 14, background: '#fff' };
const cell = { padding: 9, borderBottom: '1px solid #d8e2eb', textAlign: 'left' as const, verticalAlign: 'top' };
const labels: Record<string,string> = {
  NT40: 'Conceito Enade Medicina — NT40/2025', NT19: 'Método Angoff — NT19/2025',
  NT1PL: 'Justificativa do modelo Rasch — NT1PL/2025', NT42: 'Notas individuais da edição 2025 — NT42/2025',
  MANUAL: 'Manual Enamed para participantes e IES', EDITAL71: 'Edital71/2026 republicado',
};

export function EnamedVerifiedSources() {
  return <section aria-label="Documentos ENAMED verificados">
    <h4>Documentos recuperados e rastreabilidade</h4>
    <p>Fotografia documental de 17/11/2026: oito PDFs de provas/gabaritos preliminares e cinco documentos normativos com integridade verificada. O hash identifica o arquivo; não substitui revisão clínica, validação de vigência ou gabarito definitivo.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 10 }}>
      {evidence.documents.map(doc => <article key={doc.id} style={panel}>
        <strong>{labels[doc.id] || doc.id}</strong>
        <p>{doc.verified ? 'Arquivo recuperado · SHA-256 conferido' : 'Recuperação pendente · falha de conexão'}{doc.pages ? ` · ${doc.pages} páginas` : ''}</p>
        <a href={doc.url} target="_blank" rel="noopener noreferrer">Consultar documento oficial ↗</a>
        {doc.sha256 ? <details><summary>Identificação do arquivo</summary><code style={{ overflowWrap: 'anywhere', fontSize: 11 }}>{doc.sha256}</code></details> : null}
        {doc.id.includes('GAB') ? <p><strong>Gabarito preliminar.</strong> Não é versão definitiva.</p> : null}
      </article>)}
    </div>
    <p>Versões de cálculo: a NT42 descreve a edição 2025. Suas constantes não devem ser aplicadas automaticamente a 2026. As 15 competências de referência e as 12 entradas da matriz teórica têm enumerações próprias.</p>
  </section>;
}

export default function EnamedEditorialEvidence() {
  const [view, setView] = useState<'differences'|'candidates'>('differences');
  const [query, setQuery] = useState('');
  const [numericOnly, setNumericOnly] = useState(false);
  const differences = useMemo(() => evidence.differences.filter(row =>
    (!numericOnly || row.numericDifference) && `${row.id} ${row.booklet}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [query,numericOnly]);
  return <section aria-label="Curadoria e incorporações ENAMED">
    <h4>Acervo, correções e incorporações</h4>
    <p>Fotografia de 17/11/2026. São registros e propostas documentais, sem consulta em tempo real ou alteração no banco de questões.</p>
    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
      {[
        ['Registros comparados', evidence.totalRecords], ['Equivalentes em tokens', evidence.tokenEquivalent],
        ['Registros com diferenças', evidence.differences.length], ['Posições candidatas da reaplicação', evidence.candidates.length],
        ['Ocorrências de imagens', evidence.mediaOccurrences],
      ].map(([label,value]) => <div key={label} style={panel}><dt style={{ fontSize: 12 }}>{label}</dt><dd style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{value}</dd></div>)}
    </dl>
    <p>Equivalência do texto extraído não é homologação médica. Diferenças podem decorrer de extração, tabelas, unidades ou conteúdo. Imagens têm vínculos preparados e ainda exigem conferência visual e direitos de uso.</p>
    <div role="group" aria-label="Fila editorial" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" aria-pressed={view==='differences'} onClick={()=>setView('differences')}>Diferenças para revisão ({evidence.differences.length})</button>
      <button type="button" aria-pressed={view==='candidates'} onClick={()=>setView('candidates')}>Incorporações pendentes ({evidence.candidates.length})</button>
    </div>
    {view==='differences' ? <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '14px 0' }}>
        <label>Buscar ID ou caderno <input aria-label="Buscar ID ou caderno" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: c2-q12" style={{ padding: 8, maxWidth: '100%' }}/></label>
        <label><input type="checkbox" checked={numericOnly} onChange={e=>setNumericOnly(e.target.checked)}/> Somente diferenças numéricas no enunciado</label>
      </div>
      <p role="status">{differences.length} registros na seleção.</p>
      <div role="region" aria-label="Tabela de diferenças" tabIndex={0} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <caption>Diferenças por ID — decisão clínica pendente</caption>
          <thead><tr>{['ID e origem','Diferença observada','Mídia','Documento'].map(t=><th key={t} scope="col" style={cell}>{t}</th>)}</tr></thead>
          <tbody>{differences.map(row=><tr key={row.id}>
            <th scope="row" style={cell}>{row.id}<br/>{row.booklet} · questão {row.number}</th>
            <td style={cell}>{row.stemDifferences} trechos do enunciado; {row.optionsWithDifferences} alternativas{row.numericDifference ? ' · sequência numérica diferente' : ''}</td>
            <td style={cell}>{row.mediaCandidates ? `${row.mediaCandidates} ocorrência(s) a conferir` : 'Sem imagem rasterizada associada nesta extração'}</td>
            <td style={cell}><a href={`${row.sourceUrl}#page=${row.page}`} target="_blank" rel="noopener noreferrer">PDF · página {row.page}</a></td>
          </tr>)}</tbody>
        </table>
      </div>
    </> : <>
      <p>Estas 17 posições não estavam no acervo auditado na fotografia consultada. C1 e C2 apresentam as mesmas questões em outra ordem; as referências C2 não representam 100 novos casos. Nenhuma destas propostas foi importada.</p>
      <div role="region" aria-label="Tabela de incorporações" tabIndex={0} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <caption>Reaplicação 2026 — candidatas à incorporação</caption>
          <thead><tr>{['Caderno1','Correspondência Caderno2','Mídia','Situação'].map(t=><th key={t} scope="col" style={cell}>{t}</th>)}</tr></thead>
          <tbody>{evidence.candidates.map(row=><tr key={row.number}>
            <th scope="row" style={cell}><a href={`${row.sourceUrl}#page=${row.pageC1}`} target="_blank" rel="noopener noreferrer">Questão {row.number} · página {row.pageC1}</a></th>
            <td style={cell}>Questão {row.equivalentC2} · página {row.pageC2}</td>
            <td style={cell}>{row.mediaCandidates ? 'Imagem a conferir' : 'Conferir texto e eventuais tabelas'}</td>
            <td style={cell}>{row.status} · não importada</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
    <p style={{ ...panel, marginTop: 14 }}><strong>Publicação bloqueada.</strong> {evidence.approvedReleaseGates} de {evidence.totalReleaseGates} condições aprovadas na fotografia documental. Dependências: gabaritos definitivos, revisão visual/documental, duas IAs e parecer médico, acesso autenticado por perfil, integração remota e aceite final. Não há aprovação ou aplicação automática nesta tela.</p>
  </section>;
}
