// Gera a migração que leva ao banco os catálogos de instrumento mantidos hoje só no portal:
//  - Recredenciamento institucional 2017 (avaliacao-institucional.json: 50 indicadores, 5 eixos com peso,
//    descritores de conceito 1 a 5, aplicabilidade e evidências esperadas);
//  - Novo Instrumento 2026, curso e institucional (novo-instrumento.ts: proposta, títulos provisórios);
//  - equivalência Reconhecimento 2017 → Novo Instrumento 2026 de curso (instrumento-mapping.ts).
// Nada é transcrito à mão: o SQL sai dos mesmos arquivos que o portal usa, com o sha256 de cada fonte.
// Uso: node --experimental-strip-types scripts/instrumentos/gerar-catalogos.mjs [--check]
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);
const LIB = 'source-overrides/client/src/lib/';
// Depois de aplicada, a migração passa a supabase/migrations/ e fica imutável: o --check passa a acusar
// qualquer mudança nos catálogos do portal, que então exige migração nova (não reescrever esta).
const NAME = '20261125150000_instrumentos_catalogos.sql';
export const MIGRATION = existsSync(new URL('../../supabase/migrations/' + NAME, import.meta.url))
  ? 'supabase/migrations/' + NAME : 'supabase/migrations_nao_aplicadas/' + NAME;
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const sha = (rel) => createHash('sha256').update(readFileSync(new URL(rel, root))).digest('hex');

// Carrega um módulo TS do portal sem as importações (só os dados de topo são usados).
async function loadTs(rel) {
  const dir = mkdtempSync(join(tmpdir(), 'catalogos-'));
  try {
    const file = join(dir, 'm.mts');
    writeFileSync(file, read(rel).split('\n').filter((l) => !/^import\s/.test(l)).join('\n'));
    return await import(pathToFileURL(file).href);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

export async function sources() {
  const recred = JSON.parse(read(LIB + 'avaliacao-institucional.json'));
  const ni = await loadTs(LIB + 'novo-instrumento.ts');
  const map = await loadTs(LIB + 'instrumento-mapping.ts');
  const direito = Object.fromEntries(ni.dimensao4('direito').map((o) => [o.code, o]));
  const negocios = ni.dimensao4('negocios');
  const curso = [
    ...ni.OBJETOS_BASE.map((o) => ({ code: o.code, dim: o.dimension, title: o.title, ref: { group: o.group, hint: o.hint, temas: o.temas, provisorio: !!o.provisorio, ...(o.requisito ? { requisito: o.requisito } : {}) } })),
    ...negocios.map((o) => ({ code: o.code, dim: 4, title: o.title, ref: { group: o.group, hint: o.hint, temas: o.temas, provisorio: !!o.provisorio,
      applicability: 'Somente cursos da Área 04, conforme o perfil do curso.',
      variants: { negocios: { title: o.title, hint: o.hint }, direito: { title: direito[o.code].title, hint: direito[o.code].hint } } } })),
  ];
  const institucional = ni.OBJETOS_INSTITUCIONAL.map((o) => ({ code: o.code, dim: o.eixo, title: o.title, ref: { hint: o.hint, temas: o.temas, provisorio: !!o.provisorio } }));
  const pairs = map.MAPPING_2017_2026.flatMap((m) => m.obj2026.map((t) => ({ from: m.ind2017, to: t, degree: m.grau, note: m.nota })));
  return { recred, ni, curso, institucional, pairs, mapCount: map.MAPPING_2017_2026.length };
}

export async function migrationSql() {
  const { recred, ni, curso, institucional, pairs, mapCount } = await sources();
  const prov = (file, extra) => ({ origin: 'portal', source_file: LIB + file, sha256_source_file: sha(LIB + file), official_text_verified: false, ...extra });
  const catalogs = [
    { code: 'recredenciamento_institucional', version: '2017', scope: 'instituicao',
      label: `${recred.instrument} — ${recred.edition}`,
      structure: { dimension_kind: 'eixo', dimensions: recred.axes, concept: 'media_ponderada_dos_eixos', scale: [1, 5] },
      provenance: prov('avaliacao-institucional.json', { publisher: recred.publisher, edition: recred.edition,
        note: 'Transcrição mantida no portal. Conferência contra o PDF oficial do INEP pendente; não substitui o texto oficial.' }),
      objects: recred.indicators.map((i) => ({ code: i.code, dim: i.axis, title: i.title, description: i.applicability || null,
        ref: { sinaes_dimension: i.dim, concept_descriptors: i.criteria, applicability: i.applicability || null, nota: i.nota || null,
          evidence: { obrigatoria: i.obrig, complementar: i.compl, resultado: i.resultado }, alerta: i.alerta || null } })) },
    { code: 'novo_instrumento_2026_curso', version: '2026-proposta', scope: 'curso',
      label: 'Novo Instrumento 2026 — avaliação de curso (proposta)',
      structure: { dimension_kind: 'dimensao', dimensions: ni.DIMENSOES_INSTRUMENTO.map(([code, name]) => ({ code, name })), status: 'provisorio' },
      provenance: prov('novo-instrumento.ts', { status: 'provisorio',
        note: 'Levantamento do Vértice sobre a proposta em construção; títulos marcados como provisórios devem ser confirmados no instrumento publicado. Roteiros (hint) são do Vértice, não texto oficial.' }),
      objects: curso.map((o) => ({ code: o.code, dim: o.dim, title: o.title, description: null, ref: o.ref })) },
    { code: 'novo_instrumento_2026_institucional', version: '2026-proposta', scope: 'instituicao',
      label: 'Novo Instrumento 2026 — avaliação institucional externa (proposta)',
      structure: { dimension_kind: 'eixo', dimensions: ni.EIXOS_INSTITUCIONAL.map(([code, name]) => ({ code, name })), status: 'provisorio' },
      provenance: prov('novo-instrumento.ts', { status: 'provisorio',
        note: '[Não verificado] Baseado no parecer CONIF/FDE jul/2026 e na ata da 211ª reunião da CONAES, conforme o portal. Será atualizado quando a versão definitiva for publicada.' }),
      objects: institucional.map((o) => ({ code: o.code, dim: o.dim, title: o.title, description: null, ref: o.ref })) },
  ];
  const seed = catalogs.map((c) => `
 INSERT INTO public.vertice_instrument_catalog(institution_id,instrument_code,instrument_label,instrument_version,is_active,scope,source_provenance,structure)
 VALUES(target,${q(c.code)},${q(c.label)},${q(c.version)},false,${q(c.scope)},${j(c.provenance)},${j(c.structure)})
 ON CONFLICT(institution_id,instrument_code,instrument_version) DO NOTHING;
 SELECT id INTO STRICT cat FROM public.vertice_instrument_catalog WHERE institution_id=target AND instrument_code=${q(c.code)} AND instrument_version=${q(c.version)} AND source_provenance->>'sha256_source_file'=${q(c.provenance.sha256_source_file)};
 INSERT INTO public.vertice_instrument_objects(catalog_id,object_code,dimension,object_label,description,reference)
 SELECT cat,v.code,v.dim,v.label,v.descr,v.ref FROM (VALUES
${c.objects.map((o) => `  (${q(o.code)},${q(String(o.dim))},${q(o.title)},${q(o.description)},${j(o.ref)})`).join(',\n')}
 ) AS v(code,dim,label,descr,ref)
 ON CONFLICT(catalog_id,object_code) DO NOTHING;
 IF (SELECT count(*) FROM public.vertice_instrument_objects WHERE catalog_id=cat)<>${c.objects.length} THEN RAISE EXCEPTION 'catalogo % incompleto', ${q(c.code)}; END IF;`).join('\n');
  return `-- GERADO por scripts/instrumentos/gerar-catalogos.mjs a partir dos catálogos do portal. Não editar à mão.
-- Leva ao banco os catálogos do Recredenciamento 2017 e do Novo Instrumento 2026 (curso e institucional)
-- e a equivalência Reconhecimento 2017 → Novo Instrumento 2026 de curso (${mapCount} indicadores, ${pairs.length} pares).
-- Aditiva: duas colunas jsonb novas, uma tabela nova e carga para a UNITOP (mesmo escopo do catálogo do
-- Reconhecimento já aplicado em 20261117153003). Sem alteração de permissões existentes.
-- Os catálogos novos entram com is_active=false: a pré-validação lê só catálogos ativos, então o
-- comportamento dela e a revisão de cache (vertice_doc_rules_revision) não mudam. Ligá-los à
-- pré-validação é decisão própria (passo 4 do plano dos instrumentos).

ALTER TABLE public.vertice_instrument_catalog ADD COLUMN IF NOT EXISTS structure jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.vertice_instrument_objects ADD COLUMN IF NOT EXISTS reference jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.vertice_instrument_catalog.structure IS 'Dimensões ou eixos do instrumento (código, nome, peso) e forma de cálculo do conceito, quando houver.';
COMMENT ON COLUMN public.vertice_instrument_objects.reference IS 'Dados estruturados do indicador: descritores de conceito 1 a 5, aplicabilidade, evidências esperadas, variantes por perfil e marcação de provisório.';
ALTER TABLE public.vertice_instrument_catalog ADD CONSTRAINT vertice_instrument_catalog_id_institution_key UNIQUE (id, institution_id);

-- Equivalência entre indicadores de dois catálogos da mesma instituição. Não é texto oficial:
-- a proveniência registra a origem e o grau é a leitura do Vértice (direto, parcial, complementar).
CREATE TABLE public.vertice_instrument_equivalences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL,
 source_catalog_id uuid NOT NULL,
 source_code text NOT NULL,
 target_catalog_id uuid NOT NULL,
 target_code text NOT NULL,
 degree text NOT NULL CHECK (degree IN ('direto','parcial','complementar')),
 note text,
 provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (source_catalog_id <> target_catalog_id),
 UNIQUE (source_catalog_id, source_code, target_catalog_id, target_code),
 FOREIGN KEY (source_catalog_id, institution_id) REFERENCES public.vertice_instrument_catalog(id, institution_id) ON DELETE CASCADE,
 FOREIGN KEY (target_catalog_id, institution_id) REFERENCES public.vertice_instrument_catalog(id, institution_id) ON DELETE CASCADE,
 FOREIGN KEY (source_catalog_id, source_code) REFERENCES public.vertice_instrument_objects(catalog_id, object_code) ON DELETE CASCADE,
 FOREIGN KEY (target_catalog_id, target_code) REFERENCES public.vertice_instrument_objects(catalog_id, object_code) ON DELETE CASCADE
);
CREATE INDEX vertice_instrument_equivalences_target_idx ON public.vertice_instrument_equivalences(target_catalog_id, target_code);
CREATE INDEX vertice_instrument_equivalences_inst_idx ON public.vertice_instrument_equivalences(institution_id);
ALTER TABLE public.vertice_instrument_equivalences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_instrument_equivalences FROM anon, authenticated;
GRANT SELECT ON public.vertice_instrument_equivalences TO authenticated;
CREATE POLICY vertice_instrument_equivalences_read ON public.vertice_instrument_equivalences
 FOR SELECT TO authenticated USING (vertice_private.can_read_institution(institution_id));

DO $seed$
DECLARE target uuid; cat uuid; src uuid; dst uuid;
BEGIN
 SELECT id INTO STRICT target FROM public.vertice_institutions WHERE emec_code='4969' AND acronym='UNITOP';
${seed}

 SELECT id INTO STRICT src FROM public.vertice_instrument_catalog WHERE institution_id=target AND instrument_code='reconhecimento_curso' AND instrument_version='2017';
 SELECT id INTO STRICT dst FROM public.vertice_instrument_catalog WHERE institution_id=target AND instrument_code='novo_instrumento_2026_curso' AND instrument_version='2026-proposta';
 INSERT INTO public.vertice_instrument_equivalences(institution_id,source_catalog_id,source_code,target_catalog_id,target_code,degree,note,provenance)
 SELECT target,src,v.f,dst,v.t,v.g,v.n,${j({ origin: 'portal', source_file: LIB + 'instrumento-mapping.ts', sha256_source_file: sha(LIB + 'instrumento-mapping.ts'), official: false })} FROM (VALUES
${pairs.map((p) => `  (${q(p.from)},${q(p.to)},${q(p.degree)},${q(p.note)})`).join(',\n')}
 ) AS v(f,t,g,n)
 ON CONFLICT (source_catalog_id, source_code, target_catalog_id, target_code) DO NOTHING;
 IF (SELECT count(*) FROM public.vertice_instrument_equivalences WHERE source_catalog_id=src AND target_catalog_id=dst)<>${pairs.length} THEN RAISE EXCEPTION 'equivalencia incompleta'; END IF;
END $seed$;
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sql = await migrationSql();
  const target = new URL(MIGRATION, root);
  if (process.argv.includes('--check')) {
    if (read(MIGRATION) !== sql) { console.error(MIGRATION + ' desatualizada: rode o gerador'); process.exit(1); }
    console.log('ok');
  } else { writeFileSync(target, sql); console.log('gerado ' + MIGRATION); }
}
