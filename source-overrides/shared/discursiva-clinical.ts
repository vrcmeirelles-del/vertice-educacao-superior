/** Shared clinical assessment contract. These profiles are authorial preparation, not official exams. */
export type DiscursiveProfile='institutional'|'enamed'|'residencia';
export const CLINICAL_AREAS=['Clínica Médica','Cirurgia Geral','Pediatria','Ginecologia e Obstetrícia','Medicina de Família e Comunidade','Saúde Mental','Saúde Coletiva'] as const;
export const CLINICAL_DIMENSIONS=[
 {key:'clinicalReasoning',label:'Raciocínio clínico',points:3},
 {key:'diagnosticHypotheses',label:'Hipóteses diagnósticas',points:2},
 {key:'investigation',label:'Investigação',points:2},
 {key:'management',label:'Conduta e segurança',points:3},
] as const;
export const PROFILE_LABELS:Record<DiscursiveProfile,string>={institutional:'Institucional',enamed:'ENAMED — preparação autoral',residencia:'Residência Médica — preparação autoral'};
export function clinicalProfile(v:unknown):v is 'enamed'|'residencia'{return v==='enamed'||v==='residencia';}
export function clinicalMetadata(input:Record<string,any>){
 const profile=input.profile??'institutional';
 if(!['institutional','enamed','residencia'].includes(profile))throw Error('invalid_discursive_profile');
 if(!clinicalProfile(profile))return {profile:'institutional' as const};
 if(!CLINICAL_AREAS.includes(input.medicalArea))throw Error('medical_area_required');
 if(typeof input.referenceVersion!=='string'||input.referenceVersion.trim().length<2||input.referenceVersion.length>200)throw Error('reference_version_required');
 if(profile==='residencia'&&(typeof input.residencyProgram!=='string'||input.residencyProgram.trim().length<3||input.residencyProgram.length>300))throw Error('residency_program_required');
 return {profile,medicalArea:input.medicalArea,referenceVersion:input.referenceVersion.trim(),residencyProgram:profile==='residencia'?input.residencyProgram.trim():null,origin:'authorial_preparation'};
}
export function validateClinicalContent(q:Record<string,any>){
 const metadata=clinicalMetadata(q);
 if(!clinicalProfile(metadata.profile))return metadata;
 if(!q.clinicalExpected||!CLINICAL_DIMENSIONS.every(d=>typeof q.clinicalExpected[d.key]==='string'&&q.clinicalExpected[d.key].trim().length>=20&&q.clinicalExpected[d.key].length<=4000))throw Error('four_clinical_answers_required');
 if(!Array.isArray(q.rubric)||q.rubric.length!==4||!CLINICAL_DIMENSIONS.every(d=>q.rubric.filter((r:Record<string,any>)=>r.key===d.key).length===1))throw Error('four_clinical_criteria_required');
 if(q.rubric.some((r:Record<string,any>)=>typeof r.criterion!=='string'||r.criterion.trim().length<20||typeof r.points!=='number'||!Number.isFinite(r.points)||r.points<=0)||Math.abs(q.rubric.reduce((n:number,r:Record<string,any>)=>n+r.points,0)-10)>1e-8)throw Error('invalid_clinical_rubric');
 return metadata;
}
export const CLINICAL_GENERATION=`Esta é preparação autoral, nunca uma questão oficial ou cálculo de nota do exame. Crie um caso clínico fictício, sem identificadores reais, com informações suficientes para discutir hipóteses sem inventar sinais. Use exclusivamente os excertos selecionados e sua versão; se forem insuficientes para fundamentar as quatro dimensões, retorne insufficientSources=true.
O comando deve pedir raciocínio clínico, hipóteses diagnósticas com diferenciais e lacunas, investigação justificada e conduta com segurança, prioridade e limites. Evite exigir procedimentos fora do escopo do cenário.
Além do contrato geral, retorne clinicalExpected:{clinicalReasoning:string,diagnosticHypotheses:string,investigation:string,management:string}, com resposta específica para cada dimensão. A rubric deve conter exatamente quatro critérios, cada um com key (clinicalReasoning, diagnosticHypotheses, investigation, management), criterion (descritor observável ESPECÍFICO deste caso) e points positivo, soma 10. Explique alternativas aceitáveis. Não invente doses, protocolos, exames ou urgência para completar lacunas. Não apresente o caso como atendimento clínico real.`;
export const CLINICAL_GRADING=`Avaliação clínica educacional: respeite o perfil e as quatro dimensões congeladas no snapshot. Compare raciocínio, hipóteses e diferenciais, investigação e conduta com as respostas esperadas específicas; aceite alternativas justificadas pelas fontes do caso. Não premie lista de exames sem indicação nem diagnóstico isolado sem raciocínio. Não invente contraindicações ou erros críticos. Descreva riscos somente quando sustentados pelo caso e pela rubrica; não crie regra de nota zero ou penalidade fora da rubrica. Não atualize retroativamente protocolos ou editais e não converta a nota educacional em resultado oficial. Qualquer dúvida clínica exige revisão docente.`;
