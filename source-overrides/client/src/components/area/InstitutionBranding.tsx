import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EMPTY_BRANDING, HEX, normalizeLogo, responseGate, textColor, validateBranding, type InstitutionBranding as Branding } from '@/lib/institution-branding';

export function BrandingFields({ value, onChange, disabled = false, onBusy }: { value: Branding; onChange: (v: Branding) => void; disabled?: boolean; onBusy?: (v: boolean) => void }) {
  const [error, setError] = useState(''), [suggested, setSuggested] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const gate = useRef(responseGate());
  const latest = useRef(value); latest.current = value;
  useEffect(() => () => gate.current.invalidate(), []);
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <legend>Identidade dos modelos padrão</legend>
    <label>Logo (PNG/JPEG, até 2 MB)<input type="file" accept="image/png,image/jpeg" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      const current = gate.current.ticket(); setBusy(true); onBusy?.(true); setError('');
      try { const logo = await normalizeLogo(file); if (current()) { onChange({ ...latest.current, logo_data: logo.data }); setSuggested(logo.suggested); } }
      catch (err) { if (current()) setError(err instanceof Error ? err.message : 'Logo inválida.'); }
      finally { if (current()) { setBusy(false); onBusy?.(false); } }
    }} /></label>
    {busy && <p role="status">Preparando logo…</p>}
    {value.logo_data && <button type="button" onClick={() => { gate.current.invalidate(); setBusy(false); onBusy?.(false); setSuggested(null); onChange({ ...value, logo_data: null }); }}>Remover logo</button>}
    <label>Texto do cabeçalho (até 600 caracteres)<textarea maxLength={600} rows={4} value={value.header_text} onChange={e => onChange({ ...value, header_text: e.target.value })} /></label>
    <label>Cor institucional (HEX)<input aria-label="Código HEX" value={value.theme_color ?? ''} placeholder="#RRGGBB" onChange={e => onChange({ ...value, theme_color: e.target.value || null })} /></label>
    <input aria-label="Selecionar cor institucional" type="color" value={value.theme_color && HEX.test(value.theme_color) ? value.theme_color : '#222222'} onChange={e => onChange({ ...value, theme_color: e.target.value })} />
    <button type="button" onClick={() => onChange({ ...value, theme_color: null })}>Sem cor institucional</button>
    {suggested && <button type="button" onClick={() => onChange({ ...value, theme_color: suggested })}>Usar sugestão da logo: {suggested}</button>}
    <p>O texto recebe um tom com contraste mínimo de 4,5:1 sobre branco. A cor será aplicada somente aos estilos temáticos aprovados.</p>
    <div aria-label="Prévia do cabeçalho" style={{ display: 'grid', gridTemplateColumns: '25% 75%', background: '#fff', color: textColor(value.theme_color), border: '1px solid #ccc', padding: 12, alignItems: 'center' }}>
      <div>{value.logo_data ? <img src={value.logo_data} alt="Logo institucional" style={{ width: '100%', height: 'auto' }} /> : <span>Logo</span>}</div>
      <div style={{ paddingLeft: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value.header_text || 'Texto do cabeçalho'}</div>
    </div>
    <small>Prévia apenas do cabeçalho; a paginação depende do documento e do editor.</small>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}

function BrandingPanel({ institutionId, editable }: { institutionId: string; editable: boolean }) {
  const [value, setValue] = useState<Branding>({ ...EMPTY_BRANDING });
  const [version, setVersion] = useState<string | null>(null), [error, setError] = useState(''), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [imageBusy, setImageBusy] = useState(false);
  const gate = useRef(responseGate());
  useEffect(() => {
    const current = gate.current.ticket(); setValue({ ...EMPTY_BRANDING }); setVersion(null); setError('');
    supabase.from('vertice_institutions').select('document_branding,updated_at').eq('id', institutionId).single().then(({ data, error }) => {
      if (!current()) return;
      if (error || !data) setError('Não foi possível carregar a identidade institucional.');
      else { setValue(data.document_branding ?? { ...EMPTY_BRANDING }); setVersion(data.updated_at); }
    });
    return () => gate.current.invalidate();
  }, [institutionId]);
  async function save() {
    const current = gate.current.ticket(); setSaving(true); setError(''); setSaved(false);
    try {
      const branding = validateBranding(value);
      const { data, error } = await supabase.rpc('vertice_save_document_branding', { institution: institutionId, expected_updated_at: version, branding });
      if (error) throw error;
      if (current()) { setVersion(data.updated_at); setValue(data.document_branding); setSaved(true); }
    } catch { if (current()) setError('Não foi possível salvar. Confira seu acesso/MFA. Se houve outra edição, reabra a instituição antes de tentar novamente.'); }
    finally { if (current()) setSaving(false); }
  }
  return <section className="area-panel"><h3>Identidade institucional</h3>
    {!version ? <p role="status">Carregando identidade…</p> : <BrandingFields value={value} onChange={v => { setValue(v); setSaved(false); }} disabled={!editable || saving} onBusy={setImageBusy} />}
    {editable && <button type="button" className="corp-button" disabled={!version || saving || imageBusy} onClick={save}>{saving ? 'Salvando…' : 'Salvar identidade'}</button>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Identidade salva.</p>}
  </section>;
}
export default function InstitutionBranding(props: { institutionId: string; editable: boolean }) { return <BrandingPanel key={props.institutionId} {...props} />; }
