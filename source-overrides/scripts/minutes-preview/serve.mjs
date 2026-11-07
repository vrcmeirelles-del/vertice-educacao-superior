import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root = process.cwd();
const server = await createServer({ configFile: false, root, plugins: [react()], resolve: { alias: [
 { find: '@/lib/supabase', replacement: path.join(root,'scripts/minutes-preview/supabase.ts') },
 { find: './supabase', replacement: path.join(root,'scripts/minutes-preview/supabase.ts') },
 { find: '@', replacement: path.join(root,'client/src') },
] }, server: { host: '127.0.0.1', port: 5178, strictPort: true } });
await server.listen(); console.log('Synthetic minutes preview: http://127.0.0.1:5178/scripts/minutes-preview/index.html');
