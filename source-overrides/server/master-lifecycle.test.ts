import { it, expect, vi } from 'vitest';
it('clears Master vault on pagehide before React mounts', async()=>{
 const handlers:Record<string,Function[]>={};
 const location={hash:'#master_invitation=11111111-1111-4111-8111-111111111111&master_token='+'a'.repeat(43),search:'',pathname:'/master'};
 vi.stubGlobal('window',{location,history:{replaceState:(_a:unknown,_b:string,url:string)=>{location.hash=new URL(url,'https://example.test').hash;}},addEventListener:(n:string,f:Function)=>(handlers[n]??=[]).push(f)});
 const m=await import('../client/src/lib/master-invitation-bootstrap');
 expect(m.getPendingMasterInvitation()).not.toBeNull();
 for(const f of handlers.pagehide??[])f();
 expect(m.getPendingMasterInvitation()).toBeNull();
 vi.unstubAllGlobals();
});
