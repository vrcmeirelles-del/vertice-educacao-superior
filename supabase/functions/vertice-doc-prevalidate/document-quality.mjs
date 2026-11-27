// Observable signals only. This does not detect handwriting or certify OCR fidelity.
export const QUALITY_POLICY_VERSION = 'qualidade-documental@2026-11-27.1';
const normalized = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const fold = value => normalized(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const SEVERITY_CAP = Object.freeze({ critical: 50, major: 75, minor: 95, benign: 100 });
export const rulesJobVersion = (version, supersededBy) => version + (supersededBy ? `|superseded:${supersededBy}` : '');
export function sourceBaseline(previous) {
  const issues=previous?.extraction_metadata?.quality?.issues;
  return Array.isArray(issues) && issues.some(issue=>issue.code==='source_revision_changed')
    ? previous.extraction_metadata.previous_sha256 : previous?.source_sha256;
}

export function assessDocumentQuality(extraction, source = {}) {
  const issues = [];
  const add = (code, severity, message) => issues.push({ code, severity, message });
  if (extraction.partial || extraction.pagesWithoutText?.length) {
    add('incomplete_extraction', 'critical', 'Extração incompleta: conferir as páginas ou células ausentes antes de vincular indicadores.');
  }
  if (extraction.reviewSignals?.includes('tracked_changes')) {
    add('tracked_changes', 'critical', 'O arquivo contém alterações controladas. O gestor deve definir a versão válida no original.');
  }
  if (extraction.reviewSignals?.includes('comments')) {
    add('document_comments', 'major', 'O arquivo contém comentários. Conferir no original se afetam a evidência.');
  }
  if (source.superseded_by) {
    add('superseded_source', 'critical', 'O cadastro informa substituição por outra versão. Conferir o documento sucessor.');
  }
  if (source.previous_sha256 && extraction.sha256 && source.previous_sha256 !== extraction.sha256) {
    add('source_revision_changed', 'critical', 'O conteúdo difere da extração anterior. A análise desta versão exige nova conferência humana.');
  }
  if (/\b(?:rasura(?:do|da|s)?|texto (?:tachado|riscado)|alteracoes controladas|versoes divergentes)\b/.test(fold(extraction.text))) {
    add('annotation_mentioned', 'major', 'O texto menciona rasuras ou alterações. É um sinal textual, não comprovação visual.');
  }
  const highest = issues.reduce((current, issue) => SEVERITY_CAP[issue.severity] < SEVERITY_CAP[current] ? issue.severity : current, 'benign');
  return {
    policy_version: QUALITY_POLICY_VERSION, highest_severity: highest, issues,
    suggestions_withheld: issues.some(issue => ['critical', 'major'].includes(issue.severity)),
    review_required: true, visual_annotation_detection: 'not_performed',
    // No score: without a human reference, fidelity is unknown rather than 100%.
    fidelity_score: null,
  };
}

/** Evaluate human-verified fields by consequence. Similarity cannot dilute a critical error. */
export function evaluateFields(fields) {
  if (!Array.isArray(fields)) throw Error('invalid_gold_fields');
  const seen = new Set(), errors = [];
  for (const field of fields) {
    if (!field.id || seen.has(field.id) || !Object.hasOwn(SEVERITY_CAP, field.severity) ||
        typeof field.expected !== 'string' || typeof field.actual !== 'string') throw Error('invalid_gold_field');
    seen.add(field.id);
    if (normalized(field.expected) !== normalized(field.actual)) errors.push({ id: field.id, severity: field.severity });
  }
  const scored = fields.filter(field => field.severity !== 'benign');
  const failures = errors.filter(error => error.severity !== 'benign');
  const recovery = scored.length ? 100 * (scored.length - failures.length) / scored.length : null;
  const cap = failures.reduce((value, error) => Math.min(value, SEVERITY_CAP[error.severity]), 100);
  return { fields: fields.length, errors, critical_errors: errors.filter(error => error.severity === 'critical').length,
    score: recovery === null ? null : Math.min(recovery, cap), policy_version: QUALITY_POLICY_VERSION };
}
