import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ContextHelp,HelpLabel} from './ContextHelp';
import {findHelp,HELP_GROUPS,normalizeHelp} from '@/lib/contextual-help';
let container:HTMLDivElement,root:Root;
const tick=()=>new Promise(r=>setTimeout(r,30));
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}} as any;Element.prototype.scrollIntoView=vi.fn();});
afterEach(async()=>{await act(async()=>{root.unmount();await tick()});container.remove();vi.restoreAllMocks();});
const button=()=>container.querySelector<HTMLButtonElement>('button.vx-help-dot')!;
async function click(node:Element){await act(async()=>{node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));await tick()});}
it('shows help without submitting, changing a field, or making an AI request',async()=>{
 const submit=vi.fn(e=>e.preventDefault()),change=vi.fn(),fetchSpy=vi.spyOn(globalThis,'fetch');
 await act(async()=>root.render(React.createElement('form',{onSubmit:submit},React.createElement(HelpLabel,{htmlFor:'name',help:'Nome oficial da instituição.'},'Nome',React.createElement('input',{id:'name',defaultValue:'UNITOP',onChange:change})))));
 await click(button());expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Nome oficial da instituição.');expect(submit).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('UNITOP');expect(fetchSpy).not.toHaveBeenCalled();expect(button().type).toBe('button');expect(container.querySelector('label')?.htmlFor).toBe('name');
});
it('does not toggle checkboxes while opening help',async()=>{
 const change=vi.fn();await act(async()=>root.render(React.createElement(HelpLabel,{},React.createElement('input',{type:'checkbox',onChange:change}),'Receber avisos')));await click(button());expect(change).not.toHaveBeenCalled();expect(container.querySelector<HTMLInputElement>('input')?.checked).toBe(false);
});
it('closes on Escape and restores focus to the trigger',async()=>{
 await act(async()=>root.render(React.createElement(ContextHelp,{title:'EBITDA'})));button().focus();await click(button());expect(button().getAttribute('aria-expanded')).toBe('true');await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick()});expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(button());
});
it('provides a close button, a glossary link and distinct dialog identifiers',async()=>{
 await act(async()=>root.render(React.createElement('div',{},React.createElement(ContextHelp,{title:'ENEM'}),React.createElement(ContextHelp,{title:'ENAMED'}))));const buttons=container.querySelectorAll('button');await click(buttons[0]);const first=buttons[0].getAttribute('aria-controls');expect(document.querySelector<HTMLAnchorElement>('[role="dialog"] a')?.href).toContain('/guia.html#enem');await click(document.querySelector('[aria-label="Fechar ajuda"]')!);await click(buttons[1]);expect(buttons[1].getAttribute('aria-controls')).not.toBe(first);
});
it('preserves select semantics and supports newly rendered fields',async()=>{
 await act(async()=>root.render(React.createElement(HelpLabel,{},'Semestre',React.createElement('select',{required:true},React.createElement('option',{},'2026/2')))));expect(container.querySelector('select')?.required).toBe(true);await click(button());expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Período letivo');await act(async()=>root.render(React.createElement(HelpLabel,{},'Arquivo de evidência',React.createElement('input',{type:'file',required:true}))));expect(container.querySelectorAll('.vx-help-dot')).toHaveLength(1);expect(container.querySelector<HTMLInputElement>('input')?.type).toBe('file');
});
it('covers workspace modules and financial, regulatory, inclusion and school definitions',()=>{
 for(const term of ['EBITDA','ENEM','ENAMED','Residência Médica','PEI','Overhead','CPA e Autoavaliação','Validação Pendente','Aprendizagem Conectada'])expect(findHelp(term),term).toBeTruthy();expect(normalizeHelp('Pré-validação')).toBe(normalizeHelp('pre validacao'));expect(HELP_GROUPS.find(g=>g.group==='Módulos e funcionalidades')?.entries.length).toBeGreaterThan(40);expect(HELP_GROUPS.flatMap(g=>g.entries).length).toBeGreaterThan(150);
});
