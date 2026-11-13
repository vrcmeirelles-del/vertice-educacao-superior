import { HelpLabel } from '@/components/ContextHelp';
import {useMemo,useState} from "react";
import {ArrowRight,BookOpenCheck,Building2,Check,ClipboardCopy,ExternalLink,FileCheck2,GraduationCap,Link2,ShieldCheck,TrendingUp,Users} from "lucide-react";
import type {DemoInstitutionMode} from "@/lib/demo-showroom";

const FATO_ORDEM="https://www.fatoeordem.com.br";
const VERTICE="https://www.verticesuperior.com.br";
const modes:{id:DemoInstitutionMode;title:string;description:string}[]=[
 {id:"faculdade",title:"Faculdade",description:"Cursos, disciplinas, estudantes e decisões integradas"},
 {id:"centro",title:"Centro universitário",description:"Visão gerencial de múltiplos cursos e indicadores"},
 {id:"universidade",title:"Universidade",description:"Gestão integrada e acompanhamento em diferentes áreas"},
];
type Props={mode:DemoInstitutionMode;name:string;email:string;verticeInvite:string;onCreateVertice:()=>void};
const makeFoUrl=(mode:DemoInstitutionMode)=>FATO_ORDEM+"/demonstracao-ies?"+new URLSearchParams({
 porte:mode,perfil:"reitor",curso:"all"
});
const makeVerticeUrl=(mode:DemoInstitutionMode)=>VERTICE+"/demonstracao?perfil="+encodeURIComponent(mode);
function validFoInvitation(value:string):string|null{
 try{
  const url=new URL(value.trim());
  if(url.protocol!=="https:"||!["www.fatoeordem.com.br","fatoeordem.com.br"].includes(url.hostname)
    ||url.pathname!=="/demonstracao-ies"||url.username||url.password)return null;
  if(!/^#convite=[A-Za-z0-9_-]{43}$/u.test(url.hash))return null;
  return url.href;
 }catch{return null;}
}
export default function MasterCommercialSuite({mode,name,email,verticeInvite,onCreateVertice}:Props){
 const [foInvitation,setFoInvitation]=useState("");
 const [notice,setNotice]=useState("");
 const foPrivate=useMemo(()=>validFoInvitation(foInvitation),[foInvitation]);
 const invalidInvitation=foInvitation.trim().length>0&&!foPrivate;
 const foLink=foPrivate||makeFoUrl(mode);
 const verticeLink=verticeInvite||makeVerticeUrl(mode);
 const addressee=name.trim()||"Gestor(a)";
 const subject="Convite | Conheça a Vértice + Fato & Ordem";
 const body=useMemo(()=>[
  "CONVITE EXCLUSIVO | VÉRTICE + FATO & ORDEM",
  "",
  "Olá, "+addressee+"!",
  "",
  "Sua instituição acompanha quantos estudantes ingressam, renovam a matrícula e recebem boas notas. Mas consegue identificar, com evidências, o que eles realmente aprenderam? Ou quais competências precisam ser desenvolvidas antes de uma avaliação externa?",
  "",
  "Quando dados de matrícula, evasão, reprovações, atividades docentes e resultados de aprendizagem ficam separados, decisões importantes chegam tarde. E planejar crescimento, qualidade acadêmica e conformidade regulatória fica muito mais difícil.",
  "",
  "A VÉRTICE organiza a gestão: indicadores, matrículas, captação, permanência, evidências para processos regulatórios, acompanhamento de metas e planos de ação 5W2H, com visões para coordenação e reitoria.",
  "",
  "O FATO & ORDEM apoia o desenvolvimento dos estudantes: estudos e simulados, OAB, Carreiras Jurídicas, CFC, ENADE e Enamed (Medicina), devolutivas e acompanhamento longitudinal por competência, respeitando a disponibilidade e validação das bases de questões.",
  "",
  "JUNTOS, a proposta é conectar currículo, disciplinas e evidências de aprendizagem para apoiar intervenções pedagógicas e decisões institucionais. A integração real de resultados individuais depende de credenciamento, matrícula verificada e autorizações adequadas; os links abaixo mostram cenários fictícios.",
  "",
  "CONHEÇA OS DOIS AMBIENTES DEMONSTRATIVOS:",
  "Vértice: "+verticeLink,
  "Fato & Ordem: "+foLink,
  "",
  "Agende uma demonstração guiada e descubra como a Vértice e o Fato & Ordem podem apoiar as prioridades acadêmicas e estratégicas da sua instituição.",
  "",
  "Responda a esta mensagem para alinharmos uma apresentação e os próximos passos.",
  "",
  "Vértice Educação Superior | Fato & Ordem",
 ].join("\n"),[addressee,verticeLink,foLink]);
 const copy=async(value:string,label:string)=>{
  try{await navigator.clipboard.writeText(value);setNotice(label+" copiado para a área de transferência.");}
  catch{setNotice("O navegador impediu a cópia automática. Selecione o texto e copie manualmente.");}
 };
 return <section className="vcds" aria-label="Apresentação comercial integrada Vértice e Fato & Ordem">
  <header className="vcds-hero">
   <span className="vcds-eyebrow">APRESENTAÇÃO INSTITUCIONAL · DUAS SOLUÇÕES, UMA VISÃO DE APRENDIZAGEM</span>
   <h2>A nota está no sistema. <em>Mas a aprendizagem está comprovada?</em></h2>
   <p>Uma IES pode conhecer suas matrículas, controlar suas avaliações e ainda descobrir tarde demais a evasão, a fragilidade em competências essenciais ou a ausência de evidências para uma decisão da reitoria. <strong>Vértice + Fato & Ordem</strong> aproximam a gestão acadêmica do desenvolvimento efetivo do estudante.</p>
   <div className="vcds-actions">
    <button className="corp-button" type="button" onClick={onCreateVertice}>Preparar convite comercial <ArrowRight size={16}/></button>
    <button className="corp-button vcds-outline" type="button" onClick={()=>void copy(body,"Apresentação com chamada para ação")}><ClipboardCopy size={16}/> Copiar apresentação persuasiva</button>
   </div>
  </header>
  <div className="vcds-problems" aria-label="Dores que impactam a instituição">
   <article><TrendingUp size={21}/><strong>Captação sem permanência</strong><p>Investir para atrair estudantes sem enxergar a trajetória, as renovações e os pontos de abandono.</p></article>
   <article><GraduationCap size={21}/><strong>Nota sem evidência externa</strong><p>O estudante vai bem na disciplina, mas a instituição ainda não sabe como ele responde às competências de exames externos.</p></article>
   <article><FileCheck2 size={21}/><strong>Gestão regulatória dispersa</strong><p>Documentos, metas e providências espalhados tornam a prestação de contas mais difícil.</p></article>
   <article><Users size={21}/><strong>Intervenção pedagógica tardia</strong><p>Docentes e coordenações precisam de sinais acionáveis, não apenas planilhas ao fim do semestre.</p></article>
  </div>
  <div className="vcds-product-grid">
   <article>
    <div className="vcds-product-title"><Building2 size={26}/><div><span>GESTÃO E INTELIGÊNCIA INSTITUCIONAL</span><h3>Vértice Educação Superior</h3></div></div>
    <p>Transforma registros institucionais em informação gerencial para planejar, acompanhar e agir.</p>
    <ul>
     <li>BI de matrículas, captação, permanência e reprovações com comparações históricas</li>
     <li>Governança MEC/INEP, repositório documental e rastreabilidade de evidências</li>
     <li>Metas, responsáveis, prazos, intervenções e planos de ação 5W2H</li>
     <li>Visão institucional por curso, coordenação e reitoria, conforme as permissões</li>
     <li>Radar de coerência avaliativa quando existem dados e vínculos validados</li>
    </ul>
    <a href={makeVerticeUrl(mode)} target="_blank" rel="noopener noreferrer">Explorar a Vértice em cenário fictício <ExternalLink size={15}/></a>
   </article>
   <article>
    <div className="vcds-product-title"><BookOpenCheck size={26}/><div><span>PRÁTICA E INTELIGÊNCIA PEDAGÓGICA</span><h3>Fato & Ordem</h3></div></div>
    <p>Promove estudo orientado por questões, devolutivas e acompanhamento da evolução do estudante.</p>
    <ul>
     <li>Preparação para OAB, Carreiras Jurídicas, CFC, ENADE e Enamed (Medicina), conforme o acervo validado disponível</li>
     <li>Questões objetivas, discursivas e imagens nos módulos que comportam esses recursos</li>
     <li>Mapeamento de erros, temas, confiança e competências nas atividades registradas</li>
     <li>Práticas e simulados com espaço para acompanhamento docente</li>
     <li>Aprendizagem longitudinal e suporte a intervenções de revisão</li>
    </ul>
    <a href={makeFoUrl(mode)} target="_blank" rel="noopener noreferrer">Explorar o campus demonstrativo Fato & Ordem <ExternalLink size={15}/></a>
   </article>
  </div>
  <div className="vcds-qualification">
   <ShieldCheck size={23}/>
   <p><strong>Oferta responsável:</strong> as demonstrações contêm dados fictícios. A transmissão real de desempenho entre as plataformas não é ativada por um convite; depende de integração configurada, matrícula confirmada, finalidade documentada e controles de acesso. A disponibilidade de questões oficiais e serviços automatizados depende de curadoria e homologação.</p>
  </div>
  <section className="vcds-links" aria-label="Links de convite Fato e Ordem e Vértice">
   <header>
    <span className="vcds-eyebrow">ACESSOS PRONTOS PARA APRESENTAÇÃO</span>
    <h3>Convites e vitrines das duas plataformas</h3>
    <p>Você pode enviar links públicos de cenário fictício ou criar convites privados nos respectivos sistemas. Os convites com token são administrados separadamente e não devem ser enviados a pessoas não autorizadas.</p>
   </header>
   <div className="vcds-modes">
    {modes.map(m=><div key={m.id} className="vcds-mode">
      <strong>{m.title}</strong><span>{m.description}</span>
      <a href={makeVerticeUrl(m.id)} target="_blank" rel="noopener noreferrer">Vértice <ExternalLink size={14}/></a>
      <a href={makeFoUrl(m.id)} target="_blank" rel="noopener noreferrer">Fato & Ordem <ExternalLink size={14}/></a>
      <button type="button" onClick={()=>void copy(makeVerticeUrl(m.id)+"\n"+makeFoUrl(m.id),"Links "+m.title)}><ClipboardCopy size={14}/> Copiar os dois links</button>
    </div>)}
   </div>
   <div className="vcds-admin">
    <div><strong>Emissão dos convites privados</strong><p>Os convites Vértice Experience são emitidos nesta página. O Fato & Ordem tem seu próprio gerenciador, com login administrativo, escolha de perfil, validade e revogação.</p></div>
    <a href={FATO_ORDEM+"/admin/demonstracao-ies"} target="_blank" rel="noopener noreferrer" className="corp-button vcds-outline">Administrar convites do Fato & Ordem <ExternalLink size={16}/></a>
   </div>
   <HelpLabel className="vcds-token">Convite privado Fato & Ordem (opcional, cole o link gerado no painel de administração)
     <input type="url" value={foInvitation} onChange={e=>{setFoInvitation(e.target.value);setNotice("");}} autoComplete="off" spellCheck={false}
       placeholder="https://www.fatoeordem.com.br/demonstracao-ies#convite=..." aria-invalid={invalidInvitation}/>
     <small>{invalidInvitation?"Use o link HTTPS original do Fato & Ordem, com o fragmento #convite válido.":foPrivate?"Convite temporário reconhecido no formato esperado. Prazo e revogação devem ser conferidos no Fato & Ordem.":"Sem convite privado: a apresentação utilizará o cenário público fictício."}</small>
   </HelpLabel>
  </section>
  <section className="vcds-copy" aria-label="Texto persuasivo para o convidado">
   <div className="vcds-copy-title">
     <div><span className="vcds-eyebrow">MENSAGEM PRONTA PARA ENVIAR</span><h3>Não venda só software. Mostre o problema que a IES pode resolver.</h3>
       <p>Mensagem direcionada a dirigentes institucionais. Se houver um convite privado válido para cada plataforma, ele será utilizado no texto; caso contrário, os links são de demonstrações públicas com dados fictícios.</p>
     </div>
     <button className="corp-button" type="button" onClick={()=>void copy(body,"Convite conjunto Vértice + Fato & Ordem")}>
       <ClipboardCopy size={16}/> Copiar convite conjunto
     </button>
   </div>
   <HelpLabel>Assunto sugerido <input type="text" value={subject} readOnly onFocus={e=>e.currentTarget.select()}/></HelpLabel>
   <HelpLabel>Apresentação comercial com dor, proposta e chamada para ação
     <textarea value={body} readOnly rows={17} onFocus={e=>e.currentTarget.select()}/>
   </HelpLabel>
   <div className="vcds-copy-footer">
    <span><Check size={15}/> Personalizado para {email.trim()||"o destinatário do convite"}</span>
    <span><Link2 size={15}/> Vértice + Fato & Ordem</span>
    <span><ShieldCheck size={15}/> Envio manual, sem disparo automático</span>
   </div>
   {notice&&<p className="vcds-status" role="status">{notice}</p>}
  </section>
 </section>;
}
