import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
 root:import.meta.dirname,
 plugins:[react(),...(process.env.CAPTACAO_REAL_API==='1'?[{name:'local-only-client',enforce:'pre',resolveId(source,importer){if(source==='./supabase' && importer?.endsWith('/lib/captacao-integrada.ts'))return path.resolve(import.meta.dirname,'real-client.ts');}}]:[])],
 resolve:{alias:[...(process.env.CAPTACAO_REAL_API==='1'?[]:[{find:'@/lib/captacao-integrada',replacement:path.resolve(import.meta.dirname,'mock.ts')}]),{find:'@',replacement:path.resolve(import.meta.dirname,'../../client/src')}]},
 server:{host:'127.0.0.1',port:4178,strictPort:true},
});
