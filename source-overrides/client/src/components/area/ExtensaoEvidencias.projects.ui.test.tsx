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
import ExtensionEvidenceProjects from "./ExtensionEvidenceProjects";
let host: HTMLDivElement, root: Root;
let linked: string[];
const onLinked = vi.fn();
const projects = [
  {
    id: "p1",
    title: "Projeto A sintético",
    courses: [{ id: "direito", name: "Direito" }],
  },
  {
    id: "p2",
    title: "Projeto B sintético",
    courses: [
      { id: "fisio", name: "Fisioterapia" },
      { id: "direito", name: "Direito" },
    ],
  },
  { id: "p3", title: "Projeto C sintético", courses: [] },
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
async function select(label: string, value: string) {
  const el = [...host.querySelectorAll("label")]
    .find((el) => el.textContent?.startsWith(label))
    ?.querySelector<HTMLSelectElement>("select");
  expect(el).toBeTruthy();
  await act(async () => {
    el!.value = value;
    el!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function check(label: string) {
  const project = projects.find((p) => p.title === label)!;
  await select("Projeto", project.id);
  await click("Adicionar projeto");
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
  const selected = host.querySelector(
    'ul[aria-label="Projetos selecionados"]',
  )!;
  expect(selected.textContent).toContain("Projeto A sintético");
  expect(selected.textContent).toContain("Já vinculado");
  expect(selected.querySelector("button")).toBeNull();
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
    host.querySelector('ul[aria-label="Projetos selecionados"]')?.textContent,
  ).toContain("Projeto A sintético");
  expect(host.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
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

it("filtra por curso sem perder projetos selecionados em outros cursos", async () => {
  await render();
  await click("Enviar evidência");
  await select("Curso vinculado", "fisio");
  const projectSelect = () =>
    [...host.querySelectorAll("label")]
      .find((el) => el.textContent?.startsWith("Projeto"))!
      .querySelector("select")!;
  expect([...projectSelect().options].map((o) => o.value)).toEqual(["", "p2"]);
  await check("Projeto B sintético");
  await select("Curso vinculado", "direito");
  await check("Projeto A sintético");
  await select("Curso vinculado", "__without_course__");
  expect([...projectSelect().options].map((o) => o.value)).toEqual(["", "p3"]);
  const list = host.querySelector('ul[aria-label="Projetos selecionados"]')!;
  expect(list.querySelectorAll("li")).toHaveLength(2);
  expect(list.textContent).toContain("Fisioterapia · Direito");
  await click("Remover");
  expect(list.querySelectorAll("li")).toHaveLength(1);
  expect(api.rpc).not.toHaveBeenCalled();
  expect(api.upload).not.toHaveBeenCalled();
});
it("agrupa por curso e busca sem acentos sem criar seleção duplicada", async () => {
  await render();
  await click("Enviar evidência");
  expect([...host.querySelectorAll("optgroup")].map((g) => g.label)).toEqual([
    "Direito",
    "Fisioterapia",
    "Sem curso vinculado",
  ]);
  const search = host.querySelector<HTMLInputElement>("input[type=search]")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(search, "B SINTETICO");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const options = [...host.querySelectorAll("optgroup option")];
  expect(options).toHaveLength(2);
  expect(options.every((o) => o.textContent === "Projeto B sintético")).toBe(
    true,
  );
  await check("Projeto B sintético");
  expect(
    host.querySelectorAll('ul[aria-label="Projetos selecionados"] li'),
  ).toHaveLength(1);
  expect(host.querySelectorAll("optgroup option")).toHaveLength(0);
});

it("mantém uma lista compacta com 240 projetos e filtra pelos vínculos de curso", async () => {
  const many = Array.from({ length: 240 }, (_, i) => ({
    id: `proj-${i}`,
    title: `Ação ${i}`,
    courses: [{ id: `curso-${i % 20}`, name: `Curso ${i % 20}` }],
  }));
  await act(async () =>
    root.render(
      createElement(ExtensionEvidenceProjects, {
        projects: many,
        selected: [],
        onChange: vi.fn(),
      }),
    ),
  );
  expect(host.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
  expect(
    host.querySelectorAll('ul[aria-label="Projetos selecionados"] li'),
  ).toHaveLength(0);
  expect(host.querySelectorAll("optgroup")).toHaveLength(20);
  await select("Curso vinculado", "curso-7");
  const projectSelect = [...host.querySelectorAll("label")]
    .find((el) => el.textContent?.startsWith("Projeto"))!
    .querySelector("select")!;
  expect(projectSelect.options).toHaveLength(13);
  expect(
    [...projectSelect.options]
      .slice(1)
      .every((o) => Number(o.value.split("-")[1]) % 20 === 7),
  ).toBe(true);
  expect(api.rpc).not.toHaveBeenCalled();
});
