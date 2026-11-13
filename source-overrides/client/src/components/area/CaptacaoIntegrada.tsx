import { HelpLabel } from '@/components/ContextHelp';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  canManageCaptacao, fetchCaptacaoIntegrada, createCaptacaoConnection, updateCaptacaoConnection,
  createCaptacaoAsset, updateCaptacaoAsset, createCaptacaoCampaign, updateCaptacaoCampaign, captacaoCampaignLink,
  type CaptacaoSetup, type CaptacaoConnection, type CaptacaoAsset, type CaptacaoCampaign,
  type ConnectionInput, type AssetInput, type CampaignInput,
} from '@/lib/captacao-integrada';
import './captacao-integrada.css';

type Tab = 'Visão geral' | 'Conexões' | 'Campanhas' | 'Interessados' | 'Atendimento' | 'Inscrições e matrículas';
const tabs: Tab[] = ['Visão geral', 'Conexões', 'Campanhas', 'Interessados', 'Atendimento', 'Inscrições e matrículas'];
const providerName = (value: string) => value === 'meta' ? 'Meta / Instagram' : 'TikTok';
const empty: CaptacaoSetup = { connections: [], assets: [], campaigns: [] };
type Editor = { kind: 'connection'; row?: CaptacaoConnection } | { kind: 'asset'; row?: CaptacaoAsset } | { kind: 'campaign'; row?: CaptacaoCampaign };

// Remount the entire workspace on tenant changes: data, forms, retries, messages and tabs.
export default function CaptacaoIntegrada(props: { institutionId: string; institutionName: string; overview?: ReactNode }) {
  return <SetupWorkspace key={props.institutionId} {...props} />;
}
function SetupWorkspace({ institutionId, institutionName, overview }: { institutionId: string; institutionName: string; overview?: ReactNode }) {
  const [tab, setTab] = useState<Tab>('Visão geral');
  const [data, setData] = useState<CaptacaoSetup>(empty);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  async function load() {
    const sequence = ++request.current;
    setLoading(true); setError('');
    try {
      const canManage = await canManageCaptacao(institutionId);
      const result = canManage ? await fetchCaptacaoIntegrada(institutionId) : empty;
      if (!mounted.current || request.current !== sequence) return;
      setAllowed(canManage); setData(result); setQueriedAt(new Date().toISOString());
    } catch {
      if (!mounted.current || request.current !== sequence) return;
      setData(empty); setAllowed(false); setQueriedAt(null);
      setError('Configuração indisponível. Confira sua sessão, MFA e a implantação deste módulo com o administrador.');
    } finally {
      if (mounted.current && request.current === sequence) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; request.current += 1; };
  }, [institutionId]);
  function closeEditor() { setEditor(null); heading.current?.focus(); }
  async function saved() {
    if (!mounted.current) return;
    closeEditor(); setNotice('Preparação salva. A referência ainda não foi autorizada nem verificada no provedor.');
    await load();
  }
  async function copyLink(campaign: CaptacaoCampaign) {
    const connection = data.connections.find(row => row.id === campaign.connection_id);
    if (!connection) return;
    const link = captacaoCampaignLink(campaign, connection.provider);
    try {
      if (!link) return;
      await navigator.clipboard.writeText(link);
      if (mounted.current) setNotice('Link copiado. A página precisa incorporar a captura da Vértice para registrar conversões.');
    } catch { if (mounted.current) setNotice('Cópia automática indisponível. Selecione e copie o link exibido.'); }
  }
  return <section className="vxc-root" aria-label="Captação integrada por instituição">
    <div className="vxc-heading"><div><small>PREPARAÇÃO INSTITUCIONAL</small><h3 ref={heading} tabIndex={-1}>Da campanha ao vínculo com a IES</h3><p>{institutionName}</p></div><span className="vxc-badge">Configuração · sem coleta ativa</span></div>
    <p className="vxc-note">Organize contas, páginas, formulários e destinos por instituição. Salvar um endereço prepara o cadastro; o acesso aos dados exige autorização oficial da conta.</p>
    <nav className="vxc-tabs" aria-label="Áreas da captação">{tabs.map(item => <button type="button" key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => { closeEditor(); setTab(item); setNotice(''); }}>{item}</button>)}</nav>
    {tab === 'Visão geral' ? overview || <p>Indicadores não disponibilizados neste ambiente.</p> : <>
    {error && <p role="alert" className="vxc-error">{error}</p>}
    {notice && <p role="status" className="vxc-note">{notice}</p>}
    {loading ? <p role="status">Consultando configuração desta instituição…</p> : <>
      <div className="vxc-toolbar"><p>Última consulta: {queriedAt ? new Date(queriedAt).toLocaleString('pt-BR') : 'não informada'}<br />Última sincronização com provedores: não informada</p><button type="button" disabled={!!editor} onClick={() => void load()}>Atualizar configuração</button></div>
      {!allowed && !error && <p role="status">A configuração exige MFA e perfil de gestão autorizado nesta instituição.</p>}
      {allowed && <>
        {editor && <SetupEditor key={`${editor.kind}:${editor.row?.id || 'new'}`} editor={editor} institutionId={institutionId} data={data} onCancel={closeEditor} onSaved={saved} />}
        {tab === 'Conexões' && <>
          <ol className="vxc-steps"><li><b>1. Instituição</b><span>{institutionName}</span></li><li><b>2. Contas e ativos</b><span>Referências públicas por rede</span></li><li><b>3. Campanha e destino</b><span>Rascunho e link com UTM</span></li><li><b>4. Autorização</b><span>Aguardando implementação</span></li></ol>
          <div className="vxc-toolbar"><h4>Contas e fontes</h4><button type="button" disabled={!!editor} onClick={() => setEditor({ kind: 'connection' })}>Preparar conta</button></div>
          {!data.connections.length && <p>Nenhuma conta preparada para esta IES.</p>}
          <div className="vxc-cards">{data.connections.map(connection => <article className="vxc-card" key={connection.id}>
            <small>{providerName(connection.provider)}</small><h4>{connection.label}</h4><span className="vxc-badge">Preparação salva · não autorizada</span>
            <p>Conta informada: {connection.account_external_id || 'não informada'}</p><a href={connection.public_url} target="_blank" rel="noopener noreferrer">Abrir perfil público</a>
            <dl><dt>Último teste</dt><dd>Não executado</dd><dt>Última sincronização</dt><dd>Não informada</dd></dl>
            <button type="button" disabled={!!editor} onClick={() => setEditor({ kind: 'connection', row: connection })}>Editar conta {connection.label}</button>
            <h5>Páginas e formulários informados</h5>
            {data.assets.filter(asset => asset.connection_id === connection.id).map(asset => <p key={asset.id}>{asset.kind === 'form' ? 'Formulário' : 'Página'}: {asset.label} · não verificado <button type="button" disabled={!!editor} onClick={() => setEditor({ kind: 'asset', row: asset })}>Editar ativo {asset.label}</button></p>)}
          </article>)}</div>
          {!!data.connections.length && <button type="button" disabled={!!editor} onClick={() => setEditor({ kind: 'asset' })}>Informar página ou formulário</button>}
          <div className="vxc-cards vxc-future"><article className="vxc-card"><h4>WhatsApp</h4><p>Conta institucional, consentimentos e envio ainda não implementados neste módulo.</p></article><article className="vxc-card"><h4>Sistema acadêmico e Fato &amp; Ordem</h4><p>Vínculos dependem de fonte autorizada e conciliação institucional. A preparação social não confirma matrícula.</p></article></div>
        </>}
        {tab === 'Campanhas' && <>
          <div className="vxc-toolbar"><h4>Campanhas em preparação</h4><button type="button" disabled={!data.connections.length || !!editor} onClick={() => setEditor({ kind: 'campaign' })}>Preparar campanha</button></div>
          {!data.connections.length && <p>Prepare uma conta em Conexões antes de vincular uma campanha.</p>}
          {!data.campaigns.length && <p>Nenhuma campanha cadastrada nesta instituição.</p>}
          <div className="vxc-cards">{data.campaigns.map(campaign => {
            const connection = data.connections.find(row => row.id === campaign.connection_id);
            const link = connection ? captacaoCampaignLink(campaign, connection.provider) : null;
            return <article className="vxc-card" key={campaign.id}><small>{connection?.label}</small><h4>{campaign.name}</h4><span className="vxc-badge">{campaign.status === 'archived' ? 'Arquivada' : 'Rascunho'} · referência não verificada</span><p>{campaign.capture_mode === 'native' ? 'Formulário nativo informado; recepção ainda não habilitada.' : 'Página de destino; captura precisa ser incorporada na página.'}</p>
              {link && <><HelpLabel>Link de destino com identificação da campanha<textarea readOnly rows={3} value={link} /></HelpLabel><button type="button" onClick={() => void copyLink(campaign)}>Copiar link</button></>}
              <button type="button" disabled={!!editor} onClick={() => setEditor({ kind: 'campaign', row: campaign })}>Editar campanha {campaign.name}</button>
            </article>;
          })}</div><p className="vxc-note">Crie e impulsione anúncios no gerenciador oficial da rede. Este cadastro não cria anúncios nem identifica todos os visitantes.</p>
        </>}
        {['Interessados', 'Atendimento', 'Inscrições e matrículas'].includes(tab) && <div className="vxc-card"><h4>{tab}</h4><p>{tab === 'Interessados' ? 'A captura nominal ainda não está habilitada. Nenhum interessado é criado a partir de um link salvo.' : tab === 'Atendimento' ? 'Fila e envio WhatsApp ainda não estão habilitados. Nenhuma mensagem é enviada por esta configuração.' : 'Inscrições e matrículas exigem confirmação da fonte acadêmica e vínculo da IES. Esta etapa ainda não está habilitada.'}</p></div>}
      </>}
    </>}
    </>}
  </section>;
}

function SetupEditor({ editor, institutionId, data, onCancel, onSaved }: { editor: Editor; institutionId: string; data: CaptacaoSetup; onCancel: () => void; onSaved: () => Promise<void> }) {
  const row = editor.row;
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const [connectionId, setConnectionId] = useState(editor.kind !== 'connection' ? editor.row?.connection_id || data.connections[0]?.id || '' : '');
  const [mode, setMode] = useState(editor.kind === 'campaign' ? editor.row?.capture_mode || 'landing' : 'landing');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; form.current?.querySelector<HTMLElement>('input,select')?.focus(); return () => { alive.current = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    const get = (name: string) => String(values.get(name) || '');
    try {
      if (editor.kind === 'connection') {
        const input: ConnectionInput = { provider: get('provider') as ConnectionInput['provider'], label: get('label'), public_url: get('url'), account_external_id: get('external') || null };
        if (editor.row) await updateCaptacaoConnection(editor.row, input); else await createCaptacaoConnection(institutionId, key, input);
      } else if (editor.kind === 'asset') {
        const input: AssetInput = { connection_id: connectionId, kind: get('kind') as AssetInput['kind'], label: get('label'), external_id: get('external') };
        if (editor.row) await updateCaptacaoAsset(editor.row, input); else await createCaptacaoAsset(institutionId, key, input);
      } else {
        const input: CampaignInput = { connection_id: connectionId, name: get('label'), public_url: get('url') || null, external_campaign_id: get('external') || null, capture_mode: mode as CampaignInput['capture_mode'], form_asset_id: get('form') || null, status: get('status') as CampaignInput['status'] };
        if (editor.row) await updateCaptacaoCampaign(editor.row, input); else await createCaptacaoCampaign(institutionId, key, input);
      }
      if (alive.current) await onSaved();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Não foi possível salvar. Confira a sessão/MFA e atualize a configuração. O rascunho foi mantido nesta tela.');
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  const label = editor.kind === 'connection' ? 'conta' : editor.kind === 'asset' ? 'ativo' : 'campanha';
  return <form ref={form} className="vxc-editor" onSubmit={event => void submit(event)} aria-label={`${row ? 'Editar' : 'Preparar'} ${label}`}>
    <h4>{row ? 'Editar' : 'Preparar'} {label}</h4><p>Use referências públicas. Não informe senhas, tokens ou dados pessoais.</p>
    <fieldset disabled={busy}>
      {editor.kind === 'connection' ? <HelpLabel>Rede<select aria-label="Rede" name="provider" defaultValue={editor.row?.provider || 'meta'} disabled={!!editor.row}><option value="meta">Meta / Instagram</option><option value="tiktok">TikTok</option></select>{editor.row && <input type="hidden" name="provider" value={editor.row.provider} />}</HelpLabel> : <HelpLabel>Conta desta IES<select aria-label="Conta desta IES" value={connectionId} disabled={editor.kind === 'asset' && !!editor.row} onChange={e => setConnectionId(e.target.value)} required>{data.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.label} · {providerName(connection.provider)}</option>)}</select></HelpLabel>}
      <HelpLabel>{editor.kind === 'campaign' ? 'Nome da campanha' : 'Nome de referência'}<input name="label" maxLength={160} required defaultValue={row ? ('name' in row ? row.name : row.label) : ''} /></HelpLabel>
      {editor.kind === 'asset' && <HelpLabel>Tipo<select aria-label="Tipo" name="kind" defaultValue={editor.row?.kind || 'page'} disabled={!!editor.row}><option value="page">Página</option><option value="form">Formulário</option></select>{editor.row && <input type="hidden" name="kind" value={editor.row.kind} />}</HelpLabel>}
      <HelpLabel>ID público {editor.kind === 'connection' ? 'da conta (opcional)' : editor.kind === 'campaign' ? 'da campanha (opcional)' : 'do ativo'}<input name="external" maxLength={120} required={editor.kind === 'asset'} defaultValue={editor.kind === 'connection' ? editor.row?.account_external_id || '' : editor.kind === 'asset' ? editor.row?.external_id || '' : editor.row?.external_campaign_id || ''} /></HelpLabel>
      {editor.kind === 'campaign' && <><HelpLabel>Modo de captura<select aria-label="Modo de captura" value={mode} onChange={e => setMode(e.target.value as 'landing' | 'native')}><option value="landing">Página de destino</option><option value="native">Formulário nativo da rede</option></select></HelpLabel><HelpLabel>Estado<select aria-label="Estado" name="status" defaultValue={editor.row?.status || 'draft'}><option value="draft">Rascunho</option><option value="archived">Arquivada</option></select></HelpLabel></>}
      {editor.kind === 'connection' || (editor.kind === 'campaign' && mode === 'landing') ? <HelpLabel>{editor.kind === 'connection' ? 'Link público do perfil' : 'Página HTTPS de destino, sem parâmetros'}<input name="url" type="url" maxLength={500} required defaultValue={editor.kind === 'connection' ? editor.row?.public_url || '' : editor.kind === 'campaign' ? editor.row?.public_url || '' : ''} /></HelpLabel> : null}
      {editor.kind === 'campaign' && mode === 'native' && <HelpLabel>Formulário da conta<select aria-label="Formulário da conta" name="form" key={connectionId} required defaultValue={editor.row?.connection_id === connectionId ? editor.row?.form_asset_id || '' : ''}><option value="">Selecione o formulário informado</option>{data.assets.filter(asset => asset.connection_id === connectionId && asset.kind === 'form').map(asset => <option key={asset.id} value={asset.id}>{asset.label} · não verificado</option>)}</select></HelpLabel>}
      <div><button type="submit">{busy ? 'Salvando…' : 'Salvar preparação'}</button><button type="button" onClick={onCancel}>Cancelar</button></div>
    </fieldset>
    {error && <p className="vxc-error" role="alert">{error}</p>}
    <p>O envio de mensagens e a autorização de contas não fazem parte desta gravação.</p>
  </form>;
}
