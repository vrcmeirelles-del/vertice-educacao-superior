import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({resolve:{alias:{'@':path.resolve(import.meta.dirname,'client/src')}},esbuild:{jsx:'automatic'},test:{environment:'jsdom',environmentOptions:{jsdom:{url:'http://localhost/'}},include:['client/src/components/context-help.ui.test.ts']}});
