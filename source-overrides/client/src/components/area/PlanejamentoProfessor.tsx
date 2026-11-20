import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { STAGES, YEARS, COMPONENTS, COMPONENT_LABEL, buildPlanPayload, emptyPlan, toForm, safeSearch, type PlanForm, type Stage } from "@/lib/teacher-planning";

interface PlanRow { id: string; title: string; stage: Stage; year_label: string; component: string; period_label: string | null; status: string; updated_at: string }
interface BnccItem { id: string; code: string; kind: string; component: string | null; year_label: string | null; description: string }
interface ClassRow { id: string; name: string; grade: string }
interface CaseRow { id: string; student_name: string }
interface Accommodation { id: string; category: string; description: string; status: string }

const stageLabel = (s: string) => STAGES.find(x => x.value === s)?.label ?? s;

export default function PlanejamentoProfessor({ institutionId }: { institutionId: string }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [selected, setSelected] = useState<BnccItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BnccItem[]>([]);
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    const [p, c, k, n] = await Promise.all([
      supabase.from('teacher_lesson_plans').select('id,title,stage,year_label,component,period_label,status,updated_at').eq('institution_id', institutionId).neq('status', 'arquivado').order('updated_at', { ascending: false }),
      supabase.from('vertice_school_classes').select('id,name,grade').eq('institution_id', institutionId).order('name'),
      supabase.from('student_support_cases').select('id,student_name').eq('institution_id', institutionId).neq('status', 'encerrado').order('student_name'),
      supabase.from('bncc_items').select('id', { count: 'exact', head: true }),
    ]);
    if (!mounted.current) return;
    if (p.error) { setError('Não foi possível carregar os planejamentos.'); return; }
    setPlans((p.data ?? []) as PlanRow[]); setClasses((c.data ?? []) as ClassRow[]); setCases((k.data ?? []) as CaseRow[]);
    setCatalogCount(n.error ? null : (n.count ?? 0));
  }, [institutionId]);
  useEffect(() => { load(); }, [load]);

  // Busca no catálogo BNCC conforme etapa, ano e componente escolhidos.
  useEffect(() => {
    if (!form || catalogCount === 0) { setResults([]); return; }
    let active = true;
    const timer = setTimeout(async () => {
      let q = supabase.from('bncc_items').select('id,code,kind,component,year_label,description').eq('stage', form.stage).limit(40);
      if (form.component) q = q.eq('component', form.component);
      const term = safeSearch(query);
      if (term) q = q.or(`code.ilike.%${term}%,description.ilike.%${term}%`);
      const r = await q.order('code');
      if (active && !r.error) setResults((r.data ?? []) as BnccItem[]);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [form?.stage, form?.component, query, catalogCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Adaptações do PEI do caso escolhido (somente leitura), para apoiar o planejamento inclusivo.
  useEffect(() => {
    const caseId = form?.inclusion_case_id;
    if (!caseId) { setAccs([]); return; }
    let active = true;
    (async () => {
      const pl = await supabase.from('student_individual_plans').select('id').eq('institution_id', institutionId).eq('case_id', caseId).in('status', ['validado', 'ativo']);
      const ids = (pl.data ?? []).map((x: { id: string }) => x.id);
      if (!ids.length) { if (active) setAccs([]); return; }
      const a = await supabase.from('student_plan_accommodations').select('id,category,description,status').eq('institution_id', institutionId).in('plan_id', ids).neq('status', 'cancelada');
      if (active) setAccs((a.data ?? []) as Accommodation[]);
    })();
    return () => { active = false; };
  }, [form?.inclusion_case_id, institutionId]);

  const edit = async (id: string | null) => {
    setError(''); setQuery(''); setSelected([]);
    if (!id) { setForm(emptyPlan()); return; }
    const r = await supabase.from('teacher_lesson_plans').select('*').eq('id', id).eq('institution_id', institutionId).single();
    if (r.error || !r.data) { setError('Não foi possível abrir o planejamento.'); return; }
    const links = await supabase.from('teacher_lesson_plan_bncc').select('bncc_item_id').eq('plan_id', id);
    const ids = (links.data ?? []).map((x: { bncc_item_id: string }) => x.bncc_item_id);
    if (ids.length) {
      const items = await supabase.from('bncc_items').select('id,code,kind,component,year_label,description').in('id', ids);
      setSelected((items.data ?? []) as BnccItem[]);
    }
    setForm(toForm(r.data as Record<string, unknown>));
  };

  const save = async () => {
    if (!form || lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const payload = buildPlanPayload(form, institutionId);
      let planId = form.id;
      if (planId) {
        const r = await supabase.from('teacher_lesson_plans').update(payload).eq('id', planId).eq('institution_id', institutionId);
        if (r.error) throw new Error('Não foi possível salvar.');
      } else {
        const r = await supabase.from('teacher_lesson_plans').insert(payload).select('id').single();
        if (r.error || !r.data) throw new Error('Não foi possível salvar.');
        planId = (r.data as { id: string }).id;
      }
      const del = await supabase.from('teacher_lesson_plan_bncc').delete().eq('plan_id', planId).eq('institution_id', institutionId);
      if (del.error) throw new Error('Não foi possível atualizar os vínculos BNCC.');
      if (selected.length) {
        const ins = await supabase.from('teacher_lesson_plan_bncc').insert(selected.map(s => ({ plan_id: planId, bncc_item_id: s.id, institution_id: institutionId })));
        if (ins.error) throw new Error('Planejamento salvo, mas os vínculos BNCC não foram gravados. Abra e salve de novo.');
      }
      if (mounted.current) { setForm(null); setSelected([]); }
      await load();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };

  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const toggle = (it: BnccItem) => setSelected(s => (s.some(x => x.id === it.id) ? s.filter(x => x.id !== it.id) : [...s, it]));

  return (
    <div className="inc-section">
      {error && <div className="inc-error" role="alert">{error}</div>}
      <div className="inc-header"><h3>Planejamento do Professor</h3>{!form && <button className="inc-btn-primary" onClick={() => edit(null)}>Novo planejamento</button>}</div>
      <div className="inc-ev-note">
        Planejamento por etapa, ano e componente, ligado às competências e habilidades da BNCC.
        {catalogCount === 0 && <> <b>O catálogo BNCC ainda não foi carregado:</b> você já pode salvar o planejamento; os vínculos com habilidades ficam disponíveis após a carga do texto oficial.</>}
      </div>

      {form && (
        <div className="inc-form">
          <label>Etapa<select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as Stage, year_label: '', component: '' })}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label>{form.stage === 'EI' ? 'Faixa etária' : form.stage === 'EF' ? 'Ano' : 'Série'}<select value={form.year_label} onChange={e => set('year_label', e.target.value)}><option value="">Selecione</option>{YEARS[form.stage].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          <label>{COMPONENT_LABEL[form.stage]}<select value={form.component} onChange={e => set('component', e.target.value)}><option value="">Selecione</option>{COMPONENTS[form.stage].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label>Título<input value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} /></label>
          <label>Turma (opcional)<select value={form.class_id} onChange={e => set('class_id', e.target.value)}><option value="">—</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.grade}</option>)}</select></label>
          <label>Período (ex.: 2º bimestre)<input value={form.period_label} maxLength={60} onChange={e => set('period_label', e.target.value)} /></label>
          <label>Início<input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label>
          <label>Fim<input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></label>
          <label>Objetivos de aprendizagem<textarea rows={3} value={form.objectives} onChange={e => set('objectives', e.target.value)} /></label>
          <label>Conteúdos<textarea rows={3} value={form.content} onChange={e => set('content', e.target.value)} /></label>
          <label>Metodologia<textarea rows={3} value={form.methodology} onChange={e => set('methodology', e.target.value)} /></label>
          <label>Recursos<textarea rows={2} value={form.resources} onChange={e => set('resources', e.target.value)} /></label>
          <label>Avaliação<textarea rows={3} value={form.assessment} onChange={e => set('assessment', e.target.value)} /></label>

          <h4>Competências e habilidades da BNCC</h4>
          {selected.length > 0 && <ul>{selected.map(s => <li key={s.id}><b>{s.code}</b> · {s.description} <button type="button" className="inc-btn-small" onClick={() => toggle(s)}>Remover</button></li>)}</ul>}
          {catalogCount === 0 ? <p>Catálogo BNCC em carga. Nenhuma habilidade para escolher por enquanto.</p> : (
            <>
              <label>Buscar por código ou texto<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Selecione a etapa e o componente para filtrar" /></label>
              <ul>{results.map(r => <li key={r.id}><label><input type="checkbox" checked={selected.some(x => x.id === r.id)} onChange={() => toggle(r)} /> <b>{r.code}</b> · {r.description}</label></li>)}</ul>
              {results.length === 0 && <p>Nenhum item encontrado para este filtro.</p>}
            </>
          )}

          <h4>Inclusão (opcional)</h4>
          <label>Estudante com PEI<select value={form.inclusion_case_id} onChange={e => set('inclusion_case_id', e.target.value)}><option value="">—</option>{cases.map(c => <option key={c.id} value={c.id}>{c.student_name}</option>)}</select></label>
          {accs.length > 0 && <div className="inc-ev-note">Adaptações previstas no PEI: <ul>{accs.map(a => <li key={a.id}>{a.category.replaceAll('_', ' ')}: {a.description}</li>)}</ul></div>}
          <label>Como o planejamento atende a esse estudante<textarea rows={2} value={form.inclusion_note} onChange={e => set('inclusion_note', e.target.value)} placeholder="Não registre diagnóstico nem laudo aqui." /></label>

          <label>Situação<select value={form.status} onChange={e => set('status', e.target.value as PlanForm['status'])}><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="arquivado">Arquivado</option></select></label>
          <div className="inc-form-actions"><button className="inc-btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button><button className="inc-btn-secondary" disabled={saving} onClick={() => { setForm(null); setSelected([]); }}>Cancelar</button></div>
        </div>
      )}

      {!form && plans.map(p => (
        <div key={p.id} className="inc-plan-card">
          <div className="inc-plan-header"><span className="inc-plan-student">{p.title}</span><span className="inc-badge">{p.status}</span></div>
          <div className="inc-plan-meta"><span>{stageLabel(p.stage)} · {p.year_label}</span><span>{p.component}</span>{p.period_label && <span>{p.period_label}</span>}</div>
          <div className="inc-plan-meta"><button className="inc-btn-small" onClick={() => edit(p.id)}>Abrir</button></div>
        </div>
      ))}
      {!form && plans.length === 0 && <div className="inc-empty">Nenhum planejamento ainda.</div>}
    </div>
  );
}
