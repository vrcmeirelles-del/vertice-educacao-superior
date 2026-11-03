import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto, createHash } from "node:crypto";
import { IesApi, IesError, errorMessage } from "../client/src/lib/ies/api";
import {
  generateInvitationSecret,
  invitationLink,
} from "../client/src/lib/ies/invitation";
import {
  allowedRoles,
  type Context,
  roles,
} from "../client/src/lib/ies/contracts";
const id = "11111111-1111-4111-8111-111111111111",
  token = "a".repeat(64);
function boot(hash: string, search = "") {
  const events: Record<string, () => void> = {};
  const location = { hash, pathname: "/master", search };
  const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
    const u = new URL(url, "https://example.test");
    location.hash = u.hash;
    location.search = u.search;
  });
  const window = {
    location,
    history: { replaceState },
    addEventListener: (name: string, fn: () => void) => (events[name] = fn),
  } as any;
  runInNewContext(
    readFileSync("client/public/ies-invitation-bootstrap.js", "utf8"),
    { window, URLSearchParams },
  );
  return { window, vault: window.__verticeIesInvitation, events, replaceState };
}
describe("IES early parser", () => {
  it("clears the URL synchronously and keeps a valid secret only in volatile memory", () => {
    const b = boot(`#ies_invitation=${id}&ies_token=${token}`);
    expect(b.window.location.hash).toBe("#ies=1");
    expect(b.vault.peek()).toEqual({ id, token });
    expect(b.replaceState).toHaveBeenCalledOnce();
  });
  it.each([
    "master_invitation",
    "master_token",
    "academic_invitation",
    "academic_token",
    "access_token",
    "refresh_token",
    "code",
    "token_hash",
  ])("rejects mixed %s and clears all fragments", (key) => {
    const b = boot(`#ies_invitation=${id}&ies_token=${token}&${key}=secret`);
    expect(b.vault.peek()).toBeNull();
    expect(b.vault.invalid()).toBe(true);
    expect(b.window.location.hash).toBe("#ies=1");
  });
  it.each([
    `ies_invitation=${id}`,
    `ies_token=${token}`,
    `ies_invitation=wrong&ies_token=${token}`,
    `ies_invitation=${id}&ies_token=${token.toUpperCase()}`,
    `ies_invitation=${id}&ies_token=${token}&ies_token=${token}`,
    `ies_invitation=${id}&ies_invitation=${id}&ies_token=${token}`,
    `ies_invitation=${id}&ies_token=${token}&unknown=1`,
  ])("rejects malformed fragment %s", (fragment) => {
    const b = boot("#" + fragment);
    expect(b.vault.peek()).toBeNull();
    expect(b.vault.invalid()).toBe(true);
  });
  it.each([
    "master_invitation=x&master_token=y",
    "academic_invitation=x&academic_token=y",
    "access_token=x&refresh_token=y",
    "instituicao=x",
  ])("preserves unrelated parser input %s", (fragment) => {
    const b = boot("#" + fragment);
    expect(b.replaceState).not.toHaveBeenCalled();
    expect(b.window.location.hash).toBe("#" + fragment);
  });
  it("rejects query secrets and removes them without removing unrelated search", () => {
    const b = boot(
      `#ies_invitation=${id}&ies_token=${token}`,
      "?access_token=secret&next=ok",
    );
    expect(b.vault.peek()).toBeNull();
    expect(b.window.location.search).toBe("?next=ok");
  });
  it.each(["code", "token_hash"])(
    "rejects mixed Auth query %s and scrubs it before the SDK",
    (key) => {
      const b = boot(
        `#ies_invitation=${id}&ies_token=${token}`,
        `?${key}=AUTH_CODE_SENTINEL&next=ok`,
      );
      expect(b.vault.peek()).toBeNull();
      expect(b.vault.invalid()).toBe(true);
      expect(b.window.location.hash).toBe("#ies=1");
      expect(b.window.location.search).toBe("?next=ok");
    },
  );
  it.each(["code", "token_hash"])(
    "preserves Auth-only %s in query and fragment",
    (key) => {
      for (const [hash, search] of [
        [`#${key}=AUTH_ONLY&type=recovery`, ""],
        ["", `?${key}=AUTH_ONLY&type=recovery`],
      ]) {
        const b = boot(hash, search);
        expect(b.replaceState).not.toHaveBeenCalled();
        expect(b.window.location.hash).toBe(hash);
        expect(b.window.location.search).toBe(search);
        expect(rejectUnconsumedIesFragment(b.window)).toBe(false);
      }
    },
  );
  it("rejects IES query-only input", () => {
    const b = boot("", `?ies_invitation=${id}&ies_token=${token}`);
    expect(b.vault.invalid()).toBe(true);
    expect(b.window.location.search).toBe("");
  });
  it("clears on account change, logout and pagehide", () => {
    for (const action of ["change", "clear", "hide"]) {
      const b = boot(`#ies_invitation=${id}&ies_token=${token}`);
      b.vault.bind("first");
      expect(b.vault.peek()).not.toBeNull();
      if (action === "change") b.vault.bind("second");
      if (action === "clear") b.vault.clear();
      if (action === "hide") b.events.pagehide();
      expect(b.vault.peek()).toBeNull();
    }
  });
  it("captures subsequent fragment navigation before consumer listeners", () => {
    const b = boot("");
    b.window.location.hash = `#ies_invitation=${id}&ies_token=${token}`;
    b.events.hashchange();
    expect(b.vault.peek()).toEqual({ id, token });
    expect(b.window.location.hash).toBe("#ies=1");
  });
  it("HTML loads the blocking scrubber before the entry module", () => {
    const html = readFileSync("client/index.html", "utf8");
    expect(html.indexOf('src="/ies-invitation-bootstrap.js"')).toBeLessThan(
      html.indexOf('src="/src/main.tsx"'),
    );
    expect(html).toContain(
      '<script src="/ies-invitation-bootstrap.js"></script>',
    );
  });
});
describe("invitation cryptography", () => {
  it("uses 32 random bytes and hashes UTF-8 lowercase hex, not raw random bytes", async () => {
    const a = await generateInvitationSecret(webcrypto as unknown as Crypto);
    const b = await generateInvitationSecret(webcrypto as unknown as Crypto);
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(
      createHash("sha256").update(a.token, "utf8").digest("hex"),
    );
    expect(a.hash).not.toBe(
      createHash("sha256").update(Buffer.from(a.token, "hex")).digest("hex"),
    );
  });
  it("keeps credentials exclusively in the Vértice fragment", () => {
    const u = new URL(
      invitationLink("https://example.test/path?tracking=1", id, token),
    );
    expect(u.origin).toBe("https://example.test");
    expect(u.pathname).toBe("/master");
    expect(u.search).toBe("");
    expect(u.hash).toBe(`#ies_invitation=${id}&ies_token=${token}`);
  });
});
describe("RPC contracts and fail-closed lifetime", () => {
  it("surfaces disabled state and never performs fallback writes", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "feature_disabled" },
    }));
    const api = new IesApi(rpc);
    await expect(api.context()).rejects.toMatchObject({
      kind: "feature_disabled",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("vertice_ies_my_context", {});
  });
  it("rejects malformed context and unexpected document activation", async () => {
    for (const data of [
      null,
      {},
      {
        assignments: [],
        preferences: {
          optional_news_email: false,
          optional_news_whatsapp: false,
          optional_learning_email: false,
          optional_learning_whatsapp: false,
        },
        document_adapter_ready: true,
      },
    ]) {
      const api = new IesApi(async () => ({ data, error: null }));
      await expect(api.context()).rejects.toMatchObject({
        kind: "invalid_response",
      });
    }
  });
  it("sends only a hash when issuing", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ invitation_id: id, expires_at: "2026-12-01T00:00:00Z" }],
      error: null,
    }));
    const api = new IesApi(rpc);
    await api.issue(
      id,
      "personal@example.test",
      "nde",
      id,
      "membro",
      "b".repeat(64),
    );
    expect(rpc.mock.calls[0]).toEqual([
      "vertice_ies_issue_invite",
      {
        p_ies: id,
        p_email: "personal@example.test",
        p_role: "nde",
        p_course: id,
        p_capacity: "membro",
        p_token_hash: "b".repeat(64),
      },
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(token);
  });
  it("rejects repeated write clicks while a request is pending", async () => {
    let release!: (v: any) => void;
    const rpc = vi.fn(() => new Promise<any>((resolve) => (release = resolve)));
    const api = new IesApi(rpc);
    const first = api.review(id, true, 4);
    await expect(api.review(id, true, 4)).rejects.toMatchObject({
      kind: "busy",
    });
    release({ data: null, error: null });
    await first;
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("drops late results after account/view disposal and blocks later requests", async () => {
    let release!: (v: any) => void;
    const rpc = vi.fn(() => new Promise<any>((resolve) => (release = resolve)));
    const api = new IesApi(rpc);
    const pending = api.register("Universidade", "123", "");
    api.dispose();
    release({ data: id, error: null });
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    await expect(api.register("Other", "124", "")).rejects.toMatchObject({
      kind: "cancelled",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("uses keyset pagination and expected revision", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "vertice_ies_list_institutions" ? [] : null,
      error: null,
    }));
    const api = new IesApi(rpc);
    await api.institutions(id);
    await api.review(id, false, 7);
    expect(rpc.mock.calls).toEqual([
      ["vertice_ies_list_institutions", { p_after: id, p_limit: 20 }],
      [
        "vertice_ies_review_registration",
        { p_ies: id, p_approve: false, p_expected_revision: 7 },
      ],
    ]);
  });
  it("never renders raw backend errors or tokens", async () => {
    const api = new IesApi(async () => ({
      data: null,
      error: { message: token },
    }));
    let caught;
    try {
      await api.preview(token);
    } catch (e) {
      caught = e;
    }
    expect(errorMessage(caught)).not.toContain(token);
    expect(caught).toBeInstanceOf(IesError);
  });
});
describe("academic scopes", () => {
  const context: Context = {
    assignments: [],
    preferences: {
      optional_news_email: false,
      optional_news_whatsapp: false,
      optional_learning_email: false,
      optional_learning_whatsapp: false,
    },
    document_adapter_ready: false,
  };
  it("preserves global superadmin management", () =>
    expect(allowedRoles(context, id, true)).toEqual([...roles]));
  it("keeps scoped Masters from assigning other Masters", () => {
    const c = {
      ...context,
      assignments: [
        {
          id,
          institution_id: id,
          role: "master_ies" as const,
          course_id: null,
          capacity: "principal" as const,
        },
      ],
    };
    expect(allowedRoles(c, id, false)).not.toContain("master_ies");
    expect(allowedRoles(c, "other", false)).toEqual([]);
  });
  it.each(["reitor", "diretor_geral", "pro_reitor_graduacao"] as const)(
    "treats %s as equivalent high management",
    (role) => {
      const c = {
        ...context,
        assignments: [
          {
            id,
            institution_id: id,
            role,
            course_id: null,
            capacity: "adjunto" as const,
          },
        ],
      };
      expect(allowedRoles(c, id, false)).toEqual([
        "diretor_pedagogico",
        "procurador_institucional",
        "presidente_cpa",
        "coordenador",
        "nde",
      ]);
    },
  );
  it.each([
    "diretor_pedagogico",
    "procurador_institucional",
    "presidente_cpa",
    "coordenador",
    "nde",
  ] as const)("does not imply invitation administration for %s", (role) => {
    const c = {
      ...context,
      assignments: [
        {
          id,
          institution_id: id,
          role,
          course_id: null,
          capacity: "membro" as const,
        },
      ],
    };
    expect(allowedRoles(c, id, false)).toEqual([]);
  });
});

import { rejectUnconsumedIesFragment } from "../client/src/lib/ies/preAuthGuard";
describe("pre-Auth defense and global disable", () => {
  it("rejects and scrubs unconsumed mixed input before createClient without accepting it", () => {
    const location = {
      pathname: "/master",
      search: "?master_token=leaked&keep=1",
      hash: `#ies_token=${token}&ies_invitation=${id}&access_token=auth-secret&refresh_token=refresh-secret&type=recovery`,
    };
    const replaceState = vi.fn((_a: unknown, _b: string, url: string) => {
      const u = new URL(url, "https://example.test");
      location.hash = u.hash;
      location.search = u.search;
    });
    expect(
      rejectUnconsumedIesFragment({
        location,
        history: { replaceState },
      } as any),
    ).toBe(true);
    expect(location.hash).toBe("#ies=1");
    expect(location.search).toBe("?keep=1");
    const source = readFileSync("client/src/lib/supabase.ts", "utf8");
    expect(source).toContain(
      "import { iesBootstrapRejected } from './ies/preAuthGuard'",
    );
    expect(source).toContain("detectSessionInUrl: !iesBootstrapRejected");
  });
  it("does not change a Master-only or Auth-only callback", () => {
    for (const hash of [
      "#master_token=x&master_invitation=y",
      "#access_token=x&type=recovery",
    ]) {
      const replaceState = vi.fn();
      expect(
        rejectUnconsumedIesFragment({
          location: { hash, search: "" },
          history: { replaceState },
        } as any),
      ).toBe(false);
      expect(replaceState).not.toHaveBeenCalled();
    }
  });
  it("broadcasts disable from a mutation and blocks further transport calls", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "feature_disabled" },
    }));
    const api = new IesApi(rpc);
    const disabled = vi.fn();
    api.onDisabled(disabled);
    await expect(api.review(id, true, 1)).rejects.toMatchObject({
      kind: "feature_disabled",
    });
    expect(disabled).toHaveBeenCalledTimes(1);
    await expect(api.review(id, true, 1)).rejects.toMatchObject({
      kind: "feature_disabled",
    });
    await expect(api.institutions()).rejects.toMatchObject({
      kind: "feature_disabled",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("retains confirmed registration identity if subsequent detail is disabled", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "vertice_ies_register"
        ? { data: id, error: null }
        : { data: null, error: { message: "feature_disabled" } },
    );
    const api = new IesApi(rpc);
    await api.register("Universidade", "123", "");
    await expect(api.detail(id)).rejects.toMatchObject({
      kind: "feature_disabled",
    });
    expect(api.registrationReceipt).toEqual({
      id,
      revision: null,
      kind: "registered",
    });
    expect(errorMessage(new IesError("feature_disabled"))).not.toContain(
      "Nenhuma alteração foi realizada",
    );
    api.dispose();
    expect(api.registrationReceipt).toBeNull();
  });
  it("retains the confirmed reopen revision when detail fails", async () => {
    const api = new IesApi(async (name: string) =>
      name === "vertice_ies_reopen_registration"
        ? { data: 4, error: null }
        : { data: null, error: { message: "scope_unavailable" } },
    );
    await api.reopen(id, 3);
    await expect(api.detail(id)).rejects.toBeInstanceOf(IesError);
    expect(api.registrationReceipt).toEqual({
      id,
      revision: 4,
      kind: "reopened",
    });
  });
});

it("exposes the pending write synchronously to every navigation gate", async () => {
  let release!: (value: any) => void;
  const api = new IesApi(
    () =>
      new Promise<any>((resolve) => {
        release = resolve;
      }),
  );
  const pending = vi.fn();
  api.onWriting(pending);
  const request = api.register("Universidade", "123", "");
  expect(api.isWriting).toBe(true);
  expect(pending.mock.calls).toEqual([[false], [true]]);
  release({ data: id, error: null });
  await request;
  expect(api.isWriting).toBe(false);
  expect(pending.mock.calls).toEqual([[false], [true], [false]]);
});
