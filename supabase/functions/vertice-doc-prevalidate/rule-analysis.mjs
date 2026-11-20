// Pré-validação por algoritmo (auditoria de 20/11/2026): substitui a análise por IA.
// Natureza por padrões no nome e no início do texto; IES e curso por casamento com o cadastro;
// período por regex; vínculos a indicadores por BM25 sobre trechos do documento, usando o rótulo
// do indicador mais um vocabulário curado. Cada vínculo cita literalmente o trecho de maior
// pontuação, o que satisfaz groundedLinks. É sugestão: a validação continua humana.

export const RULES_VERSION = 'regras-bm25@2026-11-20';
export const fold = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const STOP = new Set('a o e de da do das dos em no na nos nas para por pela pelo pelas pelos com sem sob sobre entre ao aos as os um uma uns umas que se ou como mais menos ser sao seu sua seus suas este esta isto esse essa isso aquele aquela ja nao sim tambem quando onde qual quais cada todo toda todos todas outro outra deve devem pode podem sera serao foi foram tem ter ha caso forma meio ambito curso cursos processo processos relacao'.split(' '));
const stem = w => { w = w.replace(/(oes|aes|ais|eis|is|es|s)$/, m => m === 'oes' || m === 'aes' ? 'ao' : m === 'ais' ? 'al' : m === 'eis' ? 'el' : ''); return w.length > 7 ? w.slice(0, 7) : w; };
export const terms = s => (fold(s).match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w)).map(stem);

// Vocabulário curado por indicador (rótulo normalizado → termos que costumam comprovar o indicador).
const VOCAB = {
  'politicas institucionais no ambito do curso': 'pdi ppi politica institucional ensino pesquisa extensao missao',
  'objetivos do curso': 'objetivo geral objetivos especificos formar profissional',
  'perfil profissional do egresso': 'perfil egresso competencias habilidades formacao profissional mercado',
  'estrutura curricular': 'matriz curricular carga horaria disciplinas componentes semestre periodo flexibilidade interdisciplinaridade',
  'conteudos curriculares': 'ementa ementario conteudo programatico bibliografia diretrizes curriculares dcn',
  'metodologia': 'metodologia metodologias ativas aprendizagem baseada problemas estudo caso sala invertida pratica pedagogica',
  'estagio curricular supervisionado': 'estagio supervisionado convenio supervisor orientador relatorio estagio',
  'estagio curricular supervisionado relacao com a rede de escolas da educacao basica': 'estagio escola educacao basica rede publica licenciatura',
  'estagio curricular supervisionado relacao teoria e pratica': 'estagio teoria pratica vivencia profissional',
  'atividades complementares': 'atividades complementares horas complementares regulamento certificado aproveitamento',
  'trabalhos de conclusao de curso (tcc)': 'tcc trabalho conclusao monografia orientador banca regulamento',
  'apoio ao discente': 'apoio discente acolhimento nivelamento monitoria acessibilidade psicopedagogico ouvidoria intercambio permanencia',
  'gestao do curso e os processos de avaliacao interna e externa': 'autoavaliacao cpa avaliacao institucional enade resultados gestao plano acao',
  'atividades de tutoria': 'tutoria tutor tutores mediacao pedagogica distancia',
  'conhecimentos, habilidades e atitudes necessarias as atividades de tutoria': 'tutor capacitacao tutoria formacao competencias',
  'tecnologias de informacao e comunicacao (tic) no processo ensino-aprendizagem': 'tecnologias informacao comunicacao tic digital plataforma recursos tecnologicos',
  'ambiente virtual de aprendizagem (ava)': 'ambiente virtual aprendizagem ava moodle plataforma online',
  'material didatico': 'material didatico apostila livro recursos didaticos producao',
  'procedimentos de acompanhamento e de avaliacao dos processos de ensino-aprendizagem': 'avaliacao aprendizagem provas notas frequencia recuperacao criterios avaliacao',
  'numero de vagas': 'vagas anuais numero vagas dimensionamento demanda',
  'integracao com as redes publicas de ensino': 'rede publica ensino escolas convenio secretaria educacao',
  'integracao do curso com o sistema local e regional de saude (sus)': 'sus sistema saude unidade basica convenio municipal',
  'atividades praticas de ensino para areas da saude': 'pratica clinica saude atendimento laboratorio',
  'atividades praticas de ensino para licenciaturas': 'pratica ensino licenciatura escola docencia',
  'nucleo docente estruturante – nde': 'nde nucleo docente estruturante ata reuniao membros ppc atualizacao',
  'equipe multidisciplinar': 'equipe multidisciplinar profissionais areas distancia',
  'atuacao do coordenador': 'coordenador coordenacao atuacao gestao plano acao reunioes',
  'regime de trabalho do coordenador de curso': 'coordenador regime trabalho tempo integral horas semanais',
  'corpo docente: titulacao': 'docentes titulacao doutores mestres especialistas doutorado mestrado',
  'regime de trabalho do corpo docente do curso': 'regime trabalho tempo integral parcial horista docentes',
  'experiencia profissional do docente': 'experiencia profissional docente anos atuacao mercado',
  'experiencia no exercicio da docencia na educacao basica': 'experiencia docencia educacao basica',
  'experiencia no exercicio da docencia superior': 'experiencia docencia superior magisterio anos',
  'experiencia no exercicio da docencia na educacao a distancia': 'experiencia docencia distancia ead',
  'experiencia no exercicio da tutoria na educacao a distancia': 'experiencia tutoria distancia ead',
  'atuacao do colegiado de curso ou equivalente': 'colegiado reuniao ata deliberacao representacao',
  'titulacao e formacao do corpo de tutores do curso': 'tutores titulacao formacao',
  'experiencia do corpo de tutores em educacao a distancia': 'tutores experiencia distancia',
  'interacao entre tutores (presenciais – quando for o caso – e a distancia), docentes e coordenadores de curso a distancia': 'interacao tutores docentes coordenadores distancia',
  'producao cientifica, cultural, artistica ou tecnologica': 'producao cientifica artigos publicacoes periodicos lattes livros capitulos',
  'espaco de trabalho para docentes em tempo integral': 'gabinete espaco trabalho docentes tempo integral',
  'espaco de trabalho para o coordenador': 'sala coordenacao espaco coordenador',
  'sala coletiva de professores': 'sala professores coletiva',
  'salas de aula': 'salas aula climatizacao carteiras projetor capacidade',
  'acesso dos alunos a equipamentos de informatica': 'laboratorio informatica computadores internet acesso',
  'bibliografia basica por unidade curricular (uc)': 'bibliografia basica acervo exemplares titulos biblioteca',
  'bibliografia complementar por unidade curricular (uc)': 'bibliografia complementar acervo exemplares biblioteca',
  'laboratorios didaticos de formacao basica': 'laboratorio didatico formacao basica equipamentos',
  'laboratorios didaticos de formacao especifica': 'laboratorio didatico formacao especifica equipamentos',
  'laboratorios de ensino para a area de saude': 'laboratorio saude anatomia equipamentos',
  'laboratorios de habilidades': 'laboratorio habilidades simulacao',
  'unidades hospitalares e complexo assistencial conveniados': 'hospital conveniado complexo assistencial',
  'bioterios': 'bioterio animais',
  'processo de controle de producao ou distribuicao de material didatico (logistica)': 'material didatico distribuicao logistica producao',
  'nucleo de praticas juridicas: atividades basicas e arbitragem, negociacao, conciliacao, mediacao e atividades juridicas reais': 'npj nucleo pratica juridica arbitragem negociacao conciliacao mediacao atendimento assistencia juridica',
  'comite de etica em pesquisa (cep)': 'comite etica pesquisa cep plataforma brasil',
  'comite de etica na utilizacao de animais (ceua)': 'ceua etica animais',
  'ambientes profissionais vinculados ao curso': 'ambientes profissionais convenio parceria pratica profissional',
};
const vocabFor = label => VOCAB[fold(label).replace(/\s+/g, ' ').trim()] || '';
// Descrições do catálogo trazem regras de aplicabilidade (NSA/Obrigatório/Exclusivo), não conteúdo.
const usefulDescription = d => String(d || '').split(/(?<=\.)\s+/).filter(s => !/^(nsa|obrigatori|exclusivo)/i.test(fold(s).trim())).join(' ');

/** Trechos do documento (por página/seção) com ~600 caracteres, cortados em fim de frase. */
export function passages(pages, size = 600) {
  const out = [];
  for (const p of pages || []) {
    const text = String(p.text || '');
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) { const dot = text.lastIndexOf('. ', end); if (dot > start + size / 2) end = dot + 1; }
      const piece = text.slice(start, end).trim();
      if (piece.length >= 40) out.push({ page: p.page ?? null, section: p.section ?? null, text: piece, tokens: terms(piece) });
      start = end;
    }
  }
  return out;
}

export function rankIndicators(pages, objects, { k1 = 1.2, b = 0.75, max = 8 } = {}) {
  const docs = passages(pages);
  if (!docs.length) return [];
  const N = docs.length, avg = docs.reduce((s, d) => s + d.tokens.length, 0) / N;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);
  const foldedDocs = docs.map(d => fold(d.text).replace(/\s+/g, ' '));
  const ranked = [];
  for (const o of objects) {
    const labelTerms = [...new Set(terms(o.object_label))];
    const q = [...new Set([...labelTerms, ...terms(vocabFor(o.object_label)), ...terms(usefulDescription(o.description))])];
    if (!q.length) continue;
    // Frase do indicador: o rótulo inteiro (sem parênteses e pontuação) ou, se tiver 3+ palavras, o trecho antes de "–"/":".
    const full = fold(o.object_label).replace(/\(.*?\)/g, ' ').replace(/[–:,-]/g, ' ').replace(/\s+/g, ' ').trim();
    const core = fold(o.object_label).replace(/\(.*?\)/g, '').replace(/[–:].*$/, '').replace(/\s+/g, ' ').trim();
    const phrases = [full, ...(core.split(' ').length >= 3 && core !== full ? [core] : [])].filter(p => p.length >= 8);
    let best = null;
    docs.forEach((d, i) => {
      const tf = new Map(); for (const t of d.tokens) tf.set(t, (tf.get(t) || 0) + 1);
      let score = 0; const hit = [];
      for (const t of q) {
        const f = tf.get(t); if (!f) continue;
        const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
        score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.tokens.length / avg));
        hit.push(t);
      }
      const labelHit = labelTerms.filter(t => hit.includes(t)).length;
      const flat = foldedDocs[i].replace(/[–:,()-]/g, ' ').replace(/\s+/g, ' ');
      const phraseHit = phrases.some(p => flat.includes(p));
      if (phraseHit) score += 3;
      if (!best || score > best.score) best = { score, hit, labelHit, phraseHit, passage: d };
    });
    if (!best || best.score <= 0) continue;
    const labelCoverage = labelTerms.length ? best.labelHit / labelTerms.length : 0;
    // Exige o próprio indicador no trecho: a frase do rótulo, ou a maioria dos termos do rótulo
    // mais termos do vocabulário. Termos genéricos sozinhos não bastam.
    if (!best.phraseHit && !(labelCoverage >= 0.6 && best.hit.length >= 3)) continue;
    ranked.push({ o, ...best, labelCoverage });
  }
  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, max);
  const maxScore = top[0]?.score || 1;
  const rated = top.map(r => ({ r, compatibility: r.phraseHit && r.score >= 0.6 * maxScore ? 'alta' : r.labelCoverage >= 0.6 && r.hit.length >= 4 ? 'media' : 'baixa' }));
  // Vínculo fraco só entra quando o documento não tem nenhum mais forte (evita ruído de termos genéricos).
  const strong = rated.filter(x => x.compatibility !== 'baixa');
  const kept = strong.length ? strong : rated.slice(0, 1);
  return kept.map(({ r, compatibility }, i) => ({
    object: r.o,
    score: Number(r.score.toFixed(3)),
    compatibility,
    is_primary: i === 0,
    matched: r.hit,
    phrase: r.phraseHit,
    excerpt: { page: r.passage.page, section: r.passage.section || '', text: r.passage.text.slice(0, 500) },
  }));
}

// Tipos específicos antes dos genéricos: uma ata ou um plano de ensino costuma citar o PPC no cabeçalho.
const NATURES = [
  [/\bata\b|ata da reuniao|ata de reuniao/, 'Ata de reunião'],
  [/avaliacao simulada/, 'Avaliação simulada (interna)'],
  [/ementa de componente|\bementa\b|\bementario\b/, 'Ementa de componente curricular'],
  [/plano de ensino|plano de aula/, 'Plano de ensino'],
  [/\bportaria\b/, 'Portaria'],
  [/\bresolucao\s*(?:n[o.º°]?\s*\d|\d|cons|cepe|consu)/, 'Resolução'],
  [/\bregimento\b/, 'Regimento'],
  [/\bregulamento\b/, 'Regulamento'],
  [/\bdiploma\b/, 'Diploma'],
  [/\bcertidao\b|\bcnd\b/, 'Certidão'],
  [/\bdeclaracao\b/, 'Declaração'],
  [/\bcertificado\b|\bcertificamos\b/, 'Certificado'],
  [/lista de (?:presenca|frequencia)|\bfrequencia\b/, 'Lista de frequência'],
  [/artigo cientifico|\bresumo\b.*\bpalavras-chave\b|\babstract\b/, 'Artigo científico'],
  [/\boficio\b/, 'Ofício'],
  [/horario de aulas|\bhorario\b/, 'Horário'],
  [/curriculo lattes|\blattes\b/, 'Currículo Lattes'],
  [/\bconvenio\b|termo de cooperacao/, 'Convênio'],
  [/\bcontrato\b/, 'Contrato'],
  [/\bedital\b/, 'Edital'],
  [/nucleo docente estruturante|\bnde\b/, 'Documento do NDE'],
  [/relatorio de autoavaliacao|autoavaliacao institucional|\bcpa\b/, 'Relatório de autoavaliação (CPA)'],
  [/plano de desenvolvimento institucional|\bpdi\b/, 'Plano de Desenvolvimento Institucional (PDI)'],
  [/projeto pedagogico|\bppc\b/, 'Projeto Pedagógico de Curso (PPC)'],
  [/\bmanual\b/, 'Manual'],
  [/^mod\b|\bmodelo\b|\bformulario\b/, 'Modelo/formulário'],
  [/\brelatorio\b/, 'Relatório'],
  [/\bplanilha\b|\.xlsx?$|\.csv$/, 'Planilha'],
];
export function detectNature(fileName, text, category) {
  const name = fold(fileName).replace(/[_\-.]+/g, ' ');
  const head = fold(String(text || '').slice(0, 600));
  for (const [re, label] of NATURES) if (re.test(name)) return label;
  for (const [re, label] of NATURES) if (re.test(head)) return label;
  return category ? `Documento (${category})` : 'Documento';
}

export function detectPeriod(text, fileName = '') {
  const fromName = String(fileName).match(/\b(20\d{2})[-_.]([12])\b/);
  if (fromName) return `${fromName[1]}/${fromName[2]}`;
  const t = fold(String(text || '').slice(0, 20000));
  const sem = t.match(/\b(20\d{2})\s*[./-]\s*([12])\b(?!\d)/) || t.match(/\b([12])[ºo°]?\s*semestre\s*(?:letivo\s*)?(?:de\s*)?(20\d{2})/);
  if (sem) return sem[0].includes('semestre') ? `${sem[2]}/${sem[1]}` : `${sem[1]}/${sem[2]}`;
  const range = t.match(/\b(20\d{2})\s*(?:-|–|a|ate)\s*(20\d{2})\b/);
  if (range && Number(range[2]) > Number(range[1]) && Number(range[2]) - Number(range[1]) <= 10) return `${range[1]}–${range[2]}`;
  const years = (t.match(/\b20[0-4]\d\b/g) || []).reduce((m, y) => m.set(y, (m.get(y) || 0) + 1), new Map());
  const top = [...years].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
  return top ? top[0] : null;
}

export function detectInstitution(text, inst) {
  const t = fold(String(text || '').slice(0, 30000));
  if (inst?.name && t.includes(fold(inst.name))) return inst.name;
  if (inst?.acronym && new RegExp(`\\b${fold(inst.acronym)}\\b`).test(t)) return inst.name || inst.acronym;
  const m = String(text || '').slice(0, 30000).match(/\b(Universidade|Faculdade|Centro Universit[áa]rio|Instituto Federal|Instituto)\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\wÀ-ÿ]+){0,6}/);
  return m ? m[0].trim() : null;
}

export function detectCourse(text, courses) {
  const t = fold(String(text || '').slice(0, 30000));
  const named = (courses || []).map(c => c.name).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of named) { const f = fold(n); if (f.length >= 4 && new RegExp(`curso de (?:bacharelado em |licenciatura em |graduacao em )?${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) return n; }
  const m = String(text || '').slice(0, 30000).match(/[Cc]urso de (?:[Bb]acharelado em |[Ll]icenciatura em |[Gg]radua[çc][ãa]o em )?([A-ZÀ-Ý][\wÀ-ÿ]+(?:[ \t]+(?:(?:e|d[aeo]s?|em)[ \t]+)?(?!Centro\b|Universidade\b|Faculdade\b|Instituto\b)[A-ZÀ-Ý][\wÀ-ÿ]+){0,4})/);
  return m ? m[1].replace(/[ \t]+(?:e|d[aeo]s?|em)$/, '').trim() : null;
}

/** Resumo extrativo: natureza, IES, curso, período e as duas primeiras frases substantivas. */
export function extractiveSummary(text, meta) {
  const sentences = String(text || '').slice(0, 8000).replace(/PÁGINA \d+\n/g, ' ').replace(/\s+/g, ' ')
    .split(/(?<=[.;!?])\s+(?=[A-ZÀ-Ý])/).map(s => s.trim()).filter(s => s.length >= 60 && s.length <= 400 && /[a-zà-ÿ]{4}/.test(s) && !/^(sum[áa]rio|índice)/i.test(s));
  const head = [meta.nature, meta.institution && `IES: ${meta.institution}`, meta.course && `curso: ${meta.course}`, meta.period && `período: ${meta.period}`].filter(Boolean).join(' · ');
  return [head, ...sentences.slice(0, 2)].filter(Boolean).join('. ').slice(0, 1500);
}

export function analyzeByRules({ extraction, fileName, category, objects, catalogs, institution, courses }) {
  const text = extraction.text;
  const nature = detectNature(fileName, text, category);
  const institutionDetected = detectInstitution(text, institution);
  const course = detectCourse(text, courses);
  const period = detectPeriod(text, fileName);
  const scope = /PPC|Plano de ensino|Ementa|NDE/.test(nature) || course ? (/PDI|CPA|Regimento/.test(nature) ? 'ambos' : 'curso') : /PDI|CPA|Regimento/.test(nature) ? 'institucional' : 'ambos';
  const catalogById = new Map((catalogs || []).map(c => [c.id, c]));
  const links = rankIndicators(extraction.pages, objects).map(r => {
    const c = catalogById.get(r.object.catalog_id) || {};
    return {
      instrument_code: c.instrument_code, instrument_version: c.instrument_version,
      object_code: r.object.object_code, dimension: String(r.object.object_code || '').split('.')[0] || '',
      is_primary: r.is_primary, compatibility: r.compatibility,
      justification: `${r.phrase ? `O documento menciona "${r.object.object_label}". ` : ''}Termos do indicador encontrados no trecho: ${r.matched.slice(0, 8).join(', ')} (pontuação BM25 ${r.score}).`,
      evidence_excerpts: [r.excerpt],
      limitations: `Sugestão por correspondência de termos, não por leitura interpretativa: confirmar se o trecho comprova o indicador.${extraction.partial ? ' Extração parcial do documento.' : ''}`,
    };
  });
  return {
    summary: extractiveSummary(text, { nature, institution: institutionDetected, course, period }),
    nature, institution_detected: institutionDetected || undefined, course_detected: course || undefined,
    period_detected: period || undefined, scope_detected: scope, indicator_links: links,
  };
}
