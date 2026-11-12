#!/usr/bin/env node
// Offline after npm ci. No credentials, uploads, remote deploys, or source maps.
import {readFile,writeFile,mkdir,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {build,version as esbuildVersion} from './build/preanalysis-edge/node_modules/esbuild/lib/main.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tooling='scripts/build/preanalysis-edge';
const destination='supabase/functions/vertice-doc-prevalidate';
const entry='supabase/functions/vertice-doc-prevalidate/index.ts';
const bundlePath=`${destination}/index.bundle.mjs`;
const pins={'npm:fflate@0.8.3':'fflate','npm:fast-xml-parser@5.12.0':'fast-xml-parser','npm:unpdf@2.1.0':'unpdf'};
const argv=process.argv.slice(2);
const check=argv.includes('--check'),smoke=argv.includes('--smoke');
const publicArg=argv.indexOf('--public-pdf');
const publicPdf=publicArg<0?null:resolve(argv[publicArg+1]??'');
if(argv.some((arg,i)=>!['--check','--smoke','--public-pdf'].includes(arg)&&!(publicArg>=0&&i===publicArg+1)))throw Error('Usage: node scripts/build-preanalysis-edge.mjs [--check] [--smoke] [--public-pdf PATH]');
if(publicArg>=0&&(!smoke||!argv[publicArg+1]))throw Error('--public-pdf PATH requires --smoke');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFile(resolve(root,path));
const json=async path=>JSON.parse(await read(path));
const stable=value=>JSON.stringify(value,null,2)+'\n';
const lockPath=`${tooling}/package-lock.json`;
const lock=await json(lockPath),pkg=await json(`${tooling}/package.json`);
if(esbuildVersion!=='0.25.12')throw Error('Unexpected esbuild version');
for(const [name,expected] of Object.entries(pkg.dependencies)){
  const installed=await json(`${tooling}/node_modules/${name}/package.json`);
  if(installed.version!==expected||lock.packages[`node_modules/${name}`]?.version!==expected)throw Error(`Package/version mismatch: ${name}. Run npm ci.`);
}
const options={
  absWorkingDir:root,bundle:true,platform:'neutral',format:'esm',target:'esnext',
  conditions:['deno','import','default'],mainFields:['module','main'],
  // Whitespace-only minification removes obsolete JSDoc imports in bundled JS.
  // Names and program transformations are not minified.
  minifyWhitespace:true,legalComments:'eof',metafile:true,write:false,
  plugins:[{name:'exact-pinned-npm-imports',setup(b){
    b.onResolve({filter:/^npm:/},async args=>{
      const name=pins[args.path];
      if(!name)throw Error(`Unpinned npm import: ${args.path}`);
      // Resolve the ESM export, without the Node condition/worker_threads build.
      return b.resolve(name,{resolveDir:resolve(root,tooling),kind:'import-statement'});
    });
  }}],
};
const result=await build({...options,entryPoints:[entry],outfile:bundlePath});
for(const output of Object.values(result.metafile.outputs))if(output.imports.length)throw Error(`Unbundled imports: ${stable(output.imports)}`);
const inputs=Object.keys(result.metafile.inputs).sort();
const dependencyNames=[...new Set(inputs.filter(p=>p.includes('/node_modules/')).map(p=>p.split('/node_modules/')[1].match(/^(?:@[^/]+\/)?[^/]+/)[0]))].sort();
const packages=[];
const licenseParts=['Third-party notices for the generated Vértice preanalysis Edge bundle.\nAll notices below are copied from the locked package or its pinned source commit.'];
for(const name of dependencyNames){
  const installed=await json(`${tooling}/node_modules/${name}/package.json`);
  const locked=lock.packages[`node_modules/${name}`];
  if(!locked?.integrity||installed.version!==locked.version)throw Error(`Unverified dependency: ${name}`);
  const packageDir=`${tooling}/node_modules/${name}`;
  let files=(await readdir(resolve(root,packageDir))).filter(f=>/^licen[sc]e(?:\.|$)/i.test(f)).sort();
  const sources=[];
  for(const file of files)sources.push({path:`${packageDir}/${file}`,origin:`${name}@${installed.version}/${file}`});
  if(name==='@nodable/entities'){
    // The npm package omits its LICENSE. Its registry gitHead pins this copy.
    const path=`${tooling}/licenses/nodable-entities-3.1.0.txt`;
    if(installed.version!=='3.1.0'||sha256(await read(path))!=='750cb3fb6362804957ef52caaf9b5c824015be44d494637330d7cd8834d31d40')throw Error('Pinned Nodable license changed');
    sources.push({path,origin:'https://raw.githubusercontent.com/nodable/val-parsers/ac48e7ea591da372be023a481875c747535812b3/LICENSE'});
  }
  if(name==='unpdf')for(const file of (await readdir(resolve(root,packageDir,'dist/licenses'))).sort())sources.push({path:`${packageDir}/dist/licenses/${file}`,origin:`unpdf@${installed.version}/dist/licenses/${file}`});
  if(!sources.length)throw Error(`Missing license: ${name}`);
  const licenses=[];
  for(const source of sources){
    const bytes=await read(source.path);
    licenseParts.push(`\n===== ${name}@${installed.version}: ${source.origin} =====\n\n${bytes.toString('utf8')}`);
    licenses.push({source:source.origin,sha256:sha256(bytes)});
  }
  packages.push({name,version:installed.version,license:installed.license,resolved:locked.resolved,integrity:locked.integrity,licenses});
}
const notices=licenseParts.join('\n')+'\n';
// Line-form legal comments preserve even upstream notices containing */.
const bundle=Buffer.from('// Generated by scripts/build-preanalysis-edge.mjs. Do not edit.\n'+result.outputFiles[0].text+'\n'+notices.split('\n').map(line=>'//! '+line).join('\n')+'\n');
if(bundle.length>=20*1024*1024)throw Error('Bundle exceeds the documented 20 MiB function size ceiling');
const sourceFiles=[...new Set([...inputs,lockPath,`${tooling}/package.json`,'scripts/build-preanalysis-edge.mjs'])].sort();
const sourceHashes={};
for(const path of sourceFiles)sourceHashes[path]=sha256(await read(path));
const manifest={
  schemaVersion:1,entrypoint:bundlePath,sourceEntrypoint:entry,
  build:{esbuild:esbuildVersion,format:'esm',platform:'neutral',conditions:options.conditions,minifyWhitespace:true,externalImports:[]},
  bundle:{bytes:bundle.length,sha256:sha256(bundle)},
  notices:{file:'THIRD_PARTY_NOTICES.txt',sha256:sha256(notices)},
  packageLock:{file:lockPath,sha256:sha256(await read(lockPath))},packages,sourceHashes,
  validationScope:'Deterministic local packaging. Supabase-hosted runtime, 2s CPU and 256MB limits still require a scoped canary.',
};
for(const [name,bytes] of [['index.bundle.mjs',bundle],['THIRD_PARTY_NOTICES.txt',notices],['bundle-manifest.json',stable(manifest)]]){
  const path=resolve(root,destination,name);
  if(check){
    let old;try{old=await readFile(path);}catch{throw Error(`Missing generated ${name}. Rebuild first.`);}
    if(!old.equals(Buffer.from(bytes)))throw Error(`Stale ${name}. Rebuild after changing source, catalog, release manifest or dependencies.`);
  }else{await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);}
}
console.log(`${check?'Verified':'Built'} ${bundlePath}: ${bundle.length} bytes, SHA-256 ${sha256(bundle)}, no external imports.`);

if(smoke){
  const deno=process.env.DENO_BIN||resolve(root,'scripts/tests/preanalysis-runtime/node_modules/.bin/deno');
  const temp=await mkdtemp(join(tmpdir(),'vertice-edge-smoke-'));
  try{
    const testBundle=await build({...options,entryPoints:[`${tooling}/smoke.ts`],outfile:join(temp,'smoke.mjs')});
    for(const output of Object.values(testBundle.metafile.outputs))if(output.imports.length)throw Error('Smoke has unbundled imports');
    await writeFile(join(temp,'smoke.mjs'),testBundle.outputFiles[0].contents);
    const readPaths=[resolve(root,bundlePath),...(publicPdf?[publicPdf]:[])];
    const checks=[['check','--no-config','--no-lock','--no-remote','--no-npm',resolve(root,bundlePath)],['run','--no-config','--no-lock','--no-remote','--no-npm',`--allow-read=${readPaths.join(',')}`,join(temp,'smoke.mjs'),pathToFileURL(resolve(root,bundlePath)).href,...(publicPdf?[publicPdf]:[])]];
    for(const args of checks){const p=spawnSync(deno,args,{cwd:root,stdio:'inherit',env:process.env,timeout:60000});if(p.error)throw p.error;if(p.status!==0)throw Error(`Local Deno ${args[0]} failed (${p.status})`);}
  }finally{await rm(temp,{recursive:true,force:true});}
}
