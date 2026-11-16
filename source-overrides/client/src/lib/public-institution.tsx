import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {supabase} from './supabase';

export const INSTITUTION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PublicInstitution = {name: string; logoUrl: string | null};
type Status = 'missing' | 'invalid' | 'loading' | 'ready' | 'error';
type Identity = {institutionId: string; status: Status; institution: PublicInstitution | null; retry: () => void};
const Context = createContext<Identity | null>(null);

export function publicLogoSource(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 3_000_000) return null;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  try {
    const url = new URL(value);
    return value.length <= 4096 && url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function institutionParam(): string {
  return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ies') || '';
}

export function PublicInstitutionProvider({institutionId, children}: {institutionId: string; children: ReactNode}) {
  const id = institutionId.toLowerCase();
  const initial: Status = !id ? 'missing' : INSTITUTION_UUID.test(id) ? 'loading' : 'invalid';
  const [result, setResult] = useState<{id: string; status: Status; institution: PublicInstitution | null}>({id, status: initial, institution: null});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setResult({id, status: initial, institution: null});
    if (initial !== 'loading') return;
    // Query only the active public projection, never the private institution table.
    Promise.resolve().then(() => supabase.from('vertice_institution_addresses')
      .select('display_name, logo_url').eq('institution_id', id).eq('active', true).maybeSingle())
      .then(({data, error}) => {
        if (!alive) return;
        if (error) throw error;
        const name = typeof data?.display_name === 'string' ? data.display_name.trim() : '';
        setResult({id, status: name ? 'ready' : 'invalid', institution: name ? {name, logoUrl: publicLogoSource(data?.logo_url)} : null});
      }).catch(() => { if (alive) setResult({id, status: 'error', institution: null}); });
    return () => { alive = false; };
  }, [id, initial, revision]);
  const current = result.id === id ? result : {status: initial, institution: null};
  return <Context.Provider value={{institutionId: id, status: current.status, institution: current.institution,
    retry: () => { setResult({id, status: initial, institution: null}); setRevision(n => n + 1); }}}>{children}</Context.Provider>;
}

export function usePublicInstitution() { return useContext(Context); }

export function PublicInstitutionBoundary({children}: {children: ReactNode}) {
  return usePublicInstitution() ? <>{children}</> : <PublicInstitutionProvider institutionId={institutionParam()}>{children}</PublicInstitutionProvider>;
}

export function InstitutionAccessState({audience}: {audience: 'student' | 'partner'}) {
  const identity = usePublicInstitution();
  if (identity?.status === 'loading') return <p role="status" style={{padding: 40, textAlign: 'center'}}>Consultando instituição…</p>;
  const failed = identity?.status === 'error';
  return <section style={{maxWidth: 520, margin: '3rem auto', padding: '0 1rem', textAlign: 'center'}} aria-label="Identificação institucional">
    <h2>{failed ? 'Não foi possível consultar a instituição' : 'Link de acesso incompleto'}</h2>
    <p role={failed ? 'alert' : undefined}>{failed ? 'Tente novamente em instantes. Nenhum cadastro foi enviado.' :
      `Este endereço não identifica uma instituição ativa. Use o link enviado ${audience === 'student' ? 'pela coordenação do seu curso' : 'pela instituição para cadastro de parceiros'}.`}</p>
    {failed && <button type="button" onClick={identity.retry}>Tentar novamente</button>}
  </section>;
}
