// Run only after build:static for the isolated homologation deployment.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
assert.equal(process.env.VITE_DEPLOYMENT_TARGET, 'homologacao');
const url = new URL(process.env.VITE_SUPABASE_URL || '');
assert.equal(url.protocol, 'https:');
assert.match(url.hostname, /^[a-z0-9]+\.supabase\.co$/);
assert.notEqual(url.hostname, 'qvetbbmviatxxatzzuzc.supabase.co');
assert.equal(url.href, url.origin + '/');
assert.match(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '', /^sb_publishable_/);
let count = 0;
const mainHtml = await readFile('dist/public/index.html', 'utf8');
const mainPolicy = mainHtml.match(/<meta http-equiv="Content-Security-Policy" content="[^"]+"\s*\/?>/)?.[0];
assert.ok(mainPolicy, 'Missing main application CSP');
async function configure(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await configure(file);
    else if (entry.name.endsWith('.html')) {
      let html = await readFile(file, 'utf8');
      if (!html.includes('http-equiv="Content-Security-Policy"')) {
        assert.match(html, /<head(?:\s[^>]*)?>/i);
        html = html.replace(/<head(?:\s[^>]*)?>/i, tag => tag + mainPolicy);
      }
      html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]+)("\s*\/?>)/,
        (_, before, policy, after) => before + policy
          .replaceAll('https://qvetbbmviatxxatzzuzc.supabase.co', url.origin)
          .replaceAll('wss://qvetbbmviatxxatzzuzc.supabase.co', 'wss://' + url.hostname)
          .replace(' https://www.fatoeordem.com.br', '') + after);
      const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
      assert.ok(policy?.includes(url.origin) || /connect-src 'none'/.test(policy || ''));
      assert.ok(!policy?.includes('qvetbbmviatxxatzzuzc') && !policy?.includes('www.fatoeordem.com.br'));
      html = html.replace('</head>', '<meta name="robots" content="noindex,nofollow,noarchive" /></head>');
      await writeFile(file, html); count++;
    }
  }
}
await configure('dist/public');
assert.ok(count > 0);
await writeFile('dist/public/robots.txt', 'User-agent: *\nDisallow: /\n');
console.log(`Configured ${count} homologation pages with isolated CSP and noindex.`);
