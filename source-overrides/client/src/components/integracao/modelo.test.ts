import {describe,it,expect} from 'vitest';
import {emptyPackage,validatePackage,safeReference,metadataOnly,evidenceKeys,type Evidence} from './modelo';
const record=()=>Object.fromEntries(evidenceKeys.map(k=>[k,k==='id'?'SYN-E01':k==='data'?'2026-11-14T19:00:00Z':k==='estado'?'Não confirmado':k==='url'?'':'SYN-'+k])) as Evidence;
describe('pacote de acompanhamento',()=>{
 it('preserva estados declaratórios após exportação/importação',()=>{const p=emptyPackage();p.registros=[record()];expect(validatePackage(JSON.parse(JSON.stringify(p))).registros[0].estado).toBe('Não confirmado');});
 it('exige versões, vínculo, evidência, teste e revisor para estado integrado',()=>{for(const k of ['branchOrigem','branchDestino','entidade','evidencia','testes','revisor'] as const){const p=emptyPackage(),r=record();r.estado='Integrado';r[k]='';p.registros=[r];expect(()=>validatePackage(p)).toThrow();}});
 it('recusa padrões de dados pessoais e credenciais',()=>{for(const v of ['123.456.789-00','pessoa@exemplo.com','Bearer valor-sintetico','api_key=teste'])expect(metadataOnly(v)).toBe(false);});
 it('recusa URLs com segredos e origens não permitidas',()=>{for(const u of ['javascript:alert(1)','https://github.com/x?token=x','https://a:b@github.com/x','https://github.com/x#token','https://outra-origem.com'])expect(safeReference(u)).toBe(false);});
 it('não aceita aprovação declarada sem referência ou reversão',()=>{const p=emptyPackage();p.decisoes=[{id:'SYN-D01',data:'2026-11-14',tipo:'Publicação',estado:'Aprovação declarada',escopo:'Candidato',versao:'v4',procedimento:'Implantar versão salva',reversao:'',responsavel:'Proprietário',referencia:''}];expect(()=>validatePackage(p)).toThrow();});
});
