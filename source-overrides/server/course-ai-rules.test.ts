import {describe,it,expect,vi} from 'vitest';
import {createReviewHandler,type Backend} from '../ai-backend/handler';
import {managementChunks,ruleReview} from '../ai-backend/management';
const inst='11111111-1111-4111-8111-111111111111',course='22222222-2222-4222-8222-222222222222';
const snapshot={data_referencia:'2026-11-20',total_metas:3,metas:[],indicadores:[],limites:'Registro não equivale a avaliação oficial.',
 dimensoes:[{dimensao:'Organização didático-pedagógica',exigencias:20,validados:12,sem_envio:5,documentos_atrasados:2,metas:2,metas_sem_medicao:1,metas_sem_acao:0,achados_prioritarios:1},
  {dimensao:'Infraestrutura',exigencias:8,validados:8,sem_envio:0,metas:1,metas_sem_medicao:0,metas_sem_acao:1}]};
function harness(){
 const backend:Backend={authenticate:async()=>inst,context:async()=>({enabled:true,model:'gpt-4.1-mini',max_output_tokens:1500,max_files:3}),management:async()=>managementChunks(snapshot,{}),extraction:vi.fn(),criteria:vi.fn(),reserve:vi.fn(),claim:vi.fn(),finalize:vi.fn()} as any;
 const review=vi.fn();
 const handler=createReviewHandler({backend:()=>backend,configured:()=>true,aiOn:()=>false,apiKey:()=>'test-placeholder',review});
 const call=(body:any)=>handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer testtoken','content-type':'application/json'},body:JSON.stringify({institution_id:inst,course_id:course,file_ids:[],...body})}));
 return {backend,review,call};
}
describe('revisão integrada por regras (IA suspensa)',()=>{
 it('lacunas e prioridades saem das métricas do panorama, sem provedor nem cota',async()=>{
  const h=harness();const p=await(await h.call({action:'preview'})).json();
  const panorama=p.chunks.find((c:any)=>c.id==='gestao_panorama');
  const r=await h.call({action:'analyze',privacy_confirmed:true,preview_digest:p.preview_digest,selections:[{id:'gestao_panorama',text:panorama.text.slice(0,40)}]});
  expect(r.status).toBe(200);const body=await r.json();
  expect(body.model).toBe('regras');expect(h.review).not.toHaveBeenCalled();expect(h.backend.reserve).not.toHaveBeenCalled();
  expect(body.result.gaps[0].text).toMatch(/^Organização didático-pedagógica: 1 achado\(s\) prioritário\(s\) em aberto; 5 exigência\(s\) sem envio/);
  expect(body.result.gaps[1].text).toMatch(/Infraestrutura: 1 meta\(s\) sem ação 5W2H/);
  expect(body.result.recommendations[0].text).toMatch(/^Tratar primeiro os achados prioritários/);
  expect(body.result.facts[0].quotes[0].excerpt).toBe(panorama.text.slice(0,40).trim());
  expect(body.result.limitations[0]).toMatch(/IA suspensa/);
 });
 it('sem panorama, declara a ausência em vez de inventar',()=>{
  expect(ruleReview([],[]).summary).toMatch(/Panorama de gestão indisponível/);
 });
});
