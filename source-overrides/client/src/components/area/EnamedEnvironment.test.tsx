import React from "react";
import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import EnamedEnvironment from "./EnamedEnvironment";
import {visibleTabs} from "@/lib/area";

describe("ENAMED 360 - interface (renderização sem autenticação)",()=>{
 it("mostra somente fontes INEP documentais e não inventa um curso de Medicina",()=>{
  const html=renderToStaticMarkup(<EnamedEnvironment institutionId="ies-sintetica" courses={[]} onPlan={()=>{}}/>);
  expect(html).toContain("ENAMED 360°");
  expect(html).toContain("Fontes e relatórios INEP");
  expect(html).toContain("Microdados");
  expect(html).toContain("Nenhum curso de Medicina identificado");
  expect(html).toContain("Integração de dados oficiais em homologação");
  expect(html).not.toContain("Nota TRI calculada");
 });
 it("oferece curso existente sem criar outra instituição ou dados fictícios",()=>{
  const courses=[{id:"curso-sintetico",name:"Medicina",code:"TESTE-001"},{id:"outro",name:"Direito",code:"TESTE-002"}] as any;
  const html=renderToStaticMarkup(<EnamedEnvironment institutionId="ies-sintetica" courses={courses} onPlan={()=>{}}/>);
  expect(html).toContain("TESTE-001");
  expect(html).not.toContain("TESTE-002");
  expect(html).not.toContain("Nenhum curso de Medicina identificado");
 });
});

describe("ENADE/ENAMED 360 - matriz estática de visibilidade, não teste RLS",()=>{
 it("expõe ENADE institucional aos perfis amplos e à CPA",()=>{
  for(const role of ["master","reitor","gestor","diretor_geral","diretor_pedagogico","procurador","cpa"] as const){
   expect(visibleTabs(role)).toContain("enade");
  }
 });
 it("registra que coordenador/NDE ainda não recebem ENADE 360 no menu; não ampliar sem escopo por curso",()=>{
  for(const role of ["coordenador","nde","equipe","leitor"] as const){
   expect(visibleTabs(role)).not.toContain("enade");
  }
  expect(visibleTabs("coordenador")).toContain("trilhas-enade");
  expect(visibleTabs("nde")).toContain("trilhas-enade");
 });
});
