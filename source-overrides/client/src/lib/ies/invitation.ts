export type SecretInvitation = Readonly<{ id: string; token: string }>;
declare global {
  interface Window {
    __verticeIesInvitation?: {
      peek(): SecretInvitation | null;
      invalid(): boolean;
      bind(id: string | null): void;
      clear(): void;
    };
  }
}
export function invitationVault() {
  return typeof window === "undefined"
    ? undefined
    : window.__verticeIesInvitation;
}
export async function generateInvitationSecret(
  cryptoApi: Crypto = globalThis.crypto,
) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  bytes.fill(0);
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return {
    token,
    hash: Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
export function invitationLink(origin: string, id: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/.test(token))
    throw new Error("invalid_invitation");
  const url = new URL("/master", origin);
  url.hash = new URLSearchParams({
    ies_invitation: id,
    ies_token: token,
  }).toString();
  return url.toString();
}
