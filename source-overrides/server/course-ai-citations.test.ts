import {it,expect} from 'vitest';
import {reviewSchemaFor,validateReview} from '../ai-backend/core';
it('limits quotations to safe literal source excerpts and rejects invented quotations',()=>{
 const snippets=[{id:'gestao_1',text:JSON.stringify({meta:'Revisar o PPC',situacao:'planejada'},null,2)},{id:'gestao_2',text:'Documentos: nao enviados.'}];
 const schema=reviewSchemaFor(snippets);
 for(const quote of schema.properties.facts.items.properties.quotes.items.properties.excerpt.enum){expect(snippets.some(s=>s.text.includes(quote))).toBe(true);expect(quote).not.toMatch(/["\\\r\n]/);}
 expect(()=>validateReview({summary:'Resumo',facts:[{text:'Existe uma meta.',source_ids:['gestao_1'],quotes:[{source_id:'gestao_1',excerpt:'Meta inventada sem fonte'}]}],gaps:[],recommendations:[],limitations:['Recorte parcial']},snippets)).toThrow();
});