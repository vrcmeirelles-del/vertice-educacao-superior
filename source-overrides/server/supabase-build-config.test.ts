import { describe, it, expect } from 'vitest';
import { resolveSupabaseBuildConfig } from '../client/src/lib/supabase-config';
const separate = { VITE_DEPLOYMENT_TARGET: 'homologacao', VITE_SUPABASE_URL: 'https://isolated123.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' };
describe('isolamento da configuração Supabase', () => {
  it('conserva a configuração produtiva sem overrides', () => {
    expect(resolveSupabaseBuildConfig({}).url).toBe('https://qvetbbmviatxxatzzuzc.supabase.co');
  });
  it('seleciona o projeto isolado explicitamente configurado', () => {
    expect(resolveSupabaseBuildConfig(separate)).toMatchObject({ url: separate.VITE_SUPABASE_URL, homologacao: true });
  });
  it('recusa homologação incompleta ou produtiva', () => {
    for (const env of [{ VITE_DEPLOYMENT_TARGET: 'homologacao' }, { ...separate, VITE_SUPABASE_URL: '' }, { ...separate, VITE_SUPABASE_URL: 'https://qvetbbmviatxxatzzuzc.supabase.co' }]) {
      expect(() => resolveSupabaseBuildConfig(env)).toThrow();
    }
  });
  it('recusa destinos adulterados e chaves privilegiadas', () => {
    for (const url of ['http://isolated123.supabase.co', 'https://isolated123.supabase.co.evil.test', 'https://isolated123.supabase.co/path', 'https://u:p@isolated123.supabase.co', 'https://isolated123.supabase.co?x=1']) {
      expect(() => resolveSupabaseBuildConfig({ ...separate, VITE_SUPABASE_URL: url })).toThrow();
    }
    expect(() => resolveSupabaseBuildConfig({ ...separate, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic' })).toThrow();
    expect(() => resolveSupabaseBuildConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' })).toThrow();
  });
});
