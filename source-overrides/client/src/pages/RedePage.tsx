import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cell, totals, needsAttention, NETWORK_NUMERIC_KEYS, type NetworkRow } from '@/lib/network-indicators';

interface Net { id: string; name: string; kind: string }
const headers: Record<string, string> = {
  casos_ativos: 'Casos ativos', planos_ativos: 'PEI ativos', planos_aguardando_validacao: 'PEI aguardando validação',
  alertas_alta: 'Alertas altos', alertas_media: 'Alertas médios', alertas_baixa: 'Alertas baixos', acolhimento_atrasado: 'Acolhimento atrasado',
};

export default function RedePage() {
  const [state, setState] = useState<'checking' | 'denied' | 'ready'>('checking');
  const [nets, setNets] = useState<Net[]>([]);
  const [netId, setNetId] = useState('');
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await supabase.auth.getUser();
        if (u.error || !u.data.user) throw new Error();
        const a = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (a.error || a.data?.currentLevel !== 'aal2') throw new Error();
        const r = await supabase.rpc('vertice_my_networks');
        if (r.error || !r.data?.length) throw new Error();
        if (!active) return;
        setNets(r.data as Net[]); setNetId((r.data as Net[])[0].id); setState('ready');
      } catch { if (active) setState('denied'); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state !== 'ready' || !netId) return;
    let active = true;
    setError(''); setRows([]);
    supabase.rpc('vertice_network_indicators', { p_network: netId }).then(r => {
      if (!active) return;
      if (r.error) setError('Não foi possível carregar os indicadores.'); else setRows((r.data ?? []) as NetworkRow[]);
    });
    return () => { active = false; };
  }, [state, netId]);

  if (state === 'checking') return <main style={{ padding: '50px 24px' }} role="status"><h1>Verificando acesso à rede…</h1></main>;
  if (state === 'denied') return (
    <main style={{ padding: '60px 24px', minHeight: '100vh' }}><section style={{ maxWidth: 720, margin: 'auto' }}>
      <LockKeyhole size={30} /><h1 style={{ fontSize: 28, margin: '16px 0' }}>Acesso restrito à secretaria da rede</h1>
      <p>Entre com a conta autorizada e confirme o segundo fator. Se a verificação falhar ou a conta não estiver vinculada a uma rede, nada é exibido.</p>
      <p><Link href="/entrar?destino=rede" className="corp-button">Entrar ou confirmar segundo fator</Link></p>
    </section></main>
  );
  const t = totals(rows);
  return (
    <main style={{ padding: '32px 24px', maxWidth: 1100, margin: 'auto' }}>
      <h1 style={{ fontSize: 26 }}>Rede · indicadores de inclusão</h1>
      {nets.length > 1 && (
        <label>Rede <select value={netId} onChange={e => setNetId(e.target.value)}>{nets.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
      )}
      {nets.length === 1 && <p>{nets[0].name}</p>}
      <p style={{ fontSize: 13, opacity: 0.8 }}>Somente contagens por escola. Nenhum nome de estudante, laudo ou texto de PEI é exibido nesta área. Os alertas seguem regras provisórias (pei-alerts-v1).</p>
      {error && <div role="alert">{error}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>Escola</th>{NETWORK_NUMERIC_KEYS.map(k => <th key={k} style={{ textAlign: 'right' }}>{headers[k]}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.institution_id} style={needsAttention(r) ? { background: 'rgba(220,38,38,0.08)' } : undefined}>
                <td>{r.escola}{needsAttention(r) ? ' ⚠' : ''}</td>
                {NETWORK_NUMERIC_KEYS.map(k => <td key={k} style={{ textAlign: 'right' }}>{cell(r[k])}</td>)}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ fontWeight: 600, borderTop: '2px solid currentColor' }}>
                <td>Total da rede</td>
                {NETWORK_NUMERIC_KEYS.map(k => <td key={k} style={{ textAlign: 'right' }}>{t.sums[k]}{t.suppressed[k] ? '+' : ''}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !error && <p>Nenhuma escola vinculada a esta rede.</p>}
    </main>
  );
}
