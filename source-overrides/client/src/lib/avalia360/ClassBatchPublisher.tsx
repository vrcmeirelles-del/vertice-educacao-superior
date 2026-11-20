import {useState} from 'react';
import {buildIndividualizedPdf,downloadPdf,prepareIssues,type PrintStudent} from './individualized-pdf';
import type {QuestionDraft} from './question-draft';
type Props={institutionName?:string;courseName:string;discipline:string;title:string;semester:string;questions:QuestionDraft[];previewMode:boolean};
const field={display:'grid',gap:5,fontWeight:600,fontSize:13} as const;
const style={padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,width:'100%'} as const;
const demoStudents=[
 {id:'demo-2a-1',name:'Ana Exemplo',registration:'DEMO-001',selected:true},
 {id:'demo-2a-2',name:'Bruno Exemplo',registration:'DEMO-002',selected:true},
 {id:'demo-2a-3',name:'Carla Exemplo',registration:'DEMO-003',selected:true}
];
export default function ClassBatchPublisher({institutionName='Vértice · Demonstração',courseName,discipline,title,semester,questions,previewMode}:Props){
 const [classLabel,setClassLabel]=useState('2A');
 const [students,setStudents]=useState<PrintStudent[]>([]);
 const [raw,setRaw]=useState('');
 const [status,setStatus]=useState('');
 const [working,setWorking]=useState(false);
 const chooseExample=()=>{setStudents(demoStudents.map(x=>({...x})));setClassLabel('2A');setStatus('Turma fictícia carregada. Nenhum estudante real foi consultado.');};
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
  if(!previewMode){setStatus('A emissão nominal real depende de autorização e conciliação com o cadastro institucional.');return;}
  if(!courseName||!discipline.trim()||!title.trim()||!questions.length){
   setStatus('Informe curso, disciplina, título e ao menos uma questão antes de gerar.');return;
  }
  if(questions.some(q=>q.statement.trim().length<10||(q.kind==='objetiva'&&q.options.some(o=>!o.text.trim())))){
   setStatus('Complete o enunciado e as alternativas de todas as questões.');return;
  }
  if(questions.some(q=>q.images.length>0)){setStatus('Esta primeira emissão PDF não suporta imagens anexadas. Retire as imagens ou aguarde a versão de PDF com figuras.');return;}
  if(!classLabel.trim()){setStatus('Informe a turma.');return;}
  setWorking(true);setStatus('Preparando as folhas individualizadas…');
  try{
   const issues=prepareIssues(students,crypto.randomUUID());
   const bytes=await buildIndividualizedPdf({institutionName,courseName,discipline,
    title,semester,classLabel,questions},issues);
   downloadPdf(bytes,'Avalia360-'+classLabel+'-'+semester.replace('/','-'));
   setStatus('PDF demonstrativo gerado com '+issues.length+' prova(s) nominal(is). Os QR Codes NÃO estão cadastrados no sistema; não usar para correção oficial.');
  }catch(e){setStatus(e instanceof Error?e.message:'Não foi possível criar o PDF.');}
  finally{setWorking(false);}
 };
 return <section aria-label="Geração por turma" style={{border:'1px solid #dce7f4',background:'#fff',borderRadius:14,padding:18,marginTop:18}}>
  <h3 style={{margin:'0 0 10px'}}>5 · Gerar provas individualizadas por turma</h3>
  <p style={{fontSize:13}}>Emita um único PDF com uma prova por aluno, nome na primeira página e QR individual. O modelo definitivo de cabeçalho será incorporado depois.</p>
  {previewMode?<div role="note" style={{padding:12,background:'#fff4e3',borderRadius:8,fontSize:13}}>
    Modo demonstração: a base oficial de alunos NÃO está conectada. Utilize nomes fictícios; nenhuma matrícula será consultada ou gravada no sistema. O QR é apenas um identificador de demonstração e não está habilitado para correção.
   </div>:<p role="note">A integração com a base oficial de turmas requer autorização no servidor e matrícula conciliada. A geração nominal está bloqueada até a homologação.</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,margin:'14px 0'}}>
   <label style={field}>Turma
    <input style={style} value={classLabel} onChange={e=>{setClassLabel(e.target.value);setStudents([])}} placeholder="Ex.: 2A"/>
   </label>
   <div style={{alignSelf:'end'}}>
    <button type="button" onClick={chooseExample} disabled={!previewMode}>Carregar turma fictícia 2A</button>
   </div>
  </div>
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
  <button type="button" disabled={working||!previewMode||students.every(x=>!x.selected)}
   onClick={generate} style={{background:'#164b92',color:'#fff',border:'none',borderRadius:9,padding:'12px 18px',fontWeight:700,cursor:'pointer'}}>
   {working?'Gerando PDF…':'Gerar PDF individualizado da turma'}
  </button>
  {status&&<p role="status" style={{fontSize:13,color:'#334155',marginBottom:0}}>{status}</p>}
  <p style={{fontSize:12,color:'#64748b'}}>A correção via leitura do QR Code, exportação de notas e conexão com a turma oficial serão ativadas em etapa segura própria; nenhum resultado é enviado a planilhas ou ao banco nesta prévia.</p>
 </section>;
}
