// Fila operacional da Automação 360°: cada proposta só avança por decisão humana registrada.
// Papéis, MFA, escopo, revisão (CAS), evidência e verificação independente são impostos pelas RPCs
// vertice_automation_decide e vertice_automation_handoff_5w2h; esta tela só coleta a decisão.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensagemErro, rotulo, situacoes, type Proposta } from './modelo';

type Membro = { user_id: string; email: string };
type Props = { institutionId: string; pending: Proposta[]; onChanged: () => void };
const dia = (v: string | null) => v ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v)) : 'Sem prazo';

export default function FilaAutomacao({ institutionId, pending, onChanged }: Props) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState(''), [dono, setDono] = useState(''), [prazo, setPrazo] = useState(''), [evidencia, setEvidencia] = useState(''), [oque, setOque] = useState('');
  const [enviando, setEnviando] = useState(false), [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    void Promise.resolve(supabase.rpc('vertice_team', { target: institutionId })).then((r) => { if (vivo && r && !r.error) setMembros((r.data ?? []) as Membro[]); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [institutionId]);

  function abrir(id: string) { setAberto(aberto === id ? null : id); setMotivo(''); setDono(''); setPrazo(''); setEvidencia(''); setOque(''); setAviso(''); }

  async function decidir(p: Proposta, acao: string) {
    setEnviando(true); setAviso('');
    const fim = prazo ? new Date(prazo + 'T23:59:00-03:00').toISOString() : null;
    const r = await supabase.rpc('vertice_automation_decide', {
      p_alert: p.id, p_action: acao, p_expected_revision: p.revision, p_reason: motivo.trim(),
      p_owner: acao === 'approve' ? dono || null : null, p_due_at: acao === 'approve' ? fim : null,
      p_evidence_ref: acao === 'complete' || acao === 'verify' ? evidencia.trim() || null : null });
    setEnviando(false);
    if (r.error) { setAviso(mensagemErro(r.error)); return; }
    setAberto(null); onChanged();
  }
  async function encaminhar(p: Proposta) {
    setEnviando(true); setAviso('');
    const r = await supabase.rpc('vertice_automation_handoff_5w2h', { p_alert: p.id, p_goal: null, p_what: oque.trim() || null, p_why: motivo.trim() || null });
    setEnviando(false);
    if (r.error) { setAviso(mensagemErro(r.error)); return; }
    setAberto(null); onChanged();
  }

  if (!pending.length) return <p>Nenhuma proposta pendente na fila operacional verificada.</p>;
  const motivoOk = motivo.trim().length >= 5;
  return (
    <ul className="a360-fila">
      {pending.map((p) => (
        <li key={p.id}>
          <div className="a360-fila-linha">
            <span><b>{p.priority}</b> · {rotulo(p.ruleId)}</span>
            <span className="a360-nota">{situacoes[p.status] ?? 'Situação não reconhecida'}{p.dueAt && ` · prazo ${dia(p.dueAt)}`}{p.actionId && ' · ação 5W2H criada'}</span>
            <button type="button" aria-expanded={aberto === p.id} onClick={() => abrir(p.id)}>Decidir</button>
          </div>
          {p.sourceCleared && <p className="a360-alerta">A ocorrência não aparece mais na fonte. Confirme e conclua ou encerre com justificativa.</p>}
          {aberto === p.id && (
            <div className="a360-decisao">
              <label>Justificativa (obrigatória) <input value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} /></label>
              {p.status === 'pending_review' && <>
                <label>Responsável <select value={dono} onChange={(e) => setDono(e.target.value)}>
                  <option value="">Selecione</option>{membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}</select></label>
                <label>Prazo <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
                <div className="a360-acoes">
                  <button type="button" disabled={enviando || !motivoOk || !dono || !prazo} onClick={() => decidir(p, 'approve')}>Aprovar e atribuir</button>
                  <button type="button" disabled={enviando || !motivoOk} onClick={() => decidir(p, 'reject')}>Rejeitar</button>
                  <button type="button" disabled={enviando || !motivoOk} onClick={() => decidir(p, 'close')}>Encerrar</button>
                </div>
              </>}
              {p.status === 'approved' && <>
                {!p.actionId && <label>O quê (ação 5W2H; opcional) <input value={oque} maxLength={500} onChange={(e) => setOque(e.target.value)} /></label>}
                <div className="a360-acoes">
                  {!p.actionId && <button type="button" disabled={enviando} onClick={() => encaminhar(p)}>Encaminhar ao 5W2H</button>}
                  <button type="button" disabled={enviando || !motivoOk} onClick={() => decidir(p, 'start')}>Iniciar execução</button>
                  <button type="button" disabled={enviando || !motivoOk} onClick={() => decidir(p, 'close')}>Encerrar</button>
                </div>
              </>}
              {(p.status === 'in_progress' || p.status === 'completed') && <>
                <label>Evidência (referência do documento ou registro) <input value={evidencia} maxLength={300} onChange={(e) => setEvidencia(e.target.value)} /></label>
                <div className="a360-acoes">
                  {p.status === 'in_progress' && <button type="button" disabled={enviando || !motivoOk || !evidencia.trim()} onClick={() => decidir(p, 'complete')}>Concluir</button>}
                  {p.status === 'in_progress' && <button type="button" disabled={enviando || !motivoOk} onClick={() => decidir(p, 'close')}>Encerrar</button>}
                  {p.status === 'completed' && <button type="button" disabled={enviando || !motivoOk || !evidencia.trim()} onClick={() => decidir(p, 'verify')}>Verificar (outra pessoa)</button>}
                </div>
              </>}
              {aviso && <p className="a360-erro" role="alert">{aviso}</p>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
