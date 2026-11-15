export type SchoolClass={id:string;name:string;grade:string;shift?:string;year:number;segment_id?:string;capacity:number|null;enrolled:number|null;approved:number|null;failed:number|null;dropped:number|null;transferred_in:number|null;transferred_out:number|null;avg_score:number|null;source?:string;reference_date?:string;updated_at:string;notes?:string};
export type SchoolRecord={id:string;kind:string;year:number;class_id:string|null;title:string;source:string;reference_date:string;status:string;updated_at:string;data:Record<string,any>};
export type SchoolSnapshot={institution_id:string;fetched_at:string;classes:SchoolClass[];segments:{id:string;segment:string}[];records:SchoolRecord[];indicators:any[]};
export const schoolViews={bi:'Desempenho escolar',permanencia:'Permanência escolar',financeiro:'Resultado e custos',dados:'Dados e importação',projetos:'Projetos e atividades',estagio:'Estágio escolar',captacao:'Captação escolar'} as const;
export type SchoolView=keyof typeof schoolViews;
export function completeSum(rows:Record<string,any>[],key:string){return rows.length&&rows.every(r=>r[key]!==null&&r[key]!==undefined&&Number.isFinite(Number(r[key])))?rows.reduce((s,r)=>s+Number(r[key]),0):null;}
export function schoolRate(value:number|null,total:number|null){return value===null||total===null||total<=0||value>total?null:100*value/total;}
export function financeResult(data:Record<string,any>){const costs=completeSum(['personnel','direct_cost','allocated_cost'].map(k=>({value:data[k]})),'value');return {costs,result:costs===null||data.revenue_received==null?null:Number(data.revenue_received)-costs};}
export const classColumns=['name','grade','shift','year','capacity','enrolled','approved','failed','transferred_in','transferred_out','dropped','avg_score','source','reference_date','notes'];
export function csvCell(value:unknown){const text=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
export function classesCSV(rows:Record<string,any>[]){return '\uFEFF'+[classColumns.map(csvCell).join(';'),...rows.map(r=>classColumns.map(k=>csvCell(r[k])).join(';'))].join('\r\n');}
export function parseClassCSV(text:string){
 if(text.length>1000000)throw new Error('Arquivo muito grande; limite de 1 MB.');
 text=text.replace(/^\uFEFF/,'');const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',';
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length)throw new Error('Aspas inválidas no CSV.');else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw new Error('Aspas não encerradas no CSV.');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 const header=rows.shift()?.map(v=>v.trim())??[];
 if(['name','grade','year','source','reference_date'].some(k=>!header.includes(k))||new Set(header).size!==header.length||header.some(k=>!classColumns.includes(k)))throw new Error('Cabeçalhos inválidos. Use o modelo de turmas.');
 if(!rows.length||rows.length>200)throw new Error('Selecione de 1 a 200 linhas.');
 return rows.map((cells,i)=>{if(cells.length!==header.length)throw new Error(`Linha ${i+2}: número de colunas inválido.`);const r:Record<string,any>={};header.forEach((k,j)=>r[k]=cells[j].trim()||null);
 for(const k of ['year','capacity','enrolled','approved','failed','transferred_in','transferred_out','dropped','avg_score'])if(r[k]!=null){const value=String(r[k]).replace(',','.');if(!/^\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value))||(k!=='avg_score'&&!Number.isInteger(Number(value))))throw new Error(`Linha ${i+2}: ${k} inválido.`);r[k]=Number(value);}
 if(!r.name||!r.grade||!r.shift||r.capacity==null||r.enrolled==null||!r.source||!/^\d{4}-\d{2}-\d{2}$/.test(r.reference_date||'')||r.year<2000||r.year>2100)throw new Error(`Linha ${i+2}: confira nome, série, turno, capacidade, matrículas, ano, fonte e data.`);
 return r;});
}

export function schoolSegmentLabel(value:string){return ({infantil:'Educação Infantil',fundamental_1:'Ensino Fundamental · Anos Iniciais',fundamental_2:'Ensino Fundamental · Anos Finais',medio:'Ensino Médio',tecnico:'Educação Profissional',eja:'Educação de Jovens e Adultos'} as Record<string,string>)[value]||value;}

export function schoolGradeLabel(value:string){return value.replace(/^(\d+)ano$/, '$1º ano').replace(/^(\d+)serie$/, '$1ª série');}
