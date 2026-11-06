// Browser-only fixture. No SDK, network, storage or production release flag changes.
export const MASTER_INVITATIONS_ENABLED=true;
import { issueMasterInvitation as realIssue, createMasterRequestGuard } from '../../client/src/lib/master-invitations';
export { createMasterRequestGuard };
export async function listMasters(){return {rows:[],next:null};}
export async function listMasterInvitations(){return {rows:[],next:null};}
export async function issueMasterInvitation(...args: Parameters<typeof realIssue>){
 if((window as any).useRealIssue){try{return await realIssue(...args);}finally{(window as any).realIssueSettled=true;}}
 (window as any).issues++;
 if((window as any).holdIssue)await new Promise<void>(resolve=>(window as any).releaseIssue=resolve);
 return {id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.test',expiresAt:'2030-01-01T00:00:00Z',link:'https://example.test/master#master_token=EMITTED_FIXTURE_SECRET'};
}
export async function previewMasterInvitation(){throw new Error('not used');}
export async function acceptMasterInvitation(){throw new Error('not used');}
export async function revokeMasterInvitation(){throw new Error('not used');}
(window as any).issues=0;
