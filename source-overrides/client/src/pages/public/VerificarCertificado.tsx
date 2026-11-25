// Verificação pública de certificado pelo código impresso. Mostra só o que consta do certificado.
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { cargaHoraria, periodo } from '@/lib/certificate-pdf';

type Resultado = { found: false } | { found: true; status: 'emitido' | 'revogado'; kind: 'extensao' | 'ensino'; holderName: string; activityTitle: string;
  minutes: number; periodStart: string | null; periodEnd: string | null; issuedAt: string; signerName: string; signerRole: string; institution: string;
  contentSha256: string; revokedAt: string | null };
const dia = (v: string) => v.slice(0, 10).split('-').reverse().join('/');

export default function VerificarCertificado() {
  const [codigo, setCodigo] = useState(() => new URLSearchParams(window.location.search).get('codigo') ?? '');
  const [res, setRes] = useState<Resultado | null>(null), [busy, setBusy] = useState(false), [erro, setErro] = useState('');
  async function consultar(c: string) {
    const code = c.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { setRes(null); setErro('O código tem 12 caracteres em três blocos, como ABCD-EFGH-JKLM.'); return; }
    setBusy(true); setErro('');
    const r = await supabase.rpc('vertice_certificate_verify', { p_code: code });
    setBusy(false);
    if (r.error) { setRes(null); setErro('Não foi possível consultar agora. Tente novamente.'); return; }
    setRes(r.data as Resultado);
  }
  useEffect(() => { if (codigo) void consultar(codigo); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const enviar = (e: FormEvent) => { e.preventDefault(); void consultar(codigo); };
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px' }}>
      <h1>Verificação de certificado</h1>
      <p>Digite o código impresso no certificado, ou leia o QR code.</p>
      <form onSubmit={enviar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label>Código <input value={codigo} maxLength={14} onChange={(e) => setCodigo(e.target.value)} placeholder="ABCD-EFGH-JKLM" autoComplete="off" /></label>
        <button disabled={busy}>{busy ? 'Consultando…' : 'Verificar'}</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {res && !res.found && <p role="status">Nenhum certificado encontrado com este código. Confira a digitação.</p>}
      {res && res.found && <section role="status" aria-label="Resultado da verificação">
        <h2>{res.status === 'emitido' ? 'Certificado válido' : 'Certificado revogado'}</h2>
        {res.status === 'revogado' && <p>Este certificado foi revogado pela instituição{res.revokedAt ? ` em ${dia(res.revokedAt)}` : ''} e não tem validade.</p>}
        <dl>
          <dt>Participante</dt><dd>{res.holderName}</dd>
          <dt>{res.kind === 'extensao' ? 'Projeto de extensão' : 'Atividade de ensino'}</dt><dd>{res.activityTitle}</dd>
          <dt>Carga horária</dt><dd>{cargaHoraria(res.minutes)}</dd>
          {periodo(res.periodStart, res.periodEnd) && <><dt>Realização</dt><dd>{periodo(res.periodStart, res.periodEnd)}</dd></>}
          <dt>Instituição</dt><dd>{res.institution}</dd>
          <dt>Assinado por</dt><dd>{res.signerName}, {res.signerRole}</dd>
          <dt>Emitido em</dt><dd>{dia(res.issuedAt)}</dd>
          <dt>Resumo criptográfico (SHA-256)</dt><dd style={{ wordBreak: 'break-all' }}><code>{res.contentSha256}</code></dd>
        </dl>
      </section>}
    </main>
  );
}
