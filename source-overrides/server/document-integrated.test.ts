import {describe,it,expect} from 'vitest';
import {recommendSources,reviewDocuments,dimensionAttention,type DimensionOverview} from '../client/src/lib/document-review';
import {managementChunks,managementOverview} from '../ai-backend/management';
const zero:DimensionOverview={dimensao:'Infraestrutura',exigencias:0,validados:0,sem_envio:0,em_revisao:0,devolvidos:0,reclassificar:0,nsa:0,documentos_atrasados:0,documentos_sem_meta:0,metas:0,metas_sem_medicao:0,metas_sem_acao:0,acoes:0,acoes_atrasadas:0,achados_abertos:0,achados_prioritarios:0};
describe('integrated documentary review',()=>{
 it('reports missing data without presenting it as green or a score',()=>{
  expect(dimensionAttention(zero).tone).toBe('gray');
  expect(dimensionAttention({...zero,metas:1,metas_sem_medicao:1}).tone).toBe('amber');
  expect(dimensionAttention({...zero,exigencias:1,devolvidos:1}).tone).toBe('red');
  expect(dimensionAttention({...zero,achados_abertos:1,achados_prioritarios:1}).tone).toBe('red');
  expect(dimensionAttention({...zero,exigencias:1,validados:1}).label).toBe('Sem alerta cadastral');
  expect(dimensionAttention({...zero,nsa:1}).tone).toBe('amber');
 });
 it('never offers old, foreign, inactive, unvalidated or oversized versions',()=>{
  const requests=[{id:'r1',institution_id:'i1',course_id:'c1',active:true},{id:'r2',institution_id:'i1',course_id:'c2',active:true},{id:'r3',institution_id:'i1',course_id:'c1',active:false},{id:'r4',institution_id:'i1',course_id:'c1',not_applicable:true},{id:'r5',institution_id:'i1',course_id:'c1'}];
  const file={institution_id:'i1',request_id:'r1',file_name:'evidencia.txt',status:'validado',size_bytes:20,created_at:'2026-01-01'};
  const files=[{...file,id:'old'},{...file,id:'new',status:'enviado',created_at:'2026-02-01'},{...file,id:'foreign',institution_id:'i2'},{...file,id:'course',request_id:'r2'},{...file,id:'inactive',request_id:'r3'},{...file,id:'nsa',request_id:'r4'},{...file,id:'big',request_id:'r5',size_bytes:6*1024*1024}];
  expect(reviewDocuments('i1','c1',requests,files).compatible).toHaveLength(0);
  expect(reviewDocuments('i1','c1',requests,[...files,{...file,id:'good',request_id:'r5',created_at:'2026-02-01'}]).compatible.map(f=>f.id)).toEqual(['good']);
 });
 it('keeps all dimension summaries ahead of details and reports truncation',()=>{
  const dims=[{...zero,metas:1,metas_sem_medicao:1},{...zero,dimensao:'Organização didático-pedagógica',exigencias:2,sem_envio:2}];
  const chunks=managementChunks({dimensoes:dims,total_metas:90,metas:Array.from({length:50},(_,i)=>({dimensao:i%2?'Infraestrutura':'Organização didático-pedagógica',meta:'M'.repeat(700),ultima_medicao:null})),indicadores:[],limites:'Recorte de dados cadastrados.'},{});
  const overview=managementOverview(chunks);
  expect(overview.metas_sem_medicao).toBe(1);expect(overview.exigencias).toBe(2);expect(overview.total_metas).toBe(90);expect(overview.metas_incluidas).toBe(50);
  expect(overview.dimensoes).toHaveLength(2);expect(chunks.at(-1)?.id).toBe('gestao_limites');
  const selected=recommendSources(chunks);expect(selected).toHaveProperty('gestao_panorama');expect(selected).toHaveProperty('gestao_dim_1');expect(selected).toHaveProperty('gestao_dim_2');expect(selected).toHaveProperty('gestao_limites');
  expect(Object.keys(selected).length).toBeLessThanOrEqual(12);expect(Object.values(selected).reduce((n,t)=>n+t.length,0)).toBeLessThanOrEqual(24000);
 });
 it('does not recommend sensitive sources and reserves space for selected document content',()=>{
  const chunk={file_id:'',file_name:'Fonte',text:'Registro cadastral sem dados pessoais.',sensitive_findings:[]};
  const selected=recommendSources([{...chunk,id:'gestao_panorama'},{...chunk,id:'gestao_dim_1'},...Array.from({length:20},(_,i)=>({...chunk,id:`gestao_meta_${i}`})),{...chunk,id:'document',file_id:'f1'},{...chunk,id:'sensitive',sensitive_findings:['email']}]);
  expect(selected).toHaveProperty('document');expect(selected).not.toHaveProperty('sensitive');expect(Object.keys(selected)).toHaveLength(12);
 });
});
