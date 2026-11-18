// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import EnadeOperations from "./EnadeOperations";
import { blank, type Entry } from "./model";
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("./api", () => ({ loadOperations: api.load, saveOperation: api.save }));
let host: HTMLDivElement, root: Root;
const props = {
  institutions: [
    { id: "ia", name: "IES A" },
    { id: "ib", name: "IES B" },
  ],
  courses: [
    { id: "ca", name: "Direito A", institution_id: "ia" },
    { id: "cb", name: "Direito B", institution_id: "ib" },
  ],
};
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  api.load
    .mockReset()
    .mockResolvedValue({
      entries: [],
      current: [],
      next_before: null,
      fetched_at: "2026-11-17T20:00:00Z",
    });
  api.save.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function render() {
  await act(async () => root.render(<EnadeOperations {...props} />));
}
async function click(label: string) {
  const b = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  )!;
  await act(async () => b.click());
}
async function value(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  v: string,
) {
  await act(async () => {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
it("não transforma ausência de registro em conclusão", async () => {
  await render();
  expect(host.querySelectorAll(".eop-front")).toHaveLength(17);
  expect(host.textContent).toContain("não confirmado");
  expect(api.save).not.toHaveBeenCalled();
});
it("falha de MFA não exibe estado como carregado e não permite gravar", async () => {
  api.load.mockRejectedValue(new Error("Master com MFA obrigatório"));
  await render();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("MFA");
  expect(host.querySelector(".eop-front")).toBeNull();
  expect(api.save).not.toHaveBeenCalled();
});
it("filtro institucional limpa curso e não mistura instituições", async () => {
  await render();
  const selects = host.querySelectorAll<HTMLSelectElement>(".eop-scope select");
  await value(selects[0], "ia");
  expect(selects[1].textContent).toContain("Direito A");
  expect(selects[1].textContent).not.toContain("Direito B");
  await value(selects[1], "ca");
  await value(selects[0], "ib");
  expect(selects[1].value).toBe("");
  expect(api.load).toHaveBeenLastCalledWith({
    institution_id: "ib",
    course_id: null,
    environment: "Homologação",
  });
});
it("trocar versão reinicia testes e checklists", async () => {
  const p = blank();
  p.version = "v1";
  p.tests[0] = {
    ...p.tests[0],
    executed: true,
    validated: true,
    evidence: "https://example.org",
    result: "passou",
    outcome: "passou" as const,
  };
  const entry = {
    id: "e",
    seq: 1,
    front: "core",
    kind: "revision",
    payload: p,
    environment: "Homologação",
    institution_id: null,
    course_id: null,
    created_at: "2026-11-17T20:00:00Z",
  } as Entry;
  api.load.mockResolvedValue({
    entries: [entry],
    current: [entry],
    next_before: null,
    fetched_at: "2026-11-17T20:00:00Z",
  });
  await render();
  await click("Examinar frente");
  await click("Registrar validação");
  expect(
    host.querySelector<HTMLInputElement>(".eop-test-edit input[type=checkbox]")
      ?.checked,
  ).toBe(true);
  await value(
    host.querySelector<HTMLInputElement>("input[name=version]")!,
    "v2",
  );
  expect(
    host.querySelector<HTMLInputElement>(".eop-test-edit input[type=checkbox]")
      ?.checked,
  ).toBe(false);
});
it("registro de aprovação não executa operação externa e exige aceite", async () => {
  await render();
  await click("Examinar frente");
  await click("Registrar aprovação explícita");
  await act(async () =>
    host
      .querySelector("dialog form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(host.querySelector("dialog [role=alert]")?.textContent).toContain(
    "confirmação explícita",
  );
  expect(api.save).not.toHaveBeenCalled();
});
it("referências documentais permanecem acessíveis sem simular banco conectado", async () => {
  api.load.mockRejectedValue(new Error("migração pendente"));
  await render();
  await click("Antes e agora");
  expect(host.textContent).toContain("Referências documentais consultadas");
  expect(host.textContent).toContain("Registros operacionais indisponíveis");
  expect(api.save).not.toHaveBeenCalled();
});
