import { describe, it, expect } from 'vitest';
import { buildPeiHtml, escapeHtml } from './pei-print';
describe('pei-print',()=>{
 it('escapa HTML em todos os campos',()=>{const h=buildPeiHtml({student_name:'<img src=x onerror=1>',status:'ativo',strengths:'<b>x</b>',objectives:['<script>']},[{category:'a',description:'<i>',responsible:'"r"'}]);expect(h).not.toContain('<img');expect(h).not.toContain('<script>');expect(h).not.toContain('<b>x');expect(h).toContain('&lt;img');expect(h).toContain('&quot;r&quot;');});
 it('inclui seções preenchidas e omite vazias',()=>{const h=buildPeiHtml({student_name:'Ana',status:'ativo',strengths:'oral',version_number:2},[]);expect(h).toContain('versão 2');expect(h).toContain('Potencialidades');expect(h).not.toContain('Barreiras');expect(h).not.toContain('Adaptações e apoios');});
 it('escapeHtml',()=>{expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');});
});
