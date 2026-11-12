import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";

const root=new URL("../",import.meta.url);
const file=(name:string)=>readFileSync(new URL(name,root),"utf8");

describe("Convites Demonstrativos dentro do portal Master",()=>{
  const master=file("client/src/pages/OwnerDashboard.tsx");
  const hub=file("client/src/components/area/MasterHub.tsx");
  const existing=file("client/src/pages/ExperienceAdmin.tsx");
  const client=file("client/src/lib/experience-access.ts");
  const routing=file("client/src/App.tsx");

  it("inclui entrada acessível na navegação do Master com estado próprio",()=>{
    expect(master).toContain("demonstrativos:p.get('demonstrativos')==='1'");
    expect(master).toContain("route.hub&&master?<MasterHub");
    expect(hub).toContain("onClick={() => setShowInvite(!showInvite)}");
    expect(hub).toContain("apiCall('admin:create'");
    expect(master).toContain("master&&route.demonstrativos?<ExperienceAdmin embedded/>");
  });
  it("não abre o formulário aos demais perfis por meio de flag na URL",()=>{
    expect(master).toContain("master&&route.demonstrativos?<ExperienceAdmin embedded/>");
    expect(existing).toContain("Acesso restrito ao Master");
    expect(existing).toContain("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
    expect(existing).toContain("currentLevel!=='aal2'");
    expect(existing).toContain("supabase.from('vertice_admins')");
  });
  it("reaproveita a emissão e revogação já existentes, sem outra base de convites",()=>{
    expect(existing).toContain("experienceApi");
    expect(existing).toContain("admin:create");
    expect(existing).toContain("admin:revoke");
    expect(existing).toContain("admin:list");
    expect(client).toContain("vertice-experience");
    expect(routing).toContain('normalized === "/master/experience"');
  });
  it("exibe os três cenários fictícios e usa contêiner sem main aninhado",()=>{
    expect(existing).toContain("embedded ? 'section' : 'main'");
    expect(existing).toContain('<Frame id="convites-demonstrativos"');
    for(const kind of ["faculdade","centro","universidade"]){
      expect(existing).toContain('href="/demonstracao?perfil='+kind+'"');
    }
    expect(existing).toContain("Link confidencial — disponível somente agora");
    expect(existing).toContain("Nenhuma mensagem foi enviada automaticamente");
  });
});
