import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STUDENT_FIELDS } from '@/lib/extension-forms/student-fields';
import type { Answers } from '@/lib/extension-forms/schema';
import '@/components/area/extensao360.css';

interface Contribution {
  id: string; project_id: string; title: string; state: string; revision: number;
  fields: string[]; answers: Answers; execution_open: boolean; proposal_open: boolean;
}
const VALIDATION_FAILURE = 'A validação falhou. Confira os dados e procure o responsável pelo projeto se o problema continuar.';
const TOKEN_KEY = 'vertice-extension-student-invite';

export default function ExtensaoAluno() {
  const [token,setToken] = useState(() => {
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('ativacao')||new URLSearchParams(window.location.search).get('ativacao');
    return /^[a-f0-9]{64}$/.test(fromLink||'') ? fromLink! : sessionStorage.getItem(TOKEN_KEY)||'';
  });
  const [identity,setIdentity] = useState({ email:'', cpf:'', registration:'' });
  const [signedIn,setSignedIn] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [projects,setProjects] = useState<Contribution[]>([]);
  const [selected,setSelected] = useState('');
  const [edits,setEdits] = useState<Answers>({});
  const contribution = projects.find(item=>item.id===selected);

  async function reload(projectId?:string) {
    const { data,error } = await supabase.rpc('vertice_extension_student_projects');
    if (error) throw error;
    const rows=(data||[]) as Contribution[];
    setProjects(rows);
    setSelected(id=>rows.find(p=>p.project_id===projectId)?.id||(rows.some(p=>p.id===id)?id:rows[0]?.id||''));
  }

  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem(TOKEN_KEY,token);
    const url = new URL(location.href);
    if (url.searchParams.has('ativacao')||new URLSearchParams(url.hash.slice(1)).has('ativacao')) {
      url.searchParams.delete('ativacao');
      if(new URLSearchParams(url.hash.slice(1)).has('ativacao'))url.hash='';
      history.replaceState(history.state,'',url);
    }
  },[token]);

  useEffect(() => {
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_event,session) => {
      setSignedIn(!!session?.user);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  },[]);

  useEffect(() => {
    if (!signedIn) { setProjects([]);setEdits({});return; }
    void reload().catch(()=>setMessage('Não foi possível carregar os projetos autorizados.'));
  },[signedIn]);

  async function authenticate() {
    setBusy(true);setMessage('');
    try {
      const url = new URL('/extensao-convite?aluno=1',location.origin);
      if(token)url.searchParams.set('ativacao',token);
      const { error } = await supabase.auth.signInWithOtp({
        email:identity.email.trim(),
        options:{ emailRedirectTo:url.href,shouldCreateUser:!!token },
      });
      if (error) throw error;
      setMessage('Confira seu e-mail e abra o link para entrar no Vértice.');
    } catch { setMessage('Não foi possível enviar o acesso. Confira o e-mail cadastrado e tente novamente.'); }
    finally { setBusy(false); }
  }

  async function activate() {
    setBusy(true);setMessage('');
    try {
      const { data,error }=await supabase.rpc('vertice_extension_student_activate',{
        p_token:token,p_email:identity.email,p_cpf:identity.cpf,p_registration:identity.registration,
      });
      if(error||!data)throw new Error();
      sessionStorage.removeItem(TOKEN_KEY);setToken('');
      setIdentity({email:'',cpf:'',registration:''});
      await reload(String(data));setMessage('Convite ativado. Acesse seu projeto abaixo.');
    } catch { setMessage(VALIDATION_FAILURE); }
    finally { setBusy(false); }
  }

  async function save(send:boolean) {
    if(!contribution)return;
    setBusy(true);setMessage('');
    try {
      const {error}=await supabase.rpc('vertice_extension_student_save',{
        p_id:contribution.id,p_revision:contribution.revision,p_answers:edits,p_send:send,
      });
      if(error)throw error;
      setEdits({});await reload();
      setMessage(send?'Contribuição enviada para revisão.':'Rascunho salvo.');
    } catch(e) { setMessage((e as Error).message||'Não foi possível salvar a contribuição.'); }
    finally { setBusy(false); }
  }

  const visibleFields=STUDENT_FIELDS.filter(f=>contribution?.fields.includes(f.key));
  return <main className="ext-student-page ext-workspace">
    <header className="ext-workspace-hero">
      <div><p className="ext-workspace-kicker">Vértice Educação Superior</p><h1>Projetos de Extensão</h1></div>
      {signedIn&&<button type="button" className="ext-btn-secondary" disabled={busy} onClick={()=>void supabase.auth.signOut()}>Sair</button>}
    </header>
    {message&&<p role="status" className="ext-info">{message}</p>}
    {loading?<p role="status">Carregando acesso…</p>:<>
      {(!signedIn||token)&&<form className="ext-form" onSubmit={e=>{e.preventDefault();void (signedIn?activate():authenticate());}}>
        <h2>{signedIn?'Validar convite individual':'Entrar com o e-mail cadastrado'}</h2>
        <fieldset disabled={busy}>
          <label>E-mail<input type="email" required value={identity.email} onChange={e=>setIdentity({...identity,email:e.target.value})}/></label>
          {signedIn&&<>
            <label>Matrícula<input required maxLength={80} value={identity.registration} onChange={e=>setIdentity({...identity,registration:e.target.value})}/></label>
            <label>CPF<input required inputMode="numeric" maxLength={18} value={identity.cpf} onChange={e=>setIdentity({...identity,cpf:e.target.value})}/></label>
          </>}
          <button className="ext-btn-primary">{signedIn?'Validar convite':'Enviar link de acesso'}</button>
        </fieldset>
      </form>}
      {signedIn&&!token&&(!contribution?<p>Nenhum projeto autorizado nesta conta.</p>:<>
        <label>Projeto<select disabled={busy} value={selected} onChange={e=>{if(Object.keys(edits).length&&!confirm('Descartar alterações não salvas?'))return;setEdits({});setSelected(e.target.value);}}>
          {projects.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}
        </select></label>
        <h2>{contribution.title}</h2>
        <p>{({rascunho:'Rascunho',em_revisao:'Em revisão',ajustes:'Devolvido para ajustes',aceito:'Revisado'})[contribution.state]}</p>
        <div className="ext-form ext-form-grid">{visibleFields.map(f=>{
          const canWrite=(f.report?contribution.execution_open:contribution.proposal_open)&&['rascunho','ajustes'].includes(contribution.state);
          if(!canWrite&&!contribution.answers[f.key])return null;
          return <label key={f.key} className="ext-workspace-wide">{f.label}<textarea rows={4} disabled={busy||!canWrite}
            value={edits[f.key]??contribution.answers[f.key]??''} onChange={e=>setEdits({...edits,[f.key]:e.target.value})}/></label>;
        })}</div>
        {['rascunho','ajustes'].includes(contribution.state)&&visibleFields.some(f=>f.report?contribution.execution_open:contribution.proposal_open)&&<div className="ext-form-actions">
          <button className="ext-btn-secondary" disabled={busy||!Object.keys(edits).length} onClick={()=>void save(false)}>Salvar rascunho</button>
          <button className="ext-btn-primary" disabled={busy||!Object.values({...contribution.answers,...edits}).some(v=>v.trim())} onClick={()=>void save(true)}>Enviar para revisão</button>
        </div>}
      </>)}
    </>}
  </main>;
}
