import {describe,it,expect} from "vitest";
import {inspectInstitutionalJson,getInstitutionalJsonDataset} from "../client/src/lib/json-structure-preview";

describe("curadoria de JSON institucional grande",()=>{
 it("identifica tabelas aninhadas, sem exigir que a raiz seja array",()=>{
  const document={metadata:{sistema:"legado"},dados:{cursos:[{curso:"Direito",periodo:"2026/02",valor:10},{curso:"Administração",periodo:"2026/02",valor:12}]}};
  const report=inspectInstitutionalJson(document);
  expect(report.rootType).toBe("object");
  expect(report.topLevelKeys).toContain("dados");
  expect(report.datasets.some(d=>d.path==="dados.cursos"&&d.count===2)).toBe(true);
  expect(getInstitutionalJsonDataset(document,"dados.cursos")).toHaveLength(2);
 });
 it("mostra estrutura de conjuntos grandes sem permitir sua publicação truncada",()=>{
  const document={registros:Array.from({length:501},(_,i)=>({id:i,indicador:"exemplo"}))};
  const report=inspectInstitutionalJson(document);
  expect(report.datasets[0]).toMatchObject({path:"registros",count:501,previewEligible:false});
  expect(()=>getInstitutionalJsonDataset(document,"registros")).toThrow(/Não é permitido homologar/);
 });
 it("não mistura valores de arrays com nomes de campos da prévia",()=>{
  const doc={linhas:[{matricula:"123456",nome:"Pessoa",valor:20}]};
  const report=inspectInstitutionalJson(doc);
  expect(JSON.stringify(report)).not.toContain("123456");
  expect(JSON.stringify(report)).not.toContain("Pessoa");
 });
 it("recusa caminhos inexistentes e atalhos de protótipo",()=>{
  expect(()=>getInstitutionalJsonDataset({dados:[]},"__proto__")).toThrow();
  expect(()=>getInstitutionalJsonDataset({dados:[]},"dados.records")).toThrow();
 });
});
