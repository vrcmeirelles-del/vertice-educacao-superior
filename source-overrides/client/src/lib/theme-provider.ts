// ============================================================
// Vértice – White-Label Theme Provider
// Arquivo: client/theme-provider.ts
// Importar e chamar applyInstitutionTheme() após login
// ============================================================

import { supabase } from './supabase';

export interface InstitutionTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  sidebar_style: 'dark' | 'light';
  powered_by: boolean;
  institution_name: string;
}

// Defaults = visual padrão da Vértice
const VERTICE_DEFAULTS: InstitutionTheme = {
  primary_color: '#1a56db',
  secondary_color: '#1e293b',
  accent_color: '#f59e0b',
  logo_url: '/assets/vertice-logo.svg',
  favicon_url: '/favicon.ico',
  sidebar_style: 'dark',
  powered_by: true,
  institution_name: 'Vértice Educação Superior',
};

// ---------- Core: buscar tema ----------

export async function fetchInstitutionTheme(
  institutionId: string
): Promise<InstitutionTheme> {
  const { data, error } = await supabase.rpc('get_institution_theme', {
    p_institution_id: institutionId,
  });

  if (error || !data) {
    console.warn('[theme] Falha ao carregar tema, usando padrão Vértice', error);
    return VERTICE_DEFAULTS;
  }

  return { ...VERTICE_DEFAULTS, ...(data as Partial<InstitutionTheme>) };
}

// ---------- Core: aplicar tema no DOM ----------

export function injectTheme(theme: InstitutionTheme): void {
  const root = document.documentElement;

  // Cores principais → CSS variables
  root.style.setProperty('--color-primary', theme.primary_color);
  root.style.setProperty('--color-secondary', theme.secondary_color);
  root.style.setProperty('--color-accent', theme.accent_color);

  // Derivadas automáticas (hover, bg-light, ring)
  root.style.setProperty('--color-primary-hover', adjustBrightness(theme.primary_color, -15));
  root.style.setProperty('--color-primary-light', adjustBrightness(theme.primary_color, 85));
  root.style.setProperty('--color-primary-ring', theme.primary_color + '33'); // 20% opacity

  // Sidebar
  root.style.setProperty(
    '--sidebar-bg',
    theme.sidebar_style === 'dark' ? theme.secondary_color : '#ffffff'
  );
  root.style.setProperty(
    '--sidebar-text',
    theme.sidebar_style === 'dark' ? '#e2e8f0' : '#1e293b'
  );

  // Logo e nome
  updateLogoElements(theme);

  // Favicon
  if (theme.favicon_url) {
    updateFavicon(theme.favicon_url);
  }

  // Powered by
  togglePoweredBy(theme.powered_by);

  // Salvar no sessionStorage para reload rápido
  sessionStorage.setItem('vertice_theme', JSON.stringify(theme));
}

// ---------- Ponto de entrada principal ----------

export async function applyInstitutionTheme(institutionId: string): Promise<void> {
  // Tenta cache rápido primeiro (evita flash branco no reload)
  const cached = sessionStorage.getItem('vertice_theme');
  if (cached) {
    try {
      injectTheme(JSON.parse(cached));
    } catch { /* ignora cache corrompido */ }
  }

  // Busca tema atualizado
  const theme = await fetchInstitutionTheme(institutionId);
  injectTheme(theme);
}

// Para master: resetar ao visual padrão da Vértice
export function resetToVerticeTheme(): void {
  injectTheme(VERTICE_DEFAULTS);
  sessionStorage.removeItem('vertice_theme');
}

// ---------- Helpers ----------

function updateLogoElements(theme: InstitutionTheme): void {
  // Header logo
  const headerLogo = document.querySelector<HTMLImageElement>('[data-theme="logo"]');
  if (headerLogo && theme.logo_url) {
    headerLogo.src = theme.logo_url;
    headerLogo.alt = theme.institution_name;
  }

  // Nome da instituição no header
  const nameEl = document.querySelector('[data-theme="institution-name"]');
  if (nameEl) {
    nameEl.textContent = theme.institution_name;
  }
}

function updateFavicon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

function togglePoweredBy(show: boolean): void {
  const el = document.querySelector('[data-theme="powered-by"]');
  if (el) {
    (el as HTMLElement).style.display = show ? 'flex' : 'none';
  }
}

/** Clareia (positivo) ou escurece (negativo) uma cor hex */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
