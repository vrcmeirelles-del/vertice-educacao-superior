// Vértice · correspondência assistida de evidências institucionais (2017 → proposta 2026).
// Somente metadados autorizados; nunca envia conteúdo binário nem atribui conformidade.
import { createClient } from "npm:@supabase/supabase-js@2";
// IA suspensa até a plataforma gerar receita (decisão de 19/11/2026). Para religar: secret AI_SUSPENDED=false.
{const __aiFetch=globalThis.fetch;const __aiHosts=/(^|\.)(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com)$/i;
globalThis.fetch=((input:any,init?:any)=>{let host="";try{host=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).hostname;}catch{}
if(__aiHosts.test(host)&&String(Deno.env.get("AI_SUSPENDED")??"true").toLowerCase()!=="false")
 return Promise.resolve(new Response(JSON.stringify({error:{type:"ai_suspended",message:"IA suspensa temporariamente."}}),{status:503,headers:{"content-type":"application/json"}}));
return __aiFetch(input,init);}) as typeof fetch;}
const CATALOG = [{"code":"E1.1","title":"Plano de Desenvolvimento Institucional (PDI)","hint":"PDI vigente, coerente com a missão, objetivos e metas da IES."},{"code":"E1.2","title":"Comissão Própria de Avaliação (CPA)","hint":"Constituição, composição, plano de trabalho, instrumentos e resultados."},{"code":"E1.3","title":"Autoavaliação institucional e meta-avaliação","hint":"Ciclos de autoavaliação, uso de indicadores, ciência de dados e devolutivas."},{"code":"E1.4","title":"Monitoramento de indicadores de qualidade","hint":"Painel de indicadores (CC, CPC, IGC, ENADE) com série histórica e plano de melhoria."},{"code":"E1.5","title":"Planejamento estratégico e orçamentário","hint":"Articulação entre PDI, PPI, orçamento e plano de ação."},{"code":"E2.1","title":"Responsabilidade social e compromisso com os ODS","hint":"Política de responsabilidade social vinculada à Agenda 2030."},{"code":"E2.2","title":"Inclusão, diversidade e equidade","hint":"Políticas de inclusão, cotas, ações afirmativas e acessibilidade."},{"code":"E2.3","title":"Extensão e relação com a comunidade","hint":"Programas de extensão, impacto social e parcerias territoriais."},{"code":"E2.4","title":"Educação ambiental e sustentabilidade","hint":"Política ambiental, práticas sustentáveis e integração curricular."},{"code":"E3.1","title":"Projeto Pedagógico Institucional (PPI)","hint":"Coerência do PPI com o PDI, as DCN e a identidade da IES."},{"code":"E3.2","title":"Políticas de ensino","hint":"Inovação pedagógica, metodologias ativas, integração ensino-pesquisa-extensão."},{"code":"E3.3","title":"Políticas de pesquisa e inovação","hint":"Programas de IC, grupos de pesquisa, produção e impacto."},{"code":"E3.4","title":"Políticas de extensão","hint":"Curricularização, creditação, registro e impacto social."},{"code":"E3.5","title":"Políticas de gestão de pessoas","hint":"Plano de carreira, formação continuada e avaliação docente."},{"code":"E3.6","title":"Acompanhamento de egressos (institucional)","hint":"Sistema centralizado, indicadores de empregabilidade e retroalimentação dos PPCs."},{"code":"E3.7","title":"Internacionalização","hint":"Acordos, mobilidade, dupla diplomação e cooperação internacional."},{"code":"E4.1","title":"Governança e estrutura organizacional","hint":"Organograma, regimentos, colegiados e fluxos decisórios."},{"code":"E4.2","title":"Transformação digital e sistemas de informação","hint":"ERP, BI, integração de dados, portais e automação de processos."},{"code":"E4.3","title":"LGPD e proteção de dados","hint":"Política de privacidade, encarregado (DPO), mapeamento de dados e consentimentos."},{"code":"E4.4","title":"Sustentabilidade financeira","hint":"Equilíbrio receita-despesa, reservas, investimento e projeção."},{"code":"E4.5","title":"Comunicação institucional","hint":"Canais, ouvidoria, transparência e atendimento."},{"code":"E5.1","title":"Estruturas de aprendizagem","hint":"Salas, laboratórios e ambientes flexíveis; manutenção e adequação."},{"code":"E5.2","title":"Ambiente híbrido de aprendizagem (Biblioteca)","hint":"Acervo físico e digital, base de dados, acesso remoto e acessibilidade."},{"code":"E5.3","title":"Acessibilidade arquitetônica e digital","hint":"Design universal, rotas acessíveis, tecnologias assistivas e sinalização."},{"code":"E5.4","title":"Infraestrutura tecnológica","hint":"Rede, datacenter, nuvem, segurança e suporte técnico."},{"code":"E5.5","title":"Polos EaD (quando aplicável)","hint":"Polos com infraestrutura, tutoria e avaliação conforme Decreto nº 12.456/2025."}];
const codes = new Set(CATALOG.map(o=>o.code));
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
function respond(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
type Doc={id:string;file_name:string;status:string;request_id:string};
type Req={id:string;title:string;indicator:string|null;instructions:string|null;course_id:string|null;repository_section:string|null};
type Suggestion={file_id:string;object_code:string;confidence:number;rationale:string};
// Correspondência por algoritmo (desde 20/11/2026, método único): termos do título, do nome do
// arquivo e da descrição contra título e descrição de cada objeto do instrumento 2026, por radical,
// com peso maior para siglas regulatórias. Só metadados; o conteúdo do arquivo não é analisado.
const ACRONYMS=new Set(["pdi","cpa","ppi","lgpd","ods","ead","enade","cpc","igc","dpo","erp","nde","ppc","dcn"]);
const STOP=new Set(["para","com","dos","das","uma","sobre","pela","pelo","institucional","institucionais","instituicao","documento","documentos","avaliacao","vigente","quando","aplicavel"]);
export function terms(s:string){
 return new Set(String(s||"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g,"").split(/[^a-z0-9]+/)
  .filter(w=>(w.length>3||ACRONYMS.has(w))&&!STOP.has(w)).map(w=>ACRONYMS.has(w)?w:w.slice(0,7)));
}
export function heuristicLinks(rows:{file:Doc;request:Req}[]):Suggestion[]{
 const catalog=CATALOG.map(o=>({o,words:terms(o.title+" "+o.hint)}));
 // Termo presente em um único objeto do catálogo é distintivo e pesa como sigla.
 const df=new Map<string,number>();for(const {words} of catalog)for(const w of words)df.set(w,(df.get(w)??0)+1);
 return rows.flatMap(({file,request})=>{
  const titled=terms(file.file_name+" "+request.title);
  const doc=new Set([...titled,...terms(request.instructions??"")]);
  return catalog.map(({o,words})=>{
   const hit=[...doc].filter(w=>words.has(w));
   const score=hit.reduce((s,w)=>s+(ACRONYMS.has(w)||(df.get(w)===1&&titled.has(w))?2:1),0);
   return {file_id:file.id,object_code:o.code,confidence:Math.min(.85,.4+score*.1),
    rationale:`Termos em comum com "${o.title}": ${hit.join(", ")}. Correspondência pelos metadados (título, nome do arquivo e descrição); conteúdo do arquivo não analisado.`,score,hit};
  }).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,2).map(({score,hit,...x})=>x);
 });
}
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("",{headers:cors});
 if(request.method!=="POST")return respond({error:"method_not_allowed"},405);
 try{
  const jwt=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  const projectUrl=Deno.env.get("SUPABASE_URL")??"";
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
  if(!jwt||!projectUrl||!anonKey)return respond({error:"authentication_required"},401);
  const supabase=createClient(projectUrl,anonKey,{global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await supabase.auth.getUser(jwt);
  if(userError||!user)return respond({error:"authentication_required"},401);
  const body=await request.json();
  const institution=String(body?.institution_id??"");
  const fileId=body?.file_id?String(body.file_id):null;
  if(!/^[0-9a-f-]{36}$/i.test(institution)||(fileId&&!/^[0-9a-f-]{36}$/i.test(fileId)))return respond({error:"invalid_scope"},400);
  // Escrita somente por perfis autorizados com MFA; RLS faz a checagem novamente.
  const {data:membership,error:memberError}=await supabase.from("vertice_instrumento_checklist").select("id").eq("institution_id",institution).limit(1);
  if(memberError)return respond({error:"access_denied"},403);
  let fileQuery=supabase.from("vertice_repository_files").select("id,file_name,status,request_id,created_at").eq("institution_id",institution).order("created_at",{ascending:false}).limit(40);
  if(fileId)fileQuery=fileQuery.eq("id",fileId);
  const {data:files,error:filesErr}=await fileQuery;
  if(filesErr)return respond({error:"access_denied"},403);
  if(!files?.length)return respond({processed:0,created:0,method:"none"});
  const ids=[...new Set(files.map(f=>f.request_id))];
  const {data:reqs,error:reqErr}=await supabase.from("vertice_repository_requests").select("id,title,indicator,instructions,course_id,repository_section").eq("institution_id",institution).in("id",ids).is("course_id",null);
  if(reqErr)return respond({error:"access_denied"},403);
  const requestMap=new Map((reqs??[]).filter(r=>!String(r.repository_section??"").startsWith("novo_instrumento_2026")).map(r=>[r.id,r]));
  const eligible=files.filter(f=>requestMap.has(f.request_id)).map(f=>({file:f as Doc,request:requestMap.get(f.request_id) as Req}));
  if(!eligible.length)return respond({processed:0,created:0,method:"none",note:"Nenhum arquivo vinculado ao acervo institucional."});
  const {data:existing,error:linksErr}=await supabase.from("vertice_instrumento_correspondencias").select("source_file_id,target_object_code").eq("institution_id",institution).in("source_file_id",eligible.map(e=>e.file.id));
  if(linksErr)return respond({error:"link_table_unavailable"},503);
  const existingFiles=new Set((existing??[]).map(e=>e.source_file_id));
  const pending=eligible.filter(x=>!existingFiles.has(x.file.id));
  if(!pending.length)return respond({processed:eligible.length,created:0,method:"already_indexed"});
  const method="heuristic_metadata";
  const suggestions=heuristicLinks(pending);
  const validFiles=new Set(pending.map(x=>x.file.id));
  const dedupe=new Set<string>();
  const normalized=suggestions.filter(x=>x&&validFiles.has(String(x.file_id))&&codes.has(String(x.object_code))).map(x=>({institution_id:institution,source_file_id:String(x.file_id),target_object_code:String(x.object_code),confidence:Math.max(0,Math.min(1,Number(x.confidence)||0)),rationale:String(x.rationale??"").slice(0,1200),method,suggestion_status:"sugerido"})).filter(x=>x.confidence>=.5&&x.rationale.length>=5&&(()=>{const k=x.source_file_id+"/"+x.target_object_code;if(dedupe.has(k))return false;dedupe.add(k);return true})()).slice(0,90);
  if(!normalized.length)return respond({processed:pending.length,created:0,method,note:"Sem correspondências suficientemente sustentadas pelos metadados."});
  const {data:created,error:writeErr}=await supabase.from("vertice_instrumento_correspondencias").insert(normalized).select("id");
  if(writeErr)return respond({error:"write_denied",detail:writeErr.code},403);
  return respond({processed:pending.length,created:created?.length??0,method,review_required:true});
 }catch(e){return respond({error:"sync_failed",detail:String(e instanceof Error?e.message:e).slice(0,250)},500)}
});
