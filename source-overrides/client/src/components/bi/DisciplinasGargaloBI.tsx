import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {bottleneckMap,WINDOW,MIN_PAIRS,MIN_LIFT,type OfferingRow,type BottleneckLevel,type TeacherPattern} from "@/lib/bottleneck";

type Course={id:string;name:string;code:string|null};
const LEVEL:Record<BottleneckLevel,string>={persistente:"Gargalo persistente",recente:"Desvio recente",atencao:"Atenção",normal:"Dentro dos pares"};
const COLOR:Record<BottleneckLevel,string>={persistente:"#b4232f",recente:"#a7660c",atencao:"#8a6d12",normal:"#2e6a3f"};
const TEACHER:Record<TeacherPattern,string>={varios_docentes:"Repete com docentes diferentes: indica fator estrutural (conteúdo, posição na matriz, pré-requisitos)",um_docente:"Desvios concentrados nas turmas de um mesmo docente: vale examinar a condução com a coordenação",indefinido:"—"};
const pct=(v:number|null|undefined)=>v==null?"—":`${(v*100).toFixed(1).replace(".",",")}%`;
const fmt=(v:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(v);
const COLS="course_code,discipline,semester,teachers,passed_direct,passed_final,source_failures,rf,rn,ra,other_status";

/** Mapa de disciplinas-gargalo: reprovação acima dos pares do curso, de forma repetida, validada nos dados. */
export default function DisciplinasGargaloBI({institutionId,courses}:{institutionId:string;courses:Course[]}){
 const [rows,setRows]=useState<OfferingRow[]|null>(null);
 const [error,setError]=useState("");
 const [course,setCourse]=useState("");
 const [all,setAll]=useState(false);
 useEffect(()=>{
  let alive=true;setRows(null);setError("");
  void (async()=>{
   const out:OfferingRow[]=[];
   for(let page=0;;page++){
    const {data,error:e}=await supabase.from("vertice_offering_outcomes").select(COLS).eq("institution_id",institutionId).order("id").range(page*1000,page*1000+999);
    if(e)throw e;out.push(...(data??[]) as OfferingRow[]);if(!data||data.length<1000)break;
   }
   return out;
  })().then(r=>{if(alive)setRows(r);}).catch(()=>{if(alive)setError("Não foi possível consultar os resultados das ofertas. Verifique o acesso institucional.");});
  return()=>{alive=false;};
 },[institutionId]);
 const result=useMemo(()=>rows?bottleneckMap(rows):null,[rows]);
 const courseName=(code:string)=>courses.find(c=>c.code===code)?.name??`Curso ${code}`;
 if(error)return <p role="alert" className="vxa-error">{error}</p>;
 if(!result)return <p role="status">Calculando o mapa de disciplinas-gargalo…</p>;
 const {validation:v,disciplines}=result;
 const persistent=disciplines.filter(d=>d.level==="persistente");
 const positive=disciplines.reduce((s,d)=>s+Math.max(0,d.excess),0);
 const persistentExcess=persistent.reduce((s,d)=>s+d.excess,0);
 const codes=[...new Set(disciplines.map(d=>d.course))].sort((a,b)=>courseName(a).localeCompare(courseName(b)));
 const shown=v.ready?disciplines.filter(d=>(!course||d.course===course)&&(all||d.level!=="normal")):[];
 return <div className="vxa-card">
  <h3>Mapa de disciplinas-gargalo</h3>
  <p>Cada oferta é comparada às demais <strong>do mesmo curso no mesmo semestre</strong>, pela taxa de reprovação (por falta, nota ou aproveitamento) entre os que tiveram resultado. Gargalo é a disciplina que reprova acima dos pares de forma repetida nos últimos {WINDOW} semestres com resultado. O ranking segue o <strong>excesso de reprovações</strong>: quantas matrículas reprovaram além do esperado pelos pares.</p>
  {v.ready?<>
   <div className="vxa-submetrics" aria-label="Resumo e validação">
    <article><small>Gargalos persistentes</small><strong>{persistent.length}</strong><span>de {disciplines.length} disciplinas com resultado</span></article>
    <article><small>Excesso concentrado</small><strong>{positive?pct(persistentExcess/positive):"—"}</strong><span>{fmt(persistentExcess)} de {fmt(positive)} reprovações acima do esperado</span></article>
    <article><small>Acerto do sinal</small><strong>{pct(v.hitRate)}</strong><span>oferta com desvio seguiu acima dos pares na seguinte (acaso: {pct(v.baseRate)})</span></article>
    <article><small>Comparações no histórico</small><strong>{v.pairs}</strong><span>correlação {v.corr==null?"—":v.corr.toFixed(2).replace(".",",")} entre ofertas</span></article>
   </div>
   <div className="vxa-filters">
    <label>Curso<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Todos os cursos</option>{codes.map(c=><option key={c} value={c}>{courseName(c)}</option>)}</select></label>
    <label style={{display:"flex",gap:8,alignItems:"center",alignSelf:"end"}}><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} style={{width:"auto"}}/>Mostrar disciplinas dentro dos pares</label>
   </div>
   {shown.length?<div className="vxa-scroll"><table>
    <thead><tr><th>Disciplina</th><th>Curso</th><th>Nível</th><th>Reprovações × esperado</th><th>Excesso</th><th>Ofertas com desvio forte</th><th>Por falta</th><th>Padrão</th></tr></thead>
    <tbody>{shown.slice(0,200).map(d=><tr key={d.course+d.discipline}>
     <td><details><summary>{d.discipline}</summary>{d.offerings.map(o=><div key={o.semester}><small>{o.semester}: {pct(o.rate)} × {pct(o.peerRate)} pares · {o.n} com resultado{o.teachers?` · ${o.teachers}`:""}</small></div>)}</details></td>
     <td>{courseName(d.course)}</td>
     <td><strong style={{color:COLOR[d.level]}}>{LEVEL[d.level]}</strong></td>
     <td>{fmt(d.failures)} × {fmt(d.expected)}</td>
     <td><strong>{d.excess>0?"+":""}{fmt(d.excess)}</strong></td>
     <td>{d.strong} de {d.offerings.length}</td>
     <td>{pct(d.absenceShare)}</td>
     <td><small>{TEACHER[d.teacherPattern]}</small></td>
    </tr>)}</tbody>
   </table></div>:<p>Nenhuma disciplina fora do padrão com os filtros atuais.</p>}
  </>:<p className="vxa-alert" role="status"><strong>Mapa não publicado.</strong> {v.reason} O mapa só aparece quando, nos dados desta instituição, o desvio de uma oferta antecipa o da oferta seguinte ao menos {Math.round(MIN_LIFT*100)} pontos acima do acaso, com no mínimo {MIN_PAIRS} comparações.</p>}
  <p className="vxa-source"><strong>Como ler:</strong> "Gargalo persistente" = duas ou mais ofertas com desvio forte (≥ 2) e desvio acumulado ≥ 2 na janela; "Desvio recente" = desvio forte na oferta mais recente; "Atenção" = desvio acumulado ≥ 1,5. Ofertas com menos de 10 resultados, com mais de 10% ainda cursando ou em prova final e cursos com menos de 5 ofertas no semestre não são comparados. Reprovação alta por falta sugere abandono da disciplina, não só dificuldade de conteúdo. O padrão de docente é descritivo e não constitui avaliação individual. Fonte: vertice_offering_outcomes.</p>
 </div>;
}
