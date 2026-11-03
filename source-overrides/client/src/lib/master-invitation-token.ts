// No network or storage dependencies. Consume before Auth, analytics or routing.
export type MasterCredential = { invitation: string; rawToken: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export function masterInvitationId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
export function canonicalMasterEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const mail = value.trim().toLowerCase();
  if (mail.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(mail)) return null;
  const [local, domain] = mail.split('@'), labels = domain.split('.'), suffix = labels.at(-1)!;
  if (labels.some(label => label.length > 63) || suffix.length < 2 || /^\d+$/.test(suffix)) return null;
  return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? mail : null;
}
export function validMasterCredential(value: MasterCredential): boolean {
  return masterInvitationId(value?.invitation) && typeof value?.rawToken === 'string' && TOKEN.test(value.rawToken);
}
export function parseMasterFragment(hash: string): MasterCredential | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  // Ambiguous invitation/auth flows fail closed, rather than partially accepting a credential.
  if (p.has('academic_invitation') || p.has('academic_token') || p.has('ies_invitation') || p.has('ies_token') || p.has('access_token') || p.has('refresh_token')) return null;
  const invitation = p.get('master_invitation'), rawToken = p.get('master_token');
  if (p.getAll('master_invitation').length !== 1 || p.getAll('master_token').length !== 1 || !invitation || !rawToken) return null;
  const credential = { invitation, rawToken };
  return validMasterCredential(credential) ? credential : null;
}
export function consumeMasterFragment(location: { hash: string; pathname: string; search: string }, history: { replaceState(data: unknown, unused: string, url: string): void }): MasterCredential | null {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!p.has('master_invitation') && !p.has('master_token')) return null;
  const credential = parseMasterFragment(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  return credential;
}
export async function generateMasterSecret(cryptoApi: Crypto = globalThis.crypto): Promise<{ rawToken: string; digest: string }> {
  if (!cryptoApi?.getRandomValues || !cryptoApi?.subtle) throw new Error('Geração segura indisponível.');
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  const rawToken = btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
  return { rawToken, digest: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') };
}
export function masterInvitationLink(credential: MasterCredential): string {
  if (!validMasterCredential(credential)) throw new Error('Convite inválido.');
  return `https://www.verticesuperior.com.br/master#master_invitation=${credential.invitation}&master_token=${credential.rawToken}`;
}
