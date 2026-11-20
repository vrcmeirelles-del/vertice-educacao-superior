// Leitura de certificados de atividades complementares por regras (auditoria de 20/11/2026).
// Substitui o gpt-4o com visão. Entra o texto do PDF (camada de texto lida com pdfjs);
// saem os campos do certificado, as divergências com o que o aluno declarou e a categoria
// sugerida por palavras-chave. Nada é inventado: campo não encontrado fica nulo e vira aviso.

export type Category = { id: string; code?: string | null; label: string; description?: string | null; max_per_item_minutes?: number | null };
export type Declared = { title?: string | null; issuer?: string | null; minutes?: number | null };
export type Extraction = {
  participant_name: string | null; issuer: string | null; event_title: string | null;
  starts_at: string | null; ends_at: string | null; documentary_minutes: number | null;
  extraction_quality: "complete" | "partial" | "insufficient"; warnings: string[];
  suggested_category_id: string | null; suggested_justification: string | null;
  name_matches: boolean;
};

export const MIN_TEXT = 40;
const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MONTH_RE = Object.keys(MONTHS).join("|");

export const fold = (s: string) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const iso = (y: number, m: number, d: number) => {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
};

/** Carga horária em minutos. Prefere o valor ao lado de "carga horária"; senão, um único valor de horas no texto. */
export function findMinutes(text: string): { minutes: number | null; ambiguous: boolean } {
  const t = fold(text);
  const toMin = (h: string, m?: string) => Number(h) * 60 + (m ? Number(m) : 0);
  const near = t.match(/carga\s+horaria(?:\s+total)?(?:\s+de)?\s*[:\-]?\s*(\d{1,4})(?:[.,](\d))?\s*(?:h|hs|horas?)?(?:\s*(?:e\s*)?(\d{1,2})\s*min)?/);
  if (near) {
    const decimal = near[2] ? Number(near[2]) * 6 : 0;
    return { minutes: toMin(near[1], near[3]) + decimal, ambiguous: false };
  }
  const values = new Set<number>();
  for (const m of t.matchAll(/(\d{1,4})\s*(?:h|hs|horas?)\b(?:\s*(?:e\s*)?(\d{1,2})\s*min(?:utos)?)?/g)) values.add(toMin(m[1], m[2]));
  for (const m of t.matchAll(/\b(\d{1,2})h(\d{2})\b/g)) values.delete(toMin(m[1], m[2])); // horário (19h30), não carga
  if (values.size === 1) return { minutes: [...values][0], ambiguous: false };
  return { minutes: null, ambiguous: values.size > 1 };
}

/** Período do evento: intervalo explícito, ou datas ligadas a "realizado/no dia/nos dias/período". */
export function findDates(text: string): { starts: string | null; ends: string | null; onlyOne: boolean } {
  const t = fold(text);
  let r = t.match(new RegExp(`(\\d{1,2})\\s*(?:de\\s+(${MONTH_RE})\\s+)?(?:a|ate|e)\\s*(\\d{1,2})\\s+de\\s+(${MONTH_RE})\\s+de\\s+(\\d{4})`));
  if (r) {
    const y = Number(r[5]); const m2 = MONTHS[r[4]]; const m1 = r[2] ? MONTHS[r[2]] : m2;
    return { starts: iso(y, m1, Number(r[1])), ends: iso(y, m2, Number(r[3])), onlyOne: false };
  }
  r = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:a|ate|-|–)\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (r) return { starts: iso(+r[3], +r[2], +r[1]), ends: iso(+r[6], +r[5], +r[4]), onlyOne: false };
  const all: { date: string; idx: number }[] = [];
  for (const m of t.matchAll(new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTH_RE})\\s+de\\s+(\\d{4})`, "g"))) {
    const d = iso(+m[3], MONTHS[m[2]], +m[1]); if (d) all.push({ date: d, idx: m.index || 0 });
  }
  for (const m of t.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)) {
    const d = iso(+m[3], +m[2], +m[1]); if (d) all.push({ date: d, idx: m.index || 0 });
  }
  if (!all.length) return { starts: null, ends: null, onlyOne: false };
  const event = all.filter((x) => /(realizad|ocorrid|no dia|nos dias|periodo|durante|em)\W*$/.test(t.slice(Math.max(0, x.idx - 25), x.idx)));
  const pick = (event.length ? event : all).map((x) => x.date).sort();
  return { starts: pick[0], ends: pick[pick.length - 1], onlyOne: !event.length && all.length === 1 };
}

const ISSUER_RE = /(universidade|faculdade|centro universitario|instituto|escola|ordem dos advogados|oab|tribunal|associacao|fundacao|conselho|ministerio|defensoria|procuradoria|academia|camara|assembleia|secretaria|nucleo)/;
export function findIssuer(lines: string[]): string | null {
  const head = lines.slice(0, 12);
  const hit = head.find((l) => ISSUER_RE.test(fold(l)) && l.length <= 160 && !/certific/i.test(l));
  if (hit) return clean(hit);
  const all = lines.join(" ");
  const promo = fold(all).match(/promovid[oa]\s+(?:pel[oa]|por)\s+([^,.;]{5,120}?)(?=,|\.|;|\s+(?:no dia|nos dias|em \d|com carga|realizad)|$)/);
  return promo ? extractOriginal(all, promo[1]) : null;
}
function extractOriginal(original: string, foldedPiece: string) {
  const f = fold(original); const i = f.indexOf(foldedPiece);
  return i >= 0 ? clean(original.slice(i, i + foldedPiece.length)) : clean(foldedPiece);
}

const EVENT_KIND = "curso|minicurso|evento|palestra|seminario|congresso|simposio|jornada|conferencia|forum|webinario|webinar|workshop|oficina|encontro|semana|mesa redonda|capacitacao|projeto|programa";
export function findTitle(text: string): string | null {
  const quoted = text.match(/[“"«]([^”"»]{6,160})[”"»]/);
  if (quoted) return clean(quoted[1]);
  const f = fold(text);
  const m = f.match(new RegExp(`(?:participou|concluiu|participacao|frequentou|assistiu|ministrou|organizou)\\s+(?:como\\s+\\w+\\s+)?(?:d[oa]s?|n[oa]s?|[oa]s?|ao)\\s+((?:${EVENT_KIND})\\b[^.;]{3,160}?)(?=,|\\.|;|\\s+(?:realizad|promovid|ocorrid|com carga|no dia|nos dias|no periodo|em \\d|pel[oa]\\s|de \\d))`));
  return m ? extractOriginal(text.replace(/\s+/g, " "), clean(m[1])) : null;
}

export function nameMatches(text: string, studentName: string | null | undefined): boolean {
  if (!studentName) return false;
  const t = ` ${fold(text).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  const parts = fold(studentName).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((p) => p.length > 2 && !["dos", "das", "de", "da", "do"].includes(p));
  if (!parts.length) return false;
  if (t.includes(` ${parts.join(" ")} `)) return true;
  return parts.length >= 2 && t.includes(` ${parts[0]} `) && t.includes(` ${parts[parts.length - 1]} `);
}
function findParticipant(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/(?:certificamos que|certifica-se que|conferido a|confere a|atestamos que)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'´ ]{5,90}?)(?=,|\s+(?:participou|concluiu|portador|inscrit|CPF|RG|frequentou|esteve|assistiu|ministrou))/i);
  return m ? clean(m[1]) : null;
}

const HINTS: [RegExp, RegExp][] = [
  [/palestra|seminario|congresso|simposio|jornada|conferencia|forum|webinar|webinario|encontro|semana juridica|mesa redonda/, /evento/],
  [/minicurso|curso livre|capacitacao|curso de|workshop|oficina/, /curso|capacitacao/],
  [/monitoria|monitor/, /monitoria/],
  [/extensao/, /extensao/],
  [/voluntari|acao social|campanha|filantrop/, /voluntari|acoes sociais/],
  [/estagio/, /estagio/],
  [/iniciacao cientifica|pibic/, /iniciacao cientifica/],
  [/artigo|publicac|anais|periodico|revista/, /publicac/],
  [/banca|defesa de (?:tcc|monografia|dissertacao)|trabalho de conclusao/, /defesas/],
  [/colegiado|representante discente|representacao discente|centro academico/, /representacao/],
  [/nucleo de pratica|npj|empresa junior|laboratorio/, /npj|empresa junior|laboratorio/],
];
export function suggestCategory(text: string, title: string | null, categories: Category[]) {
  const subject = fold(`${title || ""} ${text.slice(0, 1500)}`);
  const scores = categories.map((c) => {
    const target = fold(`${c.label} ${c.description || ""}`);
    let score = 0; const why: string[] = [];
    for (const [inText, inCat] of HINTS) {
      const hit = subject.match(inText);
      if (hit && inCat.test(target)) { score += 1; why.push(hit[0]); }
    }
    if (score && /juridic|direito/.test(target) && /juridic|direito|advoca|oab/.test(subject)) score += 0.5;
    return { c, score, why };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (!scores.length || (scores[1] && scores[1].score === scores[0].score)) return { id: null, justification: null };
  const best = scores[0];
  return { id: best.c.id, justification: `Palavra-chave no certificado: "${best.why.join('", "')}" → ${best.c.label}${best.c.code ? ` (${best.c.code})` : ""}.` };
}

const overlap = (a: string, b: string) => {
  const ta = new Set(fold(a).split(/\W+/).filter((w) => w.length > 3));
  const tb = fold(b).split(/\W+/).filter((w) => w.length > 3);
  return tb.length ? tb.filter((w) => ta.has(w)).length / tb.length : 1;
};

export function extractCertificate(text: string, opts: { studentName?: string | null; declared?: Declared; categories?: Category[] } = {}): Extraction {
  const warnings: string[] = [];
  const body = String(text || "");
  if (clean(body).length < MIN_TEXT) {
    return {
      participant_name: null, issuer: null, event_title: null, starts_at: null, ends_at: null, documentary_minutes: null,
      extraction_quality: "insufficient", name_matches: false, suggested_category_id: null, suggested_justification: null,
      warnings: ["Documento sem texto legível (imagem ou PDF digitalizado): leitura automática indisponível; conferir manualmente."],
    };
  }
  const lines = body.split(/\n+/).map(clean).filter(Boolean);
  const { minutes, ambiguous } = findMinutes(body);
  const dates = findDates(body);
  const issuer = findIssuer(lines);
  const title = findTitle(body);
  const matched = nameMatches(body, opts.studentName);
  const participant = matched ? clean(String(opts.studentName)) : findParticipant(body);

  if (minutes === null) warnings.push(ambiguous ? "Mais de um valor de horas no documento: confirmar a carga horária." : "Carga horária não encontrada no documento.");
  if (!dates.starts) warnings.push("Data do evento não encontrada.");
  else if (dates.onlyOne) warnings.push("Só uma data no documento: pode ser a data de emissão, não a do evento.");
  if (!issuer) warnings.push("Emissor não identificado no cabeçalho.");
  if (!title) warnings.push("Título do evento não identificado.");
  if (opts.studentName && !matched) warnings.push(participant ? `Nome no certificado ("${participant}") não confere com o cadastro do aluno.` : "Nome do aluno não encontrado no certificado.");
  if (!/assinad|assinatura|codigo de (?:verificacao|autenticacao|validacao)|autenticidade|qr ?code|hash/.test(fold(body))) warnings.push("Sem assinatura ou código de verificação identificável no texto.");

  const d = opts.declared || {};
  if (d.minutes && minutes !== null && Math.abs(d.minutes - minutes) >= 30) warnings.push(`Carga declarada (${(d.minutes / 60).toLocaleString("pt-BR")}h) difere da do documento (${(minutes / 60).toLocaleString("pt-BR")}h).`);
  if (d.issuer && issuer && overlap(issuer, d.issuer) < 0.5) warnings.push(`Emissor declarado ("${d.issuer}") difere do documento ("${issuer}").`);
  if (d.title && title && overlap(`${title} ${body.slice(0, 800)}`, d.title) < 0.5) warnings.push(`Título declarado ("${d.title}") não aparece no documento.`);

  const cat = suggestCategory(body, title, opts.categories || []);
  if (cat.id) {
    const c = (opts.categories || []).find((x) => x.id === cat.id);
    if (c?.max_per_item_minutes && minutes && minutes > c.max_per_item_minutes) warnings.push(`Carga acima do limite da categoria (${c.max_per_item_minutes / 60}h por item): o crédito será limitado.`);
  }

  const found = [minutes !== null, !!dates.starts, !!issuer, !!title, matched].filter(Boolean).length;
  const quality = found === 5 ? "complete" : minutes !== null || title ? "partial" : "insufficient";
  return {
    participant_name: participant, issuer, event_title: title, starts_at: dates.starts, ends_at: dates.ends,
    documentary_minutes: minutes, extraction_quality: quality, warnings, name_matches: matched,
    suggested_category_id: cat.id, suggested_justification: cat.justification,
  };
}
