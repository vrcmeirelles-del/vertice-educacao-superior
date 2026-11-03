import { personalizeTemplate, sha256 } from '../_shared/document-template.ts';
const ORIGINS = new Set([
  'https://www.verticesuperior.com.br', 'https://verticesuperior.com.br',
  'https://vertice-educacao-superior-jlri.onrender.com',
  'https://vertice-educacao-superior-site.onrender.com',
]);
const BUCKET = 'vertice-biblioteca-inep';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function libraryHandler(createClient: any, env: (key: string) => string | undefined) {
return async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
  };
  if (origin && ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (origin && !ORIGINS.has(origin)) return respond(403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, { error: 'Método não permitido.' });
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return respond(401, { error: 'Entre para acessar a biblioteca.' });
  try {
    const url = env('SUPABASE_URL')!;
    const userClient = createClient(url, env('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !user || user.is_anonymous) return respond(401, { error: 'Sessão inválida.' });
    const body = await req.json();
    if (!UUID.test(body.institutionId || '') || !UUID.test(body.id || '')) return respond(400, { error: 'Documento inválido.' });
    if (body.responseVersion !== undefined && body.responseVersion !== 2) return respond(400, { error: 'Versão de download não suportada.' });
    const binary = body.responseVersion === 2;
    // RLS aplica vinculo com a instituicao e MFA aal2, inclusive ao master.
    const { data: doc, error } = await userClient.from('vertice_inep_library')
      .select('id,institution_id,file_name,object_path,format,sha256,template_object_path,template_sha256,template_source_sha256,template_review_ref')
      .eq('institution_id', body.institutionId).eq('id', body.id).eq('active', true).maybeSingle();
    if (error || !doc) return respond(403, { error: 'Documento indisponível para este acesso.' });
    const secret = env('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!secret) return respond(503, { error: 'Biblioteca temporariamente indisponível.' });
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    if (doc.template_object_path !== null) {
      if (!binary) return respond(409, { error: 'Atualize a página para baixar este modelo personalizado.' });
      if (doc.format !== 'docx' || !doc.template_sha256 || !doc.template_review_ref || doc.template_source_sha256 !== doc.sha256
        || doc.template_object_path !== `${doc.institution_id}/templates/${doc.template_sha256}.docx`
        || doc.template_object_path === doc.object_path) return respond(409, { error: 'Revisão do modelo indisponível.' });
      // Read institutional identity under the caller's RLS, before ANY Storage read.
      const { data: institution, error: institutionError } = await userClient.from('vertice_institutions')
        .select('document_branding').eq('id', body.institutionId).single();
      if (institutionError || !institution) return respond(403, { error: 'Instituição indisponível.' });
      const source = await admin.storage.from(BUCKET).download(doc.object_path);
      if (source.error || !source.data || source.data.size > 30 * 1024 * 1024 || await sha256(new Uint8Array(await source.data.arrayBuffer())) !== doc.sha256)
        return respond(409, { error: 'A fonte mudou; o modelo exige nova revisão.' });
      const prepared = await admin.storage.from(BUCKET).download(doc.template_object_path);
      if (prepared.error || !prepared.data || prepared.data.size > 30 * 1024 * 1024) return respond(503, { error: 'Modelo indisponível.' });
      const result = await personalizeTemplate(new Uint8Array(await prepared.data.arrayBuffer()), institution.document_branding ?? { header_text: '', theme_color: null, logo_data: null }, doc);
      const { error: auditError } = await admin.from('vertice_audit').insert({ actor: user.id, table_name: 'vertice_inep_library', action: 'download_personalized', record_id: doc.id });
      if (auditError) return respond(503, { error: 'Não foi possível registrar o download.' });
      return new Response(result, { status: 200, headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(doc.file_name) } });
    }
    // Unreviewed DOCX, PDF and XLSX remain byte-for-byte originals, but also verify integrity.
    const original = await admin.storage.from(BUCKET).download(doc.object_path);
    if (original.error || !original.data || original.data.size > 30 * 1024 * 1024
      || await sha256(new Uint8Array(await original.data.arrayBuffer())) !== doc.sha256)
      return respond(409, { error: 'Integridade do arquivo não confirmada.' });
    // Keep deployed legacy clients working while Edge rolls out before the frontend.
    let signedUrl: string | null = null;
    if (!binary) {
      const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(doc.object_path, 300, { download: doc.file_name });
      if (signError || !signed?.signedUrl) return respond(503, { error: 'Não foi possível preparar o download.' });
      signedUrl = signed.signedUrl;
    }
    const { error: auditError } = await admin.from('vertice_audit').insert({
      actor: user.id, table_name: 'vertice_inep_library', action: 'download', record_id: doc.id,
    });
    if (auditError) return respond(503, { error: 'Não foi possível registrar o download.' });
    if (signedUrl) return respond(200, { url: signedUrl, filename: doc.file_name, expiresIn: 300 });
    return new Response(original.data, { status: 200, headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(doc.file_name) } });
  } catch {
    return respond(400, { error: 'Não foi possível processar o download.' });
  }
};
}
