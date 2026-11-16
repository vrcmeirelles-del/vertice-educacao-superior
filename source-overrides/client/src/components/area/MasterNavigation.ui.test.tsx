// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MasterOverview from './MasterOverview';
import InstitutionSummaryCard from './InstitutionSummaryCard';
import InstitutionTabs from './InstitutionTabs';
import MasterLayout from '../MasterLayout';

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  window.history.replaceState(null, '', '/master');
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = (element: React.ReactNode) => act(() => root.render(element));
function click(label: string) {
  const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(label) || b.getAttribute('aria-label') === label);
  expect(button, label).toBeTruthy(); act(() => button!.click());
}

describe('Master navigation and institution boundaries', () => {
  it('opens the selected institution and retains every administrative destination', () => {
    const navigate = vi.fn();
    render(<MasterOverview ies={[{id:'ies-a',name:'IES A',acronym:'IES A',city:'Palmas',state:'TO'}]} schools={[]} contracts={3} trials={1} revenue={12000} onNavigate={navigate}/>);
    click('IES A'); expect(navigate).toHaveBeenLastCalledWith('institution', 'ies-a');
    for (const [label, destination] of [['Gerenciar educação superior','universidades'], ['Gerenciar escolas','escolas'], ['Abrir Central de Homologação','homologacao'], ['BI Vértice','bi-vertice'], ['Financeiro','financeiro'], ['Sapiens','sapiens'], ['Integração Fato & Ordem','integracao'], ['Administração de acessos','configuracoes']]) {
      click(label); expect(navigate).toHaveBeenLastCalledWith(destination);
    }
    expect(host.textContent).toContain('Nenhuma escola ativa cadastrada');
  });
  it('retains partial source warnings and only renders authorized financial shortcuts', () => {
    const open = vi.fn();
    const props = { name:'IES A', tier:'superior', roleLabel:'Leitor', archived:false, courseCount:4, goalCount:2, overdue:1, findings:0, stats:{semester:'2026/2',enrolled:100,covered:2,total:4}, onOpen:open, onRepository:vi.fn(), onLibrary:vi.fn(), onInstrument:vi.fn() };
    render(<InstitutionSummaryCard {...props}/>);
    expect(host.textContent).toContain('Cobertura parcial');
    expect(host.textContent).toContain('não representa necessariamente o total oficial');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('2');
    expect(host.textContent).not.toContain('EBITDA');
    click('Abrir gestão'); expect(open).toHaveBeenCalledOnce();
    const ebitda = vi.fn(); render(<InstitutionSummaryCard {...props} onEbitda={ebitda}/>);
    click('EBITDA'); expect(ebitda).toHaveBeenCalledOnce();
    render(<InstitutionSummaryCard {...props} stats={undefined}/>);
    expect(host.textContent).toContain('Sem fonte'); expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });
  it('closes contextual navigation with Escape and restores keyboard focus', () => {
    render(<InstitutionTabs activeTab="tcc" activeMacro="academico" onSelectMacro={vi.fn()} institutionName="IES A" availableMacros={['academico']}><p>TCC</p></InstitutionTabs>);
    const toggle = host.querySelector<HTMLButtonElement>('.inst-tabs-mobile-toggle')!;
    act(() => toggle.click()); expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})));
    expect(toggle.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(toggle);
    expect(host.querySelectorAll('.inst-tabs-nav-item')).toHaveLength(1);
  });
  it('reflects deep-link institutional context without marking the global overview as selected', () => {
    window.history.replaceState(null, '', '/master#instituicao=ies-a&aba=estagio');
    render(<MasterLayout><p>Estágio da IES A</p></MasterLayout>);
    expect(host.querySelector('.master-topbar')?.textContent).toContain('AMBIENTE INSTITUCIONAL');
    expect(host.querySelector('.master-sidebar a[aria-current]')).toBeNull();
    expect(host.querySelector('a[href="/integracao"]')).not.toBeNull();
    expect(host.querySelector('a[href="/master#homologacao=1"]')).not.toBeNull();
    click('Abrir menu'); expect(document.body.style.overflow).toBe('hidden');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})));
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Abrir menu');
  });
});
