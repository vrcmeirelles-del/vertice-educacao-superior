// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import EnamedEnvironment from './EnamedEnvironment';
import EnamedEditorialEvidence, { EnamedVerifiedSources } from './EnamedEditorialEvidence';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root:ReturnType<typeof createRoot>|undefined;
let host:HTMLDivElement;
afterEach(async()=>{ if(root) await act(async()=>root!.unmount()); host?.remove(); root=undefined; });
async function mount(node:React.ReactNode) {
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  await act(async()=>root!.render(node));
}
async function click(text:string) {
  const button=[...host.querySelectorAll('button')].find(b=>b.textContent===text);
  expect(button).toBeTruthy(); await act(async()=>button!.click());
}

it('opens the 17 pending incorporations without presenting them as imported or approved',async()=>{
  await mount(<EnamedEditorialEvidence/>);
  await click('Incorporações pendentes (17)');
  const table=host.querySelector('[aria-label="Tabela de incorporações"] table')!;
  expect(table.querySelectorAll('tbody tr')).toHaveLength(17);
  expect(table.textContent).toContain('não importada');
  const first=table.querySelector('tbody a') as HTMLAnchorElement;
  expect(first.href).toContain('2026');expect(first.href).toContain('#page=3');
  expect(table.textContent).toContain('Questão 27');
  expect(host.textContent).toContain('Publicação bloqueada');
  expect(host.textContent).toContain('0 de 6');
  expect([...host.querySelectorAll('button')].some(b=>/aprovar|publicar|importar/i.test(b.textContent||''))).toBe(false);
});

it('filters numerical differences and searches the complete ID without losing their provenance',async()=>{
  await mount(<EnamedEditorialEvidence/>);
  expect(host.querySelector('[role="status"]')!.textContent).toContain('69 registros');
  const checkbox=host.querySelector('input[type="checkbox"]') as HTMLInputElement;
  await act(async()=>checkbox.click());
  expect(host.querySelector('[role="status"]')!.textContent).toContain('25 registros');
  const input=host.querySelector('input[aria-label="Buscar ID ou caderno"]') as HTMLInputElement;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'ID-inexistente');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  expect(host.querySelector('[role="status"]')!.textContent).toContain('0 registros');
});

it('distinguishes preliminary answer keys, verified files and the unavailable normative PDF',async()=>{
  await mount(<EnamedVerifiedSources/>);
  expect(host.querySelectorAll('article')).toHaveLength(14);
  expect([...host.querySelectorAll('code')]).toHaveLength(13);
  expect(host.textContent).toContain('Gabarito preliminar.');
  expect(host.textContent).toContain('Recuperação pendente');
  expect(host.textContent).toContain('não devem ser aplicadas automaticamente a 2026');
  expect(host.querySelectorAll('a[target="_blank"]')).toHaveLength(14);
  for(const link of host.querySelectorAll('a[target="_blank"]'))expect(link.getAttribute('rel')).toContain('noopener');
});

it('makes both implementation fronts reachable in the existing ENAMED area without a course or data mutation',async()=>{
  await mount(<EnamedEnvironment institutionId="synthetic-ies" courses={[]} onPlan={()=>{}}/>);
  expect(host.textContent).not.toContain('hash e validação dos arquivos ainda não comprovados');
  await click('Acervo e incorporações');
  expect(host.querySelector('[aria-label="Curadoria e incorporações ENAMED"]')).not.toBeNull();
  expect(host.textContent).toContain('não é homologação médica');
  await click('Documentos verificados');
  expect(host.querySelector('[aria-label="Documentos ENAMED verificados"]')).not.toBeNull();
  expect(host.textContent).toContain('Nenhum curso de Medicina identificado');
});
