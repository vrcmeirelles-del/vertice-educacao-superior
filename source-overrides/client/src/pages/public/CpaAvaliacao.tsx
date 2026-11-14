// CpaAvaliacao.tsx — Portal público de resposta CPA
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const box: React.CSSProperties = { padding: 16, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' };
const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '.9rem' };

interface Question { id: string; stable_code: string; sort_order: number; question_text: string; question_type: string; scale_config: any; required: boolean; sinaes_axis?: string; sinaes_dimension?: string; }
interface Campaign { id: string; title: string; target_audience: string; status: string; opens_at: string; closes_at: string; instrument_id: string; institution_id: string; }

export default function CpaAvaliacao() {
  const params = new URLSearchParams(window.location.search);
  const campaignId = params.get('campanha') || '';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [instName, setInstName] = useState('');
  const [answers, setAnswers] = useState<Record<string, { value: string; text: string; is_na: boolean; is_dk: boolean }>>({});
  const [page, setPage] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const QUESTIONS_PER_PAGE = 5;

  useEffect(() => {
    if (!campaignId) { setError('Link inválido.'); setLoading(false); return; }
    (async () => {
      const { data: camp } = await supabase.from('vertice_cpa_campaigns').select('*').eq('id', campaignId).single();
      if (!camp || camp.status !== 'ativa') { setError('Esta avaliação não está ativa no momento.'); setLoading(false); return; }
      const now = new Date();
      if (new Date(camp.closes_at) < now) { setError('O período de coleta desta avaliação já encerrou.'); setLoading(false); return; }
      if (new Date(camp.opens_at) > now) { setError(`Esta avaliação abre em ${new Date(camp.opens_at).toLocaleDateString('pt-BR')}.`); setLoading(false); return; }
      setCampaign(camp as Campaign);

      const { data: inst } = await supabase.from('vertice_institutions').select('name').eq('id', camp.institution_id).single();
      if (inst) setInstName(inst.name);

      const { data: qs } = await supabase.from('vertice_cpa_questions').select('*').eq('instrument_id', camp.instrument_id).order('sort_order');
      setQuestions((qs || []) as Question[]);
      setLoading(false);
    })();
  }, [campaignId]);

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const progress = questions.length > 0 ? Math.round(100 * Object.keys(answers).length / questions.length) : 0;

  const setAnswer = (qId: string, field: string, val: any) => {
    setAnswers(prev => {
      const curr = prev[qId] || { value: '', text: '', is_na: false, is_dk: false };
      if (field === 'is_na' && val) return { ...prev, [qId]: { ...curr, value: '', is_na: true, is_dk: false } };
      if (field === 'is_dk' && val) return { ...prev, [qId]: { ...curr, value: '', is_na: false, is_dk: true } };
      return { ...prev, [qId]: { ...curr, [field]: val, is_na: false, is_dk: false } };
    });
  };

  const handleSubmit = async () => {
    if (!campaign) return;
    // Check required
    const unanswered = questions.filter(q => q.required && !answers[q.id]?.value && !answers[q.id]?.text && !answers[q.id]?.is_na && !answers[q.id]?.is_dk);
    if (unanswered.length > 0) {
      const first = unanswered[0];
      const pg = Math.floor(questions.indexOf(first) / QUESTIONS_PER_PAGE);
      setPage(pg);
      setError(`Responda a pergunta obrigatória: "${first.question_text.substring(0, 60)}..."`);
      return;
    }

    setSaving(true); setError('');
    try {
      // Create response
      const { data: resp, error: respErr } = await supabase.from('vertice_cpa_responses').insert({
        campaign_id: campaign.id, instrument_id: campaign.instrument_id,
        status: 'concluida', started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
        channel_used: 'portal', progress_pct: 100,
      }).select().single();
      if (respErr) throw respErr;

      // Insert answers
      const answerRows = questions.map(q => {
        const a = answers[q.id] || { value: '', text: '', is_na: false, is_dk: false };
        return {
          response_id: resp.id, question_id: q.id,
          answer_value: a.value || null, answer_text: a.text || null,
          is_na: a.is_na, is_dk: a.is_dk, is_pnr: false,
          answered_at: new Date().toISOString(),
        };
      }).filter(a => a.answer_value || a.answer_text || a.is_na || a.is_dk);

      if (answerRows.length > 0) {
        const { error: ansErr } = await supabase.from('vertice_cpa_answers').insert(answerRows);
        if (ansErr) throw ansErr;
      }

      setSubmitted(true);
    } catch (err) {
      setError('Erro ao enviar: ' + (err as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando avaliação…</div>;

  if (submitted) return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 20 }}>
      <div style={{ ...box, textAlign: 'center', background: '#f0fdf4', border: '2px solid #16a34a' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
        <h2 style={{ margin: '0 0 8px', color: '#16a34a' }}>Avaliação enviada!</h2>
        <p style={{ color: '#475569' }}>Obrigado pela sua participação. Suas respostas são anônimas e contribuem para a melhoria da instituição.</p>
        {instName && <p style={{ fontSize: '.85rem', color: '#64748b', marginTop: 12 }}>{instName}</p>}
      </div>
    </div>
  );

  if (error && !campaign) return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 20 }}>
      <div style={{ ...box, textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca' }}>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>{error}</p>
      </div>
    </div>
  );

  if (!campaign) return null;

  const AUDIENCES: Record<string,string> = { estudante:'Estudante', docente:'Docente', tecnico:'Técnico-Administrativo', sociedade:'Sociedade Civil', egresso:'Egresso', gestao:'Gestão' };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>VÉRTICE</h1>
        {instName && <p style={{ fontSize: '.85rem', color: '#64748b', margin: '0 0 8px' }}>{instName}</p>}
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px' }}>{campaign.title}</h2>
        <p style={{ fontSize: '.8rem', color: '#64748b' }}>{AUDIENCES[campaign.target_audience] || campaign.target_audience} · {questions.length} perguntas · Respostas anônimas</p>
      </div>

      {/* Barra de progresso */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', marginBottom: 4 }}>
          <span>Página {page + 1} de {totalPages}</span>
          <span style={{ fontWeight: 700 }}>{progress}% respondido</span>
        </div>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#2563eb', borderRadius: 3, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Perguntas da página */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pageQuestions.map((q, idx) => {
          const a = answers[q.id] || { value: '', text: '', is_na: false, is_dk: false };
          const globalIdx = page * QUESTIONS_PER_PAGE + idx + 1;

          return (
            <div key={q.id} style={{ ...box, borderLeft: a.value || a.text || a.is_na || a.is_dk ? '4px solid #16a34a' : '4px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>{globalIdx}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '.9rem', fontWeight: 600, margin: '0 0 10px' }}>
                    {q.question_text} {q.required && <span style={{ color: '#dc2626' }}>*</span>}
                  </p>

                  {q.question_type === 'likert' && q.scale_config && (
                    <div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {(q.scale_config.labels || ['1','2','3','4','5']).map((label: string, i: number) => {
                          const val = String(i + 1);
                          const selected = a.value === val;
                          return <button key={val} type="button" onClick={() => setAnswer(q.id, 'value', val)}
                            style={{ ...btn, padding: '8px 14px', fontSize: '.8rem', background: selected ? '#2563eb' : '#f1f5f9', color: selected ? '#fff' : '#475569', border: selected ? '2px solid #2563eb' : '2px solid #e2e8f0', minWidth: 50 }}>
                            <div style={{ fontWeight: 800 }}>{val}</div>
                            <div style={{ fontSize: '.6rem', marginTop: 2 }}>{label}</div>
                          </button>;
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {q.scale_config.allow_dk && <label style={{ fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', cursor: 'pointer' }}>
                          <input type="checkbox" checked={a.is_dk} onChange={e => setAnswer(q.id, 'is_dk', e.target.checked)} /> Não sei responder
                        </label>}
                        {q.scale_config.allow_na && <label style={{ fontSize: '.75rem', display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', cursor: 'pointer' }}>
                          <input type="checkbox" checked={a.is_na} onChange={e => setAnswer(q.id, 'is_na', e.target.checked)} /> Não se aplica
                        </label>}
                      </div>
                    </div>
                  )}

                  {q.question_type === 'text' && (
                    <textarea value={a.text} onChange={e => setAnswer(q.id, 'text', e.target.value)} rows={3}
                      placeholder="Escreva sua resposta aqui…"
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '.85rem', resize: 'vertical', fontFamily: 'inherit' }} />
                  )}

                  {q.question_type === 'boolean' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Sim', 'Não'].map(opt => (
                        <button key={opt} type="button" onClick={() => setAnswer(q.id, 'value', opt)}
                          style={{ ...btn, padding: '8px 20px', background: a.value === opt ? '#2563eb' : '#f1f5f9', color: a.value === opt ? '#fff' : '#475569', border: a.value === opt ? '2px solid #2563eb' : '2px solid #e2e8f0' }}>{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: '.85rem', margin: '12px 0', fontWeight: 600 }}>{error}</p>}

      {/* Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
        <button disabled={page === 0} onClick={() => { setPage(p => p - 1); setError(''); }}
          style={{ ...btn, background: '#f1f5f9', color: '#475569', opacity: page === 0 ? .4 : 1 }}>← Anterior</button>

        {page < totalPages - 1 ? (
          <button onClick={() => { setPage(p => p + 1); setError(''); }}
            style={{ ...btn, background: '#2563eb', color: '#fff' }}>Próxima →</button>
        ) : (
          <button disabled={saving} onClick={handleSubmit}
            style={{ ...btn, background: '#16a34a', color: '#fff', opacity: saving ? .6 : 1 }}>{saving ? 'Enviando…' : '✅ Enviar avaliação'}</button>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '.7rem', color: '#94a3b8', marginTop: 20 }}>
        Suas respostas são anônimas e confidenciais. Resultados serão divulgados de forma agregada pela CPA.
      </p>
    </div>
  );
}
