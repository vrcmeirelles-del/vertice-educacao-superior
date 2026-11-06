import {describe,it,expect} from "vitest";
import {UNI_GIZ_EXPECTED_TABLES,UNI_GIZ_QUERY_SHA256} from "../client/src/lib/uni-giz-expected";
import {uniGizSha256,validateUniGizStructuralFiles} from "../client/src/lib/uni-giz-structural-validation";

function makeCsv(){
 const lines=['"esquema";"tabela";"area";"prioridade";"situacao";"linhas_tabela_estimadas"'];
 for(const qualified of UNI_GIZ_EXPECTED_TABLES){
  const i=qualified.indexOf("."),schema=qualified.slice(0,i),name=qualified.slice(i+1);
  lines.push(['"'+schema+'"','"'+name+'"','"Acadêmico"','"1"','"LOCALIZADA"','"0"'].join(";"));
 }
 return lines.join("\r\n")+"\r\n";
}
async function fixtures(){
 const csv=new File([makeCsv()],"02_642_tabelas.csv",{type:"text/csv"});
 const hash=await uniGizSha256(csv);
 const json=new File([JSON.stringify({
  instituicao:"FACULDADE DE CALDAS NOVAS",banco:"UNI_GIZ_HOMOLOGACAO",
  estado:"READ_ONLY",data_utc:"2026-11-06T20:20:00Z",
  tabelas_esperadas:642,tabelas_localizadas:642,tabelas_ausentes:0,tabelas_adicionais:0,
  arquivo_sql_sha256:UNI_GIZ_QUERY_SHA256,
  arquivos:[
   {arquivo:"01_resumo_cobertura.csv",sha256:"a".repeat(64)},
   {arquivo:"02_642_tabelas.csv",sha256:hash},
   {arquivo:"03_tabelas_adicionais.csv",sha256:"b".repeat(64)},
   {arquivo:"04_colunas_prioritarias.csv",sha256:"c".repeat(64)},
   {arquivo:"05_relacionamentos.csv",sha256:"d".repeat(64)}
  ]
 })],"00_manifesto_conciliacao.json",{type:"application/json"});
 return {csv,json};
}
describe("conferência pós-restauração UNI_GIZ",()=>{
 it("reconhece 642 tabelas distintas e não declara validação acadêmica",async()=>{
  const {csv,json}=await fixtures();
  const result=await validateUniGizStructuralFiles(json,csv);
  expect(result.expected).toBe(642);
  expect(result.found).toBe(642);
  expect(result.missing).toBe(0);
  expect(result.rows).toHaveLength(642);
  expect(result.warning).toContain("Nenhuma importação ao BI");
 });
 it("rejeita edição de relatório sem atualização do manifesto SHA-256",async()=>{
  const {csv,json}=await fixtures();
  const edited=new File([await csv.text()+"\"dbo\";\"OUTRA\";\"x\";\"1\";\"LOCALIZADA\";\"0\""],csv.name,{type:"text/csv"});
  await expect(validateUniGizStructuralFiles(json,edited)).rejects.toThrow(/hash registrado/);
 });
 it("rejeita arquivo de origem ou formato diferente",async()=>{
  const {csv,json}=await fixtures();
  const invalid=new File([await json.text()],"outro.json",{type:"application/json"});
  await expect(validateUniGizStructuralFiles(invalid,csv)).rejects.toThrow(/Selecione os arquivos/);
 });
});
