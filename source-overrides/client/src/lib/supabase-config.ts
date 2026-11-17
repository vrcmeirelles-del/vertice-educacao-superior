export type SupabaseBuildEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_DEPLOYMENT_TARGET?: string;
};

const productionUrl = 'https://qvetbbmviatxxatzzuzc.supabase.co';
const productionKey = 'sb_publishable_id8AJN7W1v1TyYIp4R7yTg_gclHJ0T1';

export function resolveSupabaseBuildConfig(env: SupabaseBuildEnv) {
  const homologacao = env.VITE_DEPLOYMENT_TARGET === 'homologacao';
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key) || (homologacao && (!url || !key))) {
    throw new Error('Configure endereço e chave pública próprios para este ambiente.');
  }
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname)
      || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash
      || parsed.pathname !== '/') throw new Error('Endereço Supabase inválido.');
    if (!key?.startsWith('sb_publishable_')) throw new Error('Use somente uma chave pública Supabase.');
    if (homologacao && (parsed.origin === productionUrl || key === productionKey)) {
      throw new Error('Homologação exige um projeto separado da produção.');
    }
    return { url: parsed.origin, publishableKey: key, homologacao };
  }
  return { url: productionUrl, publishableKey: productionKey, homologacao };
}

const config = resolveSupabaseBuildConfig({
  VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_DEPLOYMENT_TARGET: import.meta.env?.VITE_DEPLOYMENT_TARGET,
});
export const SUPABASE_URL = config.url;
export const SUPABASE_PUBLISHABLE_KEY = config.publishableKey;
