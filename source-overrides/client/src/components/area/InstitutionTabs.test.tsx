import React from 'react';
import { visibleTabs } from '@/lib/area';
import InstitutionSubTabs, { orderAcademicModules } from './InstitutionSubTabs';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import InstitutionTabs, { MACRO_TABS, macroTabFor, macroDestination } from './InstitutionTabs';

describe('institution navigation', () => {
  it('retains new modules in authorized navigation without granting them to other profiles', () => {
    for (const tab of ['tcc', 'atividades-complementares', 'estagio', 'vitrine-curso'] as const) {
      expect(visibleTabs('master')).toContain(tab);
      expect(visibleTabs('gestor')).toContain(tab);
      expect(visibleTabs('leitor')).not.toContain(tab);
      expect(visibleTabs('cpa')).not.toContain(tab);
      expect(visibleTabs('coordenador')).not.toContain(tab);
      expect(MACRO_TABS.filter(macro => macro.tabs.includes(tab))).toHaveLength(1);
    }
  });
  it('lists Avalia 360° as a separate academic entry without granting unauthorized roles', () => {
    expect(macroTabFor('avalia360')).toBe('academico');
    expect(macroTabFor('discursiva')).toBe('academico');
    expect(MACRO_TABS.filter(m => m.tabs.includes('avalia360'))).toHaveLength(1);
    for(const role of ['master','gestor','coordenador','nde'] as const)
      expect(visibleTabs(role)).toContain('avalia360');
    for(const role of ['leitor','cpa','equipe'] as const)
      expect(visibleTabs(role)).not.toContain('avalia360');
  });
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
  it('renders eight navigation destinations with one current destination', () => {
    const html = renderToStaticMarkup(<InstitutionTabs activeTab="cadastro" activeMacro="dados" onSelectMacro={() => {}} institutionName="IES teste"><p>Conteúdo</p></InstitutionTabs>);
    expect(html.match(/class="inst-tabs-nav-item(?: |")/g)).toHaveLength(8);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('Conteúdo');
    expect(html).not.toContain('role="tab"');
  });
  it('separates academic modules from team and administrative management while retaining deep links', () => {
    for (const tab of ['tcc', 'atividades-complementares', 'estagio', 'extensao', 'egressos', 'cpa-autoavaliacao'] as const) {
      expect(macroTabFor(tab)).toBe('academico');
      expect(macroDestination('academico', [tab], () => false)).toBe(tab);
    }
    expect(macroTabFor('equipe')).toBe('gestores');
    expect(macroTabFor('plano')).toBe('gestores');
    expect(macroTabFor('visao')).toBe('cursos');
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


describe('academic module labels in alphabetical order', () => {
  const academic = MACRO_TABS.find(item => item.key === 'academico')!;
  const entries = [
    {key:'extensao',label:'Extensão 360°',locked:true},
    {key:'estagio',label:'Estágio Obrigatório 360°'},
    {key:'atividades-ensino',label:'Atividades de Ensino'},
    {key:'acompanhamento-especial',label:'Acompanhamento Especial 360°'},
    {key:'discursiva',label:'Discursiva 360°'},
  ] as const;

  it('orders the Master list by visible Portuguese labels and retains the selected route/activation', () => {
    const html = renderToStaticMarkup(<InstitutionSubTabs macro={academic} sortByLabel entries={[...entries]} activeTab="atividades-ensino" onSelect={() => {}} />);
    const names = ['Acompanhamento Especial 360°','Atividades de Ensino','Discursiva 360°','Estágio Obrigatório 360°','Extensão 360°'];
    expect(names.map(name => html.indexOf(name))).toEqual(names.map(name => html.indexOf(name)).sort((a,b)=>a-b));
    expect(html).toMatch(/aria-current="page"[^>]*><span>Atividades de Ensino<\/span>/);
    expect(html).toContain('Ativar');
    expect(macroDestination('academico',entries.map(entry=>entry.key),()=>false)).toBe('discursiva');
  });

  it('works on the institutional role-filtered list without injecting, removing, or changing modules', () => {
    const allowed = visibleTabs('coordenador');
    const visible = entries.filter(item=>allowed.includes(item.key)).map(({key,label})=>[key,label] as const);
    const ordered = orderAcademicModules(visible, ([,label])=>label);
    expect(ordered.map(([key])=>key)).toEqual(['atividades-ensino','discursiva']);
    expect(visible.map(([key])=>key)).toEqual(['atividades-ensino','discursiva']);
    expect(orderAcademicModules(['Z','Evasão','Áreas'], label=>label)).toEqual(['Áreas','Evasão','Z']);
  });

  it('does not reorder an opt-out menu or undo Favorites', () => {
    const unchanged = renderToStaticMarkup(<InstitutionSubTabs macro={academic} entries={[...entries]} activeTab={null} onSelect={() => {}} />);
    expect(unchanged.indexOf('Extensão 360°')).toBeLessThan(unchanged.indexOf('Atividades de Ensino'));
    const favorite = renderToStaticMarkup(<InstitutionSubTabs macro={academic} sortByLabel entries={[...entries]} activeTab={null}
      onSelect={() => {}} onlyFavorites favorites={['estagio','atividades-ensino']} />);
    expect(favorite).not.toContain('Extensão 360°');
    expect(favorite.indexOf('Atividades de Ensino')).toBeLessThan(favorite.indexOf('Estágio Obrigatório 360°'));
  });
});
