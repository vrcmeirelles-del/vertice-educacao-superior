const fontes=[{nome:'Fato & Ordem',repo:'vrcmeirelles-del/fato-e-ordem'},{nome:'Vértice',repo:'vrcmeirelles-del/vertice-educacao-superior'}];
export async function consultarVersoes(){
 const resultados=await Promise.all(fontes.map(async ({nome,repo})=>{try{
  const options={headers:{Accept:'application/vnd.github+json'},credentials:'omit' as const,signal:AbortSignal.timeout(8000)};
  const a=await fetch(`https://api.github.com/repos/${repo}`,options);if(!a.ok)throw Error();
  const d=await a.json();if(typeof d.default_branch!=='string'||!d.default_branch||d.default_branch.length>200)throw Error();
  const b=await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(d.default_branch)}`,{...options,signal:AbortSignal.timeout(8000)});if(!b.ok)throw Error();const c=await b.json();if(!/^[a-f0-9]{40}$/.test(c.sha))throw Error();
  return{nome,ok:true,branch:d.default_branch,sha:c.sha,url:`https://github.com/${repo}/commit/${c.sha}`};
 }catch{return{nome,ok:false,motivo:'Fonte pública indisponível; referência anterior mantida sem confirmação de atualização.'};}}));
 return{consultadoEm:new Date().toISOString(),resultados};
}
