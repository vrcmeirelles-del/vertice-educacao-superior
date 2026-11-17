import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STUDENT_FIELDS } from '@/lib/extension-forms/student-fields';
import type { Answers } from '@/lib/extension-forms/schema';

interface Invitation {
  id: string; email: string; expires_at: string; activated_at: string | null; revoked_at: string | null;
  state: string; answers: Answers; fields: string[]; execution_open: boolean; updated_at: string;
}

const DEFAULT_FIELDS = STUDENT_FIELDS.filter(field=>!field.report).map(field=>field.key);

export default function ExtensaoAlunosConvites({projectId,onUse}:{
  projectId:string;onUse:(key:string,value:string,source:string)=>void;
}) {
  const [rows,setRows]=useState<Invitation[]>([]);
  const [identity,setIdentity]=useState({registration:'',cpf:'',email:''});
  const [fields,setFields]=useState(DEFAULT_FIELDS);
  const [execution,setExecution]=useState(false);
  const [editing,setEditing]=useState<Invitation|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function review(invite?:string, action?:string) {
    const result=await supabase.rpc('vertice_extension_student_review',{
      p_project:projectId,p_invite:invite??null,p_action:action??null,
      p_fields:fields,p_execution:execution,
    });
    if(result.error)throw result.error;
    setRows((result.data||[]) as Invitation[]);
  }
  useEffect(()=>{void review().catch(e=>setError(e.message));},[projectId]);
  async function issue(invite?:string) {
    setBusy(true);setError('');setMessage('');
    try {
      const result=await supabase.functions.invoke('vertice-extension-student-invite',{body:{
        project:projectId,...(invite?{invite}:{...identity,fields,execution}),
      }});
      await review();
      if(result.error){
        const context=(result.error as {context?:Response}).context;
        const details=await context?.json().catch(()=>null);
        throw new Error(details?.error||'Não foi possível enviar o convite.');
      }
      setIdentity({registration:'',cpf:'',email:''});
      setMessage('Convite enviado ao e-mail cadastrado.');
    } catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  async function change(row:Invitation,action:string) {
    if(action==='revogar'&&!confirm(`Revogar o acesso de ${row.email} a este projeto?`))return;
    setBusy(true);setError('');setMessage('');
    try{
      await review(row.id,action);
      setEditing(null);setFields(DEFAULT_FIELDS);setExecution(false);
      setMessage('Acesso e situação atualizados.');
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <div className="ext-form">
    <h4>Alunos e convites</h4>
    {error&&<p className="ext-project-error" role="alert">{error}</p>}
    {message&&<p className="ext-info" role="status">{message}</p>}
    <form onSubmit={e=>{e.preventDefault();void (editing?change(editing,'permissoes'):issue());}}>
      <fieldset disabled={busy} className="ext-source-box"><legend>{editing?`Campos liberados · ${editing.email}`:'Novo convite individual'}</legend>
        {!editing&&<div className="ext-form-grid">
          <label>Matrícula<input required maxLength={80} value={identity.registration} onChange={e=>setIdentity({...identity,registration:e.target.value})}/></label>
          <label>CPF<input required inputMode="numeric" maxLength={18} value={identity.cpf} onChange={e=>setIdentity({...identity,cpf:e.target.value})}/></label>
          <label>E-mail<input required type="email" value={identity.email} onChange={e=>setIdentity({...identity,email:e.target.value})}/></label>
        </div>}
        <label><input type="checkbox" checked={execution} onChange={e=>{
          setExecution(e.target.checked);
          if(!e.target.checked)setFields(prev=>prev.filter(key=>DEFAULT_FIELDS.includes(key)));
        }}/> Permitir contribuição durante a execução</label>
        <details><summary>Escolher campos liberados ({fields.length})</summary>
          <div className="ext-ods-grid">{STUDENT_FIELDS.filter(f=>execution||!f.report).map(f=><label key={f.key}>
            <input type="checkbox" checked={fields.includes(f.key)} onChange={e=>setFields(prev=>e.target.checked?[...prev,f.key]:prev.filter(k=>k!==f.key))}/> {f.label}
          </label>)}</div>
        </details>
        <div className="ext-stage-actions">
          <button className="ext-btn-primary" disabled={!fields.length}>{editing?'Salvar permissões':'Enviar convite'}</button>
          {editing&&<button type="button" className="ext-btn-secondary" onClick={()=>{setEditing(null);setFields(DEFAULT_FIELDS);setExecution(false);}}>Cancelar</button>}
        </div>
      </fieldset>
    </form>
    <div className="ext-invite-list">{rows.map(row=>{
      const status=row.revoked_at?'Revogado':row.activated_at?'Ativado':Date.parse(row.expires_at)<=Date.now()?'Expirado':'Aguardando ativação';
      return <article key={row.id}>
        <strong>{row.email}</strong>
        <p>{status} · {({rascunho:'Rascunho',em_revisao:'Em revisão',ajustes:'Devolvido para ajustes',aceito:'Revisado'})[row.state]} · {new Date(row.updated_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
        {!row.revoked_at&&<div className="ext-stage-actions">
          {!row.activated_at&&<button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>void issue(row.id)}>Reenviar</button>}
          <button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>{setEditing(row);setFields(row.fields);setExecution(row.execution_open);}}>Campos liberados</button>
          {row.state==='em_revisao'&&<>
            <button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>void change(row,'ajustes')}>Devolver para ajustes</button>
            <button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>void change(row,'aceito')}>Marcar como revisado</button>
          </>}
          {row.state==='aceito'&&row.execution_open&&<button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>void change(row,'ajustes')}>Reabrir para contribuir na execução</button>}
          <button type="button" className="ext-btn-danger" disabled={busy} onClick={()=>void change(row,'revogar')}>Revogar convite</button>
        </div>}
        {Object.entries(row.answers).some(([,value])=>value.trim())&&<details><summary>Ver contribuição</summary>
          {Object.entries(row.answers).filter(([,value])=>value.trim()).map(([key,value])=><div key={key} className="ext-source-box">
            <strong>{STUDENT_FIELDS.find(f=>f.key===key)?.label||key}</strong><p>{value}</p>
            <button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>onUse(key,value,`Contribuição de ${row.email}`)}>Revisar aplicação ao formulário</button>
          </div>)}
        </details>}
      </article>;
    })}</div>
  </div>;
}
