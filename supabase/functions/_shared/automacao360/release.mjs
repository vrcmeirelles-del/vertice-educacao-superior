import {RULES} from './catalog.mjs';
import {UNMAPPED} from './native-integration.mjs';
export const RELEASE_VERSION='1.0-rc.1';
export const GATES=Object.freeze(['native_adapter','rls','transaction','ui_build','shadow_comparison','cost_budget','rollback_drill','human_review']);
const same=(a,b)=>a?.institutionId===b?.institutionId&&a?.courseId===b?.courseId;
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
// Inputs are trusted server records, not browser claims. Pure assessment: no activation command.
export function assessRelease({scope,actor,ruleId,evidence,asOf}){
 if(!uuid(scope?.institutionId)||!(scope.courseId===null||uuid(scope.courseId))||!same(scope,actor)||!uuid(actor.id)||actor.mfa!==true||!Array.isArray(actor.permissions)||!actor.permissions.includes('automation.release.review'))throw Error('access_denied');
 const rule=RULES.find(r=>r.id===ruleId);if(!rule||!instant(asOf))throw Error('invalid_rule_or_clock');
 const blockers=[];
 if(UNMAPPED.includes(ruleId))blockers.push('unmapped_rule');
 if(!same(scope,evidence)||evidence?.ruleId!==ruleId||evidence?.ruleVersion!==rule.version)blockers.push('invalid_evidence_scope_or_version');
 if(!uuid(evidence?.authorId)||evidence.authorId===actor.id)blockers.push('independent_review_required');
 if(!instant(evidence?.observedAt)||Date.parse(evidence.observedAt)>Date.parse(asOf)||Date.parse(asOf)-Date.parse(evidence.observedAt)>7*86400000)blockers.push('evidence_stale_or_invalid');
 for(const gate of GATES){const g=evidence?.gates?.[gate];if(g?.passed!==true||typeof g.ref!=='string'||!g.ref.trim())blockers.push(gate);}
 if(!['no_overlap','reuse_existing'].includes(evidence?.schedulerReconciliation))blockers.push('scheduler_overlap_unresolved');
 if(evidence?.schedulerReconciliation==='reuse_existing'&&(!Array.isArray(evidence.existingJobs)||!evidence.existingJobs.length||evidence.existingJobs.some(j=>typeof j!=='string'||!j.trim())))blockers.push('existing_job_reference_missing');
 if(!Number.isFinite(evidence?.budgetLimit)||evidence.budgetLimit<=0||!Number.isFinite(evidence?.measuredCost)||evidence.measuredCost<0||evidence.measuredCost>evidence.budgetLimit||typeof evidence?.costUnit!=='string'||!evidence.costUnit.trim())blockers.push('budget_unverified_or_exceeded');
 return {version:RELEASE_VERSION,ruleId,ruleVersion:rule.version,scope:{...scope},status:blockers.length?'blocked':'eligible_for_authorization',blockers,activationPerformed:false};
}
export function inventory(){return RULES.map(r=>({id:r.id,module:r.module,version:r.version,cadence:r.cadence,adapterMapped:!UNMAPPED.includes(r.id),operationalState:'unverified'}));}
