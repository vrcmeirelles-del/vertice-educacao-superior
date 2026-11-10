import {useEffect,useState} from 'react';
import {demoInstitutionCourses,type DemoInstitutionMode} from './demo-showroom';
export type LearningDemoFeed={origin:'fato-e-ordem';kind:'synthetic_demo';synthetic:true;mode:DemoInstitutionMode;period:string;summary:{students:number;courses:number;exam:number|null;engagement:number|null};courses:Array<{id:string;name:string;students:number;exam:number|null;engagement:number|null;journey:string}>};
const percentage=(n:unknown)=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
/** Whitelist the public synthetic contract; never accept an operational feed. */
export function validateLearningDemoFeed(raw:unknown,mode:DemoInstitutionMode):LearningDemoFeed|null{
 if(!raw||typeof raw!=='object')return null;
 const d=raw as Record<string,any>,expected=demoInstitutionCourses(mode);
 if(d.origin!=='fato-e-ordem'||d.kind!=='synthetic_demo'||d.synthetic!==true||d.mode!==mode||
 !d.summary||d.summary.courses!==expected.length||!count(d.summary.students)||!percentage(d.summary.exam)||!percentage(d.summary.engagement)||
 !Array.isArray(d.courses)||d.courses.length!==expected.length||typeof d.period!=='string'||!/^\d{4}\/[12]$/.test(d.period))return null;
 // The Fato & Ordem scenario owns its counts; do not substitute Vértice estimates.
 const ids=new Set<string>();
 for(const c of d.courses){if(!c||typeof c.id!=='string'||! /^[a-z][a-z0-9-]{0,79}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>160||!count(c.students)||!percentage(c.exam)||!percentage(c.engagement)||typeof c.journey!=='string'||c.journey.length>120)return null;ids.add(c.id);}
 if(d.courses.reduce((n:number,c:any)=>n+c.students,0)!==d.summary.students)return null;
 return {origin:'fato-e-ordem',kind:'synthetic_demo',synthetic:true,mode,period:d.period,
 summary:{students:d.summary.students,courses:d.summary.courses,exam:d.summary.exam,engagement:d.summary.engagement},
 courses:d.courses.map((c:any)=>({id:c.id,name:c.name,students:c.students,exam:c.exam,engagement:c.engagement,journey:c.journey}))};
}
export function useLearningDemoFeed(mode:DemoInstitutionMode){
 const [feed,setFeed]=useState<LearningDemoFeed|null>(null),[state,setState]=useState<'loading'|'connected'|'unavailable'>('loading');
 useEffect(()=>{let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);setFeed(null);setState('loading');
 fetch('https://www.fatoeordem.com.br/api/public/institutional-demo-feed?mode='+encodeURIComponent(mode),{mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal})
 .then(async r=>{if(!r.ok)throw Error('indisponível');const data=validateLearningDemoFeed(await r.json(),mode);if(!data)throw Error('contrato inválido');if(active){setFeed(data);setState('connected')}})
 .catch(()=>{if(active){setFeed(null);setState('unavailable')}}).finally(()=>clearTimeout(timeout));
 return()=>{active=false;clearTimeout(timeout);controller.abort()};},[mode]);
 return {feed,state,status:state==='connected'?'Conexão demonstrativa confirmada: indicadores fictícios recebidos do Fato & Ordem.':state==='loading'?'Consultando a demonstração do Fato & Ordem…':'Feed demonstrativo indisponível nesta consulta. Nenhum indicador foi apresentado como sincronizado.'};
}
