// Gera a matriz de rastreabilidade a partir de catalog.mjs + source-map.mjs.
// A carga do catálogo (20261124210001) já foi aplicada em produção e é imutável; mudanças de
// source_status vão em migração nova, e o teste SQL confere o banco contra source-map.mjs.
// Uso: node scripts/automacao360/gerar-matriz.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { SOURCE_MAP } from '../../supabase/functions/_shared/automacao360/source-map.mjs';

const root = new URL('../../', import.meta.url);
const DOC = new URL('docs/automacao360/MATRIZ_REGRAS.md', root);
const op = (r) => r.operator === 'between' ? `${r.threshold[0]}–${r.threshold[1]}` : `${r.operator === 'lt' ? '<' : '>'} ${r.threshold}`;

export function matrixMd() {
  const counts = SOURCE_MAP.reduce((a, r) => (a[r.sourceStatus] = (a[r.sourceStatus] || 0) + 1, a), {});
  const lines = SOURCE_MAP.map((r) => `| \`${r.id}\` | ${r.module} | ${r.version} | ${r.cadence} | ${r.metric} ${op(r)}${r.minimum ? ` (mín. ${Object.entries(r.minimum).map(([k, v]) => `${k} ${v}`).join('')})` : ''} | ${r.family} | ${r.source} | ${r.adapter ? `\`${r.adapter}\`` : '—'} | ${r.sourceStatus} | ${r.destination} | ${r.note || ''} |`);
  return `# Matriz de rastreabilidade das 40 regras

GERADO por \`scripts/automacao360/gerar-matriz.mjs\` a partir de \`catalog.mjs\` e \`source-map.mjs\`. Não editar à mão.

Fontes verificadas em produção por consulta somente de metadados (esquema, colunas, domínios de status e contagens agregadas) em 24/11/2026. **"identificada" não significa validada**: nenhuma regra está validada, homologada ou ativada. Todas as regras exigem, para leitura, \`vertice_private.automation_can(..., 'read')\` (vínculo nativo com MFA; coordenação/NDE só no próprio curso) e, para configurar, aprovar, revisar, executar, verificar e encaminhar, os papéis definidos em \`vertice_private.automation_can\` (migração \`20261124210000_automacao360_nucleo.sql\`), derivados de \`member_role\`, \`course_function\` e da política nativa \`vertice_actions_insert\`. Qualidade mínima comum: fonte completa e no escopo exato, observação não futura e dentro de \`max_age_hours\`; ausência nunca vira zero.

Resumo: ${counts.identificada || 0} com fonte identificada, ${counts.pendente || 0} com fonte pendente, 0 validadas.

| Regra | Módulo | Versão | Periodicidade | Gatilho proposto | Família | Fonte real | Adaptador | Fonte | Destino | Observação |
|---|---|---|---|---|---|---|---|---|---|---|
${lines.join('\n')}
`;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const check = process.argv.includes('--check');
  const out = [[DOC, matrixMd()]];
  let stale = false;
  for (const [file, content] of out) {
    let cur = null; try { cur = readFileSync(file, 'utf8'); } catch {}
    if (cur !== content) { stale = true; if (!check) writeFileSync(file, content); }
  }
  if (check && stale) { console.error('Matriz desatualizada: rode node scripts/automacao360/gerar-matriz.mjs'); process.exit(1); }
  console.log(check ? 'Matriz atualizada.' : 'Gerada.');
}
