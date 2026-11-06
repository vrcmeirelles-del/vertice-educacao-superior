import {describe,it,expect} from "vitest";
import {parseCsv,parseTabular,guessMapping,normalizeInput} from "../client/src/lib/source-curation";

describe("curadoria das fontes de dados da IES",()=>{
 it("interpreta CSV separado por ponto e vírgula e cabeçalho informado",()=>{
  const rows=parseCsv("indicador;semestre;valor;unidade\nMatriculados;2026/02;6846;alunos\nReprovados;2026/02;10;alunos");
  expect(rows).toHaveLength(2);
  const result=normalizeInput(rows,{indicator:"indicador",period:"semestre",value:"valor",unit:"unidade"},"quantidade");
  expect(result[0]).toEqual({indicador:"Matriculados",periodo:"2026/02",valor:6846,unidade:"alunos"});
 });
 it("normaliza semestre com e sem zero, sem inventar competência",()=>{
  const rows=parseTabular('[{"nome":"Total matriculados","periodo":"2026/2","quantidade":120}]',"json");
  const map=guessMapping(Object.keys(rows[0]));
  expect(normalizeInput(rows,map,"alunos")[0].periodo).toBe("2026/02");
 });
 it("recusa valores locais ambíguos, duplicatas e informação fora do esquema",()=>{
  const mapping={indicator:"indicador",period:"semestre",value:"valor",unit:"unidade"};
  expect(()=>normalizeInput([{indicador:"Total matriculados",semestre:"2026/02",valor:"1.987",unidade:"alunos"}],mapping,"alunos")).toThrow();
  expect(()=>normalizeInput([
   {indicador:"Total matriculados",semestre:"2026/02",valor:"100",unidade:"alunos"},
   {indicador:"Total matriculados",semestre:"2026/02",valor:"110",unidade:"alunos"}
  ],mapping,"alunos")).toThrow(/Duplicidade/);
 });
 it("não interpreta PDF ou XLSX como dados estruturados sem extrator",()=>{
  expect(()=>parseTabular("conteúdo","pdf")).toThrow(/CSV ou JSON/);
  expect(()=>parseTabular("conteúdo","xlsx")).toThrow(/CSV ou JSON/);
 });
});
