"use strict";
/**
 * ENADE 360: isolated edition policy and classification controls.
 * No official individual-score recalculation. Rules for 2022 and 2023 are
 * restricted to explicitly verified selection/SC and 2023 concept bands.
 * Source: NT 2/2023 and NT 6/2024, Inep. Never silently assume another year.
 */
const POLICIES=Object.freeze({
  2022:Object.freeze({id:"ENADE-CONCEITO-2022-NT2-2023",year:2022,minValid:2,
   selection:{TP_INSCRICAO:1,IN_REGULAR:1,TP_INSCRICAO_ADM:[0,2],TP_PRES:555},
   exclusionPresence:[333,334,556,887,888],conceptBands:null,
   reference:"https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2023/nota_tecnica_n_2_2023_cei_cggi_daes_descricao_da_metodologia_de_calculo_do_conceito_enade.pdf"}),
  2023:Object.freeze({id:"ENADE-CONCEITO-2023-NT6-2024",year:2023,minValid:2,
   selection:{TP_INSCRICAO:1,IN_REGULAR:1,TP_INSCRICAO_ADM:[0,2],TP_PRES:555},
   exclusionPresence:[333,334,556,887,888],
   conceptBands:["0","0.945","1.945","2.945","3.945","5"],
   reference:"https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2024/nota_tecnica_6_metodologia_calculo_conceito_enade_2023.pdf"})
});
function policy(year,declaredId){const p=POLICIES[year];if(!p)return {status:"POLICY_UNVERIFIED",reason:"Edition not verified"};if(declaredId!==p.id)return {status:"METHODOLOGY_MISMATCH",expected:p.id,received:declaredId};return {status:"MATCH",policy:p};}
function code(v){if(v===null||v===undefined||v==="")return NaN;return Number(v);}
function select(rows,year,id){
 const p=policy(year,id);if(p.status!=="MATCH")return {status:p.status,reasons:{},valid:[],policy:p};
 if(!Array.isArray(rows))return {status:"INVALID_INPUT",reasons:{},valid:[]};
 const valid=[],reasons={};
 for(const r of rows){
  let reason=null;
  if(!r||typeof r!=="object")reason="MISSING_RECORD";
  else if(![r.TP_INSCRICAO,r.IN_REGULAR,r.TP_INSCRICAO_ADM,r.TP_PRES].every(v=>v!==undefined&&v!==null&&v!==""))reason="MISSING_REQUIRED_FIELD";
  else if(code(r.TP_INSCRICAO)!==1)reason="NOT_CONCLUDING";
  else if(code(r.IN_REGULAR)!==1)reason="NOT_REGULAR";
  else if(![0,2].includes(code(r.TP_INSCRICAO_ADM)))reason="INVALID_ADMIN_MODE";
  else if(code(r.TP_PRES)!==555)reason="INVALID_PRESENCE";
  if(reason)reasons[reason]=(reasons[reason]||0)+1;else valid.push(r);
 }
 return {status:"FILTERED",valid,reasons,eligibleCourse:valid.length>=p.policy.minValid,
   indicatorStatus:valid.length>=p.policy.minValid?"ELIGIBLE_PENDING_CALCULATION":"SC",
   note:"Eligibility evaluated for supplied single-course records only. No computed concept."};
}
function decimal(v){
 const s=typeof v==="number"?String(v):v;
 if(typeof s!=="string"||!/^(0|[1-9]\d*)(\.\d+)?$/.test(s))throw Error("DECIMAL_NONNEGATIVE_REQUIRED");
 const [a,b=""]=s.split(".");
 return {num:BigInt(a+b),scale:b.length};
}
function scaled(v,places){
 const d=decimal(v); if(d.scale<=places)return d.num*10n**BigInt(places-d.scale);
 return null;
}
function cmp(a,b){const x=decimal(a),y=decimal(b);const p=Math.max(x.scale,y.scale);const X=x.num*10n**BigInt(p-x.scale),Y=y.num*10n**BigInt(p-y.scale);return X<Y?-1:X>Y?1:0;}
function roundDisplay(value,digits){
 if(!Number.isInteger(digits)||digits<0||digits>8)throw Error("INVALID_DIGITS");
 const d=decimal(value);if(d.scale<=digits)return (d.num*10n**BigInt(digits-d.scale)).toString();
 const drop=d.scale-digits, divisor=10n**BigInt(drop);
 const q=d.num/divisor,rem=d.num%divisor;
 return (q+(2n*rem>=divisor?1n:0n)).toString();
}
function conceptBand(value,year,id){
 const p=policy(year,id);if(p.status!=="MATCH")return {status:p.status};
 if(!p.policy.conceptBands)return {status:"BAND_UNVERIFIED"};
 try{if(cmp(value,"5")>0)return {status:"OUT_OF_RANGE"};const cuts=p.policy.conceptBands;
  for(let i=1;i<5;i++)if(cmp(value,cuts[i])<0)return {status:"BAND",band:i};
  return {status:"BAND",band:5};
 }catch(_){return {status:"INVALID_SCORE"}}
}
function classifyDifference({official,computed,methodologyExpected,methodologyActual,rounding}){
 if(!methodologyExpected||!methodologyActual)return {category:"METHODOLOGY_UNVERIFIED",action:"BLOCK"};
 if(methodologyExpected!==methodologyActual)return {category:"METHODOLOGY_DIFFERENCE",action:"BLOCK",expected:methodologyExpected,actual:methodologyActual};
 try{
  if(cmp(official,computed)===0)return {category:"EXACT_MATCH",action:"ACCEPT"};
  if(rounding?.mode==="DISPLAY"&&rounding.approved===true&&rounding.justification&&Number.isInteger(rounding.digits)&&rounding.digits>=0&&rounding.digits<=8){
   if(roundDisplay(official,rounding.digits)===roundDisplay(computed,rounding.digits))
    return {category:"DISPLAY_ROUNDING_DIFFERENCE",action:"REVIEW",digits:rounding.digits,justification:rounding.justification};
  }
  return {category:"CALCULATION_DIVERGENCE",action:"INVESTIGATE",official,computed};
 }catch(_){return {category:"INVALID_VALUES",action:"BLOCK"}}
}
function classifyClaim(claim){
 if(!claim||typeof claim!=="object")return {category:"INVALID_CLAIM",action:"BLOCK"};
 if(claim.epistemic_label==="PEDAGOGICAL_HYPOTHESIS"){
  if(!Array.isArray(claim.assumptions)||!claim.assumptions.length||!Array.isArray(claim.limitations)||!claim.limitations.length)
   return {category:"HYPOTHESIS_INCOMPLETE",action:"BLOCK"};
  return {category:"PEDAGOGICAL_HYPOTHESIS",action:"HUMAN_REVIEW_REQUIRED"};
 }
 return {category:"NOT_PEDAGOGICAL_HYPOTHESIS",action:"NO_PEDAGOGICAL_CONCLUSION"};
}
module.exports={POLICIES,policy,select,conceptBand,roundDisplay,classifyDifference,classifyClaim};
