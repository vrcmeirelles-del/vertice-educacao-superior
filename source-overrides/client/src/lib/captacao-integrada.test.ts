import { describe, it, expect, vi, beforeEach } from 'vitest';
const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from, rpc } }));
import { CAPTACAO_CAPABILITIES, CaptacaoConflict, validateCaptacaoPublicUrl, validateCaptacaoLandingUrl, connectionPayload, assetPayload, campaignPayload, captacaoCampaignLink, createCaptacaoCampaign, updateCaptacaoCampaign, fetchCaptacaoIntegrada, canManageCaptacao, type CampaignInput, type CaptacaoCampaign } from './captacao-integrada';
const ies = 'bb000000-0000-4000-8000-000000000001';
const key = 'ee000000-0000-4000-8000-000000000001';
const account = 'cc000000-0000-4000-8000-000000000001';
const input: CampaignInput = { connection_id: account, name: 'Vestibular', public_url: 'https://ies.edu.br/vestibular', external_campaign_id: null, capture_mode: 'landing', form_asset_id: null, status: 'draft' };
const saved = { ...input, institution_id: ies, id: key, version: 1 } as CaptacaoCampaign;
beforeEach(() => { vi.resetAllMocks(); });
function chain(result: unknown) {
  const builder: any = {};
  for (const method of ['insert', 'update', 'select', 'eq', 'gt', 'order', 'limit']) builder[method] = vi.fn(() => builder);
  builder.single = vi.fn(async () => result); builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}
describe('preparação e limites', () => {
  it('declara apenas preparação implementada', () => expect(Object.entries(CAPTACAO_CAPABILITIES).filter(([, enabled]) => enabled)).toEqual([['setup', true]]));
  it('aceita perfis das redes oficiais', () => {
    expect(validateCaptacaoPublicUrl('meta', ' https://instagram.com/ies ')).toBe('https://instagram.com/ies');
    expect(validateCaptacaoPublicUrl('tiktok', 'https://www.tiktok.com/@ies')).toBe('https://www.tiktok.com/@ies');
  });
  it.each(['https://evil.com/ies', 'https://instagram.com.evil.com/ies', 'https://user:pass@instagram.com/ies', 'https://instagram.com/ies?token=x', 'https://instagram.com/ies#x', 'http://instagram.com/ies', 'https://tiktok.com/@ies'])('recusa perfil inválido %s', url => expect(() => validateCaptacaoPublicUrl('meta', url)).toThrow());
  it.each(['http://ies.edu.br', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://user:secret@ies.edu.br/', 'https://ies.edu.br/?token=x', 'https://ies.edu.br/#secret', 'https://ies.edu.br:8443/'])('recusa destino inválido %s', url => expect(() => validateCaptacaoLandingUrl(url)).toThrow());
  it('descarta campos de estado e sincronização enviados pelo chamador', () => {
    expect(connectionPayload({ provider: 'meta', label: ' Conta ', public_url: 'https://instagram.com/ies', account_external_id: '123', status: 'active', token: 'secret' } as any)).toEqual({ provider: 'meta', label: 'Conta', public_url: 'https://instagram.com/ies', account_external_id: '123' });
    expect(campaignPayload({ ...input, verification: 'verified' } as any)).toEqual(input);
  });
  it('valida campos de ativo e formulário', () => {
    expect(() => assetPayload({ connection_id: account, kind: 'form', label: 'Form', external_id: 'token?=123' })).toThrow();
    expect(() => campaignPayload({ ...input, capture_mode: 'native' })).toThrow();
    expect(() => campaignPayload({ ...input, status: 'active' } as any)).toThrow();
  });
  it('gera link somente com metadados públicos gerados, sem nome ou ID pessoal', () => {
    const link = new URL(captacaoCampaignLink(saved, 'meta')!);
    expect(link.origin + link.pathname).toBe(input.public_url);
    expect([...link.searchParams]).toEqual([['utm_source', 'meta'], ['utm_medium', 'paid_social'], ['utm_campaign', `vxc_${key}`]]);
    expect(captacaoCampaignLink({ ...saved, capture_mode: 'native' }, 'meta')).toBeNull();
  });
});
describe('persistência por IES, falhas e concorrência', () => {
  it('consulta permissão no servidor, sem assumir que leitura autoriza escrita', async () => {
    rpc.mockResolvedValue({ data: false, error: null }); expect(await canManageCaptacao(ies)).toBe(false);
    expect(rpc).toHaveBeenCalledWith('vertice_captacao_access', { p_institution: ies });
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } }); await expect(canManageCaptacao(ies)).rejects.toEqual({ code: '42501' });
  });
  it('reutiliza uma criação já confirmada após timeout sem sobrescrever', async () => {
    const first = chain({ data: null, error: { code: '23505' } }), prior = chain({ data: saved, error: null });
    from.mockReturnValueOnce(first).mockReturnValueOnce(prior);
    expect(await createCaptacaoCampaign(ies, key, input)).toEqual(saved);
    expect(first.insert).toHaveBeenCalledWith({ ...input, institution_id: ies, id: key });
    expect(prior.eq).toHaveBeenCalledWith('institution_id', ies);
    expect(prior.update).not.toHaveBeenCalled();
  });
  it('não aceita replay com conteúdo alterado nem ID de outra IES', async () => {
    for (const data of [{ ...saved, name: 'Alterada' }, null]) {
      from.mockReturnValueOnce(chain({ error: { code: '23505' } })).mockReturnValueOnce(chain({ data, error: null }));
      await expect(createCaptacaoCampaign(ies, key, input)).rejects.toBeInstanceOf(CaptacaoConflict);
    }
  });
  it('erro de rede não é tratado como criação confirmada', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: { code: 'NETWORK' } }));
    await expect(createCaptacaoCampaign(ies, key, input)).rejects.toEqual({ code: 'NETWORK' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('filtra versão e IES; zero linhas retorna conflito', async () => {
    const builder = chain({ data: null, error: null }); from.mockReturnValue(builder);
    await expect(updateCaptacaoCampaign(saved, input)).rejects.toBeInstanceOf(CaptacaoConflict);
    expect(builder.eq).toHaveBeenCalledWith('institution_id', ies);
    expect(builder.eq).toHaveBeenCalledWith('version', 1);
    expect(builder.update).toHaveBeenCalledWith({ ...input, version: 2 });
  });
  it('percorre páginas com cursor e mantém a IES em toda consulta', async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({ id: String(i).padStart(5, '0') }));
    const first = chain({ data: page, error: null }), assets = chain({ data: [], error: null }), campaigns = chain({ data: [], error: null }), last = chain({ data: [{ id: '00500' }], error: null });
    from.mockReturnValueOnce(first).mockReturnValueOnce(assets).mockReturnValueOnce(campaigns).mockReturnValueOnce(last);
    expect((await fetchCaptacaoIntegrada(ies)).connections).toHaveLength(501);
    for (const query of [first, assets, campaigns, last]) expect(query.eq).toHaveBeenCalledWith('institution_id', ies);
    expect(last.gt).toHaveBeenCalledWith('id', '00499');
  });
  it('erro de uma fonte não vira lista vazia ou sucesso parcial silencioso', async () => {
    from.mockReturnValue(chain({ data: null, error: { code: '42501' } }));
    await expect(fetchCaptacaoIntegrada(ies)).rejects.toEqual({ code: '42501' });
  });
});
