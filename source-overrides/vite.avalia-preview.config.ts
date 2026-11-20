import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const dir=import.meta.dirname;
export default defineConfig({
 root:path.resolve(dir,'preview-avalia360'),
 plugins:[react()],
 resolve:{alias:[
  // Bloqueio obrigatório: nunca importar o Supabase da produção nesta prévia.
  {find:'@/lib/supabase',replacement:path.resolve(dir,'preview-avalia360/mock-supabase.ts')},
  {find:/^@\//,replacement:path.resolve(dir,'client/src')+'/'}
 ]},
 build:{outDir:path.resolve(dir,'dist-avalia-preview'),emptyOutDir:true},
});
