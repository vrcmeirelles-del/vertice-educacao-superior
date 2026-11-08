import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../client/src/pages/OwnerDashboard.tsx',import.meta.url),'utf8');
it('BI real da reitoria alterna telas por período selecionável sem atualizar API a cada mudança',()=>{
 expect(source).toContain('const [tvPaused,setTvPaused]=useState(false),[tvSpeed,setTvSpeed]=useState(15000)');
 expect(source).toContain('window.setInterval');
 expect(source).toContain('document.visibilityState');
 expect(source).not.toContain('600000);');
 expect(source).toContain('15 segundos');
 expect(source).toContain('tvMove(-1)');
 expect(source).toContain('tvMove(1)');
});
