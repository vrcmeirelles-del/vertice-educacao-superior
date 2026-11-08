import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import "./direito-raio-x.css";

interface Props { institutionId: string }

const UNITOP_ID = "1f5fd5b4-93c6-4626-834d-136884915587";
const SEM_IDS: Record<string,number> = {"2023/01":41,"2023/02":42,"2024/01":43,"2024/02":44,"2025/01":45,"2025/02":46,"2026/01":47};
const GHOST_SITS = new Set(["CA","RF","AC","AB","TR"]);
const SIT_LABELS: Record<string,string> = {AD:"Aprovado Direto",AF:"Aprovado Final",RF:"Reprov. Falta",RN:"Reprov. Nota",RA:"Reprov. Ambos",TR:"Transferido",CA:"Cancelado",AC:"Abandono",CR:"Concluído c/ Ressalva",AB:"Abandono"};

type CompareMode = "anterior"|"homologo"|"livre";
const valueNum=(v:unknown):number=>typeof v==="number"&&Number.isFinite(v)?v:Number(v)||0;
function movement(s:any){
  const withdrawn=valueNum(s?.trancado),abandoned=valueNum(s?.abandono),canceled=valueNum(s?.cancelado),transferred=valueNum(s?.transferido),changed=valueNum(s?.troca_curso);
  const out=withdrawn+abandoned+canceled+transferred+changed;
  const active=valueNum(s?.matriculados),pre=valueNum(s?.pre_matriculado),finished=valueNum(s?.concluido)+valueNum(s?.graduado);
  const denominator=active+pre+finished+out;
  return {out,active,pre,finished,denominator,rate:denominator>0?100*out/denominator:null};
}
function occupancy(s:any){
  const enrolled=valueNum(s?.matriculados),vacancies=valueNum(s?.vagas);
  return vacancies>0?100*enrolled/vacancies:null;
}
const SEM_POR_ID: Record<number,string> = Object.fromEntries(
  Object.entries(SEM_IDS).map(([sem, id]) => [id, sem]),
) as Record<number,string>;

// Um 403 do PostgREST significa falta de GRANT na tabela, nao ausencia de registro.
// Exibir "nenhum registro" nesse caso esconde o defeito real.
function motivoBloqueio(error: any): string {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "");
  if (code === "42501" || /permission denied/i.test(msg)) {
    return "Sem permissão de leitura nos dados nominais. Falta GRANT SELECT em vertice_eorbit_alunos para o papel authenticated — a regra de acesso (sessão com segundo fator e papel gestor/reitor/diretor/master) continua valendo e não foi afrouxada.";
  }
  return `Não foi possível ler os dados nominais${msg ? `: ${msg}` : "."}`;
}

export default function DireitoRaioX({ institutionId }: Props) {
  const [semData, setSemData] = useState<any[]>([]);
  const [turmaData, setTurmaData] = useState<any[]>([]);
  const [profData, setProfData] = useState<any>(null);
  const [quantGeral, setQuantGeral] = useState<any>(null);
  const [docenteEvo, setDocenteEvo] = useState<any>(null);
  const [serieReal, setSerieReal] = useState<any>(null);
  const [sourceStatus, setSourceStatus] = useState<"ready"|"pending_mapping"|"error">("pending_mapping");
  const [sourceDate, setSourceDate] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [openSem, setOpenSem] = useState<string|null>(null);
  const [openTurma, setOpenTurma] = useState<string|null>(null);
  const [turmaAlunos, setTurmaAlunos] = useState<Record<string, any[]>>({});
  const [loadingTurma, setLoadingTurma] = useState<string|null>(null);
  const [turmaErro, setTurmaErro] = useState<Record<string,string>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterErro, setRosterErro] = useState<string>("");
  const [buscaAluno, setBuscaAluno] = useState("");
  const [docenciaOfertas,setDocenciaOfertas]=useState<{id:string;semestre:string;curso:string;turma:string;periodo:string;nome:string;disciplina:string;rf:number;rn:number;ra:number;matriculas:number}[]>([]);
  const [docenciaStatus,setDocenciaStatus]=useState<"loading"|"ready"|"error">("loading");
  const [docenciaSem,setDocenciaSem]=useState("2026/02");
  const [docenciaCompare,setDocenciaCompare]=useState("2025/02");
  const [docenciaBusca,setDocenciaBusca]=useState("");
  const [ingressoSem,setIngressoSem]=useState("2026/01");
  const [ingressoCategory,setIngressoCategory]=useState<"primeiro"|"avancado"|"continuidade"|"realocado"|"todos">("todos");
  const [ingressoBusca,setIngressoBusca]=useState("");

  const [rankingSemestre,setRankingSemestre]=useState("todos");
  const [rankingSelecionado,setRankingSelecionado]=useState<string|null>(null);
  const [ofertaSelecionada,setOfertaSelecionada]=useState<string|null>(null);
  const [selectedSem,setSelectedSem]=useState("");
  const [compareMode,setCompareMode]=useState<CompareMode>("homologo");
  const [comparisonSem,setComparisonSem]=useState("");
  const [selectedMetric,setSelectedMetric]=useState("");
  const [selectedYear,setSelectedYear]=useState("");
  const [comparisonYear,setComparisonYear]=useState("");


  useEffect(() => {
    let active = true;
    setSemData([]); setTurmaData([]); setProfData(null); setQuantGeral(null);
    setDocenteEvo(null); setSerieReal(null); setSourceStatus("pending_mapping");
    setSourceDate(null); setLoading(true);setDocenciaOfertas([]);setDocenciaStatus("loading");
    (async()=>{
      const {data,error}=await supabase.from("vertice_offering_outcomes")
        .select("id,semester,course_code,class_label,academic_period,teachers,discipline,rf,rn,ra,discipline_enrollments").eq("institution_id",institutionId).eq("course_code","027")
        .gte("semester","2023/01").lte("semester","2026/02").order("semester",{ascending:true}).limit(1000);
      if(!active)return;
      if(error){setDocenciaStatus("error");return;}
      const items=(data??[]).flatMap(row=>{
        const name=String(row.teachers??"").trim();
        if(!name)return [];
        return [{id:String(row.id),semestre:String(row.semester),curso:String(row.course_code??"027"),turma:String(row.class_label??""),periodo:String(row.academic_period??""),nome:name,disciplina:String(row.discipline??"Disciplina não identificada"),rf:Math.max(0,Number(row.rf)||0),rn:Math.max(0,Number(row.rn)||0),ra:Math.max(0,Number(row.ra)||0),matriculas:Math.max(0,Number(row.discipline_enrollments)||0)}];
      });
      setDocenciaOfertas(items);
      setDocenciaStatus("ready");
    })();
    if (institutionId !== UNITOP_ID) { setLoading(false); return () => { active = false; }; }
    (async () => {
      try {
        const [courseStats, classStats, source, nominal] = await Promise.all([
          supabase.from("vertice_course_semester_stats").select("*").eq("institution_id", institutionId).ilike("curso", "%DIREITO%").order("semestre"),
          supabase.from("vertice_turma_stats").select("*").eq("institution_id", institutionId).ilike("curso", "%DIREITO%").order("semestre"),
          supabase.from("vertice_eorbit_direito_raio_x").select("tipo,dados,data_extracao,created_at").eq("institution_id", institutionId).order("created_at"),
          supabase.from("vertice_eorbit_alunos").select("nome_aluno,matricula,situacao,turma_nome,semestre_id,periodo").eq("curso_id", 46).order("nome_aluno"),
        ]);
        if (!active) return;
        if (courseStats.error || classStats.error || source.error) { setSourceStatus("error"); return; }
        if (nominal.error) { setRosterErro(motivoBloqueio(nominal.error)); setRoster([]); }
        else { setRosterErro(""); setRoster(nominal.data ?? []); }
        setSemData(courseStats.data ?? []);
        setTurmaData(classStats.data ?? []);
        const rx = source.data ?? [];
        if (rx.length === 0) { setSourceStatus("pending_mapping"); return; }
        setSourceStatus("ready");
        const dates = rx.map(r => r.data_extracao).filter(Boolean).sort();
        setSourceDate(dates.length ? new Date(dates[dates.length - 1] + "T12:00:00").toLocaleDateString("pt-BR") : null);
        const qg = rx.find(r => r.tipo === "quantitativo_geral"); if (qg) setQuantGeral(qg.dados);
        const pe = rx.find(r => r.tipo === "professor_disciplina"); if (pe) setProfData(pe.dados);
        const de = rx.find(r => r.tipo === "corpo_docente_evolucao"); if (de) setDocenteEvo(de.dados);
        const sr = rx.find(r => r.tipo === "serie_historica_real"); if (sr) setSerieReal(sr.dados);
      } catch { if (active) setSourceStatus("error"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [institutionId]);

  const toggleSem = useCallback((sem: string) => {
    setOpenSem(prev => prev === sem ? null : sem);
    setOpenTurma(null);
  }, []);

  const toggleTurma = useCallback(async (sem: string, turma: string) => {
    const key = `${sem}|${turma}`;
    if (openTurma === key) { setOpenTurma(null); return; }
    setOpenTurma(key);
    if (turmaAlunos[key]) return;
    const semId = SEM_IDS[sem];
    if (!semId) return;
    setLoadingTurma(key);
    try {
      const { data, error } = await supabase.from("vertice_eorbit_alunos")
        .select("nome_aluno,matricula,situacao")
        .eq("semestre_id", semId).eq("curso_id", 46).eq("turma_nome", turma)
        .order("nome_aluno");
      if (error) {
        setTurmaErro(prev => ({...prev, [key]: motivoBloqueio(error)}));
      } else {
        setTurmaErro(prev => { const n = {...prev}; delete n[key]; return n; });
        setTurmaAlunos(prev => ({...prev, [key]: data ?? []}));
      }
    } finally { setLoadingTurma(null); }
  }, [openTurma, turmaAlunos]);

  if (loading) return <div className="drx"><div className="drx-loading"><div className="drx-spinner"/>Carregando Raio-X…</div></div>;
  if (institutionId !== UNITOP_ID) return <section className="drx" style={{padding:24}}><h3>Raio-X do Direito — acesso institucional</h3><p>Este painel utiliza dados do e-ORBIT da UNITOP e não está disponível para outras instituições.</p></section>;
  if (sourceStatus !== "ready") return <section className="drx" style={{padding:24}}><h3>Raio-X do Direito — UNITOP</h3><p>{sourceStatus === "error" ? "Não foi possível validar o acesso aos dados do e-ORBIT." : "Os registros do e-ORBIT estão preservados, mas o identificador institucional legado precisa ser conciliado com o cadastro UNITOP."}</p></section>;

  const latest = semData.length > 0 ? semData[semData.length - 1] : null;
  const prev = semData.length > 1 ? semData[semData.length - 2] : null;
  const matriculadosAtual = latest?.matriculados || 0;
  const matriculadosPrev = prev?.matriculados || 0;
  const crescimento = matriculadosPrev > 0 ? (((matriculadosAtual - matriculadosPrev) / matriculadosPrev) * 100).toFixed(1) : "—";
  const totalGeral = quantGeral?.total_geral || 0;
  const trancados = quantGeral?.status?.TRANCADO || 0;
  const cancelados = quantGeral?.status?.CANCELADO || 0;
  const historicoDocente=(()=>{
    const semesters=["2023/01","2023/02","2024/01","2024/02","2025/01","2025/02","2026/01","2026/02"];
    return semesters.map(semestre=>{
      const rows=docenciaOfertas.filter(r=>r.semestre===semestre);
      const names=new Map<string,{nome:string;disciplinas:Set<string>;ofertas:number}>();
      for(const r of rows){
        const key=r.nome.toLocaleUpperCase("pt-BR").replace(/\\s+/g," ").trim();
        if(!names.has(key))names.set(key,{nome:r.nome,disciplinas:new Set(),ofertas:0});
        const person=names.get(key)!;person.disciplinas.add(r.disciplina);person.ofertas++;
      }
      return {semestre,docentes:[...names.values()].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")),ofertas:rows.length,disponivel:rows.length>0};
    });
  })();
  const profCount=historicoDocente.find(x=>x.semestre==="2026/02")?.docentes.length??null;
  const docenciaAtual=historicoDocente.find(x=>x.semestre===docenciaSem)??historicoDocente[7];
  const docenciaAnterior=historicoDocente.find(x=>x.semestre===docenciaCompare)??historicoDocente[5];
  const docenciaFiltrada=docenciaAtual.docentes.filter(d=>[d.nome,...d.disciplinas].join(" ").toLocaleLowerCase("pt-BR").includes(docenciaBusca.toLocaleLowerCase("pt-BR")));
  const semFiltered = semData.filter(s => s.semestre >= "2023/01");

  // Evasão por coorte de entrada. Cada linha de semData é a situação ATUAL da turma
  // que entrou naquele semestre, não o fluxo ocorrido durante o semestre.
  // Taxa correta = evadidos / (ativos + evadidos). A coluna taxa_evasao do banco
  // divide pelos que ficaram, o que produz valores acima de 100%.
  const coortes = semFiltered.map((s) => {
    const evadidos = (s.trancado||0)+(s.abandono||0)+(s.cancelado||0)+(s.transferido||0)+(s.troca_curso||0);
    const ativos = s.matriculados||0;
    const concluintes = (s.concluido||0)+(s.graduado||0);
    // Coorte inteira: ativos + pre-matriculados + concluintes + evadidos.
    // Mesma base da coluna taxa_evasao do banco. Concluir curso nao e evadir.
    const base = ativos + (s.pre_matriculado||0) + concluintes + evadidos;
    return {
      semestre: String(s.semestre), ano: String(s.semestre).slice(0,4),
      vinculos: base, ativos, evadidos, concluintes,
      trancado: s.trancado||0, cancelado: s.cancelado||0, transferido: s.transferido||0,
      vagas: s.vagas||0, ocupacao: parseFloat(s.taxa_ocupacao)||0,
      taxa: base>0 ? (evadidos/base)*100 : 0,
    };
  }).filter(c => c.vinculos > 0);

  // Evasão acumulada do curso, a partir do quantitativo geral do e-ORBIT.
  const statusGeral = quantGeral?.status ?? {};
  const ativosAcum = (statusGeral.MATRICULADO||0) + (statusGeral.PRE_MATRICULADO||0);
  const evadidosAcum = (statusGeral.TRANCADO||0) + (statusGeral.CANCELADO||0) + (statusGeral.TRANSFERIDO||0) + (statusGeral.ABANDONO||0) + (statusGeral.TROCA_DE_CURSO||0);
  const concluidosAcum = (statusGeral.GRADUADO||0) + (statusGeral.CONCLUIDO||0);
  const baseAcum = totalGeral || (ativosAcum + evadidosAcum + concluidosAcum);
  const taxaAcumulada = baseAcum > 0 ? (evadidosAcum/baseAcum)*100 : 0;

  // Comparação por ano de entrada.
  const anos = [...new Set(coortes.map(c => c.ano))].sort().map((ano) => {
    const rows = coortes.filter(c => c.ano === ano);
    const vinculos = rows.reduce((a,c)=>a+c.vinculos,0);
    const evadidos = rows.reduce((a,c)=>a+c.evadidos,0);
    const ativos = rows.reduce((a,c)=>a+c.ativos,0);
    const concluintes = rows.reduce((a,c)=>a+c.concluintes,0);
    return { ano, vinculos, ativos, evadidos, concluintes, taxa: vinculos>0 ? (evadidos/vinculos)*100 : 0 };
  });

  const periodLabels=semFiltered.map(s=>String(s.semestre)).sort();
  const displayedSem=periodLabels.includes(selectedSem)?selectedSem:(periodLabels.at(-1)??"");
  const selectedPeriod=semFiltered.find(s=>String(s.semestre)===displayedSem);
  const prevIndex=periodLabels.indexOf(displayedSem)-1;
  const previousLabel=prevIndex>=0?periodLabels[prevIndex]:"";
  const homologousLabel=displayedSem?String(Number(displayedSem.slice(0,4))-1)+displayedSem.slice(4):"";
  const selectedOther=periodLabels.includes(comparisonSem)&&comparisonSem!==displayedSem?comparisonSem:(periodLabels.find(sem=>sem!==displayedSem)??"");
  const comparisonLabel=compareMode==="anterior"?previousLabel:compareMode==="homologo"?periodLabels.includes(homologousLabel)?homologousLabel:"":selectedOther;
  const comparisonPeriod=semFiltered.find(s=>String(s.semestre)===comparisonLabel);
  const selectedMove=selectedPeriod?movement(selectedPeriod):null;
  const comparedMove=comparisonPeriod?movement(comparisonPeriod):null;
  const yearsAvailable=anos.map(x=>x.ano);
  const firstYear=yearsAvailable.includes(selectedYear)?selectedYear:(yearsAvailable.at(-1)??"");
  const otherYear=yearsAvailable.includes(comparisonYear)?comparisonYear:(yearsAvailable.at(-2)??"");
  const firstYearRow=anos.find(a=>a.ano===firstYear),otherYearRow=anos.find(a=>a.ano===otherYear);
  const pctChange=(current:number,previous:number)=>previous>0?((current-previous)/previous*100).toFixed(1)+"%":"Não comparável";

  // Diagnostico nominal: um aluno aparece em varias turmas/semestres.
  // Agrupa por matricula (ou nome, quando nao ha matricula) para montar a trajetoria.
  const trajetorias = (() => {
    const mapa = new Map<string, {nome: string; matricula: string; passagens: {sem: string; turma: string; situacao: string; periodo: string}[]}>();
    for (const r of roster) {
      const chave = String(r.matricula || r.nome_aluno || "").trim() || "—";
      if (!mapa.has(chave)) mapa.set(chave, { nome: String(r.nome_aluno ?? "—"), matricula: String(r.matricula ?? "—"), passagens: [] });
      mapa.get(chave)!.passagens.push({
        sem: SEM_POR_ID[Number(r.semestre_id)] ?? String(r.semestre_id),
        turma: String(r.turma_nome ?? "—"),
        situacao: String(r.situacao ?? "—"),
        periodo: String(r.periodo ?? ""),
      });
    }
    return [...mapa.values()].map(a => {
      const passagens = a.passagens.sort((x,y) => x.sem.localeCompare(y.sem));
      const ultima = passagens[passagens.length-1];
      const reprovacoes = passagens.filter(p => p.situacao === "RF" || p.situacao === "RN" || p.situacao === "RA").length;
      const inativo = ultima ? GHOST_SITS.has(ultima.situacao) : false;
      return { ...a, passagens, ultima, reprovacoes, inativo, semestres: passagens.length };
    }).sort((x,y) => y.reprovacoes - x.reprovacoes || x.nome.localeCompare(y.nome));
  })();

  const termoBusca = buscaAluno.trim().toLowerCase();
  const trajetoriasFiltradas = termoBusca
    ? trajetorias.filter(a => a.nome.toLowerCase().includes(termoBusca) || a.matricula.toLowerCase().includes(termoBusca))
    : trajetorias;

  // Auditoria do primeiro registro observado por matrícula. Não é prova de via oficial de ingresso.
  // Usa exatamente a relação nominal já protegida por RLS e MFA no Raio-X; não amplia permissões.
  const ingressoAuditoria=(()=>{
    type Passagem={sem:string;periodo:number;turma:string;situacao:string};
    type Aluno={matricula:string;nome:string;passagens:Passagem[];primeiroSem:string;primeiroPeriodo:number;multiturma:boolean;periodosConflitantes:boolean};
    const byStudent=new Map<string,{matricula:string;nome:string;passagens:Passagem[]}>();
    for(const r of roster){
      const matricula=String(r.matricula??"").trim();
      const sem=SEM_POR_ID[Number(r.semestre_id)]??"";
      const periodo=Number(r.periodo);
      if(!matricula||!sem||!Number.isInteger(periodo)||periodo<1||periodo>12)continue;
      let aluno=byStudent.get(matricula);
      if(!aluno){aluno={matricula,nome:String(r.nome_aluno??"Não identificado"),passagens:[]};byStudent.set(matricula,aluno);}
      const turma=String(r.turma_nome??"Sem identificação");
      if(!aluno.passagens.some(p=>p.sem===sem&&p.periodo===periodo&&p.turma===turma)){
        aluno.passagens.push({sem,periodo,turma,situacao:String(r.situacao??"Não informado")});
      }
    }
    const alunos:Aluno[]=[...byStudent.values()].map(a=>{
      const passagens=a.passagens.sort((p,q)=>p.sem.localeCompare(q.sem)||p.periodo-q.periodo);
      const primeiroSem=passagens[0]?.sem??"";
      const primeiras=passagens.filter(p=>p.sem===primeiroSem);
      const semPeriods=new Map<string,Set<number>>(),semTurmas=new Map<string,Set<string>>();
      for(const p of passagens){
        if(!semPeriods.has(p.sem))semPeriods.set(p.sem,new Set());
        if(!semTurmas.has(p.sem))semTurmas.set(p.sem,new Set());
        semPeriods.get(p.sem)!.add(p.periodo);semTurmas.get(p.sem)!.add(p.turma);
      }
      return {...a,passagens,primeiroSem,primeiroPeriodo:Math.min(...primeiras.map(p=>p.periodo)),
        multiturma:[...semTurmas.values()].some(set=>set.size>1),
        periodosConflitantes:[...semPeriods.values()].some(set=>set.size>1)};
    });
    const semestres=["2023/01","2023/02","2024/01","2024/02","2025/01","2025/02","2026/01","2026/02"];
    const indicadores=semestres.map(sem=>{
      const presentes=alunos.filter(a=>a.passagens.some(p=>p.sem===sem));
      const novos=presentes.filter(a=>a.primeiroSem===sem);
      const continuando=presentes.filter(a=>a.primeiroSem<sem);
      const realocados=presentes.filter(a=>new Set(a.passagens.filter(p=>p.sem===sem).map(p=>p.turma)).size>1);
      const conflitos=presentes.filter(a=>new Set(a.passagens.filter(p=>p.sem===sem).map(p=>p.periodo)).size>1);
      return {sem,disponivel:presentes.length>0,presentes:presentes.length,
        primeiro:novos.filter(a=>a.primeiroPeriodo===1).length,
        avancado:novos.filter(a=>a.primeiroPeriodo>1).length,
        continuidade:continuando.length,realocado:realocados.length,conflitos:conflitos.length};
    });
    return {alunos,indicadores};
  })();
  const ingressoAtual=ingressoAuditoria.indicadores.find(x=>x.sem===ingressoSem)??ingressoAuditoria.indicadores[6];
  const ingressoSelecionados=ingressoAuditoria.alunos.filter(a=>{
    const noSem=a.passagens.filter(p=>p.sem===ingressoSem);
    if(!noSem.length)return false;
    if(ingressoCategory==="primeiro"&&!(a.primeiroSem===ingressoSem&&a.primeiroPeriodo===1))return false;
    if(ingressoCategory==="avancado"&&!(a.primeiroSem===ingressoSem&&a.primeiroPeriodo>1))return false;
    if(ingressoCategory==="continuidade"&&!(a.primeiroSem<ingressoSem))return false;
    if(ingressoCategory==="realocado"&&new Set(noSem.map(p=>p.turma)).size<=1)return false;
    return [a.nome,a.matricula,...noSem.map(p=>p.turma)].join(" ").toLocaleLowerCase("pt-BR").includes(ingressoBusca.toLocaleLowerCase("pt-BR"));
  }).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));

  // Ranking de professores: soma de todas as disciplinas/turmas/semestres desde 2023/01.
  // Professor × oferta × semestre: classificação por ocorrências documentadas, não pessoas únicas.
  // Não usar a tabela antiga professor_resultados: ela não contém linhas para este recorte.
  const rankingProf=(()=>{
    const normalize=(name:string)=>name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR").replace(/\s+/g," ").trim();
    const map=new Map<string,{professor:string;total:number;reprov:number;nota:number;falta:number;ambos:number;disc:Set<string>;sems:Set<string>;ofertas:number}>();
    for(const r of docenciaOfertas){
      if(rankingSemestre!=="todos"&&r.semestre!==rankingSemestre)continue;
      const key=normalize(r.nome);
      if(!key||key.includes("PROFESSOR TESTE")||key.includes("TESTE LIFE"))continue;
      if(!map.has(key))map.set(key,{professor:r.nome,total:0,reprov:0,nota:0,falta:0,ambos:0,disc:new Set(),sems:new Set(),ofertas:0});
      const p=map.get(key)!;
      p.total+=r.matriculas;p.nota+=r.rn;p.falta+=r.rf;p.ambos+=r.ra;
      p.reprov+=r.rf+r.rn+r.ra;p.ofertas++;
      p.disc.add(r.disciplina);p.sems.add(r.semestre);
    }
    return [...map.values()].map(p=>({...p,taxa:p.total>0&&p.reprov<=p.total?100*p.reprov/p.total:null}))
      .sort((a,b)=>b.reprov-a.reprov||b.ofertas-a.ofertas);
  })();

  const corTaxa = (t: number) => t > 40 ? "var(--danger)" : t > 25 ? "var(--warning)" : "var(--success)";
  const chipTaxa = (t: number) => t > 40 ? "drx-chip-red" : t > 25 ? "drx-chip-yellow" : "drx-chip-green";
  const pp = (v: number) => `${v>0?"+":""}${v.toFixed(1)} p.p.`;

  return (
    <div className="drx">
      {/* ── Header ── */}
      <header className="drx-header">
        <div className="drx-header-left">
          <span className="drx-eyebrow">Raio-X Estratégico</span>
          <h2 className="drx-title">Curso de Direito</h2>
          <p className="drx-subtitle">Centro Universitário ITOP — UNITOP · Extração: {sourceDate ?? "—"}</p>
        </div>
        <div className="drx-header-right">
          <div className="drx-badge"><span className="drx-badge-icon">⚖️</span> Presencial · Bacharelado</div>
          <div className="drx-badge drx-badge-accent">{matriculadosAtual} matriculados</div>
        </div>
      </header>

      {/* ── KPIs ── */}
      <div className="drx-kpis">
        {[
          {label:"Matriculados",value:matriculadosAtual,sub:crescimento !== "—" ? `${Number(crescimento)>0?"+":""}${crescimento}%` : "—",color:"var(--primary)",icon:"📊"},
          {label:"Vínculos Totais",value:totalGeral,sub:"base histórica · desde 2023/01",color:"#6366f1",icon:"📋"},
          {label:"Saídas classificadas acumuladas",value:`${taxaAcumulada.toFixed(1)}%`,sub:`${evadidosAcum} de ${baseAcum} com saída classificada`,color:corTaxa(taxaAcumulada),icon:taxaAcumulada>40?"⚠️":taxaAcumulada>25?"⚠️":"✅"},
          {label:"Saídas classificadas da turma mais recente",value:`${(coortes[coortes.length-1]?.taxa ?? 0).toFixed(1)}%`,sub:`turma ${coortes[coortes.length-1]?.semestre ?? "—"} · menos tempo de exposição`,color:"#6366f1",icon:"🆕"},
          {label:"Corpo Docente",value:docenciaStatus==="ready"&&profCount!==null?profCount:"Sem dados",sub:"registrados em ofertas · 2026/02",color:"#7c3aed",icon:"👨‍🏫"},
          {label:"Trancados",value:trancados,sub:totalGeral>0?`${((trancados/totalGeral)*100).toFixed(0)}% do total`:"",color:"var(--warning)",icon:"⏸️"},
          {label:"Cancelados",value:cancelados,sub:totalGeral>0?`${((cancelados/totalGeral)*100).toFixed(0)}% do total`:"",color:"var(--danger)",icon:"❌"},
        ].map((kpi,i) => (
          <button type="button" key={i} className="drx-kpi drx-kpi-action" aria-pressed={selectedMetric===kpi.label} onClick={()=>setSelectedMetric(current=>current===kpi.label?"":kpi.label)} style={{"--kpi-color":kpi.color} as React.CSSProperties} title="Abrir explicação e detalhamento deste indicador">
            <div className="drx-kpi-icon">{kpi.icon}</div>
            <small>{kpi.label}</small>
            <strong>{kpi.value}</strong>
            <span>{kpi.sub}</span><span className="drx-kpi-open">Consultar definição e dados ↗</span>
          </button>
        ))}
      </div>

      {selectedMetric&&<section className="drx-detail" aria-live="polite"><div className="drx-compare-top"><h4>{selectedMetric} · interpretação</h4><button type="button" onClick={()=>setSelectedMetric("")}>Fechar</button></div>
        <p>{({
          "Matriculados":"Estoque de vínculos classificados MATRICULADO no recorte de Direito. Não significa captação nem alunos únicos de toda a instituição.",
          "Vínculos Totais":"Base cumulativa de vínculos e situações informadas desde 2023/01, incluindo estados diferentes. Não é o total atual de matriculados.",
          "Saídas classificadas acumuladas":"Indicador operacional composto por trancamentos, abandonos, cancelamentos, transferências e trocas de curso divididos pela base cumulativa. Transferência e trancamento não são necessariamente evasão definitiva. Não compara turmas de ingresso com tempos de acompanhamento diferentes.",
          "Saídas classificadas da turma mais recente":"Percentual operacional de eventos de saída na turma de ingresso mais recente; por possuir menor tempo de acompanhamento, não deve ser comparado diretamente a turmas que ingressaram há mais tempo.",
          "Corpo Docente":"Nomes distintos identificados nas ofertas do curso de Direito, código 027, no semestre de 2026/02. Não equivale a vínculos empregatícios ativos, nem comprova titulação, jornada ou quantidade de contratos.",
          "Trancados":"Vínculos classificados como trancados; trancamento pode ser temporário e não comprova desligamento definitivo.",
          "Cancelados":"Vínculos classificados como cancelados. A soma de estados não substitui estudo longitudinal por matrícula."
        } as Record<string,string>)[selectedMetric]??"Indicador agregado da fonte acadêmica, sujeito à validação."}</p>
        <p><strong>Como explorar:</strong> utilize a comparação de semestres e o quadro das turmas de ingresso abaixo. Os valores são agregados e não identificam pessoas únicas automaticamente.</p>
      </section>}
      {/* ── Série Histórica Real — Accordion ── */}
      {serieReal?.semestres && (
        <div className="drx-section">
          <div className="drx-section-header">
            <h4>Série Histórica Real — Turmas</h4>
            <p className="drx-sub">Clique no semestre para expandir. Clique na turma para ver alunos nominais.</p>
          </div>
          <div className="drx-accordion">
            {Object.entries(serieReal.semestres).map(([sem, sd]: [string, any]) => {
              const isSemOpen = openSem === sem;
              const turmas = sd.turmas || [];
              const pctFantasma = sd.total_alunos > 0 ? ((sd.total_fantasmas / sd.total_alunos) * 100).toFixed(0) : "0";
              return (
                <div key={sem} className={`drx-acc-item ${isSemOpen ? "drx-acc-open" : ""}`}>
                  <button className="drx-acc-trigger" onClick={() => toggleSem(sem)} type="button">
                    <span className="drx-acc-arrow">{isSemOpen ? "▾" : "▸"}</span>
                    <strong className="drx-acc-sem">{sem}</strong>
                    <span className="drx-chip drx-chip-blue">{turmas.length} turma{turmas.length !== 1 ? "s" : ""}</span>
                    <span className="drx-chip drx-chip-green">{sd.total_alunos} alunos</span>
                    {sd.total_fantasmas > 0 && <span className="drx-chip drx-chip-red">{sd.total_fantasmas} fantasmas · {pctFantasma}%</span>}
                    {sd.nota && <span className="drx-acc-note">{sd.nota}</span>}
                  </button>
                  {isSemOpen && (
                    <div className="drx-acc-body">
                      {turmas.map((t: any, ti: number) => {
                        const s = t.situacoes || {};
                        const turmaKey = `${sem}|${t.turma}`;
                        const isTurmaOpen = openTurma === turmaKey;
                        const alunos = turmaAlunos[turmaKey] || [];
                        const isLoading = loadingTurma === turmaKey;
                        const aprovados = (s.AD||0)+(s.AF||0);
                        const pctAprov = t.alunos_reais > 0 ? Math.round((aprovados/t.alunos_reais)*100) : 0;
                        const pctFant = t.alunos_reais > 0 ? Math.round((t.fantasmas/t.alunos_reais)*100) : 0;
                        const totalCA = (s.CA||0)+(s.AC||0)+(s.CR||0)+(s.AB||0);
                        return (
                          <div key={ti} className={`drx-turma-block ${isTurmaOpen ? "drx-turma-open" : ""}`}>
                            <button className="drx-turma-trigger" onClick={() => toggleTurma(sem, t.turma)} type="button">
                              <div className="drx-turma-main">
                                <span className="drx-turma-arrow">{isTurmaOpen ? "▾" : "▸"}</span>
                                <strong>{t.turma}</strong>
                                <span className="drx-turma-per">{t.periodo}º período</span>
                              </div>
                              <div className="drx-turma-stats">
                                <span className="drx-turma-num">{t.alunos_reais} <small>alunos</small></span>
                                <div className="drx-turma-minibar" title={`${pctAprov}% aprovados · ${pctFant}% fantasmas`}>
                                  <div className="drx-turma-minibar-fill drx-bg-success" style={{width:`${pctAprov}%`}}/>
                                  <div className="drx-turma-minibar-fill drx-bg-danger" style={{width:`${pctFant}%`}}/>
                                </div>
                                <div className="drx-turma-sits">
                                  {s.AD ? <span className="drx-sit drx-sit-ok">AD:{s.AD}</span> : null}
                                  {s.AF ? <span className="drx-sit drx-sit-ok">AF:{s.AF}</span> : null}
                                  {s.RF ? <span className="drx-sit drx-sit-bad">RF:{s.RF}</span> : null}
                                  {s.RN ? <span className="drx-sit drx-sit-warn">RN:{s.RN}</span> : null}
                                  {s.RA ? <span className="drx-sit drx-sit-warn">RA:{s.RA}</span> : null}
                                  {s.TR ? <span className="drx-sit drx-sit-muted">TR:{s.TR}</span> : null}
                                  {totalCA > 0 ? <span className="drx-sit drx-sit-bad">CA:{totalCA}</span> : null}
                                </div>
                                {t.fantasmas > 0 && <span className="drx-ghost-badge">👻 {t.fantasmas}</span>}
                              </div>
                            </button>
                            {isTurmaOpen && (
                              <div className="drx-alunos-panel">
                                {isLoading ? (
                                  <div className="drx-alunos-loading"><div className="drx-spinner"/>Buscando alunos…</div>
                                ) : turmaErro[turmaKey] ? (
                                  <p className="drx-alunos-bloqueado">{turmaErro[turmaKey]}</p>
                                ) : alunos.length === 0 ? (
                                  <p className="drx-alunos-empty">Nenhum registro nominal encontrado para esta turma.</p>
                                ) : (
                                  <>
                                  <div className="drx-alunos-summary">
                                    <span>{alunos.length} alunos</span>
                                    <span>{alunos.filter(a => a.situacao === "AD" || a.situacao === "AF").length} aprovados</span>
                                    <span className="drx-text-danger">{alunos.filter(a => GHOST_SITS.has(a.situacao)).length} fantasmas/inativos</span>
                                  </div>
                                  <table className="drx-table drx-table-alunos">
                                    <thead><tr><th>#</th><th>Matrícula</th><th>Nome do Aluno</th><th>Situação</th><th>Perfil</th></tr></thead>
                                    <tbody>
                                      {alunos.map((a: any, j: number) => {
                                        const isGhost = GHOST_SITS.has(a.situacao);
                                        const isApproved = a.situacao === "AD" || a.situacao === "AF";
                                        return (
                                          <tr key={j} className={isGhost ? "drx-row-ghost" : isApproved ? "drx-row-ok" : ""}>
                                            <td className="drx-cell-num">{j+1}</td>
                                            <td className="drx-cell-mat">{a.matricula}</td>
                                            <td className="drx-cell-name">{a.nome_aluno}</td>
                                            <td><span className={`drx-chip ${isApproved ? "drx-chip-green" : isGhost ? "drx-chip-red" : "drx-chip-yellow"}`}>{a.situacao || "—"}</span> <span className="drx-sit-desc">{SIT_LABELS[a.situacao] || ""}</span></td>
                                            <td>{isGhost ? <span className="drx-profile-ghost">👻 Lead frio</span> : <span className="drx-profile-active">✓ Cursou</span>}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="drx-legend">
            <strong>Fantasma</strong> = sem AV1/AV2, situação CA/RF/AC/AB/TR (matriculou mas nunca cursou) · <strong>Legenda:</strong> AD = Aprovado Direto · AF = Aprovado Final · RF = Reprovado Falta · RN = Reprovado Nota · RA = Reprovado Ambos · TR = Transferido · CA = Cancelado
          </div>
        </div>
      )}

      {/* ── Ranking por professor, origem nas ofertas de Direito ── */}
      <div className="drx-section" id="drx-ranking-professores">
        <div className="drx-section-header">
          <h4>Professores com mais ocorrências de reprovação · desde 2023/01</h4>
          <p className="drx-sub">Dados reais das ofertas do curso de Direito (027), até 2026/02. RF + RN + RA são ocorrências nas disciplinas, não estudantes únicos. O ranking não mede isoladamente desempenho ou qualidade docente.</p>
        </div>
        <div className="drx-compare-controls">
          <label>Período de análise<select value={rankingSemestre} onChange={e=>{setRankingSemestre(e.target.value);setRankingSelecionado(null);}}>
            <option value="todos">Todos · 2023/01 a 2026/02</option>
            {["2023/01","2023/02","2024/01","2024/02","2025/01","2025/02","2026/01","2026/02"].map(t=><option key={t} value={t}>{t}</option>)}
          </select></label>
        </div>
        {docenciaStatus==="loading"?<p className="drx-alunos-loading" role="status">Consultando ocorrências por professor…</p>:
        docenciaStatus==="error"?<p className="drx-alunos-bloqueado" role="alert">A fonte de ofertas não está acessível no momento. Nenhum resultado foi estimado.</p>:
        rankingProf.length===0?<p className="drx-alunos-empty">Não existem ocorrências atribuídas a professores no período escolhido.</p>:<>
          <div className="drx-ranking-summary">
            <div><small>Professores com registros</small><strong>{rankingProf.length}</strong><span>Em ofertas de disciplinas do período</span></div>
            <div><small>Matrículas em disciplinas</small><strong>{rankingProf.reduce((n,p)=>n+p.total,0).toLocaleString("pt-BR")}</strong><span>Não representa alunos únicos</span></div>
            <div><small>Ocorrências RF + RN + RA</small><strong>{rankingProf.reduce((n,p)=>n+p.reprov,0).toLocaleString("pt-BR")}</strong><span>Somatório atribuído às ofertas</span></div>
          </div>
          <div className="drx-ranking-head"><h5>Relação por professor</h5><p>Organizada pelo número de ocorrências registradas, não por qualidade docente. Selecione um professor para consultar disciplinas e semestres.</p></div>
          <div className="drx-ranking-list">
            {rankingProf.map((p,i)=>{
              const expanded=rankingSelecionado===p.professor;
              const rfPct=p.reprov>0?100*p.falta/p.reprov:0;
              const rnPct=p.reprov>0?100*p.nota/p.reprov:0;
              const raPct=p.reprov>0?100*p.ambos/p.reprov:0;
              return <article key={p.professor} className={expanded?"drx-ranking-item expanded":"drx-ranking-item"}>
                <div className="drx-ranking-person">
                  <span className="drx-ranking-place" title={"Posição "+(i+1)+" por ocorrências"}>{String(i+1).padStart(2,"0")}</span>
                  <div className="drx-ranking-identity"><strong>{p.professor}</strong><span>{p.disc.size} disciplina(s) · {p.ofertas} ofertas no período</span></div>
                </div>
                <div className="drx-ranking-numbers">
                  <div><small>Matrículas em disciplinas</small><strong>{p.total.toLocaleString("pt-BR")}</strong></div>
                  <div className="drx-ranking-number-important"><small>Ocorrências</small><strong>{p.reprov.toLocaleString("pt-BR")}</strong></div>
                  <div><small>Índice bruto*</small><strong>{p.taxa===null?"—":p.taxa.toFixed(1)+"%"}</strong></div>
                </div>
                <div className="drx-ranking-breakdown">
                  <div className="drx-ranking-bar" role="img" aria-label={p.falta+" RF por falta; "+p.nota+" RN por nota; "+p.ambos+" RA ambas"}>
                    {p.falta>0&&<span style={{width:rfPct+"%",background:"#d96d50"}}/>}
                    {p.nota>0&&<span style={{width:rnPct+"%",background:"#d9a23f"}}/>}
                    {p.ambos>0&&<span style={{width:raPct+"%",background:"#796fc9"}}/>}
                  </div>
                  <div className="drx-ranking-categories">
                    <span><i className="drx-rf"/> Falta (RF) <b>{p.falta}</b></span>
                    <span><i className="drx-rn"/> Nota (RN) <b>{p.nota}</b></span>
                    <span><i className="drx-ra"/> Ambas (RA) <b>{p.ambos}</b></span>
                  </div>
                </div>
                <button type="button" className="drx-ranking-detail-btn" aria-expanded={expanded} onClick={()=>(setRankingSelecionado(current=>current===p.professor?null:p.professor),setOfertaSelecionada(null))}>{expanded?"Fechar detalhes":"Ver disciplinas"} <span aria-hidden="true">{expanded?"⌃":"⌄"}</span></button>
              </article>;
            })}
          </div>
          {rankingSelecionado&&(()=>{
            const professor=rankingProf.find(p=>p.professor===rankingSelecionado);
            if(!professor)return null;
            const key=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
            const linhas=docenciaOfertas.filter(x=>key(x.nome)===key(professor.professor)&&(rankingSemestre==="todos"||x.semestre===rankingSemestre));
            return <div className="drx-detail" aria-live="polite">
              <div className="drx-compare-top"><h4>{professor.professor} · disciplinas e períodos</h4><button type="button" onClick={()=>{setRankingSelecionado(null);setOfertaSelecionada(null);}}>Fechar</button></div>
              <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Semestre</th><th>Disciplina / turma</th><th>Matrículas em disciplina</th><th>RF</th><th>RN</th><th>RA</th><th>Ocorrências</th><th>Alunos</th></tr></thead>
                <tbody>{linhas.sort((a,b)=>a.semestre.localeCompare(b.semestre)).map(d=><React.Fragment key={d.id}>
                <tr className={ofertaSelecionada===d.id?"drx-row-selected":undefined}>
                  <td>{d.semestre}</td>
                  <td><strong>{d.disciplina}</strong><small className="drx-note"> {d.turma?" · Turma: "+d.turma:" · Turma não identificada na fonte"}</small></td>
                  <td>{d.matriculas}</td><td>{d.rf}</td><td>{d.rn}</td><td>{d.ra}</td><td>{d.rf+d.rn+d.ra}</td>
                  <td><button type="button" className="drx-period-link" aria-expanded={ofertaSelecionada===d.id} onClick={()=>setOfertaSelecionada(current=>current===d.id?null:d.id)}>{ofertaSelecionada===d.id?"Ocultar alunos":"Consultar alunos"} ↗</button></td>
                </tr>
                {ofertaSelecionada===d.id&&<tr className="drx-offering-expand-row"><td colSpan={8}>
                  <div className="drx-offering-detail" role="region" aria-label={"Identificação nominal para "+d.disciplina+" "+d.semestre}>
                    <div><h5>Alunos da oferta · {d.disciplina}</h5><p>{d.semestre} · Curso {d.curso}{d.turma?" · Turma "+d.turma:""} · {d.periodo?"Período "+d.periodo:"Período não informado"}</p></div>
                    <div className="drx-offering-overview">
                      <span><strong>{d.matriculas}</strong><small>Matrículas em disciplina</small></span>
                      <span><strong>{d.rf}</strong><small>RF por falta</small></span>
                      <span><strong>{d.rn}</strong><small>RN por nota</small></span>
                      <span><strong>{d.ra}</strong><small>RA ambas</small></span>
                    </div>
                    <p className="drx-comparison-note"><strong>Identificação nominal pendente.</strong> A fonte atual fornece quantitativos da oferta, mas não uma relação individual confirmada de alunos e situações RF/RN/RA para esta disciplina. Não é seguro associar os nomes de uma turma geral às ocorrências desta oferta.</p>
                    <p className="drx-offering-source">Referência técnica da oferta: {d.id}. Quando houver integração autorizada, esta referência deverá ser conciliada com curso, semestre, turma, disciplina, matrícula e situação final de cada estudante. A consulta nominal ficará restrita aos perfis acadêmicos autorizados.</p>
                  </div>
                </td></tr>}
              </React.Fragment>)}</tbody>
              </table></div>
            </div>;
          })()}
          <div className="drx-legend">*Índice bruto = (RF + RN + RA) ÷ matrículas em disciplinas × 100, quando as categorias não excedem o denominador. Não é taxa de alunos únicos reprovados. O total depende da quantidade de ofertas atribuídas ao docente; reprovações por falta também dependem da frequência dos estudantes. Comparações de qualidade docente exigem análise contextual, cobertura e validação das categorias.</div>
        </>}
      </div>

      {/* ── Origem observada dos ingressantes: análise longitudinal por matrícula ── */}
      <section className="drx-section" id="drx-origem-ingressantes">
        <div className="drx-section-header"><h4>De onde vieram os ingressantes? · 1º período e outras turmas</h4>
          <p className="drx-sub">Cruzamento por matrícula acadêmica nos registros individuais do curso de Direito. Primeiro registro observado não comprova modalidade oficial de ingresso; transferência externa precisa de histórico ou documento de origem.</p>
        </div>
        {rosterErro?<p className="drx-alunos-bloqueado" role="alert">Auditoria individual indisponível: {rosterErro}</p>:
        ingressoAuditoria.alunos.length===0?<p className="drx-alunos-empty">Não existem registros nominais autorizados para distinguir os períodos de ingresso.</p>:<>
          <div className="drx-definitions">
            <p><strong>Primeira vez localizado no 1º período:</strong> matrícula encontrada pela primeira vez em turma do primeiro período. É um indício de ingresso inicial, não prova de captação por vestibular.</p>
            <p><strong>Primeira vez localizado em período avançado:</strong> aluno cujo primeiro registro disponível já está no 2º período ou posterior. Pode ser transferência externa, reingresso, aproveitamento de estudos ou lacuna histórica. <strong>Classificação pendente de validação.</strong></p>
            <p><strong>Continuidade:</strong> a mesma matrícula foi identificada em semestre anterior. Se avançou de período, isso pode corresponder à progressão curricular regular e não a uma nova captação.</p>
            <p><strong>Mais de uma turma no semestre:</strong> o mesmo registro de matrícula aparece em turmas distintas no período. Indica possível remanejamento ou lançamento múltiplo; só o histórico administrativo comprova realocação efetiva.</p>
          </div>
          <div className="drx-compare-controls">
            <label>Semestre observado<select value={ingressoSem} onChange={e=>{setIngressoSem(e.target.value);setIngressoCategory("todos");setIngressoBusca("");}}>
              {ingressoAuditoria.indicadores.map(d=><option key={d.sem} value={d.sem}>{d.sem}{!d.disponivel?" · dados nominais não disponibilizados":""}</option>)}
            </select></label>
            <label>Localizar matrícula ou turma<input type="search" value={ingressoBusca} onChange={e=>setIngressoBusca(e.target.value)} placeholder="Nome, matrícula ou turma" /></label>
          </div>
          <div className="drx-ingresso-kpis">
            {([
              ["todos","Matrículas distintas no semestre",ingressoAtual.presentes],
              ["primeiro","Primeiro registro no 1º período",ingressoAtual.primeiro],
              ["avancado","Primeiro registro em período avançado",ingressoAtual.avancado],
              ["continuidade","Localizadas em semestre anterior",ingressoAtual.continuidade],
              ["realocado","Em mais de uma turma no semestre",ingressoAtual.realocado]
            ] as [typeof ingressoCategory,string,number][]).map(([key,label,value])=>
              <button type="button" key={key} aria-pressed={ingressoCategory===key} className="drx-ingresso-kpi" onClick={()=>setIngressoCategory(key)}><small>{label}</small><strong>{ingressoAtual.disponivel?value:"—"}</strong><span>{key==="avancado"?"Não equivale a transferência comprovada":key==="realocado"?"Conferir o histórico de turma":"Consultar relação de matrículas"} ↗</span></button>
            )}
          </div>
          <div className="drx-table-wrap"><table className="drx-table">
            <thead><tr><th>Semestre</th><th>Matrículas distintas</th><th>Primeiro registro no 1º período</th><th>Primeiro registro em período avançado</th><th>Vínculo localizado anteriormente</th><th>Em mais de uma turma</th><th>Período conflitante*</th></tr></thead>
            <tbody>{ingressoAuditoria.indicadores.map(d=><tr key={d.sem} className={ingressoSem===d.sem?"drx-row-selected":undefined}>
              <td><button type="button" className="drx-period-link" onClick={()=>setIngressoSem(d.sem)}>{d.sem} ↗</button></td>
              <td>{d.disponivel?d.presentes:"Sem dados"}</td><td>{d.disponivel?d.primeiro:"—"}</td><td>{d.disponivel?d.avancado:"—"}</td><td>{d.disponivel?d.continuidade:"—"}</td><td>{d.disponivel?d.realocado:"—"}</td><td>{d.disponivel?d.conflitos:"—"}</td>
            </tr>)}</tbody>
          </table></div>
          <h5 className="drx-evasao-h5">Relação individual no recorte · {ingressoSem}</h5>
          {!ingressoAtual.disponivel?<p className="drx-comparison-note">A base nominal ainda não contém este semestre. Não é possível classificar transferências ou ingressantes em 2026/02 sem atualizar a fonte.</p>:
          <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Matrícula</th><th>Aluno</th><th>Primeiro semestre localizado</th><th>Primeiro período localizado</th><th>Turma(s) neste semestre</th><th>Período(s) neste semestre</th><th>Situação interpretativa</th></tr></thead>
            <tbody>{ingressoSelecionados.slice(0,80).map(a=>{
              const passages=a.passagens.filter(p=>p.sem===ingressoSem);
              const classes=[...new Set(passages.map(p=>p.turma))];
              const periods=[...new Set(passages.map(p=>p.periodo))];
              const categoria=a.primeiroSem===ingressoSem?(a.primeiroPeriodo===1?"Primeiro registro no 1º período":"Primeiro registro em período avançado"): "Vínculo anterior localizado";
              return <tr key={a.matricula}><td>{a.matricula}</td><td>{a.nome}</td><td>{a.primeiroSem}</td><td>{a.primeiroPeriodo}º</td><td>{classes.join(" · ")}</td><td>{periods.join("º · ")}º</td><td>{categoria}{classes.length>1?" · múltiplas turmas":""}{periods.length>1?" · verificar período":""}</td></tr>;
            })}</tbody></table>
            {ingressoSelecionados.length>80&&<p className="drx-evasao-nota">Exibindo 80 dos {ingressoSelecionados.length} registros; refine a busca ou o filtro para analisar os demais.</p>}
            {ingressoSelecionados.length===0&&<p className="drx-evasao-nota">Nenhum registro corresponde ao filtro selecionado.</p>}
          </div>}
          <p className="drx-evasao-nota">*No mesmo semestre, uma matrícula pode ter registros em mais de um período ou turma. Isso exige conciliação; o relatório não substitui a identificação formal da modalidade de ingresso no e-ORBIT. A deduplicação utiliza matrícula do curso, não CPF, e não identifica transferências externas com certeza. Dados individuais restritos aos perfis autorizados pela proteção já existente no Raio-X.</p>
        </>}
      </section>

      {/* ── Crescimento Real ── */}
      {serieReal?.resumo_serie_historica && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Crescimento Real do Curso</h4><p className="drx-sub">Total de alunos reais por semestre — evolução desde a fundação</p></div>
          <div className="drx-table-wrap">
            <table className="drx-table">
              <thead><tr><th>Semestre</th><th>Total Real</th><th>Ingressantes 1º Per.</th><th>Fantasmas</th><th>% Fantasma</th><th>Crescimento</th></tr></thead>
              <tbody>
                {Object.entries(serieReal.resumo_serie_historica).map(([sem, d]: [string, any], i: number, arr: any[]) => {
                  const prevVal = i > 0 ? (arr[i-1][1] as any).total_real : 0;
                  const cresc = prevVal > 0 ? (((d.total_real - prevVal) / prevVal) * 100).toFixed(0) : "—";
                  return (
                    <tr key={sem}>
                      <td><strong>{sem}</strong></td>
                      <td><strong className="drx-big-num">{d.total_real}</strong></td>
                      <td>{d.ingressantes_1per || "—"}{d.obs ? <span className="drx-note"> ({d.obs})</span> : ""}</td>
                      <td>{d.fantasmas > 0 ? <span className="drx-text-danger">{d.fantasmas}</span> : "0"}</td>
                      <td><span className={`drx-chip ${d.pct_fantasma > 10 ? "drx-chip-red" : d.pct_fantasma > 5 ? "drx-chip-yellow" : "drx-chip-green"}`}>{d.pct_fantasma || 0}%</span></td>
                      <td>{cresc !== "—" ? <span className={Number(cresc) > 0 ? "drx-trend-up" : "drx-trend-down"}>{Number(cresc) > 0 ? "▲" : "▼"} {cresc}%</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolução Semestral ── */}
      {semFiltered.length>0&&<div className="drx-section" id="drx-evolucao">
        <div className="drx-section-header"><h4>Evolução Semestral · análise comparativa</h4><p className="drx-sub">Os registros representam turmas de ingresso observadas na extração e sua situação atual; não são necessariamente os estoques de matrículas de cada semestre histórico.</p></div>
        <div className="drx-definitions">
          <p><strong>Relação entre matrículas atuais e vagas da turma de ingresso:</strong> matrículas ativas hoje dos ingressantes daquela turma ÷ vagas registradas para a respectiva turma de entrada × 100. Assim, 245 de 650 vagas correspondem a 37,7%. <strong>Não é ocupação de salas</strong> nem a taxa histórica de preenchimento na data do ingresso. Depende de validar que o denominador são vagas comparáveis.</p>
          <p><strong>Taxa de saída da turma de ingresso:</strong> registros de trancamento, abandono, cancelamento, transferência e troca de curso ÷ base dos alunos dessa turma de ingresso (ativos, pré-matriculados, concluídos e saídas). Trata-se de indicador amplo, não exclusivamente evasão definitiva.</p>
          <p><strong>Δ:</strong> diferença absoluta em matrículas ativas das duas turmas de ingresso. <strong>p.p.</strong> significa pontos percentuais, usados para comparar duas taxas. Turmas que ingressaram há mais tempo tiveram mais tempo para alterações de situação.</p>
        </div>
        <div className="drx-compare-controls">
          <label>Turma de ingresso de referência<select value={displayedSem} onChange={e=>setSelectedSem(e.target.value)}>{periodLabels.map(sem=><option value={sem} key={sem}>{sem}</option>)}</select></label>
          <label>Comparar com<select value={compareMode} onChange={e=>setCompareMode(e.target.value as CompareMode)}><option value="homologo">Mesmo semestre do ano anterior</option><option value="anterior">Turma que ingressou no semestre anterior</option><option value="livre">Selecionar período</option></select></label>
          {compareMode==="livre"&&<label>Outro semestre<select value={selectedOther} onChange={e=>setComparisonSem(e.target.value)}>{periodLabels.filter(sem=>sem!==displayedSem).map(sem=><option value={sem} key={sem}>{sem}</option>)}</select></label>}
        </div>
        <div className="drx-compare-cards">
          <div><small>Turma de ingresso selecionada · {displayedSem}</small><strong>{selectedPeriod?valueNum(selectedPeriod.matriculados):"Sem dados"}</strong><span>Matriculados classificados como ativos</span></div>
          <div><small>Turma de ingresso comparada · {comparisonLabel||"Indisponível"}</small><strong>{comparisonPeriod?valueNum(comparisonPeriod.matriculados):"Sem dados"}</strong><span>Mesmo indicador e critérios</span></div>
          <div><small>Diferença absoluta</small><strong>{selectedPeriod&&comparisonPeriod?valueNum(selectedPeriod.matriculados)-valueNum(comparisonPeriod.matriculados):"—"}</strong><span>Vínculos ativos; não é captação líquida</span></div>
          <div><small>Taxa operacional de saída · diferença</small><strong>{selectedMove?.rate!==null&&selectedMove?.rate!==undefined&&comparedMove?.rate!==null&&comparedMove?.rate!==undefined?(selectedMove.rate-comparedMove.rate).toFixed(1)+" p.p.":"—"}</strong><span>Turmas de ingresso podem ter tempos de acompanhamento diferentes</span></div>
        </div>
        {selectedPeriod&&comparisonPeriod&&<div className="drx-compare-breakdown">
          <h5>Confronto dos indicadores por turma de ingresso</h5>
          <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Medida</th><th>{displayedSem}</th><th>{comparisonLabel}</th><th>Variação / diferença</th></tr></thead><tbody>
            {([
              ["Matrículas ativas",valueNum(selectedPeriod.matriculados),valueNum(comparisonPeriod.matriculados)],
              ["Trancamentos",valueNum(selectedPeriod.trancado),valueNum(comparisonPeriod.trancado)],
              ["Cancelamentos",valueNum(selectedPeriod.cancelado),valueNum(comparisonPeriod.cancelado)],
              ["Transferências",valueNum(selectedPeriod.transferido),valueNum(comparisonPeriod.transferido)],
              ["Vagas registradas",valueNum(selectedPeriod.vagas),valueNum(comparisonPeriod.vagas)]
            ] as [string,number,number][]).map(([name,now,old])=><tr key={name}><td>{name}</td><td>{now}</td><td>{old}</td><td>{now-old>0?"+":""}{now-old} ({pctChange(now,old)})</td></tr>)}
            <tr><td>Relação matrículas/vagas da turma*</td><td>{occupancy(selectedPeriod)===null?"Sem base":occupancy(selectedPeriod)!.toFixed(1)+"%"}</td><td>{occupancy(comparisonPeriod)===null?"Sem base":occupancy(comparisonPeriod)!.toFixed(1)+"%"}</td><td>{occupancy(selectedPeriod)!==null&&occupancy(comparisonPeriod)!==null?(occupancy(selectedPeriod)!-occupancy(comparisonPeriod)!).toFixed(1)+" p.p.":"—"}</td></tr>
            <tr><td>Saídas classificadas / base da turma de ingresso</td><td>{selectedMove?.out} / {selectedMove?.denominator}</td><td>{comparedMove?.out} / {comparedMove?.denominator}</td><td>{selectedMove?.rate!==null&&selectedMove?.rate!==undefined&&comparedMove?.rate!==null&&comparedMove?.rate!==undefined?(selectedMove.rate-comparedMove.rate).toFixed(1)+" p.p.":"—"}</td></tr>
          </tbody></table></div>
          <p className="drx-evasao-nota">*Indicador recalculado a partir dos campos de matrícula e vagas; não mede ocupação física nem vagas originalmente preenchidas. A mudança de tamanho das turmas de ingresso e do tempo de exposição limita interpretações causais.</p>
        </div>}
        {!comparisonPeriod&&<p className="drx-comparison-note">Não há base equivalente para o confronto selecionado. Escolha “Selecionar período” para analisar duas turmas de ingresso disponíveis.</p>}
        <div className="drx-table-wrap">
          <table className="drx-table">
            <thead><tr><th>Turma de ingresso</th><th>Matrículas ativas*</th><th>Tranc.</th><th>Canc.</th><th>Transf.</th><th>Vagas registradas</th><th>Ocupação observada*</th><th>Saídas / base</th><th>Δ ativos vs. anterior</th></tr></thead>
            <tbody>{semFiltered.map((entry,i)=>{
              const prevEntry=i>0?semFiltered[i-1]:null;
              const mv=movement(entry),occ=occupancy(entry);
              const difference=prevEntry?valueNum(entry.matriculados)-valueNum(prevEntry.matriculados):null;
              return <tr key={entry.semestre} className={displayedSem===String(entry.semestre)?"drx-row-selected":undefined}>
                <td><button type="button" className="drx-period-link" aria-pressed={displayedSem===String(entry.semestre)} title="Selecionar turma de ingresso para comparação" onClick={()=>setSelectedSem(String(entry.semestre))}>{entry.semestre} ↗</button></td>
                <td>{entry.matriculados??"—"}</td><td>{entry.trancado??"—"}</td><td>{entry.cancelado??"—"}</td><td>{entry.transferido??"—"}</td><td>{entry.vagas??"—"}</td>
                <td>{occ===null?<span className="drx-chip">Sem base</span>:<div className="drx-bar-wrap"><div className="drx-bar" style={{width:Math.min(100,occ)+"%",background:occ>=35?"var(--success)":occ>=15?"var(--warning)":"var(--danger)"}}/><span>{occ.toFixed(1)}%</span></div>}</td>
                <td>{mv.rate===null?"Sem base":<span className={"drx-chip "+chipTaxa(mv.rate)} title={mv.out+" saídas classificadas entre "+mv.denominator+" vínculos da turma de ingresso"}>{mv.rate.toFixed(1)}%</span>}</td>
                <td>{difference===null?"—":difference>0?<span className="drx-trend-up">▲ +{difference}</span>:difference<0?<span className="drx-trend-down">▼ {difference}</span>:"0"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="drx-evasao-nota">*São situações observadas na extração para cada turma de ingresso, e não necessariamente o quantitativo existente em cada semestre histórico. Clique no semestre para selecioná-lo e confrontar os dados.</p>
      </div>}

      {/* ── Evasão por turma de ingresso e comparação por ano de ingresso ── */}
      {coortes.length>0&&<div className="drx-section" id="drx-coortes">
        <div className="drx-section-header"><h4>Saídas classificadas, permanência e turmas de ingresso</h4>
          <p className="drx-sub">Fotografia da situação atual dos vínculos de cada turma ingressante, não as ocorrências geradas exclusivamente no semestre indicado.</p></div>
        <div className="drx-definitions">
          <p><strong>Captação:</strong> novos ingressantes efetivamente matriculados pela primeira vez na instituição ou curso no período. Não é igual a total de matrículas ativas nem total de vagas. Este relatório de situações por turma de ingresso não comprova a primeira matrícula individual; portanto a captação líquida permanece <strong>não apurada</strong>.</p>
          <p><strong>Renovação / retenção:</strong> renovação é a confirmação de vínculo na passagem de um semestre para o seguinte; taxa de retenção é a proporção da população elegível que permaneceu vinculada nessa transição, após excluir conclusões e outras situações conforme metodologia homologada. <strong>Não pode ser calculada como 100% menos a taxa de saída</strong> desta tabela.</p>
          <p><strong>Taxa de saídas classificadas:</strong> (trancamentos + abandonos + cancelamentos + transferências + trocas de curso) ÷ base da turma de ingresso × 100. Trancamento e transferência não significam obrigatoriamente evasão definitiva. <strong>VS.</strong> significa “em comparação com”; <strong>Δ</strong> é diferença; <strong>p.p.</strong> são pontos percentuais de diferença entre taxas.</p>
          <p><strong>Turma anterior:</strong> grupo que ingressou no semestre anterior, e não os mesmos estudantes acompanhados longitudinalmente. Compará-las na data de extração significa comparar tempos de exposição diferentes. Para inferir retenção real ou evolução de evasão em igual tempo de curso, serão necessários dados individuais ou snapshots das mesmas coortes em datas equivalentes.</p>
        </div>
        <div className="drx-evasao-resumo">
          <div className="drx-evasao-card" style={{borderLeftColor:corTaxa(taxaAcumulada)}}><span className="drx-evasao-label">Saídas classificadas acumuladas · indicador amplo</span><strong className="drx-evasao-valor" style={{color:corTaxa(taxaAcumulada)}}>{baseAcum>0?taxaAcumulada.toFixed(1)+"%":"Sem base"}</strong><span className="drx-evasao-sub">{evadidosAcum} saídas de {baseAcum} vínculos históricos. Não equivale à evasão definitiva auditada.</span></div>
          <div className="drx-evasao-card" style={{borderLeftColor:"var(--warning)"}}><span className="drx-evasao-label">Trancamentos na base</span><strong className="drx-evasao-valor" style={{color:"var(--warning)"}}>{statusGeral.TRANCADO??0}</strong><span className="drx-evasao-sub">{statusGeral.CANCELADO??0} cancelamentos e {statusGeral.TRANSFERIDO??0} transferências registrados.</span></div>
          <div className="drx-evasao-card" style={{borderLeftColor:"#2563eb"}}><span className="drx-evasao-label">Taxa de renovação real</span><strong className="drx-evasao-valor">Não apurada</strong><span className="drx-evasao-sub">Aguardando continuidade de vínculo entre dois semestres e população elegível conciliada.</span></div>
          <div className="drx-evasao-card" style={{borderLeftColor:"#0f766e"}}><span className="drx-evasao-label">Captação efetiva</span><strong className="drx-evasao-valor">Não apurada</strong><span className="drx-evasao-sub">Aguardando identificação de primeiro vínculo de ingresso, transferências e reingressos.</span></div>
        </div>
        <h5 className="drx-evasao-h5">Comparativo por turma de ingresso · semestre a semestre</h5>
        <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Turma de ingresso</th><th>Base</th><th>Ativos</th><th>Saídas classificadas</th><th>Taxa</th><th>Comparação com a turma anterior</th><th>Comparação com o mesmo semestre do ano anterior</th><th>Sem saída classificada*</th></tr></thead>
        <tbody>{coortes.map((c,i)=>{
          const prior=i>0?coortes[i-1]:null;
          const homologous=coortes.find(x=>x.semestre===String(Number(c.ano)-1)+c.semestre.slice(4));
          const delta=prior?c.taxa-prior.taxa:null,deltaYear=homologous?c.taxa-homologous.taxa:null;
          return <tr key={c.semestre} className={displayedSem===c.semestre?"drx-row-selected":undefined}>
            <td><button type="button" className="drx-period-link" title="Usar esta turma de ingresso na comparação detalhada acima" aria-pressed={displayedSem===c.semestre} onClick={()=>{setSelectedSem(c.semestre);setCompareMode("anterior");}}>{c.semestre} ↗</button></td>
            <td>{c.vinculos}</td><td>{c.ativos}</td><td>{c.evadidos}</td><td><span className={"drx-chip "+chipTaxa(c.taxa)}>{c.taxa.toFixed(1)}%</span></td>
            <td>{delta===null?"Sem referência":(delta>0?"+":"")+delta.toFixed(1)+" p.p."}</td>
            <td>{deltaYear===null?"Sem referência":(deltaYear>0?"+":"")+deltaYear.toFixed(1)+" p.p."}</td>
            <td>{c.vinculos>0?(100-c.taxa).toFixed(1)+"%":"—"}</td>
          </tr>;
        })}</tbody></table></div>
        <p className="drx-evasao-nota">*O complemento de saídas contempla ativos, pré-matriculados e concluintes; não é a taxa de renovação. “VS.” representa apenas comparação descritiva entre turmas de ingresso, não comparação da mesma população ao longo do tempo.</p>

        <h5 className="drx-evasao-h5">Confronto por ano de entrada</h5>
        <div className="drx-compare-controls">
          <label>Ano de referência<select value={firstYear} onChange={e=>setSelectedYear(e.target.value)}>{yearsAvailable.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
          <label>Ano de comparação<select value={otherYear} onChange={e=>setComparisonYear(e.target.value)}>{yearsAvailable.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
        </div>
        {firstYearRow&&otherYearRow?<div className="drx-compare-breakdown">
          <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Indicador</th><th>{firstYear}</th><th>{otherYear}</th><th>Diferença</th></tr></thead>
            <tbody>{([
              ["Vínculos da base das turmas de ingresso",firstYearRow.vinculos,otherYearRow.vinculos],
              ["Ativos",firstYearRow.ativos,otherYearRow.ativos],
              ["Saídas classificadas",firstYearRow.evadidos,otherYearRow.evadidos],
              ["Concluintes",firstYearRow.concluintes,otherYearRow.concluintes]
            ] as [string,number,number][]).map(([label,a,b])=><tr key={label}><td>{label}</td><td>{a}</td><td>{b}</td><td>{a-b>0?"+":""}{a-b}</td></tr>)}
            <tr><td>Taxa de saídas classificadas</td><td>{firstYearRow.taxa.toFixed(1)}%</td><td>{otherYearRow.taxa.toFixed(1)}%</td><td>{(firstYearRow.taxa-otherYearRow.taxa>0?"+":"")+(firstYearRow.taxa-otherYearRow.taxa).toFixed(1)} p.p.</td></tr>
            </tbody></table></div>
          <p className="drx-comparison-note">Os anos agrupam turmas que ingressaram em períodos diferentes. O confronto é descritivo, sem equivalência de tempo decorrido desde o ingresso; não mede melhoria causal nem renovação anual.</p>
        </div>:<p className="drx-comparison-note">Sem dois anos de origem comparáveis na fonte.</p>}
        <div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Ano de ingresso</th><th>Vínculos da base</th><th>Ativos</th><th>Saídas classificadas</th><th>Taxa de saída</th><th>Sem saída classificada*</th></tr></thead>
          <tbody>{anos.map(a=><tr key={a.ano} className={firstYear===a.ano?"drx-row-selected":undefined}><td><button type="button" className="drx-period-link" onClick={()=>setSelectedYear(a.ano)}>{a.ano} ↗</button></td><td>{a.vinculos}</td><td>{a.ativos}</td><td>{a.evadidos}</td><td>{a.taxa.toFixed(1)}%</td><td>{(100-a.taxa).toFixed(1)}%</td></tr>)}</tbody></table></div>
        <p className="drx-evasao-nota">Taxa operacional = saídas classificadas ÷ base integral da turma de ingresso. Conclusão não é evasão. O painel preserva os dados originais; nenhuma inferência de captação ou renovação individual foi acrescentada.</p>
      </div>}

      {/* ── Diagnóstico nominal ── */}
      <div className="drx-section">
        <div className="drx-section-header">
          <h4>Diagnóstico nominal — trajetória por aluno</h4>
          <p className="drx-sub">Um aluno aparece em vários semestres. Aqui cada linha é um aluno, com a passagem por turma e a situação em cada semestre. Ordenado por quem acumula mais reprovações. Camada 2: exige sessão com segundo fator e papel restrito.</p>
        </div>
        {rosterErro ? (
          <p className="drx-alunos-bloqueado">{rosterErro}</p>
        ) : roster.length === 0 ? (
          <p className="drx-alunos-empty">Nenhum registro nominal disponível para o curso.</p>
        ) : (
          <>
            <div className="drx-roster-topo">
              <label className="drx-roster-busca">
                Buscar aluno
                <input type="search" value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} placeholder="Nome ou matrícula" />
              </label>
              <span className="drx-roster-contagem">
                {trajetoriasFiltradas.length} de {trajetorias.length} alunos · {trajetorias.filter(a => a.reprovacoes > 0).length} com ao menos uma reprovação · {trajetorias.filter(a => a.inativo).length} inativos na última passagem
              </span>
            </div>
            <div className="drx-table-wrap">
              <table className="drx-table">
                <thead><tr><th>Aluno</th><th>Matrícula</th><th>Semestres</th><th>Reprovações</th><th>Situação atual</th><th>Trajetória</th></tr></thead>
                <tbody>
                  {trajetoriasFiltradas.slice(0, 200).map((a, i) => (
                    <tr key={`${a.matricula}-${i}`}>
                      <td><strong>{a.nome}</strong></td>
                      <td>{a.matricula}</td>
                      <td>{a.semestres}</td>
                      <td>{a.reprovacoes > 0 ? <span className="drx-chip drx-chip-red">{a.reprovacoes}</span> : <span className="drx-chip drx-chip-green">0</span>}</td>
                      <td>{a.ultima ? <span className={`drx-sit ${a.inativo ? "drx-sit-bad" : "drx-sit-ok"}`}>{SIT_LABELS[a.ultima.situacao] ?? a.ultima.situacao}</span> : "—"}</td>
                      <td>
                        <div className="drx-traj">
                          {a.passagens.map((p, j) => (
                            <span key={j} className={`drx-traj-passo ${p.situacao === "RF" || p.situacao === "RN" || p.situacao === "RA" ? "drx-traj-rep" : GHOST_SITS.has(p.situacao) ? "drx-traj-out" : "drx-traj-ok"}`} title={`${p.sem} · ${p.turma} · ${SIT_LABELS[p.situacao] ?? p.situacao}`}>
                              {p.sem} {p.turma}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trajetoriasFiltradas.length > 200 && <p className="drx-evasao-nota">Exibindo os 200 primeiros de {trajetoriasFiltradas.length}. Use a busca para localizar um aluno.</p>}
            <p className="drx-evasao-nota">Situação por semestre, não por disciplina. O cruzamento aluno × disciplina × nota ainda não existe no banco e depende de nova extração do e-ORBIT.</p>
          </>
        )}
      </div>

      {/* ── Docência registrada nas ofertas: histórico 2023/01–2026/02 ── */}
      <section className="drx-section" id="drx-docencia">
        <div className="drx-section-header"><h4>Corpo Docente — histórico de 2023/01 a 2026/02</h4>
          <p className="drx-sub">Fonte: ofertas de disciplinas de Direito (curso 027). São <strong>nomes docentes distintos registrados nas ofertas</strong>, não contratos de trabalho ou quadro funcional confirmado.</p>
        </div>
        {docenciaStatus==="loading"?<p role="status" className="drx-comparison-note">Consultando registros das ofertas docentes…</p>:
        docenciaStatus==="error"?<p role="alert" className="drx-comparison-note">Não foi possível consultar os dados de docência; verifique o acesso autorizado à fonte.</p>:<>
          <div className="drx-docente-grid drx-docente-click-grid">
            {historicoDocente.map((row,i)=>{
              const anterior=i>0?historicoDocente[i-1]:null;
              const delta=anterior?.disponivel&&row.disponivel?row.docentes.length-anterior.docentes.length:null;
              return <button key={row.semestre} type="button" className="drx-docente-card drx-docente-select" aria-pressed={docenciaSem===row.semestre} onClick={()=>{setDocenciaSem(row.semestre);setDocenciaBusca("");}}>
                <span className="drx-docente-sem">{row.semestre}</span>
                <strong className="drx-docente-num">{row.disponivel?row.docentes.length:"—"}</strong>
                <span className="drx-docente-label">{row.disponivel?"nomes docentes distintos":"Fonte não disponibilizada"}</span>
                <span className="drx-docente-label">{row.disponivel?row.ofertas+" ofertas de disciplinas":"Sem contagem"}</span>
                {delta!==null&&<span className={delta>=0?"drx-trend-up":"drx-trend-down"}>{delta>=0?"+":""}{delta} vs. semestre anterior</span>}
              </button>;
            })}
          </div>
          <div className="drx-compare-controls">
            <label>Semestre para detalhar<select value={docenciaSem} onChange={e=>{setDocenciaSem(e.target.value);setDocenciaBusca("");}}>{historicoDocente.map(x=><option key={x.semestre} value={x.semestre}>{x.semestre}</option>)}</select></label>
            <label>Comparar com<select value={docenciaCompare} onChange={e=>setDocenciaCompare(e.target.value)}>{historicoDocente.filter(x=>x.semestre!==docenciaSem).map(x=><option key={x.semestre} value={x.semestre}>{x.semestre}</option>)}</select></label>
            <label>Buscar docente ou disciplina<input type="search" value={docenciaBusca} onChange={e=>setDocenciaBusca(e.target.value)} placeholder="Nome ou disciplina"/></label>
          </div>
          <div className="drx-compare-cards">
            <div><small>Nomes docentes · {docenciaSem}</small><strong>{docenciaAtual.disponivel?docenciaAtual.docentes.length:"Sem dados"}</strong><span>{docenciaAtual.ofertas} ofertas cadastradas</span></div>
            <div><small>Nomes docentes · {docenciaCompare}</small><strong>{docenciaAnterior.disponivel?docenciaAnterior.docentes.length:"Sem dados"}</strong><span>{docenciaAnterior.ofertas} ofertas cadastradas</span></div>
            <div><small>Diferença de docentes distintos</small><strong>{docenciaAtual.disponivel&&docenciaAnterior.disponivel?(docenciaAtual.docentes.length-docenciaAnterior.docentes.length>0?"+":"")+(docenciaAtual.docentes.length-docenciaAnterior.docentes.length):"—"}</strong><span>Não mede admissões nem demissões</span></div>
            <div><small>Diferença nas ofertas</small><strong>{docenciaAtual.disponivel&&docenciaAnterior.disponivel?(docenciaAtual.ofertas-docenciaAnterior.ofertas>0?"+":"")+(docenciaAtual.ofertas-docenciaAnterior.ofertas):"—"}</strong><span>Registros de disciplinas ofertadas</span></div>
          </div>
          {docenciaAtual.disponivel?<div className="drx-table-wrap"><table className="drx-table"><thead><tr><th>Professor · {docenciaSem}</th><th>Disciplinas registradas</th><th>Ofertas vinculadas</th><th>Também em {docenciaCompare}?</th></tr></thead>
            <tbody>{docenciaFiltrada.map(d=><tr key={d.nome}><td><strong>{d.nome}</strong></td><td>{[...d.disciplinas].join("; ")}</td><td>{d.ofertas}</td><td>{docenciaAnterior.disponivel?docenciaAnterior.docentes.some(x=>x.nome.toLocaleUpperCase("pt-BR")===d.nome.toLocaleUpperCase("pt-BR"))?"Sim":"Não":"Indisponível"}</td></tr>)}</tbody>
          </table>{!docenciaFiltrada.length&&<p className="drx-comparison-note">Nenhum professor ou disciplina corresponde à pesquisa neste semestre.</p>}</div>:<p className="drx-comparison-note">Não há registro individual de docência para o período selecionado.</p>}
          <p className="drx-evasao-nota">Critério: cada nome é contado uma única vez por semestre, mesmo com várias disciplinas ou ofertas. A lista deriva de registros do sistema acadêmico e pode requerer conferência de homônimos, grafia, cadastro funcional e vínculo docente. Uma variação no número de nomes não comprova contratação, desligamento ou retenção do professor.</p>
        </>}
      </section>

      {/* ── Status Geral ── */}
      {quantGeral && (
        <div className="drx-section">
          <div className="drx-section-header"><h4>Distribuição por Status (Acumulado)</h4></div>
          <div className="drx-status-grid">
            {Object.entries(quantGeral.status || {}).map(([key, val]: [string, any]) => (
              <div key={key} className={`drx-status-item ${val > 0 ? "" : "drx-status-zero"}`}>
                <span className="drx-status-label">{key.replace(/_/g, " ")}</span>
                <strong>{val}</strong>
                <span className="drx-status-pct">{totalGeral > 0 ? `${((val/totalGeral)*100).toFixed(1)}%` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="drx-footer">Dados de origem e-ORBIT UNITOP · Extração: {sourceDate ?? "—"} · Uso reservado à instituição · 779 registros nominais</footer>
    </div>
  );
}
