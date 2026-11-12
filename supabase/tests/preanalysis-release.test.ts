import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedReleaseRef,approvedReleaseSource,type ReleaseManifest} from '../functions/_shared/preanalysis-release.ts';
import type {Source} from '../functions/_shared/preanalysis-core.ts';
const source:Source={institutionId:'11111111-1111-4111-8111-111111111111',sourceTable:'vertice_repository_files',sourceId:'22222222-2222-4222-8222-222222222222',courseId:'33333333-3333-4333-8333-333333333333',version:'a'.repeat(64),kind:'file'};
const manifest:ReleaseManifest={enabled:true,sources:[{...source,sourceVersion:source.version,sha256:'b'.repeat(64)}]};
test('exact reviewed source and file hash are required',()=>{assert.equal(approvedReleaseRef(manifest,source),true);assert.deepEqual(approvedReleaseSource(manifest,source),{expectedContentHash:'b'.repeat(64)});});
for(const change of [{courseId:null},{courseId:source.sourceId},{version:'c'.repeat(64)},{kind:'structured' as const},{sourceId:source.courseId!},{institutionId:source.courseId!},{sourceTable:'vertice_documents'}])test(`release scope rejects remapping ${JSON.stringify(change)}`,()=>{assert.equal(approvedReleaseSource(manifest,{...source,...change}),null);});
test('disabled, empty, malformed release manifests fail closed',()=>{for(const m of [{enabled:false,sources:manifest.sources},{enabled:true,sources:[]},{enabled:true,sources:[{...manifest.sources[0],courseId:undefined}]},{enabled:true,sources:[{...manifest.sources[0],sourceVersion:''}]},{enabled:true,sources:[{...manifest.sources[0],sha256:'bad'}]}]){assert.equal(approvedReleaseRef(m as ReleaseManifest,source),false);assert.equal(approvedReleaseSource(m as ReleaseManifest,source),null);}});
