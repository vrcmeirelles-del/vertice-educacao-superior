// Existing student portal: AC/Estágio retain their academic passwordless flow.
// Conecta validates enrollment + CPF, uses scoped reusable 72h links and native career/survey RPCs.
// Partner intake uses scoped private links and institutional review; public callers never read students.
// Only token/session hashes are stored, and all identity derivation remains server-side.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  || (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default; } catch { return ""; } })();
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@verticesuperior.com.br";
const BASE_URL = Deno.env.get("STUDENT_PORTAL_URL") || "https://www.verticesuperior.com.br";

const BUCKET = "vertice-documents";
const TOKEN_TTL_MIN = 30;
const SESSION_TTL_H = 8;
const MAX_LINKS_PER_HOUR = 3;
const MAX_SUBMISSIONS_PER_DAY = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const GENERIC_SENT = { ok: true, message: "Se os dados estiverem corretos, um link de acesso foi enviado ao e-mail cadastrado pela instituição." };

const ORIGINS = new Set([
  "https://www.verticesuperior.com.br", "https://verticesuperior.com.br",
  "https://vertice-portal.onrender.com", "https://vertice-educacao-superior.onrender.com",
  "https://vertice-educacao-superior-site.onrender.com", "https://vertice-educacao-superior-jlri.onrender.com",
]);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

class Fail extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const randomHex = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
const moduleOf = (v: unknown) => v === "conecta" ? "conecta" : (v === "estagio" || v === "mandatory_internship" ? "estagio" : "ac");

function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 16384) throw new Fail(413, "request_too_large");
  try { const v = JSON.parse(text); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* fallthrough */ }
  throw new Fail(400, "invalid_request");
}

const eligible = (status: string, mod: string) => status === "active" || (mod === "conecta" && status === "graduated");
async function sessionFrom(key: unknown, mod = "ac") {
  if (typeof key !== "string" || !HEX64.test(key)) throw new Fail(401, "session_invalid");
  const { data: s } = await admin.from("vertice_student_sessions")
    .select("id, institution_id, student_id, expires_at, revoked_at, access_scope")
    .eq("session_key_hash", await sha256(key)).maybeSingle();
  if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) throw new Fail(401, "session_invalid");
  if(s.access_scope !== (mod === 'conecta' ? 'conecta' : 'academic')) throw new Fail(401, 'session_invalid');
  const { data: st } = await admin.from("vertice_student_registry")
    .select("id, institution_id, course_id, enrollment_code, full_name, curriculum_version, academic_status")
    .eq("id", s.student_id).eq("institution_id", s.institution_id).maybeSingle();
  if (!st || !eligible(st.academic_status, mod)) throw new Fail(401, "session_invalid");
  return { session: s, student: st };
}

async function activeRule(student: { institution_id: string; course_id: string; curriculum_version: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rules } = await admin.from("vertice_ac_rules")
    .select("id, curriculum_version, rule_version, total_required_minutes, effective_from, effective_until")
    .eq("institution_id", student.institution_id).eq("course_id", student.course_id).eq("is_active", true)
    .lte("effective_from", today).order("effective_from", { ascending: false });
  const valid = (rules ?? []).filter((r) => !r.effective_until || r.effective_until >= today);
  return valid.find((r) => student.curriculum_version && r.curriculum_version === student.curriculum_version) ?? valid[0] ?? null;
}

async function dashboard(student: { id: string; institution_id: string; course_id: string; full_name: string; enrollment_code: string; curriculum_version: string | null }, mod: string) {
  if(mod === "conecta") return {student:{full_name:student.full_name,enrollment_code:student.enrollment_code},conecta:true};
  const [course, rule, subs] = await Promise.all([
    admin.from("vertice_courses").select("name").eq("id", student.course_id).maybeSingle(),
    activeRule(student),
    admin.from("vertice_ac_submissions")
      .select("id, title, issuer, documentary_minutes, status, created_at, category_id")
      .eq("student_id", student.id).eq("institution_id", student.institution_id)
      .order("created_at", { ascending: false }).limit(50),
  ]);
  let categories: unknown[] = [];
  let credited = 0;
  if (rule) {
    const { data: cats } = await admin.from("vertice_ac_categories")
      .select("id, code, label, description, max_per_item_minutes, max_category_minutes, accepted_documents")
      .eq("rule_id", rule.id).eq("institution_id", student.institution_id).order("sort_order");
    categories = cats ?? [];
  }
  const { data: bal } = await admin.from("v_ac_student_balance")
    .select("credited_minutes").eq("student_id", student.id).eq("institution_id", student.institution_id);
  credited = (bal ?? []).reduce((acc: number, b: { credited_minutes: number | null }) => acc + Number(b.credited_minutes || 0), 0);
  let placements: unknown[] = [];
  if (mod === "estagio") {
    const { data: pl } = await admin.from("vertice_internship_placements")
      .select("id, lifecycle, starts_at, ends_at, advisor_name")
      .eq("student_id", student.id).eq("institution_id", student.institution_id)
      .order("created_at", { ascending: false }).limit(10);
    placements = pl ?? [];
  }
  return {
    student: { full_name: student.full_name, enrollment_code: student.enrollment_code, course_name: course.data?.name ?? null },
    rule: rule ? { id: rule.id, rule_version: rule.rule_version, total_required_minutes: rule.total_required_minutes } : null,
    credited_minutes: credited,
    categories,
    submissions: subs.data ?? [],
    placements,
  };
}

async function sendLinkEmail(to: string, name: string, link: string, mod: string) {
  if (!RESEND_API_KEY) { console.error("student-portal: RESEND_API_KEY ausente"); return; }
  const label = mod === "conecta" ? "Conecta 360°" : mod === "estagio" ? "Estágio Obrigatório" : "Atividades Complementares";
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
  <h2 style="margin:0 0 12px">Olá, ${esc(name)}!</h2>
  <p>Você solicitou acesso ao módulo de <strong>${esc(label)}</strong> da sua instituição.</p>
  <p>O botão abaixo abre o seu acesso pessoal. O link é de uso único e expira em ${TOKEN_TTL_MIN} minutos.</p>
  <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;padding:12px 24px;background:#1e3a8a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Acessar agora</a></p>
  <p style="font-size:13px;color:#64748b">Se você não fez esta solicitação, ignore este e-mail. Ninguém acessa sua conta sem este link.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="font-size:11px;color:#94a3b8">Plataforma Vértice Educação Superior</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Vértice Educação Superior <${FROM_EMAIL}>`, to: [to], subject: `Seu acesso — ${label}`, html }),
  });
  if (!res.ok) console.error("student-portal: resend", res.status);
}

async function handle(action: string, b: Record<string, unknown>, req: Request) {
  // Counters commit separately from credential validation, including failed requests.
  const throttle=async(bucket:string,limit:number)=>{
    const {data,error}=await admin.rpc('vertice_conecta_rate_limit',{p_key:await sha256(bucket),p_limit:limit,p_seconds:900});
    if(error)throw new Fail(503,'unavailable');if(!data)throw new Fail(429,'too_many');
  };
  if(moduleOf(b.module)==='conecta' && (action==='request'||action==='redeem')){
    const inst=str(b.institution_id,40);if(!UUID.test(inst))throw new Fail(400,'invalid_request');
    await throttle('conecta-access-ip:'+clientIp(req),60);
    const key=randomHex(),token=action==='request'?randomHex():str(b.token,80);
    if(!HEX64.test(token))throw new Fail(401,'link_invalid');
    const payload:Record<string,string>={session_hash:await sha256(key),token_hash:await sha256(token)};
    if(action==='request'){
      payload.enrollment=str(b.enrollment_code,40);const cpf=str(b.cpf,20).replace(/\D/g,'');
      await throttle('conecta-enrollment:'+inst+':'+payload.enrollment,5);
      if(!payload.enrollment||cpf.length!==11)throw new Fail(401,'invalid_credentials');payload.cpf_hash=await sha256(cpf);
    }
    const {data,error}=await admin.rpc('vertice_conecta_access',{p_action:action==='request'?'login':'redeem',p_institution:inst,p_payload:payload});
    if(error)throw new Fail(503,'unavailable');if(!data?.ok)throw new Fail(401,action==='request'?'invalid_credentials':'link_invalid');
    return {session:key,expires_at:data.expires_at,access_link:`${BASE_URL}/acesso-estudante?ies=${encodeURIComponent(inst)}&mod=conecta&token=${token}`};
  }
  if(action.startsWith('partner_')){
    const inst=str(b.institution_id,40),operation=action.slice(8);
    if(!UUID.test(inst)||!['info','register','me','proposal','logout'].includes(operation))throw new Fail(400,'invalid_request');
    await throttle('conecta-partner-ip:'+clientIp(req),operation==='info'?120:30);
    const token=operation==='register'?randomHex():str(b.token,80);
    if(operation!=='info'&&!HEX64.test(token))throw new Fail(401,'link_invalid');
    const {data,error}=await admin.rpc('vertice_conecta_partner_public',{p_action:operation,p_institution:inst,p_token_hash:operation==='info'?null:await sha256(token),p_payload:b.payload||{}});
    if(error)throw new Fail(error.code==='42501'?401:400,'partner_invalid');
    if(data?.ok===false)throw new Fail(409,'already_received');
    return operation==='register'?{...data,access_link:`${BASE_URL}/conecta-parceiros?ies=${encodeURIComponent(inst)}&token=${token}`,token}:data;
  }
  if (action === "request") {
    const institutionId = str(b.institution_id, 40);
    const enrollment = str(b.enrollment_code, 40);
    const cpf = str(b.cpf, 20).replace(/\D/g, "");
    const email = str(b.email, 254).toLowerCase();
    const mod = moduleOf(b.module);
    if (!UUID.test(institutionId) || !enrollment || cpf.length !== 11 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return GENERIC_SENT;
    const { data: st } = await admin.from("vertice_student_registry")
      .select("id, institution_id, email, full_name, academic_status")
      .eq("institution_id", institutionId).eq("enrollment_code", enrollment).eq("cpf_hash", await sha256(cpf)).maybeSingle();
    if (!st || !eligible(st.academic_status, mod) || String(st.email).trim().toLowerCase() !== email) return GENERIC_SENT;
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("vertice_student_access_tokens")
      .select("id", { count: "exact", head: true }).eq("student_id", st.id).gte("created_at", since);
    if ((count ?? 0) >= MAX_LINKS_PER_HOUR) return GENERIC_SENT;
    const token = randomHex(32);
    const { error } = await admin.from("vertice_student_access_tokens").insert({
      institution_id: st.institution_id, student_id: st.id, token_hash: await sha256(token), purpose: "session",
      expires_at: new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString(),
    });
    if (error) { console.error("student-portal: token insert", error.code); return GENERIC_SENT; }
    const link = `${BASE_URL}/acesso-estudante?ies=${encodeURIComponent(st.institution_id)}&mod=${mod}&token=${token}`;
    await sendLinkEmail(st.email, st.full_name, link, mod);
    return GENERIC_SENT;
  }

  if (action === "redeem") {
    const token = str(b.token, 80);
    if (!HEX64.test(token)) throw new Fail(401, "link_invalid");
    const { data: used } = await admin.from("vertice_student_access_tokens")
      .update({ consumed_at: new Date().toISOString(), consumed_ip: clientIp(req) })
      .eq("token_hash", await sha256(token)).eq("access_scope", "academic").is("revoked_at",null).is("consumed_at", null).gt("expires_at", new Date().toISOString())
      .select("id, institution_id, student_id");
    const t = used?.[0];
    if (!t) throw new Fail(401, "link_invalid");
    const { data: st } = await admin.from("vertice_student_registry")
      .select("id, institution_id, course_id, enrollment_code, full_name, curriculum_version, academic_status")
      .eq("id", t.student_id).eq("institution_id", t.institution_id).maybeSingle();
    if (!st || !eligible(st.academic_status, moduleOf(b.module))) throw new Fail(401, "link_invalid");
    const key = randomHex(32);
    const expires = new Date(Date.now() + SESSION_TTL_H * 3600_000).toISOString();
    const { error } = await admin.from("vertice_student_sessions").insert({
      institution_id: st.institution_id, student_id: st.id, token_id: t.id, session_key_hash: await sha256(key), expires_at: expires,
    });
    if (error) throw new Fail(503, "unavailable");
    return { session: key, expires_at: expires, data: await dashboard(st, moduleOf(b.module)) };
  }

  const mod=moduleOf(b.module);
  const {session,student}=await sessionFrom(b.session,mod);
  if(action==='survey'){
   if(mod!=='conecta')throw new Fail(400,'invalid_action');
   const {data,error}=await admin.rpc('vertice_conecta_surveys_student',{p_session_hash:await sha256(String(b.session)),p_action:str(b.operation,20),p_payload:b.payload||{}});
   if(error)throw new Fail(400,'survey_invalid');return {data};
  }
  if(action==="conecta"){
   if(mod!=="conecta")throw new Fail(400,"invalid_action");
   const {data,error}=await admin.rpc("vertice_conecta_student",{p_session_hash:await sha256(String(b.session)),p_action:str(b.operation,30),p_payload:b.payload||{}});
   if(error){console.error("student-portal: conecta",error.code);throw new Fail(400,"conecta_invalid");}
   return {data};
  }
  if(mod==="conecta"&&!["dashboard","logout"].includes(action))throw new Fail(400,"invalid_action");

  if (action === "dashboard") return { data: await dashboard(student, moduleOf(b.module)) };

  if (action === "logout") {
    if(mod==='conecta'){
      const {error}=await admin.rpc('vertice_conecta_access',{p_action:'logout',p_institution:student.institution_id,p_payload:{session_hash:await sha256(String(b.session))}});
      if(error)throw new Fail(503,'unavailable');return {ok:true};
    }
    await admin.from("vertice_student_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
    return { ok: true };
  }

  if (action === "upload_url") {
    const type = str(b.content_type, 80);
    const size = Number(b.size);
    const ext = FILE_TYPES[type];
    if (!ext) throw new Fail(400, "file_type");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) throw new Fail(400, "file_size");
    const path = `ac/${student.institution_id}/${student.id}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Fail(503, "unavailable");
    return { path, token: data.token };
  }

  if (action === "submit") {
    const title = str(b.title, 200);
    const issuer = str(b.issuer, 200) || null;
    const categoryId = str(b.category_id, 40);
    const hours = Number(b.hours);
    const path = str(b.path, 300);
    const date = (v: unknown) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
    if (!title || !UUID.test(categoryId) || !Number.isFinite(hours) || hours <= 0 || hours > 2000) throw new Fail(400, "invalid_submission");
    const prefix = `ac/${student.institution_id}/${student.id}/`;
    if (!path.startsWith(prefix) || path.includes("..") || path.slice(prefix.length).includes("/")) throw new Fail(400, "file_missing");
    const { data: listed } = await admin.storage.from(BUCKET).list(prefix.slice(0, -1), { search: path.slice(prefix.length), limit: 1 });
    if (!listed?.length) throw new Fail(400, "file_missing");
    const rule = await activeRule(student);
    if (!rule) throw new Fail(409, "no_rule");
    const { data: cat } = await admin.from("vertice_ac_categories").select("id").eq("id", categoryId).eq("rule_id", rule.id).maybeSingle();
    if (!cat) throw new Fail(400, "invalid_category");
    const since = new Date(Date.now() - 86400_000).toISOString();
    const { count } = await admin.from("vertice_ac_submissions").select("id", { count: "exact", head: true })
      .eq("student_id", student.id).gte("created_at", since);
    if ((count ?? 0) >= MAX_SUBMISSIONS_PER_DAY) throw new Fail(429, "too_many");
    const { data: row, error } = await admin.from("vertice_ac_submissions").insert({
      institution_id: student.institution_id, student_id: student.id, rule_id: rule.id, category_id: cat.id,
      title, issuer, participant_name: student.full_name,
      start_date: date(b.start_date), end_date: date(b.end_date),
      documentary_minutes: Math.round(hours * 60), external_url: path, status: "submitted",
    }).select("id, title, issuer, documentary_minutes, status, created_at, category_id").single();
    if (error) throw new Fail(503, "unavailable");
    return { submission: row };
  }

  throw new Fail(400, "invalid_action");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff",
  };
  if (ORIGINS.has(origin)) Object.assign(headers, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !ORIGINS.has(origin)) return send({ error: "origin_denied" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return send({ error: "method_not_allowed" }, 405);
  try {
    const body = await readJson(req);
    return send(await handle(str(body.action, 20), body, req));
  } catch (e) {
    if (e instanceof Fail) return send({ error: e.code }, e.status);
    console.error("student-portal:", (e as Error).message);
    return send({ error: "unavailable" }, 503);
  }
});
