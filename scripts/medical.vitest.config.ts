import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({
 resolve:{alias:{'@':path.resolve(import.meta.dirname,'../client/src')}},
 esbuild:{jsx:'automatic'},
 test:{environment:'node',include:['server/*.medical.spec.ts']}
});
