import {useEffect,useState} from 'react';
import type {QuestionDraft} from './question-draft';
import {reuseBankQuestion,type BankQuestion} from './question-bank';
import type {CompetencyDescriptor} from './competency-key';
import {listLocalBank,saveLocalBank} from './question-bank-local';
import {listInstitutionalBank,saveInstitutionalBank} from './question-bank-api';
import {loadBankCalibration,type BankCalibration} from './analysis-api';
import {discriminationLabel,facilityLabel,observedLevel} from './item-analysis-rules';
type Props={previewMode:boolean;institutionId:string;courseId:string;discipline:string;
 currentQuestion?:QuestionDraft;indexLabels:string[];competencyCatalog?:CompetencyDescriptor[];
 onReuse:(q:QuestionDraft,record:BankQuestion)=>void;};
const btn={border:'1px solid #164b92',borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:650} as const;
export default function QuestionBankPanel({previewMode,institutionId,courseId,discipline,currentQuestion,indexLabels,competencyCatalog,onReuse}:Props){
 const [saved,setSaved]=useState<BankQuestion[]>([]);
 const [query,setQuery]=useState('');
 const [notice,setNotice]=useState('');
 const [searchedQuery,setSearchedQuery]=useState('');
 const [busy,setBusy]=useState(false);
 const [calibration,setCalibration]=useState<Record<string,BankCalibration>>({});
 const canSearch=!busy&&Boolean(courseId&&discipline.trim()&&query.trim());
 const searchCompleted=canSearch&&searchedQuery===query.trim();
 const canSave=!busy&&Boolean(institutionId&&courseId&&discipline.trim()&&currentQuestion);
 useEffect(()=>{setQuery('');setSaved([]);setSearchedQuery('');},
  [institutionId,courseId,discipline,currentQuestion?.id]);
 useEffect(()=>setNotice(''),[institutionId,courseId,discipline]);
 const search=async()=>{
  if(!canSearch)return;
  setNotice('');
  setSearchedQuery('');
  setSaved([]);
  setBusy(true);
  try{
   const q=query.trim();
   setSaved(previewMode?listLocalBank(institutionId,courseId,discipline,q):await listInstitutionalBank(institutionId,courseId,discipline,q));
   if(!previewMode)setCalibration(await loadBankCalibration(institutionId,courseId,discipline).catch(()=>({})));
   setSearchedQuery(q);
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível consultar o Banco de Questões.');}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!canSave||!currentQuestion)return;
  setBusy(true);
  try{
   const input={institutionId,courseId,discipline,question:currentQuestion,
    indexLabels,competencies:competencyCatalog??[],bankId:crypto.randomUUID(),createdAt:new Date().toISOString()};
   const savedRecord=previewMode?saveLocalBank(input):await saveInstitutionalBank(input);
   setNotice('Questão salva como rascunho '+(previewMode?'no banco local':'no Banco de Questões do curso')+'. Código: '+savedRecord.bankId.slice(0,8)+'.');
  }catch(e){setNotice(e instanceof Error?e.message:'Falha ao salvar questão.');}
  finally{setBusy(false);}
 };
 const reuse=(record:BankQuestion)=>{
  try{
   const copy=reuseBankQuestion(record,crypto.randomUUID(),discipline);
   onReuse(copy,record);
   setNotice('Cópia incluída na avaliação. O registro original permanece inalterado.');
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível reutilizar a questão.');}
 };
 return <section aria-label="Banco de Questões do Avalia 360°" style={{border:'1px solid #bfd3eb',borderRadius:12,padding:16,background:'#f5f9ff',marginTop:14}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <div>
     <h4 style={{margin:'0 0 5px',fontSize:17,color:'#164b92'}}>Banco de Questões</h4>
     <p style={{margin:0,fontSize:13,color:'#42556c'}}>Guarde questões em rascunho para reutilização em avaliações futuras.</p>
    </div>
   </div>
   <p style={{fontSize:12,color:'#795317',margin:'10px 0 0'}}>
    {previewMode?'Homologação: questões armazenadas somente neste navegador; não há cópia no banco oficial. Não use materiais confidenciais.':'Questões gravadas no banco institucional do curso, visíveis à equipe autorizada desta disciplina. Questões com imagem não são arquivadas no banco.'}
   </p>
   {!courseId||!discipline.trim()?<p role="note" style={{fontSize:12}}>Selecione curso e disciplina para usar o Banco de Questões.</p>:null}
   {notice&&<p role="status" style={{padding:'9px 12px',background:'#fff',borderRadius:8,fontSize:13}}>{notice}</p>}
   <button type="button" style={{...btn,marginTop:14,background:'#164b92',color:'#fff',opacity:canSave?1:.55}}
    onClick={()=>void save()} disabled={!canSave}>
    Salvar questão no banco
   </button>
   <div style={{marginTop:14,borderTop:'1px solid #bfd3eb',paddingTop:14}}>
    <label style={{fontSize:13,fontWeight:650}}>Pesquisar por enunciado, tema, competência ou exame
     <input type="search" value={query}
      disabled={!courseId||!discipline.trim()}
      onChange={e=>{setQuery(e.target.value);setSearchedQuery('');setSaved([]);setNotice('');}}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}}
      placeholder="Ex.: responsabilidade civil" style={{display:'block',padding:11,width:'100%',borderRadius:8,border:'1px solid #c8d5e4',marginTop:6}}/>
    </label>
    <button type="button" onClick={()=>void search()} disabled={!canSearch} style={{...btn,marginTop:9}}>{busy?'Consultando…':'Buscar questões'}</button>
    {searchCompleted&&(saved.length===0?<p role="status" style={{fontSize:13}}>{previewMode?'Nenhuma questão encontrada para esta disciplina neste navegador.':'Nenhuma questão encontrada para esta disciplina no banco do curso.'}</p>:
      <div style={{display:'grid',gap:9,marginTop:12}}>
       {saved.map(record=><article key={record.bankId} style={{border:'1px solid #d6e2f1',borderRadius:9,padding:12,background:'#fff'}}>
        <strong style={{display:'block',fontSize:13}}>{record.question.kind==='objetiva'?'Objetiva':'Discursiva'} · {record.question.estimatedDifficulty}/5 · {record.question.points} ponto(s)</strong>
        <p style={{fontSize:13,whiteSpace:'pre-wrap',margin:'8px 0'}}>{record.question.statement}</p>
        <small>Versão {record.revision} · {record.status} · {new Date(record.createdAt).toLocaleDateString('pt-BR')} · ID {record.bankId.slice(0,8)}</small>
        {(()=>{const c=calibration[record.bankId];
         return c&&c.p!==null?<p style={{fontSize:12,margin:'6px 0 0',color:'#164b92'}}>
          Dificuldade declarada {record.question.estimatedDifficulty} · observada {observedLevel(c.p)} ({facilityLabel(c.p)}, {Math.round(c.p*100)}% de acerto)
          {' · '}discriminação {c.discrimination===null?'—':c.discrimination.toFixed(2).replace('.',',')+' ('+discriminationLabel(c.discrimination)+')'}
          {' · '}{c.n} resposta(s) em {c.applications} aplicação(ões) encerrada(s)</p>
          :!previewMode?<p style={{fontSize:12,margin:'6px 0 0',color:'#64748b'}}>Ainda sem dados de aplicação encerrada.</p>:null;})()}
        <div style={{marginTop:9}}><button type="button" style={{...btn,background:'#164b92',color:'#fff'}}
          onClick={()=>reuse(record)}>Inserir cópia na prova</button></div>
       </article>)}
      </div>)}
   </div>
  </section>;
}
