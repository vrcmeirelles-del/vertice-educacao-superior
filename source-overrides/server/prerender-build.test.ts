import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve('scripts/run-prerender.mjs');
function fixture(source: string) {
  const dir = mkdtempSync(resolve('.prerender-contract-'));
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'scripts/style.css'), '.title { color: red; }');
  writeFileSync(join(dir, 'scripts/prerender.tsx'), source);
  return dir;
}
function run(dir: string) { return spawnSync(process.execPath, [runner], { cwd: dir, encoding: 'utf8', timeout: 30000 }); }
describe('strict public prerender build', () => {
  it('renders real React HTML while CSS stays in the Vite client bundle', () => {
    const dir = fixture(`import './style.css'; import {renderToStaticMarkup} from 'react-dom/server'; import {writeFileSync} from 'node:fs'; writeFileSync('rendered.html',renderToStaticMarkup(<h1 className="title">Vértice teste público</h1>));`);
    try { const result=run(dir); expect(result.status, result.stderr).toBe(0); expect(readFileSync(join(dir,'rendered.html'),'utf8')).toContain('<h1 class="title">Vértice teste público</h1>'); expect(readdirSync(dir).filter(p=>p.startsWith('.prerender-'))).toEqual([]); } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  it('fails the process on a rendering exception and still removes temporary output', () => {
    const dir=fixture(`throw new Error('EXPECTED_RENDER_FAILURE');`);
    try { const result=run(dir); expect(result.status).not.toBe(0); expect(result.stderr).toContain('EXPECTED_RENDER_FAILURE'); expect(readdirSync(dir).filter(p=>p.startsWith('.prerender-'))).toEqual([]); } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  it('does not mask failure in the production package command', () => {
    const command=JSON.parse(readFileSync('package.json','utf8')).scripts['build:static'];
    expect(command).toContain('vite build && node scripts/run-prerender.mjs');
    // Ensure no shell-level error masking (|| echo, || true, || exit)
    // The version.json generator uses JS || which is fine
    expect(command).not.toMatch(/\|\|\s*(echo|true|exit|:)\b/);
    const source=readFileSync('scripts/prerender.tsx','utf8');
    expect(source).toContain('Prerender requires a fresh Vite template');
    expect(source).toContain('Public page rendered no HTML');
  });
});
