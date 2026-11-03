/** Offline only. Never accesses Supabase. Run with read access to input and write to a NEW output directory. */
import { prepareTemplate, sha256, type Manifest } from '../../supabase/functions/_shared/document-template.ts';
const [sourcePath, manifestPath, outputDirectory] = Deno.args;
if (!sourcePath || !manifestPath || !outputDirectory) throw new Error('Usage: prepare-template.ts source.docx reviewed-manifest.json NEW-output-directory');
const source = await Deno.readFile(sourcePath);
const manifest = JSON.parse(await Deno.readTextFile(manifestPath)) as Manifest;
const result = await prepareTemplate(source, manifest);
const hash = await sha256(result);
// Exclusive directory creation also prevents a partial retry from overwriting an earlier result.
await Deno.mkdir(outputDirectory);
const path = `${outputDirectory}/${hash}.docx`;
await Deno.writeFile(path, result, { createNew: true });
await Deno.writeTextFile(`${outputDirectory}/review.json`, JSON.stringify({
  template_sha256: hash, template_source_sha256: manifest.source_sha256,
  template_review_ref: manifest.review_ref, file: `${hash}.docx`,
  status: 'offline-prepared-not-published', manifest,
}, null, 2), { createNew: true });
console.log(JSON.stringify({ path, template_sha256: hash, status: 'offline-prepared-not-published' }));
