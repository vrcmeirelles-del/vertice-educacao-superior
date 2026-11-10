import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
 root:import.meta.dirname,
 plugins:[react()],
 resolve:{alias:[{find:'@/lib/captacao-integrada',replacement:path.resolve(import.meta.dirname,'mock.ts')},{find:'@',replacement:path.resolve(import.meta.dirname,'../../client/src')}]},
 server:{host:'127.0.0.1',port:4178,strictPort:true},
});
