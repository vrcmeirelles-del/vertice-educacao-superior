import {describe,it,expect} from 'vitest';
import {parseEmec,emecDiff,type EmecPayload} from '../client/src/lib/emec';
const payload=():EmecPayload=>({version:1,emec_code:'1395',source_url:'https://emec.mec.gov.br/emec/nova',consulted_on:'2026-01-01',coverage:'partial',gaps:['Ano dos conceitos não informado'],records:[{kind:'indicator',key:'CPC-10',title:'CPC',data:{value:'SC',year:null}}]});
describe('importação e-MEC',()=>{
 it('preserva SC e ausência de ano',()=>expect(parseEmec(payload(),'1395').records[0].data).toEqual({value:'SC',year:null}));
 it('recusa instituição diferente',()=>expect(()=>parseEmec(payload(),'42')).toThrow(/código/));
 it.each(['https://emec.mec.gov.br.evil.test/','javascript:alert(1)','https://user@emec.mec.gov.br/','http://emec.mec.gov.br/'])('recusa origem %s',url=>{const p=payload();p.source_url=url;expect(()=>parseEmec(p,'1395')).toThrow();});
 it('recusa chaves repetidas no mesmo tipo',()=>{const p=payload();p.records.push({...p.records[0]});expect(()=>parseEmec(p,'1395')).toThrow(/duplicada/);});
 it('recusa completude contraditória',()=>{const p=payload();p.coverage='complete';expect(()=>parseEmec(p,'1395')).toThrow(/lacunas/);});
 it('recusa data inexistente',()=>{const p=payload();p.consulted_on='2026-02-30';expect(()=>parseEmec(p,'1395')).toThrow(/Data/);});
 it('compara dados sem depender da ordem das propriedades',()=>{const p=payload(),n=payload();n.records[0].data={year:null,value:'SC'};expect(emecDiff(p,n).changed).toHaveLength(0);});
 it('distingue alterações, adições e ausências sem apagar a origem',()=>{const p=payload(),n=payload();n.records[0].data.value=2;n.records.push({kind:'process',key:'123',title:'Processo',data:{status:'Em análise'}});expect(emecDiff(p,n).changed).toHaveLength(1);expect(emecDiff(p,n).added).toHaveLength(1);expect(emecDiff(n,p).absent).toHaveLength(1);expect(p.records[0].data.value).toBe('SC');});
});
