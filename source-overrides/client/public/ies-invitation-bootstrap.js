/* Runs synchronously before any application module, Auth SDK or telemetry.
 * Master-only/academic-only/Auth-only fragments are left for their own parsers.
 * Keep this script before those parsers when integrating their branches. */
(function () {
  "use strict";
  let invitation = null;
  let account = null;
  let invalid = false;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function capture() {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const inQuery = query.has("ies_invitation") || query.has("ies_token");
    if (!p.has("ies_invitation") && !p.has("ies_token") && !inQuery) return;
    invitation = null;
    invalid = true;
    const id = p.get("ies_invitation"),
      token = p.get("ies_token");
    const sensitive = [
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
    ];
    const queryMixed = sensitive.some((k) => query.has(k));
    const valid =
      !queryMixed &&
      p.getAll("ies_invitation").length === 1 &&
      p.getAll("ies_token").length === 1 &&
      uuid.test(id || "") &&
      /^[0-9a-f]{64}$/.test(token || "") &&
      Array.from(p.keys()).every(
        (k) => k === "ies_invitation" || k === "ies_token",
      );
    // Scrub even malformed/mixed fragments. Do not hand Auth or Master half an invitation.
    sensitive.forEach((k) => query.delete(k));
    const search = query.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (search ? "?" + search : "") + "#ies=1",
    );
    if (valid) {
      invitation = Object.freeze({ id, token });
      invalid = false;
    }
  }
  Object.defineProperty(window, "__verticeIesInvitation", {
    value: Object.freeze({
      peek: () => invitation,
      invalid: () => invalid,
      bind: (id) => {
        if (account !== null && account !== id) invitation = null;
        account = id;
      },
      clear: () => {
        invitation = null;
        invalid = false;
        account = null;
      },
    }),
    configurable: false,
    writable: false,
  });
  capture();
  window.addEventListener("hashchange", capture);
  window.addEventListener("pagehide", () => {
    invitation = null;
    account = null;
  });
})();
