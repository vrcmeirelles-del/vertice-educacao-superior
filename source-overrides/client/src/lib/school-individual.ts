export interface SchoolSignal{label:string;reason:string;source:string;reference:string;}
export function studentSignals(student:any,events:any[],today:string){
 const observations=events.filter(e=>e.student_id===student.id&&e.kind==='observation').sort((a,b)=>String(b.reference_date).localeCompare(String(a.reference_date))||String(b.created_at).localeCompare(String(a.created_at)));
 const latest=observations[0];const signals:SchoolSignal[]=[];let coverage=0;
 if(student.status!=='active')return {label:'Situação não ativa',signals,latest,coverage};
 if(!latest)return {label:'Sem avaliação',signals,latest,coverage};
 const age=(Date.parse(today+'T12:00:00Z')-Date.parse(latest.reference_date+'T12:00:00Z'))/86400000;
 if(!Number.isFinite(age)||age<0||age>45)return {label:'Dados desatualizados',signals,latest,coverage};
 const d=latest.data||{};const add=(label:string,reason:string)=>signals.push({label,reason,source:latest.source,reference:latest.reference_date});
 if(d.scheduled_days!=null&&d.present_days!=null&&Number(d.scheduled_days)>0){coverage++;const frequency=100*Number(d.present_days)/Number(d.scheduled_days);if(frequency<75)add('Frequência','Presença de '+frequency.toFixed(1)+'% no período observado, abaixo do limiar operacional de 75%.');}
 if(d.score_pct!=null){coverage++;if(Number(d.score_pct)<50)add('Desempenho','Resultado normalizado de '+Number(d.score_pct)+'%, abaixo do limiar operacional de 50%.');}
 if(d.renewal&&d.renewal!=='unknown'){coverage++;if(['pending','not_renewed'].includes(d.renewal)&&d.renewal_due&&d.renewal_due<today)add('Renovação','Renovação ainda não confirmada após o prazo informado ('+d.renewal_due+'). Conferir com a secretaria.');}
 return {label:signals.length>=2?'Atenção elevada':signals.length?'Atenção':coverage?'Sem alerta pelas regras':'Sem base suficiente',signals,latest,coverage};
}
export function renderSchoolTemplate(body:string,values:Record<string,unknown>){return body.replace(/\{\{([^{}]+)\}\}/g,(_,key)=>{if(!['institution','student','enrollment','class','year','issue_date'].includes(key)||values[key]==null)throw new Error('Campo não disponível: '+key);return String(values[key]);});}
