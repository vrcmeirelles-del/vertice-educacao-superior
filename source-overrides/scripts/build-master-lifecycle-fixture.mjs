import {build} from 'esbuild';
import {resolve} from 'node:path';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
const out=process.argv[2];if(!out)throw Error('Explicit local fixture output required');
await mkdir(out,{recursive:true});
await build({entryPoints:['scripts/master-lifecycle-fixture/app.tsx'],bundle:true,format:'esm',outfile:resolve(out,'fixture.js'),define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'},plugins:[{name:'local-fixtures',setup(b){
 b.onResolve({filter:/^@\/lib\/master-invitations$/},()=>({path:resolve('scripts/master-lifecycle-fixture/api.ts')}));
 b.onResolve({filter:/^@\/lib\/supabase$/},()=>({path:resolve('scripts/master-lifecycle-fixture/auth.ts')}));
 b.onResolve({filter:/^\.\/supabase$/},a=>a.importer.endsWith('/master-invitations.ts')?{path:resolve('scripts/master-lifecycle-fixture/auth.ts')}:undefined);
 b.onResolve({filter:/^@\//},a=>({path:resolve('client/src',a.path.slice(2))+'.ts'}));
}}]});
await copyFile('client/public/ies-invitation-bootstrap.js',resolve(out,'ies-invitation-bootstrap.js'));
await writeFile(resolve(out,'index.html'),'<script src="./ies-invitation-bootstrap.js"></script><div id="root"></div><script type="module" src="./fixture.js"></script>');

await writeFile(resolve(out,'away.html'),'<!doctype html><title>Local destination</title><p>Local navigation target</p>');
