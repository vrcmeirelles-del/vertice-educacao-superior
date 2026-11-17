"use strict";
// Contract-level simulation for planned RLS only.
// This does NOT exercise PostgreSQL RLS, database roles, MFA JWT or auth.uid().
const APPROVED_ROLES=new Set(["MASTER","REITORIA","COORDENACAO","NDE","CPA"]);
function allowed(s,r){
 if(!s||!r||s.aal!=="aal2"||!s.user_id||!s.active||!APPROVED_ROLES.has(s.profile))return false;
 if(!Array.isArray(s.institutionGrants)||!Array.isArray(s.courseGrants))return false;
 const institution=s.institutionGrants.some(g=>g.active&&g.institution_id===r.institution_id);
 if(!institution||r.sensitive_personal_data)return false;
 if(s.profile==="MASTER"||s.profile==="REITORIA")return s.institutionGrants.some(g=>g.active&&g.institution_id===r.institution_id&&g.role===s.profile);
 if(s.profile==="CPA")return r.scope==="AGGREGATED"&&s.institutionGrants.some(g=>g.active&&g.institution_id===r.institution_id&&g.role==="CPA");
 return r.scope==="COURSE"&&s.courseGrants.some(g=>g.active&&g.institution_id===r.institution_id&&g.course_id===r.course_id&&g.role===s.profile);
}
module.exports={allowed};
