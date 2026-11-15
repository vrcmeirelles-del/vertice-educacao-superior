import {defineConfig} from 'vitest/config';import path from 'node:path';
export default defineConfig({resolve:{alias:{'@':path.resolve(import.meta.dirname,'client/src'),'@shared':path.resolve(import.meta.dirname,'shared')}},esbuild:{jsx:'automatic'},test:{environment:'node',environmentMatchGlobs:[['**/*.ui.test.tsx','jsdom']],include:['client/src/components/area/Conecta360.ui.test.tsx','client/src/components/area/ConectaAccess.ui.test.tsx','client/src/components/area/InstitutionTabs.test.tsx'],pool:'forks',maxWorkers:1,minWorkers:1}});

