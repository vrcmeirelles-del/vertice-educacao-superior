import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isFamilyToken } from '@/lib/family-share';

interface View { institution_name?: string; student_name: string; summary: string; period?: string; effective_from?: string; effective_until?: string; next_review_date?: string; accommodations: { category: string; description: string }[]; expires_at: string }
const fmt = (d?: string) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : null;

export default function Family() {
  const [state, setState] = useState<'loading' | 'invalid' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<View | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!isFamilyToken(token)) { setState('invalid'); return; }
    let live = true;
    supabase.rpc('vertice_family_plan_view', { p_token: token }).then(({ data: d, error }) => {
      if (!live) return;
      if (error) { setState('error'); return; }
      if (!d) { setState('invalid'); return; }
      setData(d as View); setState('ready');
    });
    return () => { live = false; };
  }, []);
  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', lineHeight: 1.6 }}>
      <meta name="robots" content="noindex,nofollow" />
      {state === 'loading' && <p>Carregando…</p>}
      {state === 'invalid' && <><h1>Link indisponível</h1><p>Este link não existe, expirou ou foi cancelado. Peça um novo link à escola.</p></>}
      {state === 'error' && <><h1>Não foi possível carregar</h1><p>Tente novamente em instantes.</p></>}
      {state === 'ready' && data && (
        <>
          <p>{data.institution_name}</p>
          <h1>Apoio educacional de {data.student_name}</h1>
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.summary}</p>
          {(data.period || data.effective_from) && <p>{data.period ? `Período: ${data.period}. ` : ''}{data.effective_from ? `Vigência: ${fmt(data.effective_from)}${data.effective_until ? ' a ' + fmt(data.effective_until) : ''}. ` : ''}{data.next_review_date ? `Próxima revisão: ${fmt(data.next_review_date)}.` : ''}</p>}
          {data.accommodations.length > 0 && <><h2>Adaptações previstas</h2><ul>{data.accommodations.map((a, i) => <li key={i}><strong>{a.category.replaceAll('_', ' ')}:</strong> {a.description}</li>)}</ul></>}
          <p style={{ fontSize: 12, color: '#555' }}>Este link vale até {fmt(data.expires_at)}. Não compartilhe com terceiros.</p>
        </>
      )}
    </main>
  );
}
