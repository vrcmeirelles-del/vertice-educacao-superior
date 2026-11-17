import {fail,type Obj} from './core.ts';
export function foQrToken(value:unknown){
 if(typeof value!=='string'||value.length>500)throw fail('invalid_fo_qr');const raw=value.trim();if(/^[a-f\d]{64}$/i.test(raw))return raw.toLowerCase();
 try{const u=new URL(raw);if(u.protocol!=='https:'||!['www.fatoeordem.com.br','fatoeordem.com.br'].includes(u.hostname)||u.port||u.username||u.password||u.search||u.hash||!/^\/scan\/[a-f\d]{64}\/?$/i.test(u.pathname))throw Error();return u.pathname.split('/')[2].toLowerCase();}catch{throw fail('invalid_fo_qr');}
}
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
export function validateFoSnapshot(s:Obj,inst:string,course:string){
 if(!s||s.contractVersion!=='manuscript-v1'||s.institutionId!==inst||s.courseId!==course||!uuid(s.sheetId)||!/^[a-f\d]{64}$/.test(s.snapshotHash)||!/^[a-f\d]{64}$/.test(s.studentToken)||typeof s.stem!=='string'||s.stem.length<50||s.stem.length>30000||typeof s.discipline!=='string'||s.discipline.length>200||typeof s.sourceModule!=='string'||s.sourceModule.length>100||typeof s.sourceMaxPoints!=='number'||!Number.isFinite(s.sourceMaxPoints)||s.sourceMaxPoints<=0||s.sourceMaxPoints>1000||!Array.isArray(s.rubric)||!s.rubric.length||s.rubric.length>10||s.ocrVerified!==false||s.imageAvailable!==false)throw fail('invalid_fo_contract',502);
 let total=0;for(const r of s.rubric){if(typeof r.criterion!=='string'||r.criterion.length<3||r.criterion.length>2000||typeof r.points!=='number'||!Number.isFinite(r.points)||r.points<=0||typeof r.sourcePoints!=='number'||!Number.isFinite(r.sourcePoints)||r.sourcePoints<=0)throw fail('invalid_fo_rubric',502);total+=r.points;}
 if(Math.abs(total-10)>1e-8||Math.abs(s.rubric.reduce((n:number,r:Obj)=>n+r.sourcePoints,0)-s.sourceMaxPoints)>1e-6||(s.ocrText!==null&&(typeof s.ocrText!=='string'||s.ocrText.length>30000)))throw fail('invalid_fo_rubric',502);
 // Whitelist; arbitrary remote fields never reach the registry or question content.
 return {contractVersion:s.contractVersion,institutionId:inst,courseId:course,sheetId:s.sheetId,snapshotHash:s.snapshotHash,studentToken:s.studentToken,sourceModule:s.sourceModule,discipline:s.discipline,stem:s.stem,sourceMaxPoints:s.sourceMaxPoints,rubric:s.rubric.map((r:Obj)=>({criterion:r.criterion,points:r.points,sourcePoints:r.sourcePoints})),ocrText:s.ocrText,ocrVerified:false,imageAvailable:false};
}
