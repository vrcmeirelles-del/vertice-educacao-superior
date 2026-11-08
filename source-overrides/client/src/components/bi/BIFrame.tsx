import type {ReactNode} from "react";
import "./bi-frame.css";

type View = "reitoria" | "captacao" | "academico" | "executivo";
const MODULES: {id:View;title:string;symbol:string;hash:string}[]=[
 {id:"reitoria",title:"BI da Reitoria",symbol:"▥",hash:"bi=1"},
 {id:"captacao",title:"BI de Captação",symbol:"◎",hash:"captacao=1"},
 {id:"academico",title:"BI Acadêmico",symbol:"▤",hash:"academico=1"},
 {id:"executivo",title:"Painel Executivo",symbol:"◇",hash:"painel-bi=1"}
];
export default function BIFrame({view,children,institutionName,source,sourceStatus="consultar",sourceUpdatedAt}:{
 view:View;children:ReactNode;institutionName?:string;source:string;
 sourceStatus?:"consultar"|"integrado"|"parcial"|"indisponivel";
 sourceUpdatedAt?:string|null;
}){
 const name=MODULES.find(m=>m.id===view)?.title??"BI Vértice";
 const status=sourceStatus==="indisponivel"?"Fonte não disponibilizada":sourceStatus==="parcial"?"Cobertura parcial":sourceStatus==="integrado"?"Fonte integrada":"Consultar cobertura dos dados";
 return <section className="vx-bi-unified" aria-label={name}>
  <aside className="vx-bi-unified-side" aria-label="Navegação dos BIs">
   <div className="vx-bi-unified-brand"><b>V</b><div><strong>Vértice</strong><small>Educação Superior</small></div></div>
   <nav>{MODULES.map(module=><a key={module.id} href={"/master#"+module.hash} aria-current={view===module.id?"page":undefined}><span aria-hidden="true">{module.symbol}</span>{module.title}</a>)}</nav>
   <p className="vx-bi-unified-side-note">Inteligência para <strong>Reitoria e Gestão</strong><small>Dados institucionais · sem informações fictícias</small></p>
  </aside>
  <div className="vx-bi-unified-main">
   <div className="vx-bi-unified-heading"><div><small>VÉRTICE · INTELIGÊNCIA INSTITUCIONAL</small><h2>{name}</h2>{institutionName&&<p>{institutionName}</p>}</div><span>Dados reais · sem projeções não fundamentadas</span></div>
   <div className="vx-bi-unified-data" role="note">
    <strong>Origem: {source}</strong><span>Estado: {status}</span>
    {sourceUpdatedAt&&<span>Última consulta: {sourceUpdatedAt}</span>}
    <span>Sem dados ≠ zero · valores sujeitos à cobertura, conciliação e validação da origem</span>
   </div>
   <div className="vx-bi-unified-content">{children}</div>
  </div>
 </section>;
}
