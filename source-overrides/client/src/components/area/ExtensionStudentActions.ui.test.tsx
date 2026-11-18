// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import ExtensionStudentActions, {
  studentLifecycleActions,
  type StudentLifecycleRow,
} from "./ExtensionStudentActions";
let host: HTMLDivElement, root: Root;
const changed = vi.fn();
const student: StudentLifecycleRow = {
  id: "aluno-sintetico",
  project_id: "projeto-sintetico",
  full_name: "Aluno fictício",
  status: "ativo",
  lifecycle_version: 3,
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  changed.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
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
});
async function render(row = student) {
  await act(async () =>
    root.render(
      createElement(ExtensionStudentActions, {
        student: row,
        projectTitle: "Projeto A fictício",
        onChanged: changed,
      }),
    ),
  );
}
async function click(name: string) {
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === name,
  )!;
  await act(async () => b.click());
}
async function reason(v: string) {
  const el = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("separa desativação, retirada, exclusão e recuperação", () => {
  expect(studentLifecycleActions(student)).toEqual([
    "desativar",
    "retirar",
    "excluir",
  ]);
  expect(studentLifecycleActions({ ...student, status: "inativo" })).toContain(
    "reativar",
  );
  expect(
    studentLifecycleActions({ ...student, removed_at: "2026-11-18" }),
  ).toEqual(["reintegrar", "excluir"]);
  expect(
    studentLifecycleActions({ ...student, deleted_at: "2026-11-18" }),
  ).toEqual(["restaurar"]);
});
it("abrir e cancelar a exclusão não altera cadastro", async () => {
  await render();
  await click("Excluir cadastro");
  expect(host.querySelector("dialog")?.textContent).toContain("lixeira");
  expect(host.querySelector("dialog")?.textContent).toContain(
    "Outros projetos",
  );
  await click("Cancelar");
  expect(rpc).not.toHaveBeenCalled();
});
it("exige motivo e confirmação antes de chamar a RPC", async () => {
  await render();
  await click("Desativar aluno");
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(rpc).not.toHaveBeenCalled();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("motivo");
});
it("envia somente o aluno, projeto, ação, versão esperada e motivo confirmados", async () => {
  await render();
  await click("Retirar do projeto");
  await reason("Pedido de retirada para teste fictício");
  await click("Confirmar retirar do projeto");
  expect(rpc).toHaveBeenCalledWith("vertice_extension_student_lifecycle", {
    p_student: student.id,
    p_project: student.project_id,
    p_action: "retirar",
    p_expected_version: 3,
    p_reason: "Pedido de retirada para teste fictício",
  });
  expect(changed).toHaveBeenCalledOnce();
});
it("recusa de autorização mantém o formulário e não anuncia sucesso", async () => {
  rpc.mockResolvedValue({ error: { message: "Gestão não autorizada" } });
  await render();
  await click("Excluir cadastro");
  await reason("Teste de autorização negada");
  await click("Confirmar excluir cadastro");
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "não autorizada",
  );
  expect(changed).not.toHaveBeenCalled();
  expect(host.querySelector("dialog")?.hasAttribute("open")).toBe(true);
});
it("restauração informa que retorna inativo e não reativa convites", async () => {
  await render({ ...student, deleted_at: "2026-11-18" });
  await click("Restaurar cadastro");
  expect(host.querySelector("dialog")?.textContent).toContain("como inativo");
  expect(host.querySelector("dialog")?.textContent).toContain(
    "Convites revogados não serão reativados",
  );
});
