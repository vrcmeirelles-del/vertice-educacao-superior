import {supabase} from '@/lib/supabase';
export async function conectaPublic<T>(body:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.functions.invoke('vertice-student-portal',{body:{...body,module:'conecta'}});
 if(error){let code='';try{code=(await error.context?.json())?.error||'';}catch{}
 throw new Error(code==='too_many'?'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.':code==='invalid_credentials'?'Não foi possível validar matrícula e CPF. Confira os dados ou procure a instituição.':code==='link_invalid'?'Link inválido ou expirado. Solicite um novo acesso.':'Não foi possível concluir. Confira os campos, sua sessão e o prazo do link.');}
 return data as T;
}
export const publicLink=(path:string,institutionId:string)=>window.location.origin+path+'?ies='+encodeURIComponent(institutionId);
export async function copyLink(value:string){await navigator.clipboard.writeText(value);}
