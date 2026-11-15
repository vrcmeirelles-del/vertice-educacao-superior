import {describe,it,expect,vi} from 'vitest';
import {analyzePlanning,parsePlanning} from './planning';
const result={summary:'Síntese',findings:[{type:'lacuna',text:'Sem plano semestral',evidence:'semester=null'}],recommendations:[],limitations:['Rascunho']};
describe('Sapiens planning isolation',()=>{
 it('rejects malformed and mislabeled AI content',()=>{expect(()=>parsePlanning('{}')).toThrow();expect(()=>parsePlanning(JSON.stringify({...result,findings:[{type:'certeza',text:'',evidence:''}]}))).toThrow();expect(parsePlanning(JSON.stringify(result)).summary).toBe('Síntese');});
 it('does not invoke providers without institutional authorization',async()=>{const call=vi.fn();const response=await analyzePlanning({rpc:async()=>({error:{code:'42501',message:'denied'}})}, {},'i',{},call,call);expect(response.status).toBe(403);expect(call).not.toHaveBeenCalled();});
 it('records absent second-provider review without claiming independent validation',async()=>{let saved:any;const admin={from:()=>({update:(v:any)=>{saved=v;return {eq:()=>({eq:()=>({select:()=>({single:async()=>({data:{id:'j',status:'pending_review'}})})})})};}})};const response=await analyzePlanning({rpc:async()=>({data:{id:'j',context:{sources:['plans']}}})},admin,'i',{},async()=>({content:JSON.stringify(result),model:'gpt-test'}),async()=>null);expect(response.status).toBe(200);expect(saved.status).toBe('pending_review');expect(saved.review.available).toBe(false);expect(saved.reviewer_model).toBeNull();expect(saved.input_hash).toHaveLength(64);});
});
