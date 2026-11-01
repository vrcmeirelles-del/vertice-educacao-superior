import { describe, it, expect } from 'vitest';
import { filterLibrary, type LibraryDocument } from '../client/src/lib/inep-library';
const doc = (p: Partial<LibraryDocument>): LibraryDocument => ({
  id:'a', institution_id:'ies', library_key:'key', version:'2026-11-01',
  code:'D1-1.1-DIR-01', dimension:1, indicator:'1.1', file_name:'Políticas institucionais.docx',
  title:'Políticas', original_path:'D1-Didatico/1.1-politicas/modelo.docx',
  format:'docx', size_bytes:100, is_placeholder:false, ...p,
});
const empty = { query:'', dimension:'', indicator:'', format:'', references:false };
describe('Biblioteca INEP do /master', () => {
  it('busca codigo e texto sem depender de acentos', () => {
    expect(filterLibrary([doc({})], {...empty,query:'politicas'})).toHaveLength(1);
    expect(filterLibrary([doc({})], {...empty,query:'D1-1.1-DIR-01'})).toHaveLength(1);
    expect(filterLibrary([doc({})], {...empty,query:'politicas inexistente'})).toHaveLength(0);
  });
  it('preserva Word e PDF com o mesmo codigo', () => {
    expect(filterLibrary([doc({}),doc({id:'b',format:'pdf',file_name:'Políticas.pdf'})],empty)).toHaveLength(2);
  });
  it('combina dimensao indicador formato e referencias', () => {
    const ref=doc({id:'ref',code:null,dimension:2,indicator:'2.1',is_placeholder:true});
    expect(filterLibrary([doc({}),ref],{...empty,dimension:'2',indicator:'2.1',format:'docx',references:true})).toEqual([ref]);
  });
  it('ordena indicadores numericamente, mantendo a identidade do arquivo', () => {
    const rows=[doc({id:'10',indicator:'2.10'}),doc({id:'9',indicator:'2.9'})];
    expect(filterLibrary(rows,empty).map(d=>d.id)).toEqual(['9','10']);
  });
});
