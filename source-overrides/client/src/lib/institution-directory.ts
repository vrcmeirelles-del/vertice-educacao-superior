import {supabase} from "@/lib/supabase";
/** A falha remota não desfaz um cadastro que já foi salvo na Vértice. */
export async function syncInstitutionDirectory(institutionId:string){
 let ok=false;
 try {
  const {data,error}=await supabase.functions.invoke("vertice-learning-bridge",{body:{operation:"sync_institution",institutionId}});
  ok=!error&&data?.ok===true;
 }catch{}
 window.dispatchEvent(new CustomEvent("vertice:institution-directory",{detail:{institutionId,ok}}));
 return ok;
}
