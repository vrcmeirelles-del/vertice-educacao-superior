import { supabase } from './supabase';

export const CAPTACAO_CAPABILITIES = Object.freeze({ setup: true, providerAuthorization: false, liveIngestion: false, adMetrics: false, whatsappDelivery: false, academicEnrollmentLink: false });
export type CaptacaoProvider = 'meta' | 'tiktok';
type Versioned = { id: string; institution_id: string; version: number; created_at: string; updated_at: string };
export type CaptacaoConnection = Versioned & {
  provider: CaptacaoProvider; label: string; public_url: string; account_external_id: string | null;
  status: 'prepared'; last_test_at: null; last_successful_sync_at: null;
};
export type CaptacaoAsset = Versioned & {
  connection_id: string; kind: 'page' | 'form'; external_id: string; label: string; verification: 'unverified';
};
export type CaptacaoCampaign = Versioned & {
  connection_id: string; name: string; public_url: string | null; external_campaign_id: string | null;
  capture_mode: 'landing' | 'native'; form_asset_id: string | null; status: 'draft' | 'archived'; verification: 'unverified';
};
export type CaptacaoSetup = { connections: CaptacaoConnection[]; assets: CaptacaoAsset[]; campaigns: CaptacaoCampaign[] };
export type ConnectionInput = Pick<CaptacaoConnection, 'provider' | 'label' | 'public_url' | 'account_external_id'>;
export type AssetInput = Pick<CaptacaoAsset, 'connection_id' | 'kind' | 'external_id' | 'label'>;
export type CampaignInput = Pick<CaptacaoCampaign, 'connection_id' | 'name' | 'public_url' | 'external_campaign_id' | 'capture_mode' | 'form_asset_id' | 'status'>;
export class CaptacaoConflict extends Error {
  constructor() { super('Este cadastro mudou ou esta tentativa já foi usada com outros dados. Atualize e revise antes de salvar novamente.'); }
}
export function validateCaptacaoPublicUrl(provider: CaptacaoProvider, value: string): string {
  const url = value.trim();
  const pattern = provider === 'meta' ? /^https:\/\/(www\.)?(instagram\.com|facebook\.com)\/[A-Za-z0-9_./-]+$/ : /^https:\/\/(www\.)?tiktok\.com\/@?[A-Za-z0-9_./-]+$/;
  if (!['meta', 'tiktok'].includes(provider) || url.length > 500 || !pattern.test(url)) throw new Error('Use o link público HTTPS da rede selecionada, sem parâmetros, senha ou token.');
  return url;
}
export function validateCaptacaoLandingUrl(value: string): string {
  const url = value.trim();
  if (url.length > 500 || !/^https:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(\/[A-Za-z0-9_./~-]*)?$/.test(url)) throw new Error('Use a página pública HTTPS da IES, sem parâmetros, credenciais, IP ou fragmento.');
  return url;
}
function id(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Identificador inválido.');
  return value.toLowerCase();
}
function title(value: string): string {
  const result = value.trim();
  if (!result || result.length > 160 || /[\u0000-\u001f]/.test(result)) throw new Error('Informe um nome de até 160 caracteres, sem dados pessoais ou credenciais.');
  return result;
}
function externalId(value: string | null): string | null {
  const result = value?.trim() || null;
  if (result && !/^[A-Za-z0-9_.-]{1,120}$/.test(result)) throw new Error('Informe somente o identificador público, nunca uma chave ou token.');
  return result;
}
export function connectionPayload(input: ConnectionInput): ConnectionInput {
  return { provider: input.provider, label: title(input.label), public_url: validateCaptacaoPublicUrl(input.provider, input.public_url), account_external_id: externalId(input.account_external_id) };
}
export function assetPayload(input: AssetInput): AssetInput {
  if (!['page', 'form'].includes(input.kind)) throw new Error('Tipo de ativo inválido.');
  const external = externalId(input.external_id);
  if (!external) throw new Error('Informe o ID público do ativo.');
  return { connection_id: id(input.connection_id), kind: input.kind, external_id: external, label: title(input.label) };
}
export function campaignPayload(input: CampaignInput): CampaignInput {
  if (!['draft', 'archived'].includes(input.status) || !['landing', 'native'].includes(input.capture_mode)) throw new Error('Estado ou modo de captura inválido.');
  if (input.capture_mode === 'native' && !input.form_asset_id) throw new Error('Selecione o formulário desta conexão.');
  return { connection_id: id(input.connection_id), name: title(input.name), external_campaign_id: externalId(input.external_campaign_id), capture_mode: input.capture_mode,
    public_url: input.capture_mode === 'landing' ? validateCaptacaoLandingUrl(input.public_url || '') : null,
    form_asset_id: input.capture_mode === 'native' ? id(input.form_asset_id!) : null, status: input.status };
}
// Only non-personal, generated campaign metadata is added to the destination.
// This function never fetches the URL or installs a conversion collector.
export function captacaoCampaignLink(campaign: Pick<CaptacaoCampaign, 'id' | 'capture_mode' | 'public_url'>, provider: CaptacaoProvider): string | null {
  if (campaign.capture_mode !== 'landing' || !campaign.public_url) return null;
  if (!['meta', 'tiktok'].includes(provider)) throw new Error('Provedor inválido.');
  const url = new URL(validateCaptacaoLandingUrl(campaign.public_url));
  url.searchParams.set('utm_source', provider);
  url.searchParams.set('utm_medium', 'paid_social');
  url.searchParams.set('utm_campaign', `vxc_${id(campaign.id)}`);
  return url.toString();
}
const tables = { connections: 'vertice_captacao_connections', assets: 'vertice_captacao_assets', campaigns: 'vertice_captacao_campaigns' } as const;
export async function canManageCaptacao(institutionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('vertice_captacao_access', { p_institution: id(institutionId) });
  if (error) throw error;
  return data === true;
}
async function list<T>(table: string, institutionId: string): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    let query = supabase.from(table).select('*').eq('institution_id', id(institutionId)).order('id').limit(500);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []) as T[]);
    if (!data || data.length < 500) return rows;
    const next = String(data[data.length - 1].id);
    if (next === after) throw new Error('Paginação interrompida; consulta incompleta. Atualize novamente.');
    after = next;
  }
}
export async function fetchCaptacaoIntegrada(institutionId: string): Promise<CaptacaoSetup> {
  const [connections, assets, campaigns] = await Promise.all([list<CaptacaoConnection>(tables.connections, institutionId), list<CaptacaoAsset>(tables.assets, institutionId), list<CaptacaoCampaign>(tables.campaigns, institutionId)]);
  return { connections, assets, campaigns };
}
// Request IDs are created once per form, reused on retry, never used to authorize reads.
async function create<T>(table: string, institutionId: string, requestId: string, payload: Record<string, unknown>): Promise<T> {
  const row = { ...payload, institution_id: id(institutionId), id: id(requestId) };
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (!error) return data as T;
  if (error.code !== '23505') throw error;
  const previous = await supabase.from(table).select('*').eq('institution_id', row.institution_id).eq('id', row.id).maybeSingle();
  if (previous.error) throw previous.error;
  if (!previous.data || Object.entries(row).some(([key, value]) => previous.data[key] !== value)) throw new CaptacaoConflict();
  return previous.data as T;
}
async function update<T>(table: string, institutionId: string, rowId: string, expectedVersion: number, payload: Record<string, unknown>): Promise<T> {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CaptacaoConflict();
  const { data, error } = await supabase.from(table).update({ ...payload, version: expectedVersion + 1 }).eq('institution_id', id(institutionId)).eq('id', id(rowId)).eq('version', expectedVersion).select().maybeSingle();
  if (error?.code === '40001') throw new CaptacaoConflict();
  if (error) throw error;
  if (!data) throw new CaptacaoConflict();
  return data as T;
}
export const createCaptacaoConnection = (ies: string, key: string, input: ConnectionInput) => create<CaptacaoConnection>(tables.connections, ies, key, connectionPayload(input));
export const updateCaptacaoConnection = (row: CaptacaoConnection, input: ConnectionInput) => update<CaptacaoConnection>(tables.connections, row.institution_id, row.id, row.version, connectionPayload(input));
export const createCaptacaoAsset = (ies: string, key: string, input: AssetInput) => create<CaptacaoAsset>(tables.assets, ies, key, assetPayload(input));
export const updateCaptacaoAsset = (row: CaptacaoAsset, input: AssetInput) => update<CaptacaoAsset>(tables.assets, row.institution_id, row.id, row.version, assetPayload(input));
export const createCaptacaoCampaign = (ies: string, key: string, input: CampaignInput) => create<CaptacaoCampaign>(tables.campaigns, ies, key, campaignPayload(input));
export const updateCaptacaoCampaign = (row: CaptacaoCampaign, input: CampaignInput) => update<CaptacaoCampaign>(tables.campaigns, row.institution_id, row.id, row.version, campaignPayload(input));
