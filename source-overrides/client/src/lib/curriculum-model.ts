/**
 * Construção Curricular — modelo replicável e checklist por regras (sem IA).
 * Gera, a partir da matriz do curso, (1) a estrutura replicável (competências, distribuição de
 * disciplinas por categoria e por período), (2) os critérios de classificação usados pelo portal e
 * (3) uma lista de verificação calculada. Não sugere competências de outras áreas: isso depende das
 * DCNs de cada curso e não é inventado aqui. Mesma matriz ⇒ mesmo modelo.
 */
export const CURRICULUM_MODEL_RULES = {version:'2026.11-1'} as const;
type Category='profissional'|'instrumental'|'basica';
export interface ModelCompetency {code:string;title:string;description?:string;origin_period?:number|null;period_status?:'proposed'|'validated'|null;
 disciplines:Array<{discipline_name:string;category:Category}>}
export interface ModelInput {course:string;graduate_profile:string;dcn_reference:string;dcn_document_url:string;competencies:ModelCompetency[]}
export interface CheckItem {ok:boolean;text:string}
export interface CurriculumModel {checks:CheckItem[];text:string}

const CATEGORY_LABEL:Record<Category,string>={profissional:'profissional',instrumental:'instrumental',basica:'básica'};
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const pct=(a:number,b:number)=>b?Math.round(a/b*100):0;

export function buildCurriculumModel(m:ModelInput):CurriculumModel{
 const comps=m.competencies.filter(c=>c.code.trim()||c.title.trim());
 const all=comps.flatMap(c=>c.disciplines.filter(d=>d.discipline_name.trim()).map(d=>({...d,comp:c.code})));
 const byCat:Record<Category,number>={profissional:0,instrumental:0,basica:0};
 for(const d of all)byCat[d.category]++;
 const unique=new Map<string,{name:string;comps:Set<string>}>();
 for(const d of all){const k=norm(d.discipline_name);const e=unique.get(k)??{name:d.discipline_name.trim(),comps:new Set<string>()};e.comps.add(d.comp);unique.set(k,e);}
 const shared=[...unique.values()].filter(u=>u.comps.size>1).sort((a,b)=>b.comps.size-a.comps.size||a.name.localeCompare(b.name));
 const codes=comps.map(c=>norm(c.code));
 const periods=comps.map(c=>c.origin_period).filter((p):p is number=>typeof p==='number');
 const maxP=periods.length?Math.max(...periods):0;
 const missingP=maxP?Array.from({length:maxP},(_,i)=>i+1).filter(p=>!periods.includes(p)):[];
 const checks:CheckItem[]=[
  {ok:m.graduate_profile.trim().length>=50,text:'Perfil do egresso descrito (ao menos 50 caracteres).'},
  {ok:m.dcn_reference.trim().length>0,text:'Referência da DCN informada.'},
  {ok:/^https:\/\//.test(m.dcn_document_url.trim()),text:'Link oficial da DCN informado (https).'},
  {ok:comps.length>0&&new Set(codes).size===codes.length,text:'Códigos de competência únicos.'},
  {ok:comps.length>0&&comps.every(c=>c.disciplines.some(d=>d.category==='profissional'&&d.discipline_name.trim())),text:'Toda competência tem ao menos uma disciplina profissional.'},
  {ok:comps.length>0&&comps.every(c=>c.disciplines.some(d=>d.discipline_name.trim())),text:'Nenhuma competência sem disciplinas.'},
  {ok:comps.length>0&&comps.every(c=>typeof c.origin_period==='number'),text:'Período de origem informado em todas as competências.'},
  {ok:comps.length>0&&comps.every(c=>c.period_status==='validated'),text:'Períodos homologados no PPC.'},
  {ok:maxP>0&&missingP.length===0,text:maxP?`Sem períodos vazios entre o 1º e o ${maxP}º.`:'Distribuição por períodos definida.'},
  {ok:!comps.some(c=>{const seen=new Map<string,Category>();return c.disciplines.some(d=>{const k=norm(d.discipline_name);if(!k)return false;const prev=seen.get(k);seen.set(k,d.category);return prev!==undefined&&prev!==d.category;});}),
   text:'Nenhuma disciplina classificada em duas categorias na mesma competência.'},
 ];
 const L:string[]=[];
 L.push(`Modelo replicável por regras (versão ${CURRICULUM_MODEL_RULES.version}) — ${m.course||'curso'}`);
 L.push('');
 L.push('1. ESTRUTURA');
 L.push(`${comps.length} competência(s); ${all.length} vínculo(s) disciplina–competência; ${unique.size} disciplina(s) distinta(s).`);
 L.push(`Distribuição: profissional ${byCat.profissional} (${pct(byCat.profissional,all.length)}%), instrumental ${byCat.instrumental} (${pct(byCat.instrumental,all.length)}%), básica ${byCat.basica} (${pct(byCat.basica,all.length)}%).`);
 for(const [i,c] of comps.entries()){
  const n=(k:Category)=>c.disciplines.filter(d=>d.category===k&&d.discipline_name.trim()).length;
  L.push(`  [Competência ${i+1}] ${c.code} — ${c.title}: ${n('profissional')} profissional, ${n('instrumental')} instrumental, ${n('basica')} básica`+
   (typeof c.origin_period==='number'?` · ${c.origin_period}º período (${c.period_status==='validated'?'homologado':'proposto'})`:' · período não informado')+'.');
 }
 if(shared.length)L.push('Disciplinas integradoras (em mais de uma competência): '+shared.slice(0,10).map(s=>`${s.name} (${s.comps.size})`).join(', ')+'.');
 L.push('Para replicar: mantenha a mesma quantidade de competências por eixo de formação, uma disciplina profissional por competência no mínimo e a proporção entre categorias como referência inicial, ajustando à DCN do curso de destino.');
 L.push('');
 L.push('2. CRITÉRIOS DE CLASSIFICAÇÃO (convenção do portal)');
 L.push('  • Profissional: disciplina do núcleo específico da área, que desenvolve diretamente a competência.');
 L.push('  • Instrumental: método, linguagem, pesquisa, tecnologia ou prática que dá suporte à competência.');
 L.push('  • Básica: fundamento de outra área do conhecimento necessário à competência.');
 L.push('  • Uma disciplina pode servir a várias competências, sempre na mesma categoria dentro de cada uma.');
 L.push('');
 L.push(`3. LISTA DE VERIFICAÇÃO — ${checks.filter(c=>c.ok).length} de ${checks.length} atendidos`);
 for(const c of checks)L.push(`  ${c.ok?'✓':'✗'} ${c.text}`);
 if(missingP.length)L.push(`  Períodos sem competência de origem: ${missingP.map(p=>p+'º').join(', ')}.`);
 L.push('');
 L.push('Limite: este modelo não sugere competências de outras áreas; elas dependem da DCN de cada curso e devem ser extraídas da norma vigente.');
 return {checks,text:L.join('\n')};
}
