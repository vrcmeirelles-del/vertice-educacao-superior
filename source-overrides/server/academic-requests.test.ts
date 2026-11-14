import { afterEach, expect, it, vi } from 'vitest';
import { requireSuccessfulQueries, withAcademicTimeout } from '../client/src/lib/academic-requests';
afterEach(()=>vi.useRealTimers());
it('rejects an API error even when its promise resolved',()=>{expect(()=>requireSuccessfulQueries([{error:null},{error:{message:'PGRST002'}}])).toThrow('PGRST002');});
it('accepts successful empty results',()=>{expect(()=>requireSuccessfulQueries([{error:null}])).not.toThrow();});
it('releases a stalled read after its deadline',async()=>{vi.useFakeTimers();const pending=withAcademicTimeout(new Promise(()=>{}),100);const checked=expect(pending).rejects.toThrow('demorou');await vi.advanceTimersByTimeAsync(100);await checked;expect(vi.getTimerCount()).toBe(0);});
it('clears its deadline when a thenable completes',async()=>{vi.useFakeTimers();await expect(withAcademicTimeout({then(resolve:any){resolve(7);return this;}} as PromiseLike<number>)).resolves.toBe(7);expect(vi.getTimerCount()).toBe(0);});
