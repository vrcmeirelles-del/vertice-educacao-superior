import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({upload:vi.fn(),remove:vi.fn(),insert:vi.fn(),confirm:vi.fn(),payload:undefined as any,filters:[] as unknown[]}));
vi.mock('../client/src/lib/supabase', () => ({supabase:{
  storage:{from:() => ({upload:f.upload,remove:f.remove})},
  from:() => ({
    insert:(payload:unknown) => {f.payload=payload;return {select:() => ({single:f.insert})};},
    select:() => {const query={eq:(...args:unknown[])=>{f.filters.push(args);return query;},maybeSingle:f.confirm};return query;},
  }),
}}));
import { submitAcWithAttachment, AcSubmissionPendingError } from '../client/src/lib/ac-submission';
const record={institution_id:'ies-test',student_id:'student-test',rule_id:'rule',category_id:'cat',title:'Synthetic',issuer:null,documentary_minutes:120,status:'submitted'};
const file=new File(['synthetic'], 'test.pdf',{type:'application/pdf'});
beforeEach(()=>{vi.clearAllMocks();f.filters=[];f.upload.mockResolvedValue({error:null});f.remove.mockResolvedValue({error:null});f.insert.mockResolvedValue({data:null,error:{message:'write failed'}});f.confirm.mockResolvedValue({data:null,error:null});});
describe('AC attachment reconciliation',()=>{
  it('keeps the attachment on confirmed success',async()=>{f.insert.mockImplementation(async()=>({data:f.payload,error:null}));const result=await submitAcWithAttachment(record,file);expect(result.id).toBe(f.payload.id);expect(f.remove).not.toHaveBeenCalled();});
  it('removes exactly its own attachment after confirmed write failure',async()=>{await expect(submitAcWithAttachment(record,file)).rejects.toThrow('write failed');expect(f.remove).toHaveBeenCalledWith([f.payload.external_url]);expect(f.filters).toContainEqual(['institution_id','ies-test']);expect(f.filters).toContainEqual(['student_id','student-test']);expect(f.filters).toContainEqual(['id',f.payload.id]);});
  it('preserves a committed write after a lost insert response',async()=>{f.insert.mockRejectedValue(new Error('network lost'));f.confirm.mockImplementation(async()=>({data:f.payload,error:null}));const result=await submitAcWithAttachment(record,file);expect(result.title).toBe('Synthetic');expect(f.insert).toHaveBeenCalledTimes(1);expect(f.remove).not.toHaveBeenCalled();});
  it('preserves the file if confirmation is unavailable',async()=>{f.confirm.mockResolvedValue({data:null,error:{message:'PGRST002'}});await expect(submitAcWithAttachment(record,file)).rejects.toBeInstanceOf(AcSubmissionPendingError);expect(f.remove).not.toHaveBeenCalled();});
  it('reports pending cleanup when storage removal fails',async()=>{f.remove.mockResolvedValue({error:{message:'unavailable'}});await expect(submitAcWithAttachment(record,file)).rejects.toThrow('remoção do comprovante ficou pendente');});
  it('does not write the request after upload failure',async()=>{f.upload.mockResolvedValue({error:{message:'quota'}});await expect(submitAcWithAttachment(record,file)).rejects.toThrow('Erro no upload');expect(f.insert).not.toHaveBeenCalled();expect(f.remove).not.toHaveBeenCalled();});
  it('does not call storage for a request without a file',async()=>{f.insert.mockImplementation(async()=>({data:f.payload,error:null}));await submitAcWithAttachment(record,null);expect(f.upload).not.toHaveBeenCalled();expect(f.payload.external_url).toBeUndefined();});
});
