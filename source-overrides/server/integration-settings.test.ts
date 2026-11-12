import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../client/src/components/area/ConexoesDados", () => ({
  default: (props: { institutionId: string; institutionName: string; role: string }) =>
    createElement("div", { "data-connector": "institutional", "data-institution": props.institutionId, "data-role": props.role }, props.institutionName),
}));
import IntegrationSettings from "../client/src/components/area/IntegrationSettings";

const props = { institutionId: "ies-a", institutionName: "Faculdade fictícia", role: "master" };
const render = (role: string | null) => renderToStaticMarkup(createElement(IntegrationSettings, { ...props, role }));

describe("institutional integration settings", () => {
  it.each(["master", "gestor"])("uses the existing authorized connection flow for %s", role => {
    const html = render(role);
    expect(html).toContain('data-connector="institutional"');
    expect(html).toContain('data-institution="ies-a"');
    expect(html).toContain(`data-role="${role}"`);
    expect(html).toContain(props.institutionName);
    expect(html).toContain("não confirma a importação de dados nem a atualização dos BIs");
    expect(html).not.toContain("Configuração salva");
  });

  it.each([null, "", "reitor", "coordenador", "docente"])("does not mount the connector for role %s", role => {
    expect(render(role)).toBe("<p>As conexões de dados são restritas à gestão da IES.</p>");
  });

  it("remounts connection state when institution or management role changes", () => {
    const connector = (institutionId: string, role: string) => {
      const view = IntegrationSettings({ ...props, institutionId, role });
      return view.props.children.at(-1);
    };
    expect(connector("ies-a", "master").key).not.toBe(connector("ies-b", "master").key);
    expect(connector("ies-a", "master").key).not.toBe(connector("ies-a", "gestor").key);
    expect(connector("ies-b", "master").props.institutionId).toBe("ies-b");
  });

  it("does not write academic settings or credentials into marketing connections", () => {
    const source = readFileSync("client/src/components/area/IntegrationSettings.tsx", "utf8");
    expect(source).not.toMatch(/supabase|academic_system|api_key|upsert|onConflict|24 a 72/);
    const workspace = readFileSync("client/src/components/area/Workspace.tsx", "utf8");
    expect(workspace).toContain('<IntegrationSettings institutionId={id} institutionName={String(institution.name)} role={role} />');
  });
});
