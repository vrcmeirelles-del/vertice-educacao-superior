import {UUID,type Source,type SourceRef} from './preanalysis-core.ts';
/** Explicit non-secret release scope. Only reviewed public file bytes are permitted initially.
 * The exact source revision and course prevent remapping the public canary into another scope. */
export type ReleaseManifest={enabled:boolean;sources:{institutionId:string;sourceTable:string;sourceId:string;courseId:string|null;sourceVersion:string;sha256:string}[]};
function entryFor(manifest:ReleaseManifest,ref:SourceRef){
 if(manifest?.enabled!==true||!Array.isArray(manifest.sources))return null;
 return manifest.sources.find(e=>e&&UUID.test(e.institutionId)&&UUID.test(e.sourceId)&&(e.courseId===null||UUID.test(e.courseId))&&/^[a-f0-9]{64}$/.test(e.sourceVersion)&&/^[a-f0-9]{64}$/.test(e.sha256)&&e.institutionId===ref.institutionId&&e.sourceTable===ref.sourceTable&&e.sourceId===ref.sourceId)??null;
}
export function approvedReleaseRef(manifest:ReleaseManifest,ref:SourceRef):boolean{return Boolean(entryFor(manifest,ref));}
export function approvedReleaseSource(manifest:ReleaseManifest,source:Source):{expectedContentHash:string}|null {
 const entry=entryFor(manifest,source);
 return entry&&source.kind==='file'&&entry.courseId===source.courseId&&entry.sourceVersion===source.version?{expectedContentHash:entry.sha256}:null;
}
