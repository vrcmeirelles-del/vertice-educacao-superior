import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import InstitutionTabs, { MACRO_TABS, macroTabFor } from './InstitutionTabs';

describe('institution navigation', () => {
  it('assigns every supported workspace destination exactly once', () => {
    const source = readFileSync(new URL('../../lib/area.ts', import.meta.url), 'utf8');
    const declaration = source.match(/export type Tab = ([^;]+);/)![1];
    const supported = [...declaration.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const assigned = MACRO_TABS.flatMap(m => m.tabs);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect([...assigned].sort()).toEqual(supported.sort());
    for (const macro of MACRO_TABS) for (const tab of macro.tabs) expect(macroTabFor(tab)).toBe(macro.key);
  });
  it('renders seven navigation destinations with one current destination', () => {
    const html = renderToStaticMarkup(<InstitutionTabs activeTab="cadastro" activeMacro="dados" onSelectMacro={() => {}} institutionName="IES teste"><p>Conteúdo</p></InstitutionTabs>);
    expect(html.match(/class="inst-tabs-nav-item(?: |")/g)).toHaveLength(7);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('Conteúdo');
    expect(html).not.toContain('role="tab"');
  });
  it('retains content without adding navigation outside Master', () => {
    expect(renderToStaticMarkup(<InstitutionTabs enabled={false} activeTab="geral" activeMacro="visao-geral" onSelectMacro={() => {}} institutionName="IES teste"><p>Original</p></InstitutionTabs>)).toBe('<p>Original</p>');
  });
  it('limits navigation to supplied authorized groups', () => {
    const html = renderToStaticMarkup(<InstitutionTabs availableMacros={['dados']} activeTab="cadastro" activeMacro="dados" onSelectMacro={() => {}} institutionName="IES teste" ><p>Cadastro</p></InstitutionTabs>);
    expect(html.match(/class="inst-tabs-nav-item(?: |")/g)).toHaveLength(1);
    expect(html).not.toContain('Gestores e Acessos');
  });
});
