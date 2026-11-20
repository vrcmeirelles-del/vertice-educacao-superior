export const familyValidityDays = [7, 30, 60] as const;
const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf as ArrayBuffer), b => b.toString(16).padStart(2, '0')).join('');
export function generateFamilyToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
export const isFamilyToken = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
export function familyLink(origin: string, token: string) {
  return `${origin.replace(/\/$/, '')}/familia?token=${token}`;
}
export function shareState(s: { revoked_at?: string | null; expires_at: string }, now = Date.now()): 'revogado' | 'expirado' | 'ativo' {
  if (s.revoked_at) return 'revogado';
  return Date.parse(s.expires_at) <= now ? 'expirado' : 'ativo';
}
