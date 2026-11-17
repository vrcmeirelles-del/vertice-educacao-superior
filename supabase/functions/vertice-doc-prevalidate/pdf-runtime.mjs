// Keep lifecycle handling shared between the production Edge function and tests.
export async function openTextPdf(bytes,getDocument){
 const task=getDocument({data:bytes,useSystemFonts:false,disableFontFace:true,isEvalSupported:false,useWorkerFetch:false,stopAtErrors:true});
 try{
  const doc=await task.promise;
  return {numPages:doc.numPages,getPage:n=>doc.getPage(n),destroy:()=>task.destroy()};
 }catch(error){await task.destroy();throw error;}
}
