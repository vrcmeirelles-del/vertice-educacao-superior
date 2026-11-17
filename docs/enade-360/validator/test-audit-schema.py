#!/usr/bin/env python3
"""Contract 0.4 and integrated semantic regression; all inputs are synthetic."""
import copy,json,pathlib,subprocess
from jsonschema import Draft202012Validator,FormatChecker

HERE=pathlib.Path(__file__).resolve().parent
schema=json.loads((HERE/'report-schema-0.4.json').read_text())
Draft202012Validator.check_schema(schema)
validator=Draft202012Validator(schema,format_checker=FormatChecker())
def fixture(kind):
 code="process.stdout.write(JSON.stringify(require('./test-audit-integrity.cjs').fixture("+json.dumps(kind)+")))"
 return json.loads(subprocess.check_output(['node','-e',code],cwd=HERE,text=True))
def verify(report):
 errors=list(validator.iter_errors(report))
 result=subprocess.run(['node',str(HERE/'integrated-gate.cjs')],input=json.dumps(report),capture_output=True,text=True,check=True)
 semantic=json.loads(result.stdout)
 return not errors and semantic['ok'],[e.message for e in errors]+semantic['errors']
cases=[]
for kind in ['R2','R3','R4','R5','R6']:cases.append(('positive_'+kind,fixture(kind),True))
def bad(name,kind,fn):
 r=fixture(kind);fn(r);cases.append((name,r,False))
bad('D01_unknown_score_field','R2',lambda r:r['payload']['general_formation'].update(score=999))
bad('D02_unit_bananas','R2',lambda r:r['payload']['general_formation'].update(unit='bananas'))
bad('D03_component_n_100000','R2',lambda r:r['payload']['general_formation'].update(n=100000))
bad('D04_unaccounted_population','R3',lambda r:r['payload']['questionnaire_categories'][0].update(respondents=1,missing=0))
bad('D05_unknown_nested_class','R5',lambda r:r['payload']['comparisons'][0].update(**{'class':'C9'}))
bad('D06_C1_without_equivalence','R5',lambda r:(r.update(comparability_class='C1'),r['payload']['comparisons'][0].update(**{'class':'C1'})))
bad('D07_approved_pending_report','R6',lambda r:r['payload']['interventions'][0].update(status='APPROVED',reviewed_by='Someone',reviewed_at='tomorrow',evidence_refs=['MISSING']))
def conflicting(r):
 r['payload']['indicators']=[dict(indicator='IDD',methodology_id='SYN',source_version='v1',status='OFFICIAL',continuous_value=2,band=3,value_state=dict(kind='AVAILABLE',continuous_value=4,band=5,source_version='v2'))]
bad('D08_conflicting_value_state','R4',conflicting)
def official(r):
 r['payload']['indicators']=[dict(indicator='IDD',methodology_id='UNVERIFIED-METHOD',source_id='S1',source_version='v1',result_origin='OFFICIAL_SOURCE',status='OFFICIAL',continuous_value=2,band=3,value_state=dict(kind='AVAILABLE',continuous_value=2,band=3,source_version='v1'))]
bad('D09_official_without_verifier','R4',official)
bad('invalid_generated_datetime','R2',lambda r:r.update(generated_at='tomorrow'))
bad('invalid_method_url','R2',lambda r:r.update(methodology_url='not a URI'))
bad('source_id_missing','R2',lambda r:r['source_documents'][0].pop('source_id'))
bad('source_id_duplicate','R2',lambda r:r['source_documents'].append(copy.deepcopy(r['source_documents'][0])))
bad('out_of_range_raw_value','R2',lambda r:r['payload']['general_formation'].update(value=101))
bad('negative_component_count','R2',lambda r:r['payload']['general_formation'].update(n=-1))
bad('unresolved_claim_source','R2',lambda r:r['claims'][0].update(evidence_refs=['MISSING']))
bad('empty_interventions','R6',lambda r:r['payload'].update(interventions=[]))
bad('unknown_component_metadata','R2',lambda r:r['payload']['specific_component'].update(grade=4))
bad('unknown_indicator_field','R4',lambda r:r['payload']['indicators'][0].update(official_verified=True))
bad('unknown_intervention_field','R6',lambda r:r['payload']['interventions'][0].update(authenticated=True))
r=fixture('R4');r.update(academic_degree=None,area_code=None,course_code=None);r['payload']['indicators'][0]['indicator']='IGC';cases.append(('positive_institution_IGC_pending',r,True))
r=fixture('R3');r['payload']['questionnaire_categories'][0].update(respondents=1,missing=0,excluded=2,not_applicable=2,population_rule_ref='SYN-RULE');cases.append(('positive_explicit_exclusions',r,True))
passed=0
for name,r,expected in cases:
 result,errors=verify(r)
 if result==expected:passed+=1;print('PASS',name)
 else:print('FAIL',name,'expected',expected,'got',result,errors)
print(json.dumps(dict(suite='audit-schema-0.4',tests=len(cases),passed=passed,failed=len(cases)-passed)))
raise SystemExit(0 if passed==len(cases) else 1)
