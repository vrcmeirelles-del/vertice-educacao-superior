import { useMemo, useState } from "react";
import type { Row } from "@/lib/area";
import EnamedFatoOrdemMetrics from "./EnamedFatoOrdemMetrics";
import EnamedEditorialEvidence, { EnamedVerifiedSources } from "./EnamedEditorialEvidence";

type Props = { institutionId: string; courses: Row[]; onPlan: () => void };
type Section = "fontes" | "curriculo" | "integracao" | "auditoria" | "documentos";
const SOURCES = [
  { label:"Provas e gabaritos", url:"https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos", purpose:"Cadernos, edições e gabaritos. Conferir sempre se preliminar ou definitivo." },
  { label:"Resultados", url:"https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/resultados", purpose:"Resultados oficiais da formação médica e documentação disponível." },
  { label:"Microdados", url:"https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enamed", purpose:"Bases e dicionários públicos, observando granularidade e limitações." },
  { label:"Indicadores de qualidade", url:"https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior/2025", purpose:"Conceito Enade Medicina, cursos e metodologias." },
  { label:"Legislação e editais", url:"https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed", purpose:"Normas, habilitação e alterações de cronograma." },
] as const;

export default function EnamedEnvironment({ institutionId, courses, onPlan }:Props) {
  const [section,setSection]=useState<Section>("fontes");
  const [courseId,setCourseId]=useState("");
  const medCourses=useMemo(()=>courses.filter(c=>/medicina/i.test(String(c.display_name??c.name??""))),[courses]);
  const course=medCourses.find(c=>String(c.id)===courseId);
  return <section aria-label="Ambiente ENAMED 360" style={{background:"#f8fafc",border:"1px solid #ccd9e6",borderRadius:16,padding:20,margin:"20px 0",color:"#183550"}}>
    <header style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,alignItems:"start"}}>
      <div><span style={{fontSize:12,fontWeight:700,letterSpacing:1}}>AVALIAÇÕES EXTERNAS · MEDICINA</span>
        <h3 style={{fontSize:26,margin:"8px 0"}}>ENAMED 360° — Inteligência INEP</h3>
        <p style={{margin:"0 0 12px",maxWidth:740}}>Ambiente institucional especializado vinculado ao ENADE 360°. As fontes oficiais orientam currículo, simulados do Fato & Ordem, intervenções do Sapiens e metas 5W2H.</p>
      </div>
      <span style={{background:"#fef3c7",border:"1px solid #f59e0b",padding:"7px 10px",borderRadius:8,fontSize:12}}>Integração de dados oficiais em homologação</span>
    </header>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"16px 0"}}>
      {([["fontes","Fontes e relatórios INEP"],["curriculo","Currículo e intervenções"],["integracao","Fato & Ordem · dados por curso"],["auditoria","Acervo e incorporações"],["documentos","Documentos verificados"]] as const).map(([k,v])=>
        <button key={k} type="button" aria-pressed={section===k} onClick={()=>setSection(k)} style={{border:"1px solid #94a3b8",borderRadius:8,padding:"9px 12px",background:section===k?"#174c78":"#fff",color:section===k?"#fff":"#174c78",cursor:"pointer"}}>{v}</button>)}
    </div>
    <label style={{display:"grid",gap:5,fontSize:13,maxWidth:480,fontWeight:600}}>Curso de Medicina vinculado à IES
      <select value={courseId} onChange={e=>setCourseId(e.target.value)} style={{padding:10,borderRadius:8,border:"1px solid #94a3b8"}}>
        <option value="">Selecionar curso</option>
        {medCourses.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.display_name??c.name)} · {String(c.code??"sem código")}</option>)}
      </select>
    </label>
    {!medCourses.length?<p role="status">Nenhum curso de Medicina identificado no cadastro desta IES. Não foi criado curso fictício.</p>:null}
    {section==="fontes"?<div>
      <p style={{fontSize:13}}>Documentos oficiais de acesso público. Nenhum indicador é exibido como homologado sem arquivo, edição, método de cálculo e validação.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
        {SOURCES.map(s=><article key={s.url} style={{border:"1px solid #d8e2eb",background:"#fff",borderRadius:10,padding:14}}>
          <strong>{s.label}</strong><p style={{fontSize:13}}>{s.purpose}</p>
          <a href={s.url} target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a>
        </article>)}
      </div>
      <p style={{fontSize:12,marginTop:12}}>Corpus documental de 17/11/2026: oito PDFs de provas/gabaritos preliminares e cinco documentos normativos recuperados com SHA-256. Consulte Documentos verificados para origem e identificação dos arquivos. Integridade do arquivo não equivale à homologação clínica; gabaritos preliminares não são definitivos.</p>
    </div>:null}
    {section==="curriculo"?<div>
      <h4>Integração curricular e pedagógica</h4>
      <p>{course?<>Curso selecionado: <strong>{String(course.display_name??course.name)}</strong> (ID institucional {String(course.id)}).</>:"Selecione um curso para contextualizar o planejamento; nenhuma associação será presumida."}</p>
      <ol style={{lineHeight:1.8}}>
        <li>Conferir prova, gabarito, matriz e relatório do Inep, com versão e data.</li>
        <li>Vincular competências oficiais às Trilhas ENADE existentes, especializadas para Medicina.</li>
        <li>Relacionar itens do ENAMED e simulados de Residência Médica mantidos no Fato & Ordem, sem duplicar bancos.</li>
        <li>Encaminhar indicadores validados ao Sapiens 360°; intervenções exigem revisão e aprovação.</li>
        <li>Publicar ações autorizadas no Planejamento Estratégico e 5W2H com evidências.</li>
      </ol>
      <button type="button" onClick={onPlan} style={{padding:"10px 14px",borderRadius:8,background:"#174c78",color:"white",border:0,cursor:"pointer"}}>Abrir planejamento estratégico</button>
    </div>:null}
    {section==="integracao"?<EnamedFatoOrdemMetrics institutionId={institutionId} courseId={courseId}/>:null}
    {section==="auditoria"?<EnamedEditorialEvidence/>:null}
    {section==="documentos"?<EnamedVerifiedSources/>:null}
    <footer style={{fontSize:12,marginTop:14,borderTop:"1px solid #ccd9e6",paddingTop:10}}>Escopo institucional: {institutionId ? "ambiente da IES selecionada" : "IES não definida"} · Separar indicador oficial, dado interno e proposta Sapiens · Respeitar RLS/LGPD.</footer>
  </section>;
}
