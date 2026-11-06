import {describe,it,expect} from "vitest";
import {inspectTableCatalog} from "../client/src/lib/database-table-catalog";

describe("inventário do backup acadêmico",()=>{
 it("reconhece 642 nomes de tabelas sem aplicar o limite de 500 indicadores",()=>{
  const names=Array.from({length:642},(_,i)=>"dbo;TABELA_"+String(i).padStart(4,"0")).join("\r\n");
  const inventory=inspectTableCatalog(names);
  expect(inventory?.entries).toHaveLength(642);
  expect(inventory?.duplicates).toHaveLength(0);
  expect(inventory?.entries[641].table).toBe("TABELA_0641");
 });
 it("identifica áreas sugeridas, sem inventar contagem de alunos",()=>{
  const input="dbo;ALUNOGER\r\ndbo;CURSOS\r\ndbo;DISCIPL\r\ndbo;FALTASGLOBAIS";
  const inventory=inspectTableCatalog(input);
  expect(inventory?.counts["Matrículas e alunos"]).toBe(1);
  expect(inventory?.counts["Avaliação e frequência"]).toBe(1);
  expect(inventory?.counts["Acadêmico"]).toBe(2);
  expect(JSON.stringify(inventory)).not.toContain("matriculados");
 });
 it("recusa CSV de indicadores ou dados pessoais no lugar de catálogo",()=>{
  expect(inspectTableCatalog("indicador;semestre;valor\nAlunos;2026/02;150")).toBeNull();
  expect(inspectTableCatalog("dbo;TABELA;CPF\ndbo;OUTRA;123")).toBeNull();
 });
 it("reconhece arquivos com BOM e alerta duplicidade",()=>{
  const c=inspectTableCatalog("\uFEFFdbo;CURSOS\ndbo;CURSOS\ndbo;TURMAS");
  expect(c?.duplicates).toEqual(["dbo.cursos"]);
 });
});
