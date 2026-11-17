import {defineConfig} from 'vitest/config';import path from 'node:path';
export default defineConfig({esbuild:{jsx:'automatic'},resolve:{alias:{'@':path.resolve(import.meta.dirname,'../client/src'),'@shared':path.resolve(import.meta.dirname,'../shared')}},test:{environment:'jsdom',include:['client/src/components/area/Discursiva360.ui.test.tsx'],maxWorkers:1,minWorkers:1}});
