import { HelpLabel } from '@/components/ContextHelp';
import React, { useEffect, useRef, useState } from 'react';
import { getPendingMasterInvitation, clearPendingMasterInvitation } from '@/lib/master-invitation-bootstrap';
import { acceptMasterInvitation, createMasterRequestGuard, previewMasterInvitation, type MasterPreview } from '@/lib/master-invitations';

export default function MasterInvitationAcceptance({ userId, backendReady = false, onAccepted }: { userId: string; backendReady?: boolean; onAccepted: () => void }) {
  const guard = useRef(createMasterRequestGuard());
  const [credential, setCredential] = useState(getPendingMasterInvitation);
  const [preview, setPreview] = useState<MasterPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false), [uncertain, setUncertain] = useState(false);
  useEffect(() => { setPreview(null); setConfirmed(false); setBusy(false); setError(''); guard.current.invalidate(); return () => guard.current.invalidate(); }, [userId, backendReady]);
  if (!credential) return null;
  async function verify() {
    if (!backendReady || !credential || uncertain) return;
    const generation = guard.current.begin(); if (generation === null) return;
    setBusy(true); setError('');
    try { const result = await previewMasterInvitation(backendReady, credential, { userId, isCurrent: () => guard.current.current(generation) }); if (guard.current.current(generation)) { setPreview(result); setConfirmed(false); } }
    catch { if (guard.current.current(generation)) setError('Convite indisponível. Confira a conta e o segundo fator. O convite pode estar expirado, revogado ou já utilizado.'); }
    finally { if (guard.current.current(generation)) setBusy(false); guard.current.finish(generation); }
  }
  async function accept() {
    if (!backendReady || !credential || !preview || !confirmed || uncertain) return;
    const generation = guard.current.begin(); if (generation === null) return;
    setBusy(true); setError('');
    try {
      await acceptMasterInvitation(backendReady, credential, { userId, isCurrent: () => guard.current.current(generation) });
      if (!guard.current.current(generation)) return;
      clearPendingMasterInvitation(); setCredential(null); setPreview(null); onAccepted();
    } catch {
      if (guard.current.current(generation)) { setPreview(null); setConfirmed(false); setUncertain(true); setError('Aceite não confirmado. Atualize os dados do painel para conferir seu acesso antes de reabrir este convite. Não repetiremos a operação automaticamente.'); }
    } finally { if (guard.current.current(generation)) setBusy(false); guard.current.finish(generation); }
  }
  return <section className="area-card" aria-labelledby="master-accept-title">
    <h2 id="master-accept-title">Convite para Master</h2>
    <p>Este perfil concede acesso global às instituições da Vértice e permite convidar outros Masters.</p>
    <p>Use a conta Vértice do e-mail convidado. Se ainda não houver conta ativada, solicite a ativação à administração antes de aceitar.</p>
    {!backendReady && <p role="status">O aceite está desabilitado até a liberação do serviço e a confirmação do segundo fator.</p>}
    {error && <p role="alert">{error}</p>}
    {!preview && <button type="button" disabled={!backendReady || busy || uncertain} onClick={() => void verify()}>Verificar convite</button>}
    {preview && <><p>Para <strong>{preview.email}</strong>. Válido até {new Date(preview.expiresAt).toLocaleString('pt-BR')}.</p>
      <HelpLabel><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Entendi o acesso global e desejo aceitar o perfil Master nesta conta.</HelpLabel>
      <button type="button" disabled={!backendReady || busy || !confirmed || uncertain} onClick={() => void accept()}>Aceitar acesso de Master</button></>}
    <button type="button" disabled={busy} onClick={() => { guard.current.invalidate(); clearPendingMasterInvitation(); setCredential(null); setPreview(null); }}>Descartar link desta sessão</button>
    <p><small>O link foi removido da URL. Recarregar ou sair pode exigir abrir o convite novamente. Descartar o link não revoga o convite.</small></p>
  </section>;
}
