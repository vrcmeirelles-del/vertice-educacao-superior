// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke } } }));
import PortalInvitations from "./PortalInvitations";
import NativeInvitationEmail from "./NativeInvitationEmail";
let host: HTMLDivElement, root: Root;
const inst = "00000000-0000-4000-8000-000000000011",
  course = "00000000-0000-4000-8000-000000000021";
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  invoke
    .mockReset()
    .mockImplementation(async (_name, { body }) => ({
      data:
        body.action === "status"
          ? { configured: true, history: [] }
          : { sent: true, delivery_confirmed: false },
      error: null,
    }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function render(role = "gestor", module = "tcc") {
  await act(async () =>
    root.render(
      createElement(PortalInvitations, {
        institutionId: inst,
        role,
        module,
        courses: [{ id: course, name: "Direito" }],
      }),
    ),
  );
}
async function click(text: string) {
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
  await act(async () => b.click());
}
async function open() {
  await click("Convites e e-mail · todos os módulos");
}
async function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function fill() {
  await change(host.querySelector("input[type=email]")!, "pessoa@example.org");
  await change(host.querySelectorAll("select")[1], course);
  await act(async () =>
    (host.querySelector("input[type=checkbox]") as HTMLInputElement).click(),
  );
}
async function submit() {
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
it("equipes sem gestão não recebem formulário nem consultam a central", async () => {
  await render("equipe");
  expect(host.textContent).toBe("");
  expect(invoke).not.toHaveBeenCalled();
});
it("usa a mesma lista de módulos, curso vinculado e alcance institucional explícito", async () => {
  await render();
  await open();
  expect(host.textContent).toContain("Estágio");
  expect(host.textContent).toContain("TCC");
  expect(host.textContent).toContain("Direito");
  expect(host.textContent).toContain("estes perfis são institucionais");
  expect(
    [...host.querySelectorAll("option")].some((o) => o.value === "gestor"),
  ).toBe(false);
});
it("sem configuração não permite enviar nem anuncia sucesso", async () => {
  invoke.mockResolvedValue({
    data: { configured: false, history: [] },
    error: null,
  });
  await render();
  await open();
  await submit();
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
  expect(host.textContent).toContain("VERTICE_RESEND_API_KEY");
  expect(invoke).toHaveBeenCalledTimes(1);
});
it("exige confirmação e envia o contexto escolhido sem alegar entrega", async () => {
  await render();
  await open();
  await submit();
  expect(invoke).toHaveBeenCalledTimes(1);
  await fill();
  await submit();
  const body = invoke.mock.calls.find((c) => c[1].body.email)?.[1].body;
  expect(body).toMatchObject({
    institution_id: inst,
    course_id: course,
    module: "tcc",
    email: "pessoa@example.org",
    role: "equipe",
  });
  expect(body.request_id).toMatch(/^[a-f0-9-]{36}$/);
  expect(host.textContent).toContain(
    "A entrega ao destinatário ainda não foi confirmada",
  );
});
it("falha bloqueia nova tentativa até conferência e não exibe sucesso", async () => {
  await render();
  await open();
  await fill();
  invoke.mockResolvedValueOnce({
    error: {
      context: new Response(JSON.stringify({ error: "Credencial recusada." })),
    },
    data: null,
  });
  await submit();
  expect(host.textContent).toContain("Credencial recusada");
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
  await submit();
  expect(invoke.mock.calls.filter((c) => c[1].body.email)).toHaveLength(1);
  expect(host.textContent).not.toContain("Aceito pelo provedor de e-mail.");
});
it("convite nativo encaminha o token existente apenas após confirmar e bloqueia repetição", async () => {
  const token = "a".repeat(64);
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await act(async () =>
    root.render(
      createElement(NativeInvitationEmail, {
        kind: "ies",
        link: `https://www.verticesuperior.com.br/master#ies_invitation=${inst}&ies_token=${token}`,
      }),
    ),
  );
  await click("Enviar este convite por e-mail");
  expect(invoke).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  await click("Enviar este convite por e-mail");
  expect(invoke).toHaveBeenCalledWith(
    "vertice-communications",
    expect.objectContaining({
      body: expect.objectContaining({
        action: "native",
        source: "ies",
        id: inst,
        token,
      }),
    }),
  );
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(host.textContent).toContain("ainda não foi confirmada");
});
