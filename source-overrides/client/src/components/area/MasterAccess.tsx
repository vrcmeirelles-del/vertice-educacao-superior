import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MASTER_INVITATIONS_ENABLED } from '@/lib/master-invitations';
import { clearPendingMasterInvitation, getPendingMasterInvitation } from '@/lib/master-invitation-bootstrap';
import MasterInvitations from './MasterInvitations';
import MasterInvitationAcceptance from './MasterInvitationAcceptance';

// Independently verify the live account. An older dashboard snapshot must not keep
// another account's directory or invitation link visible after an Auth transition.
function useMasterAccess(enabled: boolean) {
  const generation = useRef(0), lastUser = useRef<string | null>(null);
  const [access, setAccess] = useState<{ userId: string; master: boolean } | null>(null);
  const [checking, setChecking] = useState(enabled);
  useEffect(() => {
    let alive = true;
    const load = async (preserve = false) => {
      const current = ++generation.current;
      if (!preserve) { setAccess(null); setChecking(true); }
      let verified = false;
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!alive || current !== generation.current) return;
        if (error || !user) return;
        if (lastUser.current && lastUser.current !== user.id) clearPendingMasterInvitation();
        lastUser.current = user.id;
        const { data: assurance, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!alive || current !== generation.current) return;
        if (mfaError || assurance.currentLevel !== 'aal2') return;
        const { data, error: roleError } = await supabase.from('vertice_admins').select('user_id').eq('user_id', user.id);
        if (!alive || current !== generation.current) return;
        if (roleError || !Array.isArray(data)) return;
        verified = true; setAccess({ userId: user.id, master: data.some(row => row.user_id === user.id) });
      } catch { /* Fail closed without exposing server details. */ }
      finally { if (alive && current === generation.current) { if (!verified) setAccess(null); setChecking(false); } }
    };
    if (enabled) void load(); else { setAccess(null); setChecking(false); }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (enabled && session && session.user.id === lastUser.current && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        // Revalidate in the background without destroying a confirmed one-time link.
        queueMicrotask(() => { if (alive) void load(true); }); return;
      }
      generation.current++; setAccess(null);
      if (event === 'SIGNED_OUT' || !session || (lastUser.current && lastUser.current !== session.user.id)) clearPendingMasterInvitation();
      lastUser.current = session?.user.id ?? null;
      if (enabled && session) { setChecking(true); queueMicrotask(() => { if (alive) void load(); }); }
      else setChecking(false);
    });
    return () => { alive = false; generation.current++; data.subscription.unsubscribe(); };
  }, [enabled]);
  return { access, checking };
}

export function MasterDirectory() {
  const { access, checking } = useMasterAccess(MASTER_INVITATIONS_ENABLED);
  if (!MASTER_INVITATIONS_ENABLED) return <MasterInvitations userId="" isMaster backendReady={false} />;
  if (checking) return <p role="status">Verificando acesso aos Masters…</p>;
  if (!access) return <p role="alert">Não foi possível confirmar a conta e o segundo fator. Atualize o painel antes de continuar.</p>;
  return <MasterInvitations key={access.userId} userId={access.userId} isMaster={access.master} backendReady />;
}
function VerifiedMasterAcceptance({ onAccepted }: { onAccepted: () => void }) {
  const { access, checking } = useMasterAccess(MASTER_INVITATIONS_ENABLED);
  if (checking) return <p role="status">Verificando a conta para o convite de Master…</p>;
  if (!MASTER_INVITATIONS_ENABLED) return <MasterInvitationAcceptance userId="" backendReady={false} onAccepted={onAccepted} />;
  if (!access) return <p role="alert">O convite de Master exige uma conta confirmada e o segundo fator. Reabra o link após entrar.</p>;
  return <MasterInvitationAcceptance key={access.userId} userId={access.userId} backendReady onAccepted={onAccepted} />;
}
export function MasterInvitationGate({ onAccepted }: { onAccepted: () => void }) {
  if (!getPendingMasterInvitation()) return null;
  return <VerifiedMasterAcceptance onAccepted={onAccepted} />;
}
