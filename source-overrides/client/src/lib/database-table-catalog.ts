/** Inventário de tabelas SQL Server (esquema;nome).
 * NÃO são linhas acadêmicas nem dados de estudantes. Não permitem publicação no BI.
 * Respeita o conteúdo integral para que mais de 500 nomes não sejam truncados.
 */
export type CatalogArea="Acadêmico"|"Matrículas e alunos"|"Avaliação e frequência"|"Financeiro"|"Biblioteca"|"Regulação e censo"|"Gestão e sistema"|"Outros";
export type CatalogEntry={schema:string;table:string;area:CatalogArea};
export type DatabaseCatalog={kind:"sql-server-table-catalog";entries:CatalogEntry[];counts:Record<CatalogArea,number>;duplicates:string[];warnings:string[]};
const areas:CatalogArea[]=["Acadêmico","Matrículas e alunos","Avaliação e frequência","Financeiro","Biblioteca","Regulação e censo","Gestão e sistema","Outros"];
function classify(t:string):CatalogArea{
 const v=t.toUpperCase();
 if(/ALUN|MATR|REMATR|TURM|FICHALU|INGRESS|EVAS|TRANSF/.test(v))return "Matrículas e alunos";
 if(/NOTA|AVALI|FALT|FREQ|PROVA|BOLET|DIARIO|CONCEITO|APROV|REPROV/.test(v))return "Avaliação e frequência";
 if(/FINAN|PAG|BOL|DEB|CRED|CAIX|CONTA|DESP|RECE|COBR|FIES|CHEQUE|NFE/.test(v))return "Financeiro";
 if(/BIBLIO|ACERVO|LIVRO|PERIODIC|EMPREST|EXEMPLAR|CATALOGO/.test(v))return "Biblioteca";
 if(/CENSO|ENADE|INEP|EMEC|REGUL|MEC|EDC_/.test(v))return "Regulação e censo";
 if(/CURS|DISC|GRADE|ESTAGIO|PROF|HORARIO|AULA|PLANOENSINO|PERIODO/.test(v))return "Acadêmico";
 if(/CONFIG|MENU|USUARIO|ACESSO|AUDIT|GEN_|PERMIS|LOG|SIST|VERSAO/.test(v))return "Gestão e sistema";
 return "Outros";
}
export function inspectTableCatalog(text:string):DatabaseCatalog|null{
 const cleaned=text.replace(/^\uFEFF/,"").trim();
 if(cleaned.length>2*1024*1024)return null;
 const lines=cleaned.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2||lines.length>50000)return null;
 const values:CatalogEntry[]=[];
 let nonMatching=0;
 for(const line of lines){
  // Two columns only. Explicitly reject extra data so personally identifying fields
  // cannot be mistaken for a harmless schema inventory.
  const match=/^([A-Za-z_][\w]{0,63});([A-Za-z_][\w]{0,127})$/.exec(line);
  if(!match){nonMatching++;continue;}
  values.push({schema:match[1],table:match[2],area:classify(match[2])});
 }
 if(nonMatching||values.length<2)return null;
 const counts=Object.fromEntries(areas.map(a=>[a,0])) as Record<CatalogArea,number>;
 const seen=new Set<string>(),duplicates:string[]=[];
 for(const item of values){
  counts[item.area]++;
  const key=item.schema.toLowerCase()+"."+item.table.toLowerCase();
  if(seen.has(key))duplicates.push(key);else seen.add(key);
 }
 const warnings:string[]=[];
 if(duplicates.length)warnings.push(duplicates.length+" nome(s) de tabela repetido(s), requerendo conferência.");
 warnings.push("O catálogo contém somente nomes de tabelas. Não comprova a presença, quantidade ou integridade de registros acadêmicos.");
 warnings.push("A classificação temática é uma sugestão baseada no nome da tabela; exige revisão humana antes de qualquer uso.");
 return {kind:"sql-server-table-catalog",entries:values,counts,duplicates,warnings};
}
