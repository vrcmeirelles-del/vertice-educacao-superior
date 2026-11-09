import type {Row} from './area';
/** Desambigua cadastros sem mesclar identidades, nomes ou vínculos persistidos. */
export function displayCourseRows(courses:Row[],requests:Row[],goals:Row[]):Row[]{
 // Mesmo UUID pode chegar repetido após recarga de fontes. Não confundir duplicação
 // de transporte com dois cursos reais; preservar UUIDs diferentes para conciliação.
 const seen=new Set<string>();
 const unique=courses.filter(c=>{const id=String(c.id);if(!id||seen.has(id))return false;seen.add(id);return true;});
 const key=(c:Row)=>JSON.stringify([c.institution_id,c.code,c.name,c.modality]);
 const groups=new Map<string,Row[]>();for(const c of unique){const k=key(c);groups.set(k,[...(groups.get(k)||[]),c]);}
 for(const rows of groups.values())rows.sort((a,b)=>String(a.created_at??'').localeCompare(String(b.created_at??''))||a.id.localeCompare(b.id));
 return unique.map(c=>{const rows=groups.get(key(c))!;if(rows.length<2)return {...c,display_name:c.name};const match=(r:Row)=>r.institution_id===c.institution_id&&r.course_id===c.id;
  return {...c,display_name:`${c.name} — Base ${rows.findIndex(r=>r.id===c.id)+1} (${requests.filter(match).length} exigências; ${goals.filter(match).length} metas)`,registration_note:'Cadastros com mesmo nome e código foram identificados separadamente para preservar seus documentos e vínculos. A consolidação exige conciliação das bases.'};});
}
