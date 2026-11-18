// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { webcrypto } from "node:crypto";
const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: api.rpc,
    from: api.from,
    auth: { getUser: api.getUser },
    storage: { from: () => ({ upload: api.upload, remove: api.remove }) },
  },
}));
import ExtensaoEvidencias from "./ExtensaoEvidencias";
let host: HTMLDivElement, root: Root;
let linked: string[];
const onLinked = vi.fn();
const projects = [
  { id: "p1", title: "Projeto A sintético" },
  { id: "p2", title: "Projeto B sintético" },
  { id: "p3", title: "Projeto C sintético" },
];
const evidence = {
  id: "e1",
  title: "Ata sintética",
  file_name: "ata.txt",
  file_size_bytes: 10,
  document_type: "ata",
  validation_status: "pendente",
  version: 1,
  uploaded_at: "2026-11-18T12:00:00Z",
  project_id: "p1",
  student_id: null,
};
let registry: (typeof evidence)[];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("crypto", {
    randomUUID: () => webcrypto.randomUUID(),
    subtle: { digest: async () => new Uint8Array(32).buffer },
  });
  vi.resetAllMocks();
  linked = ["p1"];
  registry = [];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  api.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  api.upload.mockResolvedValue({ error: null });
  api.remove.mockResolvedValue({ error: null });
  api.insert.mockImplementation(() => {
    registry = [evidence];
    return {
      select: () => ({
        single: async () => ({ data: { id: "e1" }, error: null }),
      }),
    };
  });
  api.rpc.mockImplementation(async (_name, args) => {
    linked.push(args.p_project);
    return { error: null };
  });
  api.from.mockImplementation((table: string) => ({
    insert: api.insert,
    select: () => {
      const query = {
        eq: () => query,
        is: () => query,
        order: () => query,
        then: (resolve: (r: unknown) => void) =>
          resolve({
            data:
              table === "vertice_extension_project_evidence"
                ? linked.map((id) => ({ ...evidence, target_project_id: id }))
                : registry,
            error: null,
          }),
      };
      return query;
    },
  }));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(projectId?: string) {
  await act(async () =>
    root.render(
      createElement(ExtensaoEvidencias, {
        institutionId: "ies",
        projectId,
        projectTitle: projectId ? "Projeto A sintético" : undefined,
        canEdit: true,
        linkableProjects: projects,
        onLinked,
        onClose: vi.fn(),
      }),
    ),
  );
}
async function click(label: string) {
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  )!;
  expect(b).toBeTruthy();
  await act(async () => b.click());
}
async function check(label: string) {
  const el = [...host.querySelectorAll("label")]
    .find((el) => el.textContent?.includes(label))
    ?.querySelector<HTMLInputElement>("input[type=checkbox]");
  expect(el).toBeTruthy();
  await act(async () => el!.click());
}
async function fillTitle() {
  const el = host.querySelector<HTMLInputElement>(".ext-form-grid input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, "Ata de teste");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function pickFile(size?: number) {
  const file = new File(["conteúdo sintético"], "ata.txt", {
    type: "text/plain",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode("conteúdo sintético").buffer,
  });
  if (size) Object.defineProperty(file, "size", { value: size });
  const el = host.querySelector<HTMLInputElement>("input[type=file]")!;
  await act(async () => {
    Object.defineProperty(el, "files", { configurable: true, value: [file] });
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function upload(ids = ["Projeto A sintético", "Projeto B sintético"]) {
  await click("Enviar evidência");
  await fillTitle();
  for (const id of ids) await check(id);
  await pickFile();
  await click("Salvar evidência");
}
it("mostra seleção múltipla no envio e exige ao menos um projeto antes de gravar", async () => {
  await render();
  await click("Enviar evidência");
  expect(host.textContent).toContain(
    "Projetos vinculados — selecione um ou mais",
  );
  await fillTitle();
  await pickFile();
  await click("Salvar evidência");
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "um ou mais projetos",
  );
  expect(api.upload).not.toHaveBeenCalled();
  expect(api.insert).not.toHaveBeenCalled();
});
it("dois projetos recebem uma evidência com um único arquivo e um único cadastro", async () => {
  await render();
  await upload();
  expect(api.upload).toHaveBeenCalledOnce();
  expect(api.insert).toHaveBeenCalledOnce();
  expect(api.insert.mock.calls[0][0].project_id).toBe("p1");
  expect(api.insert.mock.calls[0][0].file_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(api.rpc).toHaveBeenCalledWith("vertice_extension_link_evidence", {
    p_project: "p2",
    p_evidence: "e1",
  });
  expect(host.querySelector("[role=status]")?.textContent).toContain(
    "2 projeto(s)",
  );
});
it("reabrir vínculos mantém o projeto anterior marcado e adiciona vários de uma vez", async () => {
  registry = [evidence];
  await render();
  await click("Vincular projetos");
  const checks = host.querySelectorAll<HTMLInputElement>(
    "input[type=checkbox]",
  );
  expect(checks[0].checked).toBe(true);
  expect(checks[0].disabled).toBe(true);
  await check("Projeto B sintético");
  await check("Projeto C sintético");
  await click("Vincular");
  expect(api.rpc).toHaveBeenCalledTimes(2);
  expect(linked).toEqual(["p1", "p2", "p3"]);
  expect(api.upload).not.toHaveBeenCalled();
});
it("campo também aparece no contexto de um projeto e pré-seleciona o projeto aberto", async () => {
  await render("p1");
  await click("Enviar evidência");
  expect(
    host.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked,
  ).toBe(true);
});
it("falha parcial não declara sucesso geral e retoma só vínculos pendentes sem reenviar arquivo", async () => {
  let fail = true;
  api.rpc.mockImplementation(async (_name, args) =>
    args.p_project === "p3" && fail
      ? { error: { message: "Permissão negada" } }
      : { error: null },
  );
  await render();
  await upload([
    "Projeto A sintético",
    "Projeto B sintético",
    "Projeto C sintético",
  ]);
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "Alguns projetos não foram vinculados",
  );
  expect(host.textContent).toContain("Restam 1 projeto(s)");
  expect(host.textContent).not.toContain("3 projeto(s), com um único arquivo");
  fail = false;
  await click("Tentar vínculos pendentes");
  expect(api.upload).toHaveBeenCalledOnce();
  expect(api.insert).toHaveBeenCalledOnce();
  expect(api.rpc.mock.calls.map(([, a]) => a.p_project)).toEqual([
    "p2",
    "p3",
    "p3",
  ]);
  expect(host.querySelector("[role=status]")?.textContent).toContain(
    "Nenhum novo arquivo",
  );
});
it("falha no registro não tenta criar vínculos e remove o arquivo não cadastrado", async () => {
  api.insert.mockReturnValue({
    select: () => ({
      single: async () => ({
        data: null,
        error: { message: "Registro recusado" },
      }),
    }),
  });
  await render();
  await upload();
  expect(api.remove).toHaveBeenCalledOnce();
  expect(api.rpc).not.toHaveBeenCalled();
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "Registro recusado",
  );
});
it("sessão expirada e arquivo acima do limite não deixam envio confirmado", async () => {
  api.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await render();
  await upload();
  expect(api.upload).not.toHaveBeenCalled();
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "Entre novamente",
  );
  await pickFile(11 * 1024 * 1024);
  await click("Salvar evidência");
  expect(host.querySelector("[role=alert]")?.textContent).toContain("10 MB");
});
