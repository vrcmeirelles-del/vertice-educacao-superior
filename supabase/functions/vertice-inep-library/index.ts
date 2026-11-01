import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ORIGINS = new Set([
  'https://www.verticesuperior.com.br', 'https://verticesuperior.com.br',
  'https://vertice-educacao-superior-jlri.onrender.com',
  'https://vertice-educacao-superior-site.onrender.com',
]);
const BUCKET = 'vertice-biblioteca-inep';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
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
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !user || user.is_anonymous) return respond(401, { error: 'Sessão inválida.' });
    const body = await req.json();
    if (!UUID.test(body.institutionId || '') || !UUID.test(body.id || '')) return respond(400, { error: 'Documento inválido.' });
    // RLS aplica vinculo com a instituicao e MFA aal2, inclusive ao master.
    const { data: doc, error } = await userClient.from('vertice_inep_library')
      .select('id,institution_id,file_name,object_path')
      .eq('institution_id', body.institutionId).eq('id', body.id).eq('active', true).maybeSingle();
    if (error || !doc) return respond(403, { error: 'Documento indisponível para este acesso.' });
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!secret) return respond(503, { error: 'Biblioteca temporariamente indisponível.' });
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    const { data: signed, error: signError } = await admin.storage.from(BUCKET)
      .createSignedUrl(doc.object_path, 300, { download: doc.file_name });
    if (signError || !signed?.signedUrl) return respond(503, { error: 'Não foi possível preparar o download.' });
    const { error: auditError } = await admin.from('vertice_audit').insert({
      actor: user.id, table_name: 'vertice_inep_library', action: 'download', record_id: doc.id,
    });
    if (auditError) return respond(503, { error: 'Não foi possível registrar o download.' });
    return respond(200, { url: signed.signedUrl, filename: doc.file_name, expiresIn: 300 });
  } catch {
    return respond(400, { error: 'Não foi possível processar o download.' });
  }
});
