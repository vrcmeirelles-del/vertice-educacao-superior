import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const load=(file:string)=>readFileSync(new URL(file,root),"utf8");

describe("Convites comerciais Master: Vértice + Fato & Ordem",()=>{
 const admin=load("client/src/pages/ExperienceAdmin.tsx");
 const master=load("client/src/pages/OwnerDashboard.tsx");
 const pack=load("client/src/pages/MasterCommercialSuite.tsx");
 const css=load("client/src/pages/master-commercial-suite.css");

 it("mantém toda a apresentação dentro da área Master de convites existentes",()=>{
  expect(master).toContain("master&&route.demonstrativos?<ExperienceAdmin embedded/>");
  expect(admin).toContain("<MasterCommercialSuite");
  expect(admin).toContain("mode={mode}");
  expect(admin).toContain("verticeInvite={link}");
  expect(admin).toContain('id="vertice-invite-form"');
  expect(admin).toContain("currentLevel!=='aal2'");
  expect(admin).toContain("supabase.from('vertice_admins')");
 });
 it("fornece links corretos de demonstração para três portes em ambas as marcas",()=>{
  expect(pack).toContain('"/demonstracao?perfil="');
  expect(pack).toContain('"/demonstracao-ies?"');
  expect(pack).toContain('porte:mode,perfil:"reitor",curso:"all"');
  expect(pack).toContain("id:\"faculdade\"");
  expect(pack).toContain("id:\"centro\"");
  expect(pack).toContain("id:\"universidade\"");
  expect(pack).toContain('FATO_ORDEM+"/admin/demonstracao-ies"');
 });
 it("não inventa emissão automática no Fato & Ordem nem envia mensagens sem comando",()=>{
  expect(pack).not.toContain("/api/admin/institutional-demo-invites");
  expect(pack).not.toContain("fetch(");
  expect(pack).toContain("Convite privado Fato & Ordem (opcional");
  expect(pack).toContain("Sem convite privado:");
  expect(pack).toContain("Envio manual, sem disparo automático");
  expect(pack).toContain('const foLink=foPrivate||makeFoUrl(mode)');
  expect(pack).toContain('const verticeLink=verticeInvite||makeVerticeUrl(mode)');
 });
 it("restringe tokens privados do F&O à origem/rota correta sem persistência",()=>{
  expect(pack).toContain('url.pathname!=="/demonstracao-ies"');
  expect(pack).toContain('url.protocol!=="https:"');
  expect(pack).toContain('^#convite=[A-Za-z0-9_-]{43}$');
  expect(pack).toContain("useState(\"\")");
  expect(pack).not.toContain("localStorage");
  expect(pack).not.toContain("sessionStorage");
 });
 it("explica dores, benefícios e CTA sem prometer integração já habilitada",()=>{
  for(const term of [
   "Captação sem permanência","Nota sem evidência externa",
   "Gestão regulatória dispersa","Intervenção pedagógica tardia",
   "Vértice Educação Superior","Fato & Ordem","OAB","CFC","ENADE",
   "matrícula confirmada","Agende","Responda a esta mensagem"
  ]){expect(pack).toContain(term);}
  expect(css).toContain(".vcds-modes");
  expect(css).toContain("@media(max-width:510px)");
 });
});
