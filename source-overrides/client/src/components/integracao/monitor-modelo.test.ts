import {describe,it,expect} from 'vitest';
import {examLabels,operationalInstitution,parseMonitoring} from './monitor-modelo';
import {fixture} from './monitor-fixture';

describe('contrato de observação automática',()=>{
 it('aceita metadados mantendo homologação humana pendente',()=>expect(parseMonitoring(fixture()).live.human_homologation).toBe('pending'));
 it('descarta campos estranhos na resposta e nos módulos antes de renderizar ou exportar',()=>{const f:any=fixture();f.live.student_name='dado que não pode ser projetado';f.live.modules[0].cpf='dado que não pode ser projetado';expect(JSON.stringify(parseMonitoring(f))).not.toContain('não pode ser projetado');});
 it('recusa pequenas contagens individuais e falta de data',()=>{for(const v of ['1','2','3','4']){const f=fixture();f.live.recent_events=v;expect(()=>parseMonitoring(f)).toThrow()}const f=fixture();f.live.captured_at='';expect(()=>parseMonitoring(f)).toThrow();});
 it('não aceita homologação automática nem troca de regra silenciosa',()=>{const f=fixture();f.live.human_homologation='approved';expect(()=>parseMonitoring(f)).toThrow();});
 it('OAB 2ª fase e feed OAB genérico continuam exigindo contrato confirmado',()=>{const f=fixture();f.live.modules.find(m=>m.id==='oab2')!.source_scope='known_source_module';expect(()=>parseMonitoring(f)).toThrow();});
 it('exclui demonstrações e escolas sem confundir com dados reais',()=>{for(const name of ['Vértice Demonstração','IES de Teste','Faculdade Vértice','Centro Universitário Vértice','Universidade Vértice','Instituição Sintética'])expect(operationalInstitution({name,status:'ativa',tier:'superior'})).toBe(false);expect(operationalInstitution({name:'Campus Alpha',status:'ativa',tier:'escolas'})).toBe(false);expect(operationalInstitution({name:'Campus Alpha',status:'ativa',tier:'superior'})).toBe(true);});
 it('recusa módulos duplicados e alertas desconhecidos',()=>{const f=fixture();f.live.modules[0]=f.live.modules[1];expect(()=>parseMonitoring(f)).toThrow();const v=fixture();v.live.flags=['approved_automatically'];expect(()=>parseMonitoring(v)).toThrow();});
});
