import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LIBRARY_DIMENSIONS, filterLibrary, type LibraryDocument } from '@/lib/inep-library';
import structure from '@/lib/inep-library-structure.json';
import './inep-library.css';

export default function InepLibrary({ institutionId }: { institutionId: string }) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [dimension, setDimension] = useState('');
  const [indicator, setIndicator] = useState(''), [format, setFormat] = useState('');
  const [references, setReferences] = useState(false), [downloading, setDownloading] = useState('');
  useEffect(() => {
    let current = true;
    setDocuments([]); setError(''); setLoading(true);
    supabase.from('vertice_inep_library')
      .select('id,institution_id,library_key,version,code,dimension,indicator,file_name,title,original_path,format,size_bytes,is_placeholder')
      .eq('institution_id', institutionId).eq('active', true).order('original_path')
      .then(({ data, error: failure }) => {
        if (!current) return;
        if (failure) setError('Não foi possível carregar a biblioteca. Tente atualizar a página.');
        else setDocuments((data ?? []) as LibraryDocument[]);
        setLoading(false);
      });
    return () => { current = false; };
  }, [institutionId]);
  const results = useMemo(() => filterLibrary(documents, { query, dimension, indicator, format, references }),
    [documents, query, dimension, indicator, format, references]);
  async function download(doc: LibraryDocument) {
    setDownloading(doc.id); setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke('vertice-inep-library', {
        body: { institutionId, id: doc.id },
      });
      if (failure || !data?.url) throw new Error('download');
      const signed = new URL(data.url);
      if (signed.origin !== 'https://qvetbbmviatxxatzzuzc.supabase.co' || signed.protocol !== 'https:') throw new Error('origin');
      const response = await fetch(signed.toString(), { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('arquivo');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = doc.file_name; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Não foi possível baixar o documento. Confira sua sessão e tente novamente.'); }
    finally { setDownloading(''); }
  }
  return <section className="inep-library" aria-labelledby="inep-library-title">
    <header><div><p className="inep-library-kicker">Base documental da instituição</p>
      <h3 id="inep-library-title">Biblioteca Institucional INEP</h3>
      <p>Modelos e referências para todas as coordenações, organizados nos 58 indicadores.</p></div>
      <span className="inep-library-count">{documents.length} arquivos</span></header>
    <p className="inep-library-guidance">Baixe, revise e adapte o documento ao seu curso. Depois, envie a versão preenchida no Repositório. Consultar a biblioteca não atende uma pendência. Os arquivos REF indicam evidências a preparar.</p>
    <div className="inep-library-filters">
      <label>Buscar documento<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Código INEP, nome ou palavra-chave" /></label>
      <label>Dimensão<select value={dimension} onChange={e => { setDimension(e.target.value); setIndicator(''); }}><option value="">Todas</option>{LIBRARY_DIMENSIONS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>Indicador<select value={indicator} onChange={e => setIndicator(e.target.value)}><option value="">Todos</option>{structure.indicadores.filter(i => !dimension || i.dimensao === dimension).map(i => <option key={i.codigo} value={i.codigo}>{i.codigo} · {i.nome}</option>)}</select></label>
      <label>Formato<select value={format} onChange={e => setFormat(e.target.value)}><option value="">Todos</option>{['docx', 'pdf', 'xlsx'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}</select></label>
      <label className="inep-library-checkbox"><input type="checkbox" checked={references} onChange={e => setReferences(e.target.checked)} />Somente referências a preencher</label>
    </div>
    {error && <p role="alert" className="area-error">{error}</p>}
    {loading ? <p role="status">Carregando a biblioteca…</p> : !documents.length ? <p>Não há documentos da biblioteca disponibilizados para esta instituição.</p> : <>
      <p aria-live="polite">{results.length} arquivo(s) encontrado(s)</p>
      <div className="inep-library-results">{results.map(doc => <article key={doc.id}>
        <div><p className="inep-library-code">{doc.code || `REF · ${doc.indicator}`}</p><h4>{doc.file_name}</h4>
          <p>{LIBRARY_DIMENSIONS.find(([k]) => k === String(doc.dimension))?.[1]} · Indicador {doc.indicator} · {doc.format.toUpperCase()} · {(doc.size_bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB</p>
          <span className={`inep-library-badge ${doc.is_placeholder ? 'reference' : ''}`}>{doc.is_placeholder ? 'Referência a preencher' : 'Revisar e adaptar ao curso'}</span></div>
        <button className="corp-button small" disabled={Boolean(downloading)} onClick={() => download(doc)} aria-label={`Baixar ${doc.file_name}`}>{downloading === doc.id ? 'Preparando…' : 'Baixar documento'}</button>
      </article>)}</div>{!results.length && <p>Nenhum documento corresponde aos filtros.</p>}
    </>}
  </section>;
}
