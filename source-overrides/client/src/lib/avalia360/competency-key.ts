/**
 * Avalia 360° — identidade estável da competência, igual à do servidor
 * (vertice_private.avalia_competency_key): 'cmp:' + código | título, em minúsculas
 * e com espaços colapsados. Renomear código ou título inicia um novo histórico.
 */
import type {DeclaredCompetency} from './declared-analysis';
const norm=(v:string)=>v.trim().replace(/\s+/g,' ').toLowerCase();
export const competencyKeyOf=(c:{code:string;title:string})=>'cmp:'+norm(c.code)+'|'+norm(c.title);

export interface CompetencyDescriptor {id:string;code:string;title:string;period:number}
/**
 * Integra as competências de uma questão vinda de outro caderno (banco) ao catálogo do
 * caderno atual: mesma chave => reaproveita a competência existente; senão, inclui no catálogo.
 * Devolve o catálogo atualizado e os ids que a questão deve usar neste caderno.
 */
export function mergeIntoCatalog(catalog:DeclaredCompetency[],descriptors:CompetencyDescriptor[],questionIds:string[],
 newId:()=>string=()=>crypto.randomUUID()):{catalog:DeclaredCompetency[];ids:string[]}{
 const next=[...catalog];
 const byKey=new Map(next.map(c=>[competencyKeyOf(c),c.id]));
 const ids:string[]=[];
 for(const oldId of questionIds){
  const d=descriptors.find(x=>x.id===oldId);
  if(!d||!d.code.trim()||!d.title.trim())continue;
  const key=competencyKeyOf(d);
  let id=byKey.get(key);
  if(!id){id=newId();next.push({id,code:d.code.trim(),title:d.title.trim(),period:d.period});byKey.set(key,id);}
  if(!ids.includes(id))ids.push(id);
 }
 return {catalog:next,ids};
}
