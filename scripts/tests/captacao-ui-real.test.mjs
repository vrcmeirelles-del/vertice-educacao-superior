import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1365,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const visible=locator=>locator.waitFor({state:'visible'});
async function screenshot(name){if(!process.env.CAPTACAO_SCREENSHOT_DIR)return;mkdirSync(process.env.CAPTACAO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CAPTACAO_SCREENSHOT_DIR,name+'.png'),fullPage:true});}
async function actor(name){await page.getByLabel('Operador sintético',{exact:true}).selectOption(name);await visible(page.getByText('Visão geral de homologação',{exact:true}));await page.getByRole('button',{name:'Conexões',exact:true}).click();}
try {
 await page.goto('http://127.0.0.1:4178/');await visible(page.getByText('Visão geral de homologação',{exact:true}));
 await page.getByRole('button',{name:'Conexões',exact:true}).click();await visible(page.getByRole('heading',{name:'Conta API A',exact:true}));
 await page.getByRole('button',{name:'Preparar conta',exact:true}).click();await page.getByLabel('Rede',{exact:true}).selectOption('tiktok');
 await page.getByLabel('Nome de referência',{exact:true}).fill('Conta criada pela UI real');await page.getByLabel('Link público do perfil',{exact:true}).fill('https://tiktok.com/@synthetic');
 await page.getByRole('button',{name:'Salvar preparação',exact:true}).click();await visible(page.getByRole('heading',{name:'Conta criada pela UI real',exact:true}));
 await page.reload();await visible(page.getByText('Visão geral de homologação',{exact:true}));await page.getByRole('button',{name:'Conexões',exact:true}).click();await visible(page.getByRole('heading',{name:'Conta criada pela UI real',exact:true}));
 await screenshot('real-desktop-persistencia');
 console.log('PASS REAL UI: authenticated AAL2 manager creates setup via product library and sees it after reload');
 await page.getByLabel('IES de teste',{exact:true}).selectOption('bb000000-0000-4000-8000-000000000002');await page.getByRole('button',{name:'Conexões',exact:true}).click();
 await visible(page.getByText('A configuração exige MFA e perfil de gestão autorizado nesta instituição.',{exact:true}));assert.equal(await page.getByRole('heading',{name:'Conta B',exact:true}).count(),0);
 await actor('managerB');await visible(page.getByRole('heading',{name:'Conta B',exact:true}));assert.equal(await page.getByRole('heading',{name:'Conta API A',exact:true}).count(),0);
 await page.getByLabel('IES de teste',{exact:true}).selectOption('bb000000-0000-4000-8000-000000000001');await page.getByRole('button',{name:'Conexões',exact:true}).click();
 await visible(page.getByText('A configuração exige MFA e perfil de gestão autorizado nesta instituição.',{exact:true}));
 for(const name of ['reader','noMfa']) {await actor(name);await visible(page.getByText('A configuração exige MFA e perfil de gestão autorizado nesta instituição.',{exact:true}));assert.equal(await page.getByRole('button',{name:'Preparar conta',exact:true}).count(),0);}
 console.log('PASS REAL UI: IES switching and genuine reader/AAL1 sessions cannot expose another institution or setup actions');
 await actor('master');await visible(page.getByRole('heading',{name:'Conta API A',exact:true}));await page.getByLabel('IES de teste',{exact:true}).selectOption('bb000000-0000-4000-8000-000000000002');await page.getByRole('button',{name:'Conexões',exact:true}).click();await visible(page.getByRole('heading',{name:'Conta B',exact:true}));
 await page.setViewportSize({width:390,height:844});await screenshot('real-mobile-master');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS REAL UI: Master scope, mobile layout and no browser errors');
}catch(error){await screenshot('real-failure');throw error;}finally{await browser.close();}
