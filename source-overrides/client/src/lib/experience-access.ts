import type {DemoInstitutionMode} from './demo-showroom';
import type {DemoSnapshot} from '@/components/DemoShowroom';

export type ExperienceRole='mantenedor'|'reitor'|'coordenador'|'diretor_escola';
export type ExperienceCredential={id:string;token:string};
export type ExperienceInvite={
 id:string;target_email:string;recipient_name:string;institution_type:DemoInstitutionMode;
 experience_role:ExperienceRole;created_at:string;expires_at:string;revoked_at:string|null;
 opens:number;saves:number;last_opened_at:string|null;usage:Record<string,number>;
};
export type ExperienceAccess={id:string;mode:DemoInstitutionMode;role:ExperienceRole;name:string;expires_at:string};
const endpoint='https://qvetbbmviatxxatzzuzc.supabase.co/functions/v1/vertice-experience';
const secretKey='vertice-experience-capability-v1';
const errors:Record<string,string>={
 invitation_expired_or_revoked:'Este convite expirou ou foi revogado pela Vértice.',
 invalid_invitation:'O link informado não é válido.',
 master_auth_required:'Entre com sua conta Master para administrar convites.',
 master_mfa_required:'Confirme o segundo fator da sua conta Master.',
 master_access_denied:'Esta conta não tem autorização de Master.',
 invitation_creation_failed:'A emissão não foi confirmada. Atualize a lista antes de repetir.',
 invalid_invitation_data:'Confira o destinatário e o perfil escolhido.',
 invalid_expiration:'Selecione uma validade permitida.',
 usage_limit:'O limite de uso desta experiência foi atingido.',
 service_unavailable:'O serviço está indisponível. Nenhum cadastro foi confirmado.',
 origin_denied:'Esta origem não está autorizada.',
};
export async function experienceApi(action:string,fields:Record<string,unknown>={},jwt?:string){
 const headers:Record<string,string>={'Content-Type':'application/json'};
 if(jwt)headers.Authorization='Bearer '+jwt;
 const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(20000),referrerPolicy:'no-referrer'});
 const result=await response.json().catch(()=>({error:'service_unavailable'}));
 if(!response.ok)throw new Error(errors[result.error]??'Não foi possível concluir a operação.');
 return result;
}
export function readExperienceCredential():ExperienceCredential|null{
 if(typeof window==='undefined')return null;
 const match=/^#convite=([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(window.location.hash);
 if(match){
   const credential={id:match[1],token:match[2]};
   try{window.sessionStorage.setItem(secretKey,JSON.stringify(credential));}catch{}
   window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
   return credential;
 }
 try{
   const saved=JSON.parse(window.sessionStorage.getItem(secretKey)||'null');
   if(saved&&typeof saved.id==='string'&&typeof saved.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(saved.token)&&/^[0-9a-f-]{36}$/i.test(saved.id))return saved;
 }catch{}
 return null;
}
export function clearExperienceCredential(){
 try{window.sessionStorage.removeItem(secretKey);}catch{}
}
export function guestExperience(action:'guest:open'|'guest:save'|'guest:module',credential:ExperienceCredential,extra:Record<string,unknown>={}){
 return experienceApi(action,{id:credential.id,token:credential.token,...extra});
}
export type {DemoSnapshot};
