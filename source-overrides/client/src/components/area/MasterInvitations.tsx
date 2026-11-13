import { ContextHelp } from '@/components/ContextHelp';
import { HelpLabel } from '@/components/ContextHelp';
import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { canonicalMasterEmail } from '@/lib/master-invitation-token';
import { createMasterRequestGuard, issueMasterInvitation, listMasters, listMasterInvitations, revokeMasterInvitation, type IssuedMasterInvitation, type MasterCursor, type MasterInvitation, type MasterProfile } from '@/lib/master-invitations';

const displayDate = (value: string) => new Date(value).toLocaleString('pt-BR');
export default function MasterInvitations({ userId, isMaster, backendReady = false }: { userId: string; isMaster: boolean; backendReady?: boolean }) {
  const guard = useRef(createMasterRequestGuard());
  const listGeneration = useRef(0);
  const [masters, setMasters] = useState<MasterProfile[]>([]);
  const [invitations, setInvitations] = useState<MasterInvitation[]>([]);
  const [masterNext, setMasterNext] = useState<MasterCursor | null>(null);
  const [inviteNext, setInviteNext] = useState<MasterCursor | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false), [email, setEmail] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [created, setCreated] = useState<IssuedMasterInvitation | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [uncertain, setUncertain] = useState(false);
  const available = backendReady && isMaster;
  const canAct = available && state === 'ready' && !busy && !uncertain;

  async function load(kind: 'all' | 'masters' | 'invitations' = 'all') {
    const generation = ++listGeneration.current;
    setState('loading');
    try {
      const [profilePage, invitePage] = await Promise.all([
        kind !== 'invitations' ? listMasters(available, kind === 'masters' ? masterNext : null) : Promise.resolve(null),
        kind !== 'masters' ? listMasterInvitations(available, kind === 'invitations' ? inviteNext : null) : Promise.resolve(null),
      ]);
      if (generation !== listGeneration.current) return;
      if (profilePage) { setMasters(previous => kind === 'masters' ? [...previous, ...profilePage.rows.filter(r => !previous.some(p => p.userId === r.userId))] : profilePage.rows); setMasterNext(profilePage.next); }
      if (invitePage) { setInvitations(previous => kind === 'invitations' ? [...previous, ...invitePage.rows.filter(r => !previous.some(p => p.id === r.id))] : invitePage.rows); setInviteNext(invitePage.next); }
      setState('ready');
      // Only an explicit full refresh resolves an uncertain outcome for the operator.
      if (kind === 'all') setUncertain(false);
    } catch {
      if (generation !== listGeneration.current) return;
      setMasters([]); setInvitations([]); setMasterNext(null); setInviteNext(null); setState('error');
    }
  }
  useEffect(() => {
    guard.current.invalidate(); setBusy(false); setEmail(''); setConfirmed(false); setCreated(null); setError(''); setNotice(''); setUncertain(false);
    setMasters([]); setInvitations([]); setMasterNext(null); setInviteNext(null);
    if (available) void load(); else setState('error');
    return () => { guard.current.invalidate(); listGeneration.current++; };
  }, [userId, isMaster, backendReady]);

  async function issue(event: FormEvent) {
    event.preventDefault();
    if (!canAct || !confirmed || !canonicalMasterEmail(email)) return;
    const generation = guard.current.begin(); if (generation === null) return;
    setBusy(true); setError(''); setNotice(''); setCreated(null);
    try {
      const result = await issueMasterInvitation(available, email, { userId, isCurrent: () => guard.current.current(generation) });
      if (!guard.current.current(generation)) return;
      setCreated(result); setEmail(''); setConfirmed(false);
      setNotice('Convite criado. O acesso só será concedido após o aceite. Nenhuma mensagem foi enviada.');
      await load();
    } catch {
      if (guard.current.current(generation)) {
        setUncertain(true); setConfirmed(false);
        setError('Emissão não confirmada. Não tente novamente sem atualizar e conferir a lista. Se um convite aparecer, revogue-o antes de emitir outro. Nenhum link será exibido sem confirmação do servidor.');
      }
    } finally { if (guard.current.current(generation)) setBusy(false); guard.current.finish(generation); }
  }
  async function revoke(invitation: MasterInvitation) {
    if (!canAct || !window.confirm(`Revogar o convite de Master para ${invitation.email}? Um convite ainda não aceito deixará de conceder acesso.`)) return;
    const generation = guard.current.begin(); if (generation === null) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await revokeMasterInvitation(available, invitation.id, { userId, isCurrent: () => guard.current.current(generation) });
      if (!guard.current.current(generation)) return;
      if (created?.id === invitation.id) setCreated(null);
      setNotice('Revogação confirmada.'); await load();
    } catch {
      if (guard.current.current(generation)) { setUncertain(true); setCreated(null); setError('Revogação não confirmada. Atualize e confira a situação antes de repetir.'); }
    } finally { if (guard.current.current(generation)) setBusy(false); guard.current.finish(generation); }
  }

  if (!isMaster) return <section className="area-card"><h2>Masters</h2><p>Acesso reservado aos Masters autenticados com segundo fator.</p></section>;
  return <section className="area-card" aria-labelledby="masters-title">
    <h2 id="masters-title">Masters da Vértice</h2>
    <p>Master é um administrador global: acessa todas as instituições e pode convidar outros Masters. Confira o destinatário antes de autorizar.</p>
    {!available && <p role="status">Funcionalidade em preparação. A emissão permanece desabilitada até a liberação segura do serviço.</p>}
    <h3>Convidar novo Master</h3>
    <p>O destinatário precisa de uma conta Vértice ativada pela administração, com e-mail confirmado e segundo fator. Este convite não cria conta nem senha.</p>
    <form onSubmit={issue}>
      <fieldset disabled={!canAct} style={{ display: 'grid', gap: 12, border: 0, padding: 0 }}>
        <HelpLabel>E-mail da conta Vértice<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={event => { setEmail(event.target.value); setConfirmed(false); }} /></HelpLabel>
        <HelpLabel><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Conferi {canonicalMasterEmail(email) || 'o e-mail'} e autorizo o convite com acesso global de Master.</HelpLabel>
        <button className="corp-button" type="submit" disabled={!confirmed || !canonicalMasterEmail(email)}>Criar convite de Master</button>
      </fieldset>
    </form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {created && <div style={{ marginTop: 16, overflowWrap: 'anywhere' }}>
      <p>Destinatário: <strong>{created.email}</strong>. Válido até {displayDate(created.expiresAt)}.</p>
      <p>Compartilhe este link confidencial somente com a pessoa indicada. O link não é salvo no navegador nem enviado automaticamente.</p>
      <HelpLabel>Link do convite<textarea rows={4} readOnly spellCheck={false} autoComplete="off" value={created.link} style={{ width: '100%' }} /></HelpLabel>
      <button type="button" onClick={() => { setCreated(null); setNotice('Link ocultado. O convite continua válido até ser aceito, revogado ou expirar.'); }}>Ocultar link</button>
    </div>}
    <div className="area-list-head"><h3>Masters cadastrados</h3><button type="button" disabled={!available || busy || state === 'loading'} onClick={() => { setCreated(null); void load(); }}>Atualizar listas</button></div>
    {available && state === 'loading' && <p role="status">Consultando o acesso e as listas…</p>}
    {available && state === 'error' && <p role="alert">Não foi possível carregar as listas. Isso não significa que estejam vazias. As ações ficam bloqueadas até uma consulta bem-sucedida.</p>}
    {state === 'ready' && <>
      {!masters.length ? <p>Nenhum registro retornado pelo serviço.</p> : <div className="table-scroll"><table><thead><tr><th>E-mail<ContextHelp title="E-mail" /></th><th>Master desde</th></tr></thead><tbody>{masters.map(profile => <tr key={profile.userId}><td>{profile.email}{profile.userId === userId ? ' (você)' : ''}</td><td>{displayDate(profile.createdAt)}</td></tr>)}</tbody></table></div>}
      {masterNext && <button disabled={busy} onClick={() => void load('masters')}>Carregar mais Masters</button>}
      <h3>Convites de Master</h3>
      {!invitations.length ? <p>Nenhum convite encontrado.</p> : <div className="table-scroll"><table><thead><tr><th>Destinatário</th><th>Validade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{invitations.map(invitation => <tr key={invitation.id}>
        <td>{invitation.email}</td><td>{displayDate(invitation.expiresAt)}</td><td>{invitation.acceptedAt ? 'Aceito' : invitation.revokedAt ? 'Revogado' : Date.parse(invitation.expiresAt) <= Date.now() ? 'Expirado' : 'Aguardando aceite'}</td>
        <td>{!invitation.acceptedAt && !invitation.revokedAt && <button type="button" disabled={!canAct} onClick={() => void revoke(invitation)}>Revogar convite</button>}</td>
      </tr>)}</tbody></table></div>}
      {inviteNext && <button disabled={busy} onClick={() => void load('invitations')}>Carregar mais convites</button>}
    </>}
    <p><small>O cadastro existente não muda ao emitir um convite. O aceite exige o e-mail confirmado do destinatário e MFA. A lista não permite recuperar links antigos nem remover Masters.</small></p>
  </section>;
}
