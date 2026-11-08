import {supabase} from "@/lib/supabase";
/** A falha remota não desfaz um cadastro que já foi salvo na Vértice. */
export async function syncInstitutionDirectory(institutionId:string){
 let ok=false,message="";
 try {
  const {data,error}=await supabase.functions.invoke("vertice-learning-bridge",{body:{operation:"sync_institution",institutionId}});
  ok=!error&&data?.ok===true;
  if(error?.context instanceof Response){
   const body=await error.context.json().catch(()=>({}));
   message=String(body.error||body.message||"Não foi possível confirmar a comunicação.").slice(0,220);
  }else if(!ok){message="Não foi possível confirmar a comunicação. Tente novamente.";}
 }catch{}
 window.dispatchEvent(new CustomEvent("vertice:institution-directory",{detail:{institutionId,ok,message}}));
 return ok;
}
