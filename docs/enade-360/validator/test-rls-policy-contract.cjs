"use strict";
const assert=require("node:assert/strict");
const {allowed}=require("./rls-policy-contract.cjs");
const resource={institution_id:"IES_A",course_id:"COURSE_1",scope:"COURSE",sensitive_personal_data:false};
function person(profile,inst="IES_A",course="COURSE_1",aal="aal2"){
 return {user_id:"U1",profile,aal,active:true,institutionGrants:[{institution_id:inst,role:profile,active:true}],courseGrants:[{institution_id:inst,course_id:course,role:profile,active:true}]};
}
const cases=[
["master_granted",person("MASTER"),resource,true],
["master_other_ies",person("MASTER","IES_B"),resource,false],
["reitoria_granted",person("REITORIA"),resource,true],
["reitoria_other_ies",person("REITORIA","IES_B"),resource,false],
["coord_own_course",person("COORDENACAO"),resource,true],
["coord_other_course",person("COORDENACAO","IES_A","COURSE_2"),resource,false],
["nde_own_course",person("NDE"),resource,true],
["nde_other_course",person("NDE","IES_A","COURSE_2"),resource,false],
["cpa_course_block",person("CPA"),resource,false],
["cpa_aggregated",person("CPA"),{...resource,scope:"AGGREGATED"},true],
["cpa_other_ies",person("CPA","IES_B"),{...resource,scope:"AGGREGATED"},false],
["cpa_personal_block",person("CPA"),{...resource,scope:"AGGREGATED",sensitive_personal_data:true},false],
["reitoria_personal_block",person("REITORIA"),{...resource,sensitive_personal_data:true},false],
["master_personal_block",person("MASTER"),{...resource,sensitive_personal_data:true},false],
["mfa_aal1_block",person("MASTER","IES_A","COURSE_1","aal1"),resource,false],
["missing_mfa_block",{...person("MASTER"),aal:null},resource,false],
["inactive_block",{...person("REITORIA"),active:false},resource,false],
["missing_user_block",{...person("MASTER"),user_id:null},resource,false],
["unrecognized_role_block",person("equipe"),resource,false],
["no_grants_block",{...person("MASTER"),institutionGrants:[]},resource,false],
["expired_course_grant_block",{...person("NDE"),courseGrants:[{institution_id:"IES_A",course_id:"COURSE_1",role:"NDE",active:false}]},resource,false],
["role_mismatch_course_block",{...person("COORDENACAO"),courseGrants:[{institution_id:"IES_A",course_id:"COURSE_1",role:"NDE",active:true}]},resource,false],
["cross_tenant_institution_block",person("REITORIA","IES_B"),resource,false],
["without_course_grant_block",{...person("COORDENACAO"),courseGrants:[]},resource,false]
];
let passed=0;for(const [name,subject,res,expected] of cases){try{assert.equal(allowed(subject,res),expected);passed++;console.log("PASS",name)}catch(e){console.error("FAIL",name,e.message)}}
console.log(JSON.stringify({suite:"rls-policy-contract-only",tests:cases.length,passed,failed:cases.length-passed,node:process.version,real_postgres_rls:false}));if(passed!==cases.length)process.exitCode=1;
