import path from 'node:path';
const build=path.resolve(process.env.VERTICE_BUILD || process.cwd());
export default {
 resolve:{alias:{'@':path.join(build,'client/src'),'@shared':path.join(build,'shared')}},
 esbuild:{jsx:'automatic'},
 test:{environment:'jsdom',include:[
  path.join(build,'client/src/components/area/PreValidationColumns.ui.test.ts'),
  path.join(build,'client/src/components/area/PreValidationPanel.ui.test.tsx'),
  path.join(build,'client/src/components/area/PreValidationQueue.ui.test.tsx')
 ],maxWorkers:1,minWorkers:1}
};
