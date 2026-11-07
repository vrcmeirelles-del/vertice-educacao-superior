import { supabase } from './supabase';
import { canonicalMasterEmail, generateMasterSecret, masterInvitationId, masterInvitationLink, validMasterCredential, type MasterCredential } from './master-invitation-token';

// Release lock: environment configuration alone must not activate this UI.
// Enabling a future release requires a reviewed code change AND approved backend rollout.
// Neither gate grants server authority.
export const MASTER_INVITATIONS_RELEASE_AVAILABLE = true;
export const MASTER_INVITATIONS_ENABLED = MASTER_INVITATIONS_RELEASE_AVAILABLE && import.meta.env.VITE_MASTER_INVITATIONS_ENABLED === 'true';
export const MASTER_PAGE_SIZE = 50;
export type MasterCursor = { createdAt: string; id: string };
export type MasterProfile = { userId: string; email: string; createdAt: string };
export type MasterInvitation = { id: string; email: string; createdAt: string; expiresAt: string; revokedAt: string | null; acceptedAt: string | null };
export type MasterPreview = { id: string; email: string; expiresAt: string };
export type IssuedMasterInvitation = MasterPreview & { link: string };
export type MasterPage<T> = { rows: T[]; next: MasterCursor | null };
export type MasterActionContext = { userId: string; isCurrent: () => boolean };
const unavailable = () => new Error('Operação de Master não confirmada. Verifique a conta, o segundo fator e a disponibilidade.');
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validCursor(cursor: MasterCursor | null) { return cursor === null || (masterInvitationId(cursor.id) && date(cursor.createdAt)); }
async function actionToken(enabled: boolean, context: MasterActionContext): Promise<string> {
  if (!enabled || !context || !masterInvitationId(context.userId) || !context.isCurrent()) throw unavailable();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !context.isCurrent() || session?.user.id !== context.userId || !session.access_token) throw unavailable();
  return session.access_token;
}
function previewResult(data: any, expectedId?: string, expectedEmail?: string): MasterPreview {
  if (!data || !masterInvitationId(data.id) || (expectedId && data.id !== expectedId) || !canonicalMasterEmail(data.email) || data.email !== canonicalMasterEmail(data.email) || (expectedEmail && data.email !== expectedEmail) || !date(data.expires_at)) throw unavailable();
  return { id: data.id, email: data.email, expiresAt: data.expires_at };
}
function page<T>(rows: T[], cursor: MasterCursor | null, identity: (r: T) => string, created: (r: T) => string): MasterPage<T> {
  if (rows.length > MASTER_PAGE_SIZE || new Set(rows.map(identity)).size !== rows.length || rows.some(r => identity(r) === cursor?.id)) throw unavailable();
  const last = rows.at(-1);
  return { rows, next: rows.length === MASTER_PAGE_SIZE && last ? { id: identity(last), createdAt: created(last) } : null };
}
export async function listMasters(enabled: boolean, cursor: MasterCursor | null = null): Promise<MasterPage<MasterProfile>> {
  if (!enabled || !validCursor(cursor)) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_list_masters', { page_size: MASTER_PAGE_SIZE, before_created_at: cursor?.createdAt ?? null, before_user_id: cursor?.id ?? null });
  if (error || !Array.isArray(data)) throw unavailable();
  const rows = data.map(r => {
    if (!r || !masterInvitationId(r.user_id) || !canonicalMasterEmail(r.email) || !date(r.created_at)) throw unavailable();
    return { userId: r.user_id, email: r.email as string, createdAt: r.created_at as string };
  });
  return page(rows, cursor, r => r.userId, r => r.createdAt);
}
export async function listMasterInvitations(enabled: boolean, cursor: MasterCursor | null = null): Promise<MasterPage<MasterInvitation>> {
  if (!enabled || !validCursor(cursor)) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_list_master_invitations', { page_size: MASTER_PAGE_SIZE, before_created_at: cursor?.createdAt ?? null, before_id: cursor?.id ?? null });
  if (error || !Array.isArray(data)) throw unavailable();
  const rows = data.map(r => {
    if (!r || !masterInvitationId(r.id) || !canonicalMasterEmail(r.target_email) || !date(r.created_at) || !date(r.expires_at) || (r.revoked_at !== null && !date(r.revoked_at)) || (r.accepted_at !== null && !date(r.accepted_at))) throw unavailable();
    // Explicit projection prevents accidental retention of server-side secrets.
    return { id: r.id, email: r.target_email as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string, revokedAt: r.revoked_at as string | null, acceptedAt: r.accepted_at as string | null };
  });
  return page(rows, cursor, r => r.id, r => r.createdAt);
}
export async function issueMasterInvitation(enabled: boolean, email: string, context: MasterActionContext): Promise<IssuedMasterInvitation> {
  const mail = canonicalMasterEmail(email);
  if (!enabled || !mail) throw unavailable();
  const accessToken = await actionToken(enabled, context);
  const { rawToken, digest } = await generateMasterSecret();
  if (!context.isCurrent()) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_issue_master_invitation', { target_email: mail, token_digest: digest }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || !context.isCurrent()) throw unavailable();
  const result = previewResult(data, undefined, mail);
  return { ...result, link: masterInvitationLink({ invitation: result.id, rawToken }) };
}
export async function previewMasterInvitation(enabled: boolean, credential: MasterCredential, context: MasterActionContext): Promise<MasterPreview> {
  if (!enabled || !validMasterCredential(credential)) throw unavailable();
  const accessToken = await actionToken(enabled, context);
  if (!context.isCurrent()) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_preview_master_invitation', { invitation: credential.invitation, raw_token: credential.rawToken }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || !context.isCurrent()) throw unavailable();
  return previewResult(data, credential.invitation);
}
export async function acceptMasterInvitation(enabled: boolean, credential: MasterCredential, context: MasterActionContext): Promise<void> {
  if (!enabled || !validMasterCredential(credential)) throw unavailable();
  const accessToken = await actionToken(enabled, context);
  if (!context.isCurrent()) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_accept_master_invitation', { invitation: credential.invitation, raw_token: credential.rawToken }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || !context.isCurrent() || data?.id !== credential.invitation || data?.accepted !== true || data?.user_id !== context.userId) throw unavailable();
}
export async function revokeMasterInvitation(enabled: boolean, id: string, context: MasterActionContext): Promise<void> {
  if (!enabled || !masterInvitationId(id)) throw unavailable();
  const accessToken = await actionToken(enabled, context);
  if (!context.isCurrent()) throw unavailable();
  const { data, error } = await supabase.rpc('vertice_revoke_master_invitation', { invitation: id }).setHeader('Authorization', `Bearer ${accessToken}`);
  if (error || !context.isCurrent() || data?.id !== id || data?.revoked !== true) throw unavailable();
}

// Synchronous lock prevents double clicks; generation invalidates stale async results.
export function createMasterRequestGuard() {
  let generation = 0, locked = false;
  return {
    begin(): number | null { if (locked) return null; locked = true; return generation; },
    current(value: number) { return value === generation; },
    finish(value: number) { if (value === generation) locked = false; },
    invalidate() { generation++; locked = false; },
  };
}
