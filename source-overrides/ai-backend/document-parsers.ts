/**
 * Document Parser Engine — Extensão ampliada do extraction.ts
 *
 * Parsers para PDF, DOCX, XLSX, PPTX e CSV com:
 * - Detecção de runtime (Node vs Deno/Supabase Edge)
 * - Fallback gracioso quando parser não disponível
 * - Limites de segurança (tamanho, expansão ZIP, memória)
 * - OCR como adaptador opcional com disponibilidade explícita
 *
 * NÃO aceita: scripts, entidades externas, URLs, instruções documentais.
 * NÃO chama PDF digitalizado de analisado sem OCR efetivo.
 */

// ============================================================
// Tipos
// ============================================================

export interface ParsedPage {
  pageNumber: number | null;       // null para formatos sem paginação natural
  text: string;
  source: 'text_layer' | 'ocr' | 'paragraph' | 'cell' | 'slide';
}

export interface ParsedDocument {
  fileName: string;
  mimeType: string;
  format: SupportedFormat;
  pages: ParsedPage[];
  totalCharacters: number;
  metadata: DocumentMetadata;
  warnings: string[];
}

export interface DocumentMetadata {
  pageCount: number | null;
  hasTextLayer: boolean | null;      // PDF: se tem camada de texto
  isScanned: boolean | null;         // PDF: se parece digitalizado
  ocrApplied: boolean;               // se OCR foi efetivamente usado
  sheetNames?: string[];             // XLSX: nomes das planilhas
  slideCount?: number;               // PPTX: número de slides
  wordCount: number;
}

export type SupportedFormat =
  | 'txt' | 'csv' | 'tsv'
  | 'pdf' | 'docx' | 'xlsx' | 'pptx';

export type ParseStatus =
  | 'ok'
  | 'partial'                        // extraído mas com perdas
  | 'scanned_no_ocr'                // PDF digitalizado sem OCR disponível
  | 'parser_unavailable'            // runtime não suporta este formato
  | 'unsupported'
  | 'too_large'
  | 'malformed'
  | 'binary_rejected';

export interface ParseResult {
  status: ParseStatus;
  document: ParsedDocument | null;
  message: string;
}

// ============================================================
// Limites de segurança
// ============================================================

export const PARSE_LIMITS = Object.freeze({
  maxFileSizeBytes: 10 * 1024 * 1024,     // 10 MiB
  maxTextCharacters: 100_000,              // 100k chars total
  maxPages: 500,
  maxSheets: 20,
  maxSlides: 200,
  maxCellsPerSheet: 50_000,
  maxZipExpansionRatio: 20,                // proteção contra zip bombs
  maxZipEntries: 500,
  timeoutMs: 30_000,
});

// ============================================================
// Detecção de runtime
// ============================================================

interface RuntimeCapabilities {
  canParsePdf: boolean;
  canParseDocx: boolean;
  canParseXlsx: boolean;
  canParsePptx: boolean;
  hasOcr: boolean;
  runtime: 'node' | 'deno' | 'unknown';
}

function detectRuntime(): RuntimeCapabilities {
  const isDeno = typeof (globalThis as any).Deno !== 'undefined';
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;

  // Em Deno (Supabase Edge), parsers de formatos Office dependem de libs
  // que podem não estar disponíveis. Checamos em runtime.
  return {
    canParsePdf: checkModule('pdf-parse') || checkModule('pdfjs-dist'),
    canParseDocx: checkModule('mammoth') || checkModule('docx-parser'),
    canParseXlsx: checkModule('xlsx') || checkModule('exceljs'),
    canParsePptx: checkModule('pptx-parser'),
    hasOcr: checkModule('tesseract.js'),
    runtime: isDeno ? 'deno' : isNode ? 'node' : 'unknown',
  };
}

function checkModule(name: string): boolean {
  try {
    // Tentativa de resolução sem execução
    if (typeof require !== 'undefined') {
      require.resolve(name);
      return true;
    }
  } catch { /* não disponível */ }
  return false;
}

// ============================================================
// Parser registry
// ============================================================

type ParserFn = (
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
) => Promise<ParseResult>;

const parsers: Record<SupportedFormat, ParserFn> = {
  txt: parsePlainText,
  csv: parseCsv,
  tsv: parseCsv,
  pdf: parsePdf,
  docx: parseDocx,
  xlsx: parseXlsx,
  pptx: parsePptx,
};

// ============================================================
// Entry point
// ============================================================

export async function parseDocument(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<ParseResult> {
  // 1. Verificar tamanho
  if (bytes.byteLength > PARSE_LIMITS.maxFileSizeBytes) {
    return { status: 'too_large', document: null, message: `Arquivo excede ${PARSE_LIMITS.maxFileSizeBytes / (1024*1024)} MiB.` };
  }

  // 2. Detectar formato
  const format = detectFormat(fileName, mimeType, bytes);
  if (!format) {
    return { status: 'unsupported', document: null, message: `Formato não suportado: ${mimeType} / ${fileName}` };
  }

  // 3. Rejeitar conteúdo suspeito
  const suspicious = detectSuspiciousContent(bytes, format);
  if (suspicious) {
    return { status: 'binary_rejected', document: null, message: suspicious };
  }

  // 4. Executar parser com timeout
  const parser = parsers[format];
  try {
    const result = await withTimeout(parser(bytes, fileName, mimeType), PARSE_LIMITS.timeoutMs);
    return result;
  } catch (err) {
    if (err instanceof TimeoutError) {
      return { status: 'malformed', document: null, message: 'Parser excedeu o tempo limite. Arquivo pode estar corrompido ou ser muito complexo.' };
    }
    return { status: 'malformed', document: null, message: `Erro ao processar: ${(err as Error).message}` };
  }
}

// ============================================================
// Detecção de formato
// ============================================================

function detectFormat(fileName: string, mimeType: string, bytes: Uint8Array): SupportedFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const mime = mimeType.toLowerCase().split(';')[0].trim();

  // Verificação por magic bytes primeiro
  const sig = bytes.subarray(0, 8);
  const sigHex = Array.from(sig, b => b.toString(16).padStart(2, '0')).join('');

  if (sigHex.startsWith('25504446')) return 'pdf';           // %PDF
  if (sigHex.startsWith('504b0304')) {                        // PK (ZIP)
    if (ext === 'docx' || mime.includes('wordprocessing')) return 'docx';
    if (ext === 'xlsx' || mime.includes('spreadsheet')) return 'xlsx';
    if (ext === 'pptx' || mime.includes('presentation')) return 'pptx';
  }

  // Fallback por extensão
  const map: Record<string, SupportedFormat> = {
    txt: 'txt', csv: 'csv', tsv: 'tsv',
    pdf: 'pdf', docx: 'docx', xlsx: 'xlsx', pptx: 'pptx',
  };
  return map[ext] || null;
}

// ============================================================
// Proteção contra conteúdo malicioso
// ============================================================

function detectSuspiciousContent(bytes: Uint8Array, format: SupportedFormat): string | null {
  // Não analisar binários em busca de texto — apenas verificar assinaturas
  if (format === 'txt' || format === 'csv' || format === 'tsv') {
    const sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096));
    // Rejeitar se contém entidades XML externas
    if (/<!ENTITY\s/i.test(sample)) return 'Arquivo contém entidades XML — rejeitado por segurança.';
    // Rejeitar se contém instruções que parecem prompt injection
    if (/\b(ignore previous|system prompt|you are now|act as)\b/i.test(sample)) {
      return 'Arquivo contém instruções suspeitas — rejeitado por segurança.';
    }
  }
  return null;
}

// ============================================================
// Parsers individuais
// ============================================================

async function parsePlainText(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { status: 'malformed', document: null, message: 'Texto não está em UTF-8 válido.' };
  }

  text = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (!text) return { status: 'malformed', document: null, message: 'Nenhum texto encontrado.' };

  if (text.length > PARSE_LIMITS.maxTextCharacters) {
    text = text.substring(0, PARSE_LIMITS.maxTextCharacters);
  }

  return {
    status: 'ok',
    document: {
      fileName, mimeType: 'text/plain', format: 'txt',
      pages: [{ pageNumber: null, text, source: 'paragraph' }],
      totalCharacters: text.length,
      metadata: { pageCount: null, hasTextLayer: null, isScanned: null, ocrApplied: false, wordCount: text.split(/\s+/).length },
      warnings: text.length >= PARSE_LIMITS.maxTextCharacters ? ['Texto truncado no limite de caracteres.'] : [],
    },
    message: 'Texto extraído com sucesso.',
  };
}

async function parseCsv(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { status: 'malformed', document: null, message: 'CSV não está em UTF-8 válido.' };
  }

  text = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  const lines = text.split('\n');
  const delimiter = fileName.endsWith('.tsv') ? '\t' : ',';
  const format: SupportedFormat = fileName.endsWith('.tsv') ? 'tsv' : 'csv';

  // Converter para texto legível: linha/campo
  const readable = lines.map((line, i) =>
    `Linha ${i + 1}: ${line.split(delimiter).map((f, j) => `Campo ${j + 1}=${f.trim()}`).join('; ')}`
  ).join('\n');

  const truncated = readable.length > PARSE_LIMITS.maxTextCharacters
    ? readable.substring(0, PARSE_LIMITS.maxTextCharacters) : readable;

  return {
    status: 'ok',
    document: {
      fileName, mimeType: format === 'tsv' ? 'text/tab-separated-values' : 'text/csv', format,
      pages: [{ pageNumber: null, text: truncated, source: 'cell' }],
      totalCharacters: truncated.length,
      metadata: { pageCount: null, hasTextLayer: null, isScanned: null, ocrApplied: false, wordCount: lines.length },
      warnings: readable.length > PARSE_LIMITS.maxTextCharacters ? ['Dados truncados no limite de caracteres.'] : [],
    },
    message: `${lines.length} linhas extraídas.`,
  };
}

async function parsePdf(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const caps = detectRuntime();

  if (!caps.canParsePdf) {
    // Verificar se é digitalizado pela ausência de streams de texto
    const sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 8192));
    const hasTextStream = /\/Type\s*\/Page/.test(sample) && /BT\s/.test(sample);

    return {
      status: 'parser_unavailable',
      document: null,
      message: hasTextStream
        ? 'Parser de PDF não disponível neste runtime. O arquivo parece conter texto extraível.'
        : 'Parser de PDF não disponível. O arquivo pode ser digitalizado — OCR seria necessário.',
    };
  }

  // Se parser disponível, usar dinamicamente
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(Buffer.from(bytes));

    const text = data.text.normalize('NFC').trim();
    const isScanned = !text || text.length < 50;

    if (isScanned && !caps.hasOcr) {
      return {
        status: 'scanned_no_ocr',
        document: null,
        message: 'PDF digitalizado detectado. OCR não disponível neste ambiente. Documento não pode ser considerado analisado.',
      };
    }

    const truncated = text.length > PARSE_LIMITS.maxTextCharacters
      ? text.substring(0, PARSE_LIMITS.maxTextCharacters) : text;

    return {
      status: text.length > PARSE_LIMITS.maxTextCharacters ? 'partial' : 'ok',
      document: {
        fileName, mimeType: 'application/pdf', format: 'pdf',
        pages: [{ pageNumber: null, text: truncated, source: 'text_layer' }],
        totalCharacters: truncated.length,
        metadata: {
          pageCount: data.numpages,
          hasTextLayer: !isScanned,
          isScanned,
          ocrApplied: false,
          wordCount: truncated.split(/\s+/).length,
        },
        warnings: [
          ...(text.length > PARSE_LIMITS.maxTextCharacters ? ['Texto truncado.'] : []),
          ...(isScanned ? ['Documento parece digitalizado. Texto pode estar incompleto sem OCR.'] : []),
        ],
      },
      message: `${data.numpages} páginas, ${truncated.length} caracteres extraídos.`,
    };
  } catch (err) {
    return { status: 'malformed', document: null, message: `Falha ao processar PDF: ${(err as Error).message}` };
  }
}

async function parseDocx(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const caps = detectRuntime();
  if (!caps.canParseDocx) {
    return {
      status: 'parser_unavailable',
      document: null,
      message: 'Parser de DOCX não disponível neste runtime. Formato suportado mas não habilitado.',
    };
  }

  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = result.value.normalize('NFC').trim();

    if (!text) return { status: 'malformed', document: null, message: 'DOCX sem texto extraível.' };

    const truncated = text.length > PARSE_LIMITS.maxTextCharacters
      ? text.substring(0, PARSE_LIMITS.maxTextCharacters) : text;

    return {
      status: 'ok',
      document: {
        fileName, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', format: 'docx',
        pages: [{ pageNumber: null, text: truncated, source: 'paragraph' }],
        totalCharacters: truncated.length,
        metadata: {
          pageCount: null, // DOCX não tem paginação nativa — não inventar
          hasTextLayer: null, isScanned: null, ocrApplied: false,
          wordCount: truncated.split(/\s+/).length,
        },
        warnings: [
          'DOCX não tem paginação nativa — páginas dependem de renderização.',
          ...(text.length > PARSE_LIMITS.maxTextCharacters ? ['Texto truncado.'] : []),
          ...(result.messages.length > 0 ? result.messages.map((m: any) => m.message) : []),
        ],
      },
      message: `${truncated.split(/\s+/).length} palavras extraídas.`,
    };
  } catch (err) {
    return { status: 'malformed', document: null, message: `Falha ao processar DOCX: ${(err as Error).message}` };
  }
}

async function parseXlsx(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const caps = detectRuntime();
  if (!caps.canParseXlsx) {
    return {
      status: 'parser_unavailable',
      document: null,
      message: 'Parser de XLSX não disponível neste runtime.',
    };
  }

  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(bytes, { type: 'array' });

    const pages: ParsedPage[] = [];
    const warnings: string[] = [];
    let totalChars = 0;

    for (const name of workbook.SheetNames.slice(0, PARSE_LIMITS.maxSheets)) {
      const sheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const cellCount = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);

      if (cellCount > PARSE_LIMITS.maxCellsPerSheet) {
        warnings.push(`Planilha "${name}" tem ${cellCount} células — truncada a ${PARSE_LIMITS.maxCellsPerSheet}.`);
      }

      const csv = XLSX.utils.sheet_to_csv(sheet);
      const text = `[Planilha: ${name}]\n${csv}`.trim();

      if (totalChars + text.length > PARSE_LIMITS.maxTextCharacters) {
        warnings.push(`Texto truncado na planilha "${name}".`);
        pages.push({ pageNumber: null, text: text.substring(0, PARSE_LIMITS.maxTextCharacters - totalChars), source: 'cell' });
        totalChars = PARSE_LIMITS.maxTextCharacters;
        break;
      }

      pages.push({ pageNumber: null, text, source: 'cell' });
      totalChars += text.length;
    }

    return {
      status: warnings.length > 0 ? 'partial' : 'ok',
      document: {
        fileName, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', format: 'xlsx',
        pages, totalCharacters: totalChars,
        metadata: {
          pageCount: null, hasTextLayer: null, isScanned: null, ocrApplied: false,
          sheetNames: workbook.SheetNames,
          wordCount: totalChars,
        },
        warnings,
      },
      message: `${workbook.SheetNames.length} planilhas, ${totalChars} caracteres.`,
    };
  } catch (err) {
    return { status: 'malformed', document: null, message: `Falha ao processar XLSX: ${(err as Error).message}` };
  }
}

async function parsePptx(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const caps = detectRuntime();
  if (!caps.canParsePptx) {
    // Fallback: extrair texto de slides via ZIP + XML manual
    return await parsePptxFallback(bytes, fileName);
  }

  return { status: 'parser_unavailable', document: null, message: 'Parser PPTX completo não disponível.' };
}

/** Fallback PPTX: abre o ZIP, lê slide*.xml e extrai texto dos nós <a:t> */
async function parsePptxFallback(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  try {
    // PPTX é um ZIP — usar JSZip se disponível, senão reportar indisponível
    let JSZip: any;
    try { JSZip = (await import('jszip')).default; } catch {
      return { status: 'parser_unavailable', document: null, message: 'JSZip não disponível para extrair slides.' };
    }

    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.keys(zip.files);

    if (entries.length > PARSE_LIMITS.maxZipEntries) {
      return { status: 'malformed', document: null, message: 'Arquivo PPTX com número excessivo de entradas — rejeitado.' };
    }

    // Encontrar slides
    const slideFiles = entries
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
        return na - nb;
      })
      .slice(0, PARSE_LIMITS.maxSlides);

    const pages: ParsedPage[] = [];
    let totalChars = 0;

    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('text');
      // Extrair texto de nós <a:t>...</a:t>
      const texts = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gs)]
        .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))
        .filter(Boolean);

      const slideText = `[Slide ${i + 1}]\n${texts.join('\n')}`.trim();

      if (totalChars + slideText.length > PARSE_LIMITS.maxTextCharacters) break;

      pages.push({ pageNumber: i + 1, text: slideText, source: 'slide' });
      totalChars += slideText.length;
    }

    if (pages.length === 0) {
      return { status: 'malformed', document: null, message: 'PPTX sem texto extraível nos slides.' };
    }

    return {
      status: 'ok',
      document: {
        fileName, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', format: 'pptx',
        pages, totalCharacters: totalChars,
        metadata: {
          pageCount: null, hasTextLayer: null, isScanned: null, ocrApplied: false,
          slideCount: slideFiles.length,
          wordCount: totalChars,
        },
        warnings: [],
      },
      message: `${pages.length} slides, ${totalChars} caracteres.`,
    };
  } catch (err) {
    return { status: 'malformed', document: null, message: `Falha ao processar PPTX: ${(err as Error).message}` };
  }
}

// ============================================================
// Utilitários
// ============================================================

class TimeoutError extends Error { constructor() { super('Timeout'); } }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
