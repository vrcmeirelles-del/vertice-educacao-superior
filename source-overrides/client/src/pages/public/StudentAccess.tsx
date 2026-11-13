// /acesso-estudante?ies=<institution_id>&mod=ac|estagio[&token=<link do e-mail>]
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import StudentAccessPortal from '@/components/area/StudentAccessPortal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StudentAccess() {
  const params = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const ies = params.get('ies') ?? '';
  const mod = params.get('mod') ?? 'ac';
  const token = params.get('token');
  const purpose = mod === 'estagio' || mod === 'mandatory_internship' ? 'mandatory_internship' : 'complementary_activities';
  const [name, setName] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>(UUID.test(ies) ? 'loading' : 'invalid');

  useEffect(() => {
    if (!UUID.test(ies)) return;
    let alive = true;
    supabase.from('vertice_institution_addresses').select('display_name').eq('institution_id', ies).eq('active', true).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.display_name) { setName(data.display_name); setState('ready'); } else setState('invalid');
      }, () => { if (alive) setState('invalid'); });
    return () => { alive = false; };
  }, [ies]);

  if (state === 'loading') return <main style={{ padding: 40, textAlign: 'center' }} role="status">Carregando acesso do estudante…</main>;
  if (state === 'invalid') return (
    <main style={{ maxWidth: 480, margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.25rem' }}>Link de acesso incompleto</h1>
      <p style={{ color: 'var(--vx-muted,#64748b)' }}>Este endereço não identifica uma instituição ativa. Use o link enviado pela coordenação do seu curso.</p>
    </main>
  );
  return <StudentAccessPortal institutionId={ies} institutionName={name ?? ''} purpose={purpose} token={token} />;
}
