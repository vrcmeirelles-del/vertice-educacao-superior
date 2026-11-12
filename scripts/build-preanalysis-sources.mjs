// Reproducible client coverage manifest from the server adapter registry.
import {SOURCE_ADAPTERS,SOURCE_COVERAGE_LIMITATIONS} from '../supabase/functions/_shared/preanalysis-sources.ts';
import fs from 'node:fs';
const destination=new URL('../source-overrides/client/src/lib/preanalysis-sources.json',import.meta.url);
const output=JSON.stringify({adapters:SOURCE_ADAPTERS,limitations:SOURCE_COVERAGE_LIMITATIONS},null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8')!==output)throw new Error('Client source coverage is stale');}
else fs.writeFileSync(destination,output);
console.log(`Verified ${SOURCE_ADAPTERS.length} source adapters`);
