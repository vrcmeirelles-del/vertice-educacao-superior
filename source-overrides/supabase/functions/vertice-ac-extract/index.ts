declare const Deno: { env: { get: (key: string) => string | undefined }; serve: (fn: (req: Request) => Promise<Response>) => void };

const origins = new Set([
  'https://www.verticesuperior.com.br', 'https://verticesuperior.com.br',
  'https://vertice-educacao-superior-jlri.onrender.com', 'https://vertice-portal.onrender.com',
  'https://vertice-educacao-superior-site.onrender.com', 'https://vertice-educacao-superior.onrender.com',
]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const h: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (origins.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  const send = (body: unknown, status = 200) => Response.json(body, { status, headers: h });
  if (origin && !origins.has(origin)) return send({ error: 'origin_denied' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return send({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return send({ error: 'authentication_required' }, 401);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apikey = Deno.env.get('SUPABASE_ANON_KEY') || JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    // Auth check
    const authHeaders = { Authorization: authorization, apikey };
    const auth = await fetch(url + '/auth/v1/user', { headers: authHeaders, signal: AbortSignal.timeout(10000) });
    const user = await auth.json();
    if (!auth.ok || !user.id) return send({ error: 'authentication_required' }, 401);

    const body = await req.json();
    const { submission_id, institution_id } = body;
    if (!UUID.test(submission_id || '') || !UUID.test(institution_id || ''))
      return send({ error: 'invalid_request' }, 400);

    // Check membership
    const serviceHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };

    // Fetch submission with document path
    const subRes = await fetch(
      `${url}/rest/v1/vertice_ac_submissions?id=eq.${submission_id}&institution_id=eq.${institution_id}&select=*`,
      { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
    );
    const subs = await subRes.json();
    if (!Array.isArray(subs) || subs.length === 0) return send({ error: 'submission_not_found' }, 404);
    const sub = subs[0];

    // Get document path
    let docPath = '';
    if (sub.document_id) {
      const docRes = await fetch(
        `${url}/rest/v1/vertice_documents?id=eq.${sub.document_id}&select=storage_path`,
        { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
      );
      const docs = await docRes.json();
      if (Array.isArray(docs) && docs.length > 0) docPath = docs[0].storage_path;
    }

    // Try alternate: look for file in ac/ folder
    if (!docPath) {
      // Check ac/{institution_id}/{submission_id} pattern
      const listRes = await fetch(
        `${url}/storage/v1/object/list/vertice-documents`,
        {
          method: 'POST', headers: serviceHeaders,
          body: JSON.stringify({ prefix: `ac/${institution_id}/${submission_id}`, limit: 1 }),
          signal: AbortSignal.timeout(10000),
        }
      );
      const files = await listRes.json();
      if (Array.isArray(files) && files.length > 0) {
        docPath = `ac/${institution_id}/${submission_id}/${files[0].name}`;
      }
    }

    if (!docPath) return send({ error: 'no_document_found', message: 'Nenhum arquivo encontrado para esta submissão.' }, 404);

    // Download the file
    const fileRes = await fetch(
      `${url}/storage/v1/object/vertice-documents/${docPath}`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }, signal: AbortSignal.timeout(30000) }
    );
    if (!fileRes.ok) return send({ error: 'file_download_failed' }, 500);

    const fileBytes = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/pdf';
    const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));
    const isImage = contentType.startsWith('image/');
    const isPdf = contentType.includes('pdf');

    if (!openaiKey) return send({ error: 'ai_not_configured', message: 'Chave de IA não configurada.' }, 503);

    // Fetch categories for context
    let categoriesContext = '';
    if (sub.rule_id) {
      const catRes = await fetch(
        `${url}/rest/v1/vertice_ac_categories?rule_id=eq.${sub.rule_id}&select=id,label,description,max_per_item_minutes,max_category_minutes`,
        { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
      );
      const cats = await catRes.json();
      if (Array.isArray(cats) && cats.length > 0) {
        categoriesContext = '\n\nCategorias disponíveis:\n' + cats.map((c: { id: string; label: string; description?: string; max_per_item_minutes?: number }) =>
          `- ${c.label} (id: ${c.id})${c.description ? ': ' + c.description : ''}${c.max_per_item_minutes ? ' [máx ' + (c.max_per_item_minutes / 60) + 'h/item]' : ''}`
        ).join('\n');
      }
    }

    // Build AI prompt
    const systemPrompt = `Você é um assistente especializado em análise de certificados de atividades complementares para cursos de graduação em Direito no Brasil.

Analise o documento enviado e extraia as seguintes informações:
1. **participant_name**: Nome completo do participante
2. **issuer**: Instituição/entidade que emitiu o certificado
3. **event_title**: Nome do evento, curso, palestra ou atividade
4. **starts_at**: Data de início (formato YYYY-MM-DD, se disponível)
5. **ends_at**: Data de término (formato YYYY-MM-DD, se disponível)
6. **documentary_minutes**: Carga horária em MINUTOS (converta horas para minutos: 1h = 60min)
7. **extraction_quality**: "high" se todos os campos foram extraídos com confiança, "medium" se alguns campos foram inferidos, "low" se há muita incerteza
8. **warnings**: Lista de avisos relevantes (ex: "carga horária não informada no documento", "nome do participante difere do cadastro", "documento sem assinatura visível")
9. **suggested_category_id**: Se houver categorias disponíveis, sugira o ID da mais adequada
10. **suggested_justification**: Justificativa breve para a categorização sugerida
${categoriesContext}

O aluno declarou:
- Título: ${sub.title || 'não informado'}
- Emissor: ${sub.issuer || 'não informado'}
- Carga horária declarada: ${sub.documentary_minutes ? (sub.documentary_minutes / 60) + 'h' : 'não informada'}

Compare o que está no documento com o que o aluno declarou e inclua discrepâncias nos warnings.

Responda APENAS com JSON válido, sem markdown, sem código, sem explicações fora do JSON:
{
  "participant_name": "...",
  "issuer": "...",
  "event_title": "...",
  "starts_at": "YYYY-MM-DD ou null",
  "ends_at": "YYYY-MM-DD ou null",
  "documentary_minutes": número_inteiro_ou_null,
  "extraction_quality": "high|medium|low",
  "warnings": ["..."],
  "suggested_category_id": "uuid ou null",
  "suggested_justification": "..."
}`;

    // Call OpenAI with vision
    const messages: unknown[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (isImage) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analise este certificado:' },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}`, detail: 'high' } },
        ],
      });
    } else if (isPdf) {
      // For PDF: send as file input
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analise este certificado em PDF:' },
          { type: 'file', file: { filename: 'certificado.pdf', file_data: `data:application/pdf;base64,${base64}` } },
        ],
      });
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 1500,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!aiRes.ok) {
      const aiErr = await aiRes.text();
      return send({ error: 'ai_request_failed', detail: aiErr }, 502);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let extracted;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return send({ error: 'ai_parse_failed', raw: content }, 502);
    }

    // Save extraction
    const insertRes = await fetch(`${url}/rest/v1/vertice_ac_extractions`, {
      method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        institution_id,
        submission_id,
        participant_name: extracted.participant_name || null,
        issuer: extracted.issuer || null,
        event_title: extracted.event_title || null,
        starts_at: extracted.starts_at || null,
        ends_at: extracted.ends_at || null,
        documentary_minutes: extracted.documentary_minutes || null,
        extraction_quality: extracted.extraction_quality || 'medium',
        suggested_category_id: UUID.test(extracted.suggested_category_id || '') ? extracted.suggested_category_id : null,
        suggested_justification: extracted.suggested_justification || null,
        warnings: extracted.warnings || [],
        provider: 'openai',
        model: 'gpt-4o',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return send({ error: 'save_failed', detail: err }, 500);
    }

    const saved = await insertRes.json();

    // === DETECÇÃO DE FRAUDE ===
    // Buscar certificados similares de OUTROS alunos (mesmo evento, mesmo emissor, mesmas datas)
    let fraudAlert = null;
    try {
      // 1. Buscar extrações similares (mesmo event_title ou issuer+dates)
      const eventTitle = (extracted.event_title || '').trim();
      const issuerName = (extracted.issuer || '').trim();
      if (eventTitle.length > 5 || issuerName.length > 5) {
        const searchParams = new URLSearchParams();
        searchParams.set('institution_id', `eq.${institution_id}`);
        searchParams.set('submission_id', `neq.${submission_id}`);
        if (eventTitle.length > 5) searchParams.set('event_title', `ilike.*${eventTitle.substring(0, 30)}*`);
        searchParams.set('select', 'id,submission_id,participant_name,event_title,issuer,documentary_minutes,starts_at,ends_at');
        searchParams.set('limit', '20');

        const simRes = await fetch(
          `${url}/rest/v1/vertice_ac_extractions?${searchParams}`,
          { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
        );
        const similars = await simRes.json();

        if (Array.isArray(similars) && similars.length > 0) {
          // Buscar student_id de cada submissão similar
          const simSubIds = similars.map((s: { submission_id: string }) => s.submission_id);
          const subIdsParam = simSubIds.map((id: string) => `"${id}"`).join(',');
          const subLookup = await fetch(
            `${url}/rest/v1/vertice_ac_submissions?id=in.(${subIdsParam})&select=id,student_id`,
            { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
          );
          const subStudents = await subLookup.json();
          const studentMap: Record<string, string> = {};
          if (Array.isArray(subStudents)) subStudents.forEach((s: { id: string; student_id: string }) => { studentMap[s.id] = s.student_id; });

          // Filtrar: mesmo evento mas DIFERENTE aluno
          const otherStudents = similars.filter((s: { submission_id: string; participant_name?: string }) => {
            const otherId = studentMap[s.submission_id];
            return otherId && otherId !== sub.student_id;
          });

          if (otherStudents.length > 0) {
            // Verificar se nomes no certificado são diferentes (edição de nome = fraude forte)
            const namesInvolved = [extracted.participant_name, ...otherStudents.map((s: { participant_name?: string }) => s.participant_name)].filter(Boolean);
            const uniqueNames = new Set(namesInvolved.map((n: string) => n.toLowerCase().trim()));
            const likelyEdited = uniqueNames.size > 1; // diferentes nomes no mesmo certificado = edição

            const allSubmissions = [submission_id, ...otherStudents.map((s: { submission_id: string }) => s.submission_id)];
            const allStudents = [...new Set([sub.student_id, ...otherStudents.map((s: { submission_id: string }) => studentMap[s.submission_id]).filter(Boolean)])];

            const alertBody = {
              institution_id,
              alert_type: likelyEdited ? 'edited_document' : 'duplicate_certificate',
              severity: likelyEdited ? 'critical' : 'high',
              title: likelyEdited
                ? `Possível edição de certificado: "${eventTitle.substring(0, 60)}"`
                : `Certificado duplicado: "${eventTitle.substring(0, 60)}"`,
              description: likelyEdited
                ? `O mesmo certificado de "${issuerName}" aparece com nomes diferentes em ${allStudents.length} alunos. Possível adulteração de documento com troca de nome.`
                : `${allStudents.length} alunos enviaram certificado idêntico do evento "${eventTitle}" emitido por "${issuerName}". Verificar autenticidade.`,
              evidence_json: {
                event_title: eventTitle,
                issuer: issuerName,
                names_found: [...uniqueNames],
                dates: { starts_at: extracted.starts_at, ends_at: extracted.ends_at },
                hours: extracted.documentary_minutes,
                detection_method: likelyEdited ? 'name_mismatch_same_certificate' : 'duplicate_event_match',
              },
              submissions_involved: allSubmissions,
              students_involved: allStudents,
              detected_by: 'ai',
              visible_to_superior: true,
            };

            // Verificar se já existe alerta para esse evento
            const existCheck = await fetch(
              `${url}/rest/v1/vertice_ac_fraud_alerts?institution_id=eq.${institution_id}&status=in.(open,under_review)&select=id,submissions_involved`,
              { headers: serviceHeaders, signal: AbortSignal.timeout(10000) }
            );
            const existing = await existCheck.json();
            const alreadyReported = Array.isArray(existing) && existing.some((a: { submissions_involved?: string[] }) =>
              a.submissions_involved?.some(sid => allSubmissions.includes(sid))
            );

            if (!alreadyReported) {
              const alertRes = await fetch(`${url}/rest/v1/vertice_ac_fraud_alerts`, {
                method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' },
                body: JSON.stringify(alertBody),
                signal: AbortSignal.timeout(10000),
              });
              if (alertRes.ok) {
                const alertData = await alertRes.json();
                fraudAlert = alertData[0] || alertData;
              }
            }
          }
        }
      }
    } catch { /* fraud detection is best-effort */ }

    return send({
      ok: true,
      extraction: saved[0] || saved,
      fraud_alert: fraudAlert,
      summary: {
        participant: extracted.participant_name,
        event: extracted.event_title,
        issuer: extracted.issuer,
        hours_extracted: extracted.documentary_minutes ? (extracted.documentary_minutes / 60) : null,
        hours_declared: sub.documentary_minutes ? (sub.documentary_minutes / 60) : null,
        quality: extracted.extraction_quality,
        warnings: extracted.warnings,
        fraud_detected: !!fraudAlert,
      },
    });
  } catch (err) {
    return send({ error: 'internal_error', message: (err as Error).message }, 500);
  }
});
