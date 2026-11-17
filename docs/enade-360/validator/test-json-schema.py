#!/usr/bin/env python3
"""Positive and negative JSON Schema Draft 2020-12 tests; entirely synthetic."""
import copy, json, pathlib, sys, subprocess
from jsonschema import Draft202012Validator, FormatChecker

HERE=pathlib.Path(__file__).resolve().parent
schema=json.loads((HERE/"report-schema-0.3.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator=Draft202012Validator(schema,format_checker=FormatChecker())
payloads={
"R1":{"inscribed":5,"present":4,"valid":3},
"R2":{"general_formation":{"methodology_id":"SYNTHETIC-METHOD","unit":"points","n":3},"specific_component":{"methodology_id":"SYNTHETIC-METHOD","unit":"points","n":3}},
"R3":{"questionnaire_categories":[{"question_id":"SYN-1","respondents":3,"missing":0,"denominator":3}]},
"R4":{"indicators":[{"indicator":"IDD","methodology_id":"SYN-IDD","source_version":"synthetic","status":"PENDING"}]},
"R5":{"comparisons":[{"class":"C0","justification":"Same synthetic dataset","claimed_comparable":True}]},
"R6":{"interventions":[{"hypothesis":"Synthetic hypothesis","action":"Review","evidence_refs":["SYN"],"limitations":["Synthetic fixture"],"status":"DRAFT"}]},
"R7":{"reconciliations":[]},
}
def fixture(kind="R1"):
 return dict(report_id="SYNTHETIC-001",report_type=kind,schema_version="0.3",
 generated_at="2026-11-16T12:00:00Z",edition_year=2022,academic_degree="bacharelado",
 area_code="SYNTH",area_name="Somente teste",methodology_id="SYNTHETIC-METHOD",
 methodology_url="https://www.gov.br/inep/",engine_version="0.3",
 dataset_hash="0"*64,sample_n=3,denominator=5,
 exclusion_counts={},missing_counts={},comparability_class="C0",
 caveats=["Dado fictício"],generated_by="CI",review_status="PENDING",
 source_documents=[dict(url="https://www.gov.br/inep/",document_title="Fonte fictícia",
 retrieval_date="2026-11-16",file_version="SYNTHETIC",sha256="a"*64)],
 claims=[dict(claim_id="C1",text="Hipótese de teste",epistemic_label="PEDAGOGICAL_HYPOTHESIS",
 validation_status="PENDING",evidence_refs=[])],payload=copy.deepcopy(payloads[kind]))
def check(name,report,expected):
 errors=list(validator.iter_errors(report))
 node=subprocess.run(['node',str(HERE/'integrated-gate.cjs')],input=json.dumps(report,ensure_ascii=False),capture_output=True,text=True)
 if node.returncode: raise RuntimeError('Integrated Node gate failed: '+node.stderr)
 semantic=json.loads(node.stdout)
 result=(not errors) and semantic['ok']
 if result!=expected:
  print("FAIL",name,"expected",expected,"got",result,
        "; ".join(f"{'.'.join(map(str,e.path))}: {e.message}" for e in errors[:2]))
  return False
 print("PASS",name,"combined_schema_and_semantics", "VALID" if result else "REJECTED")
 return True
tests=[]
for k in payloads:tests.append(("positive_"+k,fixture(k),True))
def mutation(name,fn,kind="R1"):
 r=fixture(kind);fn(r);tests.append((name,r,False))
mutation("missing_denominator",lambda x:x.pop("denominator"))
mutation("missing_source",lambda x:x.pop("source_documents"))
mutation("bad_sha",lambda x:x["source_documents"][0].update(sha256="wrong"))
mutation("negative_sample",lambda x:x.update(sample_n=-1))
mutation("invalid_degree",lambda x:x.update(academic_degree="licenciatura"))
mutation("invalid_type",lambda x:x.update(report_type="R8"))
mutation("bad_datetime",lambda x:x.update(generated_at="not-a-date"))
mutation("bad_method_url",lambda x:x.update(methodology_url="not-uri"))
mutation("bad_dataset_hash",lambda x:x.update(dataset_hash="not-sha"))
mutation("bad_claim_label",lambda x:x["claims"][0].update(epistemic_label="CERTAIN"))
mutation("official_without_evidence",lambda x:x["claims"][0].update(epistemic_label="OFFICIAL_FACT"))
mutation("calc_without_formula",lambda x:(x["claims"][0].update(epistemic_label="REPRODUCED_CALCULATION",evidence_refs=["doc"])))
mutation("unsupported_causality",lambda x:x["claims"][0].update(causal=True))
mutation("missing_r7_payload",lambda x:x["payload"].pop("reconciliations"),"R7")
mutation("wrong_r1_payload_type",lambda x:x["payload"].update(present="four"))
mutation("approved_without_reviewer",lambda x:x.update(review_status="APPROVED"))
mutation("approved_r6_without_human",lambda x:(x.update(review_status="APPROVED",reviewed_by="A",reviewed_at="2026-11-16T12:00:00Z"),x["claims"][0].update(validation_status="VALIDATED")),"R6")
mutation("public_person_data",lambda x:x.update(public_output=True,contains_individual_records=True))
mutation("unverified_official_2026",lambda x:x.update(edition_year=2026,official_publication=True))
mutation("bad_comparability_class",lambda x:x.update(comparability_class="C9"))
mutation("bad_missing_counts",lambda x:x.update(missing_counts={"x":-1}))
mutation("validated_hypothesis_no_limits",lambda x:x["claims"][0].update(validation_status="VALIDATED"))
mutation("validated_inference_no_assumptions",lambda x:x["claims"][0].update(epistemic_label="STATISTICAL_INFERENCE",validation_status="VALIDATED"))
mutation("validated_action_without_approval",lambda x:x["claims"][0].update(epistemic_label="ACTION_PROPOSAL",validation_status="VALIDATED"))
mutation("impossible_participation",lambda x:x["payload"].update(inscribed=5,present=7,valid=6))
def r4_state(kind="SC"):
 r=fixture("R4")
 r["edition_year"]=2023
 v=r["payload"]["indicators"][0]
 v.update(indicator="CONCEITO_ENADE",methodology_id="ENADE-CONCEITO-2023-NT6-2024",status=kind,continuous_value=None,band=None)
 v["value_state"]=dict(kind="SC",continuous_value=None,band=None,valid_participants=1,reason="Less than two",methodology_id="ENADE-CONCEITO-2023-NT6-2024") if kind=="SC" else dict(kind=kind)
 return r
tests.append(("positive_SC_documented_r4",r4_state(),True))
r=r4_state();r["payload"]["indicators"][0].pop("value_state");tests.append(("negative_SC_missing_state",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]["continuous_value"]=0;tests.append(("negative_SC_as_zero",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]["valid_participants"]=2;tests.append(("negative_SC_ineligible_count",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]={"kind":"NOT_APPLICABLE","reason":"Out of scope"};tests.append(("negative_NA_without_rule",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]={"kind":"MISSING","missing_reason":"Unknown"};tests.append(("negative_missing_without_source",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]={"kind":"PENDING","pending_dependency":"ZIP"};tests.append(("negative_pending_without_next_verification",r,False))
r=r4_state();r["payload"]["indicators"][0]["value_state"]={"kind":"NOT_PUBLISHED","publication_source":"INEP"};tests.append(("negative_publication_without_check_date",r,False))
passes=sum(check(name,r,expected) for name,r,expected in tests)
print(json.dumps({"schema_draft":"2020-12","tests":len(tests),"passed":passes,"failed":len(tests)-passes,"positive":8,"negative":len(tests)-8},ensure_ascii=False))
sys.exit(0 if passes==len(tests) else 1)
