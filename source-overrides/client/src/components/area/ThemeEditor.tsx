import { HelpLabel } from '@/components/ContextHelp';
// ============================================================
// Vértice – Editor de Tema (componente para o painel do gestor)
// Arquivo: client/components/ThemeEditor.tsx
// Permite ao gestor/master configurar cores e logo da IES
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { InstitutionTheme } from '@/lib/theme-provider';
import { injectTheme } from '@/lib/theme-provider';

interface ThemeEditorProps {
  institutionId: string;
  isMaster: boolean;
}

export function ThemeEditor({ institutionId, isMaster }: ThemeEditorProps) {
  const [theme, setTheme] = useState<Partial<InstitutionTheme>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadTheme();
  }, [institutionId]);

  async function loadTheme() {
    const { data } = await supabase
      .from('vertice_institutions')
      .select('ui_branding, name')
      .eq('id', institutionId)
      .single();

    if (data?.ui_branding) {
      setTheme({ ...data.ui_branding, institution_name: data.name });
    }
  }

  async function saveTheme() {
    setSaving(true);
    setFeedback('');

    const { error } = await supabase
      .from('vertice_institutions')
      .update({ ui_branding: theme })
      .eq('id', institutionId);

    if (error) {
      setFeedback('Erro ao salvar: ' + error.message);
    } else {
      setFeedback('Tema salvo! O visual já está atualizado.');
      injectTheme(theme as InstitutionTheme); // aplica ao vivo
    }
    setSaving(false);
  }

  function handleColor(field: keyof InstitutionTheme, value: string) {
    const updated = { ...theme, [field]: value };
    setTheme(updated);
    // Preview ao vivo
    injectTheme(updated as InstitutionTheme);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const path = `institutions/${institutionId}/logo_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('vertice-assets').upload(path, file, {
      upsert: true,
    });

    if (!error) {
      const { data: urlData } = supabase.storage.from('vertice-assets').getPublicUrl(path);
      handleColor('logo_url' as any, urlData.publicUrl);
    }
  }

  return (
    <div className="theme-editor">
      <h3>Personalização Visual</h3>
      <p className="theme-editor__hint">
        Configure as cores e a logo para que o painel reflita a identidade da sua instituição.
      </p>

      <div className="theme-editor__grid">
        {/* Cor primária */}
        <HelpLabel className="theme-editor__field">
          <span>Cor principal</span>
          <div className="theme-editor__color-row">
            <input
              type="color"
              value={theme.primary_color || '#1a56db'}
              onChange={(e) => handleColor('primary_color', e.target.value)}
            />
            <input
              type="text"
              value={theme.primary_color || '#1a56db'}
              onChange={(e) => handleColor('primary_color', e.target.value)}
              placeholder="#1a56db"
              maxLength={7}
            />
          </div>
        </HelpLabel>

        {/* Cor secundária */}
        <HelpLabel className="theme-editor__field">
          <span>Cor secundária</span>
          <div className="theme-editor__color-row">
            <input
              type="color"
              value={theme.secondary_color || '#1e293b'}
              onChange={(e) => handleColor('secondary_color', e.target.value)}
            />
            <input
              type="text"
              value={theme.secondary_color || '#1e293b'}
              onChange={(e) => handleColor('secondary_color', e.target.value)}
              placeholder="#1e293b"
              maxLength={7}
            />
          </div>
        </HelpLabel>

        {/* Cor de destaque */}
        <HelpLabel className="theme-editor__field">
          <span>Cor de destaque</span>
          <div className="theme-editor__color-row">
            <input
              type="color"
              value={theme.accent_color || '#f59e0b'}
              onChange={(e) => handleColor('accent_color', e.target.value)}
            />
            <input
              type="text"
              value={theme.accent_color || '#f59e0b'}
              onChange={(e) => handleColor('accent_color', e.target.value)}
              placeholder="#f59e0b"
              maxLength={7}
            />
          </div>
        </HelpLabel>

        {/* Logo */}
        <HelpLabel className="theme-editor__field">
          <span>Logo da instituição</span>
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
          {theme.logo_url && (
            <img
              src={theme.logo_url as string}
              alt="Preview"
              className="theme-editor__logo-preview"
            />
          )}
        </HelpLabel>

        {/* Estilo sidebar */}
        <HelpLabel className="theme-editor__field">
          <span>Sidebar</span>
          <select
            value={(theme.sidebar_style as string) || 'dark'}
            onChange={(e) => handleColor('sidebar_style' as any, e.target.value)}
          >
            <option value="dark">Escura</option>
            <option value="light">Clara</option>
          </select>
        </HelpLabel>

        {/* Powered by (só master pode desligar) */}
        {isMaster && (
          <HelpLabel className="theme-editor__field theme-editor__field--checkbox">
            <input
              type="checkbox"
              checked={theme.powered_by !== false}
              onChange={(e) => handleColor('powered_by' as any, e.target.checked as any)}
            />
            <span>Exibir "Powered by Vértice"</span>
          </HelpLabel>
        )}
      </div>

      <div className="theme-editor__actions">
        <button onClick={saveTheme} disabled={saving} className="btn btn--primary">
          {saving ? 'Salvando...' : 'Salvar tema'}
        </button>
        {feedback && <span className="theme-editor__feedback">{feedback}</span>}
      </div>
    </div>
  );
}
