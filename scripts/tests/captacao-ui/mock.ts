export * from '../../client/src/lib/captacao-integrada';
import type { CaptacaoSetup } from '../../client/src/lib/captacao-integrada';
const state = { failLoad:false, failSave:false, conflict:false, denied:false, delay:0, saves:0, ids:[] as string[] };
Object.assign(window, { captacaoTest: state });
const connections: CaptacaoSetup['connections'] = [{ id:'cc000000-0000-4000-8000-000000000001',institution_id:'bb000000-0000-4000-8000-000000000001',provider:'meta',label:'Conta sintética A',public_url:'https://instagram.com/synthetic',account_external_id:'111',status:'prepared',last_test_at:null,last_successful_sync_at:null,version:1,created_at:'2026-11-10T12:00:00Z',updated_at:'2026-11-10T12:00:00Z' }];
const datasets: Record<string,CaptacaoSetup> = {
 'bb000000-0000-4000-8000-000000000001':{ connections,assets:[],campaigns:[] },
 'bb000000-0000-4000-8000-000000000002':{ connections:[],assets:[],campaigns:[] },
};
export async function canManageCaptacao() { if(state.failLoad) throw Error('Synthetic source failure');return !state.denied; }
export async function fetchCaptacaoIntegrada(ies:string) {
 const result=structuredClone(datasets[ies]);
 await new Promise(resolve=>setTimeout(resolve,state.delay));
 if(state.failLoad) throw Error('Synthetic source failure');
 return result;
}
async function create(kind:keyof CaptacaoSetup,ies:string,key:string,input:object) {
 state.saves++;state.ids.push(key);await new Promise(resolve=>setTimeout(resolve,150));
 if(state.failSave) throw Error('Sessão expirada. O rascunho foi mantido nesta tela.');
 const row={...input,id:key,institution_id:ies,version:1,status:'prepared',verification:'unverified'};
 (datasets[ies][kind] as unknown[]).push(row);return row;
}
async function update() { if(state.conflict) throw Error('Este cadastro mudou. Atualize e revise antes de salvar novamente.');return {}; }
export const createCaptacaoConnection=(ies:string,key:string,input:object)=>create('connections',ies,key,input);
export const createCaptacaoAsset=(ies:string,key:string,input:object)=>create('assets',ies,key,input);
export const createCaptacaoCampaign=(ies:string,key:string,input:object)=>create('campaigns',ies,key,input);
export const updateCaptacaoConnection=update;
export const updateCaptacaoAsset=update;
export const updateCaptacaoCampaign=update;
