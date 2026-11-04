// Defense in depth when the blocking HTML scrubber is missing or did not run.
// Reject only unconsumed IES input. Never turn it into an accepted invitation.
// This module must execute before createClient and any callback/analytics parser.
export function rejectUnconsumedIesFragment(
  target: Pick<Window, "location" | "history"> | undefined,
): boolean {
  if (!target) return false;
  const fragment = new URLSearchParams(target.location.hash.slice(1));
  const query = new URLSearchParams(target.location.search);
  if (
    ![fragment, query].some(
      (p) => p.has("ies_invitation") || p.has("ies_token"),
    )
  )
    return false;
  for (const key of [
    "ies_invitation",
    "ies_token",
    "master_invitation",
    "master_token",
    "academic_invitation",
    "academic_token",
    "access_token",
    "refresh_token",
    "code",
    "token_hash",
  ])
    query.delete(key);
  const search = query.toString();
  target.history.replaceState(
    null,
    "",
    target.location.pathname + (search ? "?" + search : "") + "#ies=1",
  );
  return true;
}
export const iesBootstrapRejected = rejectUnconsumedIesFragment(
  typeof window === "undefined" ? undefined : window,
);
