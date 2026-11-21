// Avalia 360° — upload privado de imagens das questões.
// prepare: autoriza pelo JWT do docente (RPC exige AAL2 e vínculo de curso) e emite URL assinada.
// confirm: o servidor relê os bytes armazenados e só então confirma SHA-256, tipo e tamanho.
// read: URLs de leitura de 5 minutos para as imagens de um caderno que o docente pode abrir.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';

const BUCKET = 'avalia360-private';
const MAX_BYTES = 10 * 1024 * 1024;
const MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex64 = /^[0-9a-f]{64}$/;

function sniff(bytes: Uint8Array): string | null {
  const starts = (m: number[]) => bytes.length >= m.length && m.every((v, i) => bytes[i] === v);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  const ascii = (o: number, l: number) => String.fromCharCode(...bytes.slice(o, o + l));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}
async function sha256(bytes: Uint8Array) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}

type Claim = {
  action: string; institutionId: string; courseId: string; disciplineId: string; questionId: string;
  sha256: string; mime: string; sizeBytes: number; path?: string; imageId?: string;
};
function parseClaim(v: unknown): Claim {
  if (!v || typeof v !== 'object') throw new Error('Requisição inválida.');
  const c = v as Claim;
  if (!uuid.test(c.institutionId || '') || !uuid.test(c.courseId || '')) throw new Error('Instituição ou curso inválido.');
  if (typeof c.disciplineId !== 'string' || !c.disciplineId.trim() || c.disciplineId.length > 200) throw new Error('Disciplina inválida.');
  if (typeof c.questionId !== 'string' || !c.questionId || c.questionId.length > 80) throw new Error('Questão inválida.');
  if (typeof c.sha256 !== 'string' || !hex64.test(c.sha256)) throw new Error('Hash inválido.');
  if (!MIMES.has(c.mime)) throw new Error('Formato de imagem não permitido.');
  if (!Number.isInteger(c.sizeBytes) || c.sizeBytes <= 0 || c.sizeBytes > MAX_BYTES) throw new Error('Imagem acima de 10 MB.');
  return c;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return json({error: 'Método não permitido.'}, 405);
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = req.headers.get('authorization') || '';
  const asUser = createClient(url, anon, {global: {headers: {Authorization: token}}, auth: {persistSession: false}});
  const admin = createClient(url, secret, {auth: {persistSession: false}});
  try {
    const {data: {user}, error: authError} = await asUser.auth.getUser();
    if (authError || !user) return json({error: 'Entre com sua conta institucional.'}, 401);
    const body = await req.json();
    if (body && typeof body === 'object' && (body as {action?: string}).action === 'read') {
      const r = body as {institutionId?: string; courseId?: string; disciplineId?: string; draftId?: string};
      if (!uuid.test(r.institutionId || '') || !uuid.test(r.courseId || '') || !uuid.test(r.draftId || '')
        || typeof r.disciplineId !== 'string' || !r.disciplineId.trim())
        throw new Error('Requisição de leitura inválida.');
      const {data, error} = await asUser.rpc('vertice_avalia_draft_media', {
        p_institution: r.institutionId, p_course: r.courseId, p_discipline: r.disciplineId, p_draft: r.draftId,
      });
      if (error) return json({error: error.message}, error.code === '42501' ? 403 : 404);
      const rows = (Array.isArray(data) ? data : []) as Array<{questionId: string; imageId: string; path: string; sha256: string; mime: string; sizeBytes: number}>;
      if (rows.length > 300) throw new Error('Caderno com imagens demais para leitura.');
      const images = [];
      for (const row of rows) {
        const signed = await admin.storage.from(BUCKET).createSignedUrl(row.path, 300);
        if (signed.error || !signed.data?.signedUrl) throw new Error('Não foi possível autorizar a leitura das imagens.');
        images.push({...row, url: signed.data.signedUrl, expiresIn: 300});
      }
      return json({images});
    }
    const claim = parseClaim(body);

    if (claim.action === 'prepare') {
      const {data, error} = await asUser.rpc('vertice_avalia_media_prepare', {
        p_institution: claim.institutionId, p_course: claim.courseId, p_discipline: claim.disciplineId,
        p_question: claim.questionId, p_sha256: claim.sha256, p_mime: claim.mime, p_size: claim.sizeBytes,
      });
      if (error) return json({error: error.message}, error.code === '42501' ? 403 : 400);
      const ticket = data as {imageId: string; path: string};
      const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(ticket.path);
      if (signed.error || !signed.data?.token) throw new Error('Não foi possível emitir a autorização de envio.');
      return json({imageId: ticket.imageId, path: ticket.path, token: signed.data.token});
    }

    if (claim.action === 'confirm') {
      if (!uuid.test(claim.imageId || '') || typeof claim.path !== 'string') throw new Error('Comprovante incompleto.');
      const {data: row, error} = await admin.from('vertice_avalia_media')
        .select('id,path,sha256,mime,size_bytes,status,created_by,institution_id,course_id,question_id')
        .eq('id', claim.imageId).maybeSingle();
      if (error) throw new Error('Registro da imagem indisponível.');
      if (!row || row.created_by !== user.id || row.path !== claim.path || row.institution_id !== claim.institutionId
        || row.course_id !== claim.courseId || row.question_id !== claim.questionId)
        return json({error: 'Imagem não localizada para este envio.'}, 404);
      if (row.status === 'confirmed')
        return json({imageId: row.id, path: row.path, sha256: row.sha256, mime: row.mime, sizeBytes: row.size_bytes});
      if (row.status !== 'pending') return json({error: 'Envio recusado anteriormente.'}, 409);

      const file = await admin.storage.from(BUCKET).download(row.path);
      if (file.error || !file.data) return json({error: 'Arquivo ainda não recebido no armazenamento.'}, 409);
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      const actual = {sha256: await sha256(bytes), mime: sniff(bytes), size: bytes.byteLength};
      if (actual.sha256 !== row.sha256 || actual.mime !== row.mime || actual.size !== row.size_bytes
        || actual.sha256 !== claim.sha256) {
        await admin.storage.from(BUCKET).remove([row.path]);
        await admin.from('vertice_avalia_media').update({status: 'rejected'}).eq('id', row.id).eq('status', 'pending');
        return json({error: 'O arquivo armazenado não corresponde à imagem declarada.'}, 422);
      }
      const done = await admin.from('vertice_avalia_media')
        .update({status: 'confirmed', confirmed_at: new Date().toISOString()})
        .eq('id', row.id).eq('status', 'pending').select('id').maybeSingle();
      if (done.error || !done.data) throw new Error('Não foi possível confirmar a imagem.');
      return json({imageId: row.id, path: row.path, sha256: row.sha256, mime: row.mime, sizeBytes: row.size_bytes});
    }
    return json({error: 'Ação inválida.'}, 400);
  } catch (e) {
    return json({error: e instanceof Error ? e.message : 'Falha no envio da imagem.'}, 400);
  }
});
