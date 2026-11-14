import templates from './templates.json';
export type Template = keyof typeof templates;
export type Answers = Record<string,string>;
export interface Field {key:string;label:string;type:string;required:boolean;readonly?:boolean;options?:string[];min?:number;max?:number;}
export interface Model {label:string;source:string;role_group:string;note:string;fields:Field[];}
export const TEMPLATES = templates as Record<Template,Model>;
export function sectionsFor(template:Template) {
 const fields=TEMPLATES[template].fields;
 return [{title:'Identificação',fields:fields.slice(0,10)},{title:TEMPLATES[template].label,fields:fields.slice(10)}];
}
export function validateAnswers(a:Answers,final:boolean,template:Template):string[]{
 if(!TEMPLATES[template])return ['Modelo inválido.'];
 if(!final)return [];
 const errors:string[]=[];
 for(const f of TEMPLATES[template].fields){const v=a[f.key]?.trim()||'';
  if(f.required&&!v)errors.push(`Preencha: ${f.label}.`);
  if(v&&f.options&&!f.options.includes(v))errors.push(`Opção inválida: ${f.label}.`);
  if(v&&f.type==='number'&&(!Number.isFinite(Number(v))||Number(v)<(f.min??0)||Number(v)>(f.max??Infinity)))errors.push(`Nota inválida: ${f.label}.`);
 }
 if(a.semester&&!/^\d{4}[-/][12]$/.test(a.semester))errors.push('Use o semestre no formato AAAA/1 ou AAAA/2.');
 if(template==='ata')for(const n of ['2','3'])if(Boolean(a['examiner'+n]?.trim())!==Boolean(a['grade'+n]?.trim()))errors.push(`Informe o nome e a nota do avaliador ${n}, ou deixe ambos vazios.`);
 if(template==='publicacao'&&a.permission==='Autoriza após embargo'&&!a.embargo?.trim())errors.push('Informe as condições do embargo.');
 return errors;
}
export function meanGrade(a:Answers):string {
 const values=['1','2','3'].flatMap(n=>a['grade'+n]?.trim()?[Number(a['grade'+n])]:[]);
 return values.length&&values.every(v=>Number.isFinite(v)&&v>=0&&v<=10)?(values.reduce((s,v)=>s+v,0)/values.length).toFixed(2):'';
}
