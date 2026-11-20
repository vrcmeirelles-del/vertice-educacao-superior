import {useEffect,useState} from 'react';
import type {QuestionDraft} from './question-draft';
import {reuseBankQuestion,type BankQuestion} from './question-bank';
import {listLocalBank,saveLocalBank} from './question-bank-local';
type Props={previewMode:boolean;institutionId:string;courseId:string;discipline:string;
 currentQuestion?:QuestionDraft;onReuse:(q:QuestionDraft)=>void;};
const btn={border:'1px solid #164b92',borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:650} as const;
export default function QuestionBankPanel({previewMode,institutionId,courseId,discipline,currentQuestion,onReuse}:Props){
 const [saved,setSaved]=useState<BankQuestion[]>([]);
 const [query,setQuery]=useState('');
 const [notice,setNotice]=useState('');
 const [expanded,setExpanded]=useState(false);
 const refresh=()=>{
  try{setSaved(listLocalBank(institutionId,courseId,discipline,query));}
  catch(e){setNotice(e instanceof Error?e.message:'Não foi possível consultar o Banco de Questões.');}
 };
 useEffect(()=>{setQuery('');setNotice('');setSaved([]);},[institutionId,courseId,discipline]);
 const save=()=>{
  if(!previewMode){setNotice('O banco institucional requer autorização e armazenamento homologados.');return;}
  if(!currentQuestion){setNotice('Adicione ou selecione uma questão.');return;}
  try{
   const savedRecord=saveLocalBank({institutionId,courseId,discipline,question:currentQuestion,
    bankId:crypto.randomUUID(),createdAt:new Date().toISOString()});
   setNotice('Questão salva como rascunho no banco local. Código: '+savedRecord.bankId.slice(0,8)+'.');
   refresh();
  }catch(e){setNotice(e instanceof Error?e.message:'Falha ao salvar questão.');}
 };
 const reuse=(record:BankQuestion)=>{
  try{
   const copy=reuseBankQuestion(record,crypto.randomUUID(),discipline);
   onReuse(copy);
   setNotice('Cópia incluída na avaliação. O registro original permanece inalterado.');
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível reutilizar a questão.');}
 };
 return <section aria-label="Banco de Questões do Avalia 360°" style={{border:'1px solid #bfd3eb',borderRadius:12,padding:16,background:'#f5f9ff',marginTop:14}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <div>
     <h4 style={{margin:'0 0 5px',fontSize:17,color:'#164b92'}}>Banco de Questões</h4>
     <p style={{margin:0,fontSize:13,color:'#42556c'}}>Guarde questões em rascunho para reutilização em avaliações futuras.</p>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <button type="button" style={{...btn,background:'#164b92',color:'#fff'}} onClick={save}
      disabled={!previewMode||!currentQuestion||!courseId||!discipline.trim()}>
      Salvar questão no banco
     </button>
     <button type="button" style={{...btn,background:'#fff',color:'#164b92'}}
      onClick={()=>{setExpanded(!expanded);if(!expanded)refresh()}} aria-expanded={expanded}>
      {expanded?'Fechar banco':'Pesquisar e reutilizar'}
     </button>
    </div>
   </div>
   <p style={{fontSize:12,color:'#795317',margin:'10px 0 0'}}>
    {previewMode?'Homologação: questões armazenadas somente neste navegador; não há cópia no banco oficial. Não use materiais confidenciais.':'A persistência no banco institucional ficará habilitada após homologação de autenticação, permissões e versionamento.'}
   </p>
   {!courseId||!discipline.trim()?<p role="note" style={{fontSize:12}}>Selecione curso e disciplina para usar o Banco de Questões.</p>:null}
   {notice&&<p role="status" style={{padding:'9px 12px',background:'#fff',borderRadius:8,fontSize:13}}>{notice}</p>}
   {expanded&&<div style={{marginTop:14}}>
    <label style={{fontSize:13,fontWeight:650}}>Pesquisar por enunciado, tema, competência ou exame
     <input value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Ex.: responsabilidade civil" style={{display:'block',padding:11,width:'100%',borderRadius:8,border:'1px solid #c8d5e4',marginTop:6}}/>
    </label>
    <button type="button" onClick={refresh} style={{...btn,marginTop:9}}>Buscar questões</button>
    {!previewMode?<p>O acervo institucional ainda não está disponível nesta versão.</p>:
      saved.length===0?<p style={{fontSize:13}}>Nenhuma questão encontrada para esta disciplina neste navegador.</p>:
      <div style={{display:'grid',gap:9,marginTop:12}}>
       {saved.map(record=><article key={record.bankId} style={{border:'1px solid #d6e2f1',borderRadius:9,padding:12,background:'#fff'}}>
        <strong style={{display:'block',fontSize:13}}>{record.question.kind==='objetiva'?'Objetiva':'Discursiva'} · {record.question.estimatedDifficulty}/5 · {record.question.points} ponto(s)</strong>
        <p style={{fontSize:13,whiteSpace:'pre-wrap',margin:'8px 0'}}>{record.question.statement}</p>
        <small>Versão {record.revision} · {record.status} · {new Date(record.createdAt).toLocaleDateString('pt-BR')} · ID {record.bankId.slice(0,8)}</small>
        <div style={{marginTop:9}}><button type="button" style={{...btn,background:'#164b92',color:'#fff'}}
          onClick={()=>reuse(record)}>Inserir cópia na prova</button></div>
       </article>)}
      </div>}
   </div>}
  </section>;
}
