import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({esbuild:{jsx:'automatic'},resolve:{alias:{'@':path.resolve(import.meta.dirname,'../client/src')}},test:{environment:'jsdom',include:['client/src/components/integracao/monitor.ui.test.tsx','client/src/components/integracao/monitor-modelo.test.ts','client/src/pages/IntegracaoPage.ui.test.tsx','client/src/components/integracao/modelo.test.ts'],maxWorkers:1,minWorkers:1}});
