/**
 * Trilhas de Formação ENADE — diagnóstico por regras (sem IA).
 *
 * Entrada: as questões ENADE mapeadas em cada trilha (percentual de acerto nacional e da IES).
 * Para cada trilha:
 *  1. evidência: nº de questões com as duas taxas (0 = sem evidência; < minQuestions = insuficiente);
 *  2. discrepância média (IES − nacional, em pontos percentuais) → crítico / atenção / estável / forte
 *     (mesmos limiares da visão v_trail_diagnostic);
 *  3. dispersão (desvio-padrão amostral): ≥ heterogeneousSd → lacunas pontuais; senão, padrão sistêmico;
 *  4. tendência: inclinação por mínimos quadrados da discrepância média por ano (≥ 2 anos);
 *  5. tipo de lacuna: itens "fáceis" no país (acerto nacional ≥ easyNational) com a IES abaixo de
 *     −basicGap pp indicam lacuna de base; itens difíceis no país (< hardNational) indicam aprofundamento;
 *  6. prioridade = max(0, −discrepância) × √n × fatores (piora, lacuna de base); 0 quando a evidência é insuficiente.
 * Recomendações saem de uma tabela fixa de regras. Mesma entrada ⇒ mesmo diagnóstico.
 */
export const TRAIL_DIAGNOSIS_RULES = {
 version: '2026.11-1',
 minQuestions: 3,
 critical: -10, attention: -3, strong: 3,
 heterogeneousSd: 10,
 trendSlope: 2,
 easyNational: 60, hardNational: 40, basicGap: 10,
 worseningFactor: 1.25, basicGapFactor: 1.2,
 worstItems: 3,
} as const;

export type TrailStatus='critico'|'atencao'|'estavel'|'forte';
export interface DiagnosisTrail {id:string;code:string;name:string}
export interface DiagnosisQuestion {trail_id:string;enade_year:number|null;question_number:number|null;national_correct_pct:number|null;ies_correct_pct:number|null}
export interface TrailFinding {
 trailId:string;code:string;name:string;
 n:number;evidence:'sem_evidencia'|'insuficiente'|'suficiente';
 meanGap:number|null;status:TrailStatus|null;sd:number|null;pattern:'sistemico'|'pontual'|null;
 trend:'piorando'|'melhorando'|'estavel'|'sem_serie';slope:number|null;years:number;
 basicGapItems:number;hardItems:number;
 worst:Array<{year:number|null;number:number|null;gap:number}>;
 priority:number;recommendations:string[];
}
export interface CourseDiagnosis {rulesVersion:string;findings:TrailFinding[];counts:Record<TrailStatus|'insuficiente',number>;weightedGap:number|null;text:string}

const R=TRAIL_DIAGNOSIS_RULES;
const r1=(x:number)=>Math.round(x*10)/10;
const statusOf=(g:number):TrailStatus=>g<R.critical?'critico':g<R.attention?'atencao':g<R.strong?'estavel':'forte';

function slopeOf(points:Array<[number,number]>):number|null{
 if(points.length<2)return null;
 const mx=points.reduce((s,[x])=>s+x,0)/points.length,my=points.reduce((s,[,y])=>s+y,0)/points.length;
 const sxx=points.reduce((s,[x])=>s+(x-mx)**2,0);
 return sxx===0?null:points.reduce((s,[x,y])=>s+(x-mx)*(y-my),0)/sxx;
}

export function diagnoseTrail(trail:DiagnosisTrail,questions:DiagnosisQuestion[]):TrailFinding{
 const items=questions.filter(q=>q.trail_id===trail.id&&q.national_correct_pct!==null&&q.ies_correct_pct!==null)
  .map(q=>({year:q.enade_year,number:q.question_number,nat:Number(q.national_correct_pct),gap:Number(q.ies_correct_pct)-Number(q.national_correct_pct)}));
 const n=items.length;
 const base:TrailFinding={trailId:trail.id,code:trail.code,name:trail.name,n,evidence:n===0?'sem_evidencia':n<R.minQuestions?'insuficiente':'suficiente',
  meanGap:null,status:null,sd:null,pattern:null,trend:'sem_serie',slope:null,years:0,basicGapItems:0,hardItems:0,worst:[],priority:0,recommendations:[]};
 if(!n){base.recommendations.push('Mapear questões ENADE para esta trilha antes de qualquer conclusão.');return base;}
 const mean=items.reduce((s,i)=>s+i.gap,0)/n;
 const sd=n>1?Math.sqrt(items.reduce((s,i)=>s+(i.gap-mean)**2,0)/(n-1)):0;
 const byYear=new Map<number,number[]>();
 for(const i of items)if(i.year!==null)byYear.set(i.year,[...(byYear.get(i.year)??[]),i.gap]);
 const yearPoints=[...byYear.entries()].sort((a,b)=>a[0]-b[0]).map(([y,g])=>[y,g.reduce((s,x)=>s+x,0)/g.length] as [number,number]);
 const slope=slopeOf(yearPoints);
 const trend=slope===null?'sem_serie':slope<=-R.trendSlope?'piorando':slope>=R.trendSlope?'melhorando':'estavel';
 const basicGapItems=items.filter(i=>i.nat>=R.easyNational&&i.gap<=-R.basicGap).length;
 const hardItems=items.filter(i=>i.nat<R.hardNational&&i.gap<0).length;
 const worst=[...items].sort((a,b)=>a.gap-b.gap||(a.year??0)-(b.year??0)||(a.number??0)-(b.number??0)).slice(0,R.worstItems)
  .filter(i=>i.gap<0).map(i=>({year:i.year,number:i.number,gap:r1(i.gap)}));
 const status=statusOf(mean);
 const pattern=n>1&&sd>=R.heterogeneousSd?'pontual':'sistemico';
 const enough=n>=R.minQuestions;
 let priority=enough?Math.max(0,-mean)*Math.sqrt(n):0;
 if(trend==='piorando')priority*=R.worseningFactor;
 if(basicGapItems>0)priority*=R.basicGapFactor;
 const rec:string[]=[];
 if(!enough)rec.push(`Evidência insuficiente (${n} questão(ões); mínimo ${R.minQuestions}): mapear mais questões antes de concluir.`);
 if(status==='critico'&&pattern==='sistemico')rec.push('Revisar ementa, sequência e carga horária das disciplinas da trilha; prever oficina de retomada e simulados dirigidos no próximo semestre.');
 if((status==='critico'||status==='atencao')&&pattern==='pontual')rec.push('Retomar os conteúdos das questões de maior lacuna (listadas abaixo) e montar banco de questões focado nesses temas.');
 if(status==='atencao'&&pattern==='sistemico')rec.push('Revisar materiais e instrumentos de avaliação da trilha; acompanhar no próximo ciclo.');
 if(basicGapItems>0)rec.push(`${basicGapItems} questão(ões) que o país acerta com facilidade (≥ ${R.easyNational}%) ficaram ${R.basicGap} pp ou mais abaixo: revisar pré-requisitos e disciplinas introdutórias.`);
 if(hardItems>0&&(status==='critico'||status==='atencao'))rec.push(`${hardItems} questão(ões) difíceis também no país (< ${R.hardNational}%): prever aprofundamento e atividades de maior complexidade.`);
 if(trend==='piorando')rec.push(`Desempenho piorando (${r1(slope!)} pp/ano): verificar mudanças recentes de docente, ementa ou carga horária.`);
 if(trend==='melhorando'&&(status==='critico'||status==='atencao'))rec.push(`Há melhora (+${r1(slope!)} pp/ano): manter as ações em curso e medir de novo no próximo ciclo.`);
 if(status==='forte')rec.push('Trilha acima da média nacional: registrar as práticas e usá-las como referência para as demais.');
 if(status==='estavel'&&!rec.length)rec.push('Em linha com a média nacional: manter monitoramento.');
 return {...base,meanGap:r1(mean),status,sd:r1(sd),pattern,trend,slope:slope===null?null:r1(slope),years:yearPoints.length,
  basicGapItems,hardItems,worst,priority:Math.round(priority*100)/100,recommendations:rec};
}

const STATUS_LABEL:Record<TrailStatus,string>={critico:'Crítico',atencao:'Atenção',estavel:'Estável',forte:'Forte'};
const TREND_LABEL={piorando:'piorando',melhorando:'melhorando',estavel:'estável',sem_serie:'sem série histórica'} as const;

export function diagnoseCourse(trails:DiagnosisTrail[],questions:DiagnosisQuestion[]):CourseDiagnosis{
 const findings=trails.map(t=>diagnoseTrail(t,questions))
  .sort((a,b)=>b.priority-a.priority||(a.meanGap??Infinity)-(b.meanGap??Infinity)||a.code.localeCompare(b.code));
 const counts={critico:0,atencao:0,estavel:0,forte:0,insuficiente:0};
 for(const f of findings){if(f.evidence!=='suficiente')counts.insuficiente++;else if(f.status)counts[f.status]++;}
 const withData=findings.filter(f=>f.meanGap!==null);
 const totalN=withData.reduce((s,f)=>s+f.n,0);
 const weightedGap=totalN?r1(withData.reduce((s,f)=>s+f.meanGap!*f.n,0)/totalN):null;
 const lines:string[]=[];
 lines.push(`Diagnóstico por regras (versão ${R.version}) — ${findings.length} trilha(s), ${totalN} questão(ões) com taxas da IES e nacional.`);
 lines.push(`Discrepância média ponderada do curso: ${weightedGap===null?'sem dados':(weightedGap>0?'+':'')+weightedGap+' pp'}.`);
 lines.push(`Situação: ${counts.critico} crítica(s), ${counts.atencao} em atenção, ${counts.estavel} estável(is), ${counts.forte} forte(s), ${counts.insuficiente} com evidência insuficiente.`);
 const top=findings.filter(f=>f.priority>0).slice(0,3);
 if(top.length)lines.push('Prioridades: '+top.map((f,i)=>`${i+1}º ${f.code} — ${f.name}`).join('; ')+'.');
 for(const f of findings){
  lines.push('');
  lines.push(`■ ${f.code} — ${f.name}`);
  if(f.meanGap===null){lines.push('  Sem questões com taxas da IES e nacional.');}
  else{
   lines.push(`  ${f.evidence==='suficiente'?STATUS_LABEL[f.status!]:'Evidência insuficiente'} · ${f.n} questão(ões) · discrepância ${(f.meanGap>0?'+':'')+f.meanGap} pp · padrão ${f.pattern==='pontual'?'pontual (lacunas concentradas)':'sistêmico'} (desvio ${f.sd} pp) · tendência ${TREND_LABEL[f.trend]}${f.slope!==null?` (${(f.slope>0?'+':'')+f.slope} pp/ano em ${f.years} anos)`:''}.`);
   if(f.worst.length)lines.push('  Maiores lacunas: '+f.worst.map(w=>`${w.year??'ano ?'} Q${w.number??'?'} (${w.gap} pp)`).join(', ')+'.');
  }
  for(const r of f.recommendations)lines.push('  → '+r);
 }
 return {rulesVersion:R.version,findings,counts,weightedGap,text:lines.join('\n')};
}
