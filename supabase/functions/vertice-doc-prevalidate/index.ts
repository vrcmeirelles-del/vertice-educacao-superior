// Superior-only common evidence pipeline. Disabled until release/data gates pass.
import {createPreanalysisHandler} from '../_shared/preanalysis-handler.ts';
import {makePreanalysisBackend} from '../_shared/preanalysis-backend.ts';
import {approvedReleaseRef,approvedReleaseSource,type ReleaseManifest} from '../_shared/preanalysis-release.ts';
import release from '../_shared/preanalysis-release.json' with {type:'json'};
import type {Catalog} from '../_shared/preanalysis-core.ts';
import catalog from '../_shared/preanalysis-catalog.json' with {type:'json'};
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
const env=(name:string)=>Deno.env.get(name);
Deno.serve(createPreanalysisHandler({
 backend:authorization=>makePreanalysisBackend(authorization,env),
 catalog:catalog as Catalog[],
 enabled:()=>release.enabled===true&&env('VERTICE_PREANALYSIS_ENABLED')!=='false',
 sourceRefPermitted:ref=>approvedReleaseRef(release as ReleaseManifest,ref),
 processingScope:source=>approvedReleaseSource(release as ReleaseManifest,source),
 apiKey:provider=>env(provider==='anthropic'?'ANTHROPIC_API_KEY':'OPENAI_API_KEY')??'',
}));
