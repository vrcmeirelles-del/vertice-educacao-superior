import React from 'react';
import InstitutionSubTabs from './InstitutionSubTabs';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import InstitutionTabs, { MACRO_TABS, macroTabFor, macroDestination } from './InstitutionTabs';

describe('institution navigation', () => {
  it('does not enter blocked or unauthorized destinations', () => {
    expect(macroDestination('dados', ['cadastro', 'emec'], () => true)).toBeUndefined();
    expect(macroDestination('dados', ['emec'], () => false)).toBe('emec');
    expect(macroDestination('dados', ['cadastro', 'emec'], tab => tab === 'cadastro')).toBe('emec');
  });
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


describe('persistent module navigation', () => {
  const macro = MACRO_TABS.find(item => item.key === 'dados')!;
  it('keeps the module picker visible even for a single destination', () => {
    const html = renderToStaticMarkup(<InstitutionSubTabs macro={macro} entries={[{key:'cadastro',label:'Cadastro'}]} activeTab="cadastro" onSelect={() => {}} />);
    expect(html).toContain('Módulos de Dados da Instituição');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('Trocar módulo');
    expect(html).not.toContain('role="tab"');
  });
  it('retains activation, tasting and favorite controls beside navigation', () => {
    const html = renderToStaticMarkup(<InstitutionSubTabs macro={macro} entries={[{key:'cadastro',label:'Cadastro',icon:'▣',locked:true,tasting:true}]} activeTab={null} onSelect={() => {}} favorites={['cadastro']} onToggleFavorite={() => {}} />);
    expect(html).toContain('Ativar');
    expect(html).toContain('Degustação');
    expect(html).toContain('Remover Cadastro dos favoritos');
    expect(html).not.toContain('aria-current="page"');
  });
  it('offers recovery when search and favorite filters hide destinations', () => {
    const html = renderToStaticMarkup(<InstitutionSubTabs macro={macro} entries={[{key:'cadastro',label:'Cadastro'}]} activeTab="cadastro" onSelect={() => {}} query="inexistente" onQueryChange={() => {}} onlyFavorites onToggleOnlyFavorites={() => {}} />);
    expect(html).toContain('Nenhum módulo encontrado');
    expect(html).toContain('Limpar filtros');
  });
});
