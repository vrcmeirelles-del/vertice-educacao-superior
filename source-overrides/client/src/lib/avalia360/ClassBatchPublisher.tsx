import {useEffect,useState} from 'react';
import {buildIndividualizedPdf,downloadPdf,prepareIssues,validatePrintAssessment,type PrintStudent} from './individualized-pdf';
import type {QuestionDraft} from './question-draft';
import {createExamVariants,teacherAnswerRows,versioningNotice,type ShuffleMode} from './exam-variants';
import {loadAuthorizedClassRoster} from './class-roster';
import unitopLogo from './unitop-logo.png';

type Props={institutionId:string;courseId:string;institutionName?:string;courseName:string;discipline:string;title:string;teacherName:string;instructions:string;semester:string;questions:QuestionDraft[];previewMode:boolean};
const field={display:'grid',gap:5,fontWeight:600,fontSize:13} as const;
const style={padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,width:'100%'} as const;
const demoStudents=[
 {id:'demo-2a-1',name:'Ana Exemplo',registration:'DEMO-001',selected:true},
 {id:'demo-2a-2',name:'Bruno Exemplo',registration:'DEMO-002',selected:true},
 {id:'demo-2a-3',name:'Carla Exemplo',registration:'DEMO-003',selected:true}
];
export default function ClassBatchPublisher({institutionId,courseId,institutionName,courseName,discipline,title,teacherName,instructions,semester,questions,previewMode}:Props){
 const printInstitutionName=institutionName ?? (previewMode ? 'Centro Universitário UNITOP' : 'Instituição demonstrativa');
 const [classLabel,setClassLabel]=useState('2A');
 const [students,setStudents]=useState<PrintStudent[]>([]);
 const [raw,setRaw]=useState('');
 const [status,setStatus]=useState('');
 const [pdfErrors,setPdfErrors]=useState<string[]>([]);
 const [working,setWorking]=useState(false);
 const [variantCount,setVariantCount]=useState(1);
 const [shuffleMode,setShuffleMode]=useState<ShuffleMode>('ambos');
 const [answerKeyUrl,setAnswerKeyUrl]=useState('');
 const [pdfUrl,setPdfUrl]=useState('');
 const [pdfFilename,setPdfFilename]=useState('');
 useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
 useEffect(()=>()=>{if(answerKeyUrl)URL.revokeObjectURL(answerKeyUrl);},[answerKeyUrl]);
 // Invalidar documentos gerados quando conteúdo, turma ou configuração mudarem.
 useEffect(()=>{setPdfUrl('');setAnswerKeyUrl('');setPdfErrors([]);},
  [questions,students,variantCount,shuffleMode,classLabel,courseName,discipline,title,teacherName,instructions,semester,printInstitutionName]);
 const chooseExample=()=>{setStudents(demoStudents.map(x=>({...x})));setClassLabel('2A');setStatus('Turma fictícia carregada. Nenhum estudante real foi consultado.');};
 const loadReal=async()=>{
  if(previewMode)return;
  setWorking(true);setStatus('Consultando lista de alunos autorizada…');
  try{
   const roster=await loadAuthorizedClassRoster({
    institutionId,courseId,disciplineId:discipline,classLabel
   });
   setStudents(roster.students);
   setStatus('Lista carregada: '+roster.students.length+' registro(s). Matrícula não conferida: valide com a secretaria antes da emissão oficial.');
  }catch(e){setStudents([]);setStatus(e instanceof Error?e.message:'Consulta não concluída.');}
  finally{setWorking(false);}
 };
 const parse=()=>{
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length){setStatus('Informe ao menos um aluno.');return;}
  if(lines.length>120){setStatus('Limite demonstrativo: 120 alunos.');return;}
  const seen=new Set<string>();
  const rows=lines.map((line,i)=>{
   const [name,registration='']=line.split(';').map(x=>x.trim());
   const id=registration||'linha-'+(i+1);
   if(!name||seen.has(id))throw new Error('Nome vazio ou matrícula/identificador repetido na lista.');
   seen.add(id);
   return {id,name,registration,selected:true};
  });
  setStudents(rows);setStatus('Lista local importada: '+rows.length+' estudante(s). Confira antes de emitir.');
 };
 const generate=async()=>{
  setStatus('');
  const problems=validatePrintAssessment({institutionName:printInstitutionName,courseName,discipline,title,
   teacherName,instructions,semester,classLabel,questions});
  if(!previewMode)problems.unshift('A emissão nominal exige autorização institucional e conciliação das matrículas.');
  if(students.length===0)problems.push(previewMode
   ?'Carregue a turma fictícia 2A ou insira uma lista de teste.'
   :'Carregue a lista autorizada da turma.');
  else if(!students.some(student=>student.selected))problems.push('Selecione pelo menos um estudante da turma.');
  const variantError=versioningNotice(questions,variantCount,shuffleMode);
  if(variantError)problems.push(variantError);
  setPdfErrors(problems);
  if(problems.length)return;
  setWorking(true);setStatus('Preparando as folhas individualizadas…');
  setPdfUrl('');setAnswerKeyUrl('');
  try{
   const issues=prepareIssues(students,crypto.randomUUID());
   const logoResponse=institutionName==null ? await fetch(unitopLogo) : null;
   if(logoResponse && !logoResponse.ok)throw Error('Não foi possível carregar a logo da UNITOP.');
   const institutionLogo=logoResponse ? await logoResponse.arrayBuffer() : undefined;
   const bytes=await buildIndividualizedPdf({institutionName:printInstitutionName,institutionLogo,courseName,discipline,
    title,teacherName,instructions,semester,classLabel,questions,variantCount,shuffleMode},issues);
   const filename='Avalia360-'+classLabel+'-'+semester.replace('/','-');
   const variants=createExamVariants(questions,variantCount,shuffleMode);
   const rows=teacherAnswerRows(variants);
   const safeCell=(value:string|number)=>{const raw=String(value);const safe=/^\s*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};
   const csv=['Versão;Questão;Gabarito;ID original;Justificativa docente',
    ...rows.map(row=>[row.version,row.question,row.correct,row.sourceId,row.justification].map(safeCell).join(';'))].join('\r\n');
   const keyBlob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
   setAnswerKeyUrl(URL.createObjectURL(keyBlob));
   const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
   const url=URL.createObjectURL(blob);
   setPdfUrl(url);setPdfFilename(filename.replace(/[^A-Za-z0-9 _-]/g,'_')+'.pdf');
   // O link explícito abaixo funciona mesmo se o download automático for bloqueado pelo navegador.
   downloadPdf(bytes,filename);
   setStatus('PDF demonstrativo preparado com '+issues.length+' caderno(s), '+variantCount+' versão(ões) e cartão de respostas com QR por aluno. O gabarito por versão é um arquivo separado, restrito ao professor. QR sem registro no servidor.');
  }catch(e){setStatus('');setPdfErrors([e instanceof Error?e.message:'Ocorreu uma falha inesperada na geração.']);}
  finally{setWorking(false);}
 };
 return <section aria-label="Geração por turma" style={{border:'1px solid #dce7f4',background:'#fff',borderRadius:14,padding:18,marginTop:18}}>
  <h3 style={{margin:'0 0 10px'}}>Gerar provas e cartões de resposta</h3>
  <p style={{fontSize:13}}>Caderno A4 com objetivas em duas colunas, discursivas em largura total com linhas de espaçamento 1,5 e cartão objetivo separado com o mesmo QR do aluno. Você pode embaralhar questões, alternativas ou ambas e gerar até 12 versões diferentes.</p>
  {previewMode?<div role="note" style={{padding:12,background:'#fff4e3',borderRadius:8,fontSize:13}}>
    Modo demonstração: a base oficial de alunos NÃO está conectada. Utilize nomes fictícios; nenhuma matrícula será consultada ou gravada no sistema. O QR é apenas um identificador de demonstração e não está habilitado para correção.
   </div>:<p role="note">A integração com a base oficial de turmas requer autorização no servidor e matrícula conciliada. A geração nominal está bloqueada até a homologação.</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,margin:'14px 0'}}>
   <label style={field}>Turma
    <input style={style} value={classLabel} onChange={e=>{setClassLabel(e.target.value);setStudents([])}} placeholder="Ex.: 2A"/>
   </label>
   <div style={{alignSelf:'end'}}>
    {previewMode?
     <button type="button" onClick={chooseExample}>Carregar turma fictícia 2A</button>:
     <button type="button" onClick={loadReal} disabled={working||!courseId||!discipline.trim()}>Buscar estudantes autorizados da turma</button>}
   </div>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,margin:'14px 0'}}>
   <label style={field}>Quantas versões da mesma avaliação?
    <select style={style} value={variantCount} onChange={e=>setVariantCount(Number(e.target.value))}>
     {Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} {n===1?'versão':'versões'} ({String.fromCharCode(65+n-1)})</option>)}
    </select>
   </label>
   <label style={field}>O que randomizar?
    <select style={style} value={shuffleMode} onChange={e=>setShuffleMode(e.target.value as ShuffleMode)}>
     <option value="ambos">Ordem das questões e alternativas</option>
     <option value="questoes">Somente ordem das questões</option>
     <option value="alternativas">Somente alternativas objetivas</option>
    </select>
   </label>
  </div>
  {versioningNotice(questions,variantCount,shuffleMode)&&<p role="alert" style={{color:'#91620f',fontSize:13}}>{versioningNotice(questions,variantCount,shuffleMode)}</p>}
  <p style={{fontSize:12,color:'#536b87'}}>As versões são distribuídas alternadamente entre os alunos selecionados. O gabarito objetivo muda de acordo com a posição das alternativas e fica disponível em arquivo docente separado. A randomização não altera o conteúdo das questões.</p>
  {previewMode&&<>
   <details>
    <summary style={{cursor:'pointer',fontWeight:650}}>Inserir lista de teste manualmente (nome; identificação fictícia)</summary>
    <p style={{fontSize:12}}>Uma linha por aluno: Nome Exemplo; DEMO-001. Não cole listas com dados pessoais reais neste site de demonstração.</p>
    <textarea style={{...style,minHeight:85}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'Aluno Exemplo Um;DEMO-001\nAluno Exemplo Dois;DEMO-002'}/>
    <button type="button" onClick={()=>{try{parse()}catch(e){setStatus(e instanceof Error?e.message:'Lista inválida.')}}}>Carregar lista local</button>
   </details>
  </>}
  {students.length>0&&<div style={{marginTop:14}}>
    <strong>Conferência da turma {classLabel} · {students.filter(s=>s.selected).length} selecionado(s)</strong>
    <div style={{maxHeight:260,overflow:'auto',border:'1px solid #dce7f4',margin:'8px 0',borderRadius:8,padding:10}}>
     {students.map(st=><label key={st.id} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 0'}}>
      <input type="checkbox" checked={st.selected} onChange={e=>setStudents(x=>x.map(s=>s.id===st.id?{...s,selected:e.target.checked}:s))}/>
      <span>{st.name} <small>· {st.registration||'sem matrícula'}</small></span>
     </label>)}
    </div>
  </div>}
  <button type="button" disabled={working}
   onClick={generate} style={{background:'#164b92',color:'#fff',border:'none',borderRadius:9,padding:'12px 18px',fontWeight:700,cursor:'pointer'}}>
   {working?'Gerando PDF…':'Gerar PDF individualizado da turma'}
  </button>
  {pdfErrors.length>0&&<div role="alert" style={{marginTop:12,padding:12,borderRadius:8,background:'#FFF0F0',color:'#982F2F'}}>
   <strong>Não foi possível gerar o PDF</strong>
   <ul style={{marginTop:6,marginBottom:0}}>{pdfErrors.map(error=><li key={error}>{error}</li>)}</ul>
  </div>}
  {pdfUrl&&<a href={pdfUrl} download={pdfFilename} style={{display:'inline-block',marginTop:12,padding:'12px 16px',background:'#164b92',color:'#fff',fontWeight:700,borderRadius:9,textDecoration:'none'}}>
   Baixar PDF gerado
  </a>}
  {answerKeyUrl&&<a href={answerKeyUrl} download={'Avalia360-Gabarito-Docente-'+classLabel+'.csv'} style={{display:'inline-block',marginTop:12,marginLeft:9,padding:'12px 16px',border:'1px solid #164b92',color:'#164b92',fontWeight:700,borderRadius:9,textDecoration:'none'}}>Baixar gabarito por versão (docente)</a>}
  {status&&<p role="status" style={{fontSize:13,color:'#334155',marginBottom:0}}>{status}</p>}
  <p style={{fontSize:12,color:'#64748b'}}>A correção via leitura do QR Code, exportação de notas e conexão com a turma oficial serão ativadas em etapa segura própria; nenhum resultado é enviado a planilhas ou ao banco nesta prévia.</p>
 </section>;
}
