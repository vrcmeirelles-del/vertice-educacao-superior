"use strict";
// Integrated synthetic gate: JSON Schema is checked by Python upstream; this file
// validates cross-field consistency and pedagogical interpretation on the SAME instance.
const fs=require("node:fs");
const {validateReport}=require("./schema-validator.cjs");
function validateInterpretation(r){
 const problems=[];
 if(!r||typeof r!=="object")return ["REPORT_OBJECT"];
 for(const [i,c] of (Array.isArray(r.claims)?r.claims:[]).entries()){
   if(c.validation_status==="VALIDATED"&&["STATISTICAL_INFERENCE","PEDAGOGICAL_HYPOTHESIS"].includes(c.epistemic_label)){
     if(!Array.isArray(c.assumptions)||!c.assumptions.length)problems.push("CLAIM_"+i+"_ASSUMPTIONS");
     if(!Array.isArray(c.limitations)||!c.limitations.length)problems.push("CLAIM_"+i+"_LIMITATIONS");
   }
   if(c.validation_status==="VALIDATED"&&c.epistemic_label==="ACTION_PROPOSAL"){
     if(!Array.isArray(c.evidence_refs)||!c.evidence_refs.length)problems.push("CLAIM_"+i+"_ACTION_EVIDENCE");
     if(r.review_status!=="APPROVED"||!r.reviewed_by||!r.reviewed_at)problems.push("CLAIM_"+i+"_ACTION_NOT_APPROVED");
   }
 }
 if(r.report_type==="R1"&&r.payload&&["inscribed","present","valid"].every(k=>Number.isInteger(r.payload[k]))){
   if(r.payload.valid>r.payload.present||r.payload.present>r.payload.inscribed)problems.push("IMPOSSIBLE_PARTICIPATION");
 }
 return problems;
}
function run(r){const basic=validateReport(r);const pedagogical=validateInterpretation(r);return {ok:basic.ok&&pedagogical.length===0,errors:[...basic.errors,...pedagogical]};}
if(require.main===module){
 try{const data=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(JSON.stringify(run(data))+"\n");}catch(e){process.stderr.write(String(e)+"\n");process.exit(2);}
}
module.exports={run,validateInterpretation};
