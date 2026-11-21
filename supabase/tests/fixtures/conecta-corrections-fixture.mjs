import vm from 'node:vm';import ts from 'typescript';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const ids=Array.from({length:25},(_,i)=>'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
const [inst,other,course,otherCourse,actor,coord,student,otherStudent,goal,otherGoal,profile,education,document]=ids;
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA vertice_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.user',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('aal',current_setting('request.aal',true))$$;
CREATE TABLE public.vertice_institutions(id uuid primary key,tier text);
CREATE TABLE public.vertice_courses(id uuid primary key,institution_id uuid,name text);
CREATE TABLE public.vertice_memberships(user_id uuid,institution_id uuid,role text);
CREATE TABLE public.vertice_admins(user_id uuid);
CREATE FUNCTION vertice_private.member_role(inst uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT CASE WHEN auth.jwt()->>'aal'<>'aal2' THEN NULL WHEN EXISTS(SELECT 1 FROM public.vertice_admins WHERE user_id=auth.uid()) THEN 'master' ELSE (SELECT role FROM public.vertice_memberships WHERE institution_id=inst AND user_id=auth.uid()) END $$;
CREATE TABLE public.vertice_learning_staff_scope(user_id uuid,institution_id uuid,course_id uuid,active boolean);
CREATE TABLE public.vertice_student_registry(id uuid primary key,institution_id uuid,course_id uuid,full_name text,enrollment_code text,academic_status text,cpf_hash text,email text);
CREATE TABLE public.vertice_student_sessions(id uuid primary key default gen_random_uuid(),token_id uuid,student_id uuid,institution_id uuid,session_key_hash text,expires_at timestamptz,revoked_at timestamptz);
CREATE TABLE public.vertice_alumni_profiles(id uuid primary key,full_name text,social_name text);
CREATE TABLE public.vertice_alumni_education(id uuid primary key,profile_id uuid,institution_id uuid,course_id uuid,enrollment_id text);
CREATE TABLE public.vertice_goals(id uuid primary key,institution_id uuid,course_id uuid,title text,target numeric,unit text);
CREATE TABLE public.vertice_documents(id uuid primary key,institution_id uuid,course_id uuid,status text);
CREATE TABLE public.vertice_internship_placements(id uuid primary key,institution_id uuid,student_id uuid,lifecycle text,starts_at date,ends_at date);
CREATE TABLE public.vertice_ac_submissions(id uuid primary key,institution_id uuid,student_id uuid,title text,status text);
CREATE TABLE public.vertice_actions(id uuid primary key,institution_id uuid,course_id uuid,goal_id uuid,what text,why text,where_at text,who text,start_date date,due_date date,how text,how_much text,origin_type text,origin_ref uuid,origin_label text,created_by uuid,CHECK(due_date>=start_date));
CREATE TABLE public.vertice_sapiens_planning_analyses(id uuid primary key,institution_id uuid,course_id uuid,scope text,context jsonb);
INSERT INTO public.vertice_institutions VALUES('${inst}','superior'),('${other}','superior');
INSERT INTO public.vertice_courses VALUES('${course}','${inst}','Direito'),('${otherCourse}','${other}','Outro');
INSERT INTO public.vertice_admins VALUES('${actor}');
INSERT INTO public.vertice_memberships VALUES('${coord}','${inst}','coordenador'),('${ids[24]}','${inst}','cpa');
INSERT INTO public.vertice_learning_staff_scope VALUES('${coord}','${inst}','${course}',true);
INSERT INTO public.vertice_student_registry VALUES('${student}','${inst}','${course}','Aluno sintético','A1','active',repeat('c',64),NULL),('${otherStudent}','${other}','${otherCourse}','Aluno outra IES','B1','active',repeat('d',64),NULL);
INSERT INTO public.vertice_goals VALUES('${goal}','${inst}','${course}','Meta de acompanhamento',80,'%'),('${otherGoal}','${other}','${otherCourse}','Outra meta',90,'%');
INSERT INTO public.vertice_alumni_profiles VALUES('${profile}','Egresso sintético',NULL);
INSERT INTO public.vertice_alumni_education VALUES('${education}','${profile}','${inst}','${course}','E1');
INSERT INTO public.vertice_documents VALUES('${document}','${other}','${otherCourse}','approved');
INSERT INTO public.vertice_student_sessions(id,student_id,institution_id,session_key_hash,expires_at,revoked_at) VALUES('${ids[17]}','${student}','${inst}','${'a'.repeat(64)}',now()+interval '1 hour',NULL);
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;GRANT USAGE ON SCHEMA public TO service_role;GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;`);
await db.exec(`
CREATE TABLE public.vertice_student_access_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,student_id uuid,token_hash text UNIQUE,purpose text,expires_at timestamptz,consumed_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.vertice_institution_addresses(institution_id uuid,display_name text,active boolean);
INSERT INTO public.vertice_institution_addresses VALUES('${inst}','IES sintética',true),('${other}','Outra IES',true);
CREATE TABLE public.vertice_internship_organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,name text,trade_name text,identifier text,identifier_type text,address text,city text,state text,contact_name text,contact_email text,contact_phone text,sector text,status text CHECK(status IN ('active','blocked','suspended','inactive')));
CREATE TABLE public.vertice_internship_fields(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,organization_id uuid,name text,location_type text,address text,capacity int,area_of_practice text,status text CHECK(status IN ('active','under_review','approved','blocked','suspended')));
CREATE TABLE public.vertice_extension_partners(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,name text,partner_type text,cnpj_cpf text,contact_name text,contact_email text,contact_phone text,address text,active boolean);
CREATE TABLE public.vertice_extension_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,title text,code text,project_type text,description text,status text,review_status text,start_date date,end_date date,course_ids uuid[]);
CREATE TABLE public.vertice_extension_project_partners(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,partner_id uuid,role_in_project text,contribution text);
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
`);
await db.exec(readFileSync(new URL('../../migrations/20261115213753_conecta_360_native.sql',import.meta.url),'utf8'));
async function auth(user=actor,aal='aal2'){await db.query("select set_config('request.user',$1,false),set_config('request.aal',$2,false)",[user,aal]);}
async function api(action,payload={},institution=inst){return (await db.query('select public.vertice_conecta($1,$2,$3) r',[institution,action,payload])).rows[0].r;}

await db.exec(readFileSync(new URL('../../migrations/20261115230337_conecta_access_72h.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../../migrations/20261115230351_conecta_partner_intake.sql',import.meta.url),'utf8'));

await db.exec(`
ALTER TABLE public.vertice_alumni_profiles ADD COLUMN cpf_hash text;
ALTER TABLE public.vertice_alumni_education ADD COLUMN academic_status text DEFAULT 'formado',ADD COLUMN conclusion_year smallint,ADD COLUMN conclusion_semester smallint,ADD COLUMN graduation_date date;
UPDATE public.vertice_alumni_profiles SET cpf_hash=repeat('c',64) WHERE id='${profile}';
UPDATE public.vertice_alumni_education SET enrollment_id='A1',conclusion_year=extract(year from current_date)::int-1,conclusion_semester=2,graduation_date=current_date-interval '1 year' WHERE id='${education}';
CREATE TABLE public.vertice_alumni_surveys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid,course_id uuid,title text,description text,version smallint DEFAULT 1,wave_type text,custom_months smallint,opens_at timestamptz,closes_at timestamptz,status text,target_audience text,responsible_id uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.vertice_alumni_survey_questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),survey_id uuid REFERENCES public.vertice_alumni_surveys(id),sort_order smallint,question_text text,question_type text,options jsonb,required boolean,indicator_key text);
CREATE TABLE public.vertice_alumni_survey_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),survey_id uuid REFERENCES public.vertice_alumni_surveys(id),profile_id uuid,education_id uuid,status text,device text,completed_at timestamptz,updated_at timestamptz DEFAULT now(),UNIQUE(survey_id,profile_id));
CREATE TABLE public.vertice_alumni_survey_answers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),response_id uuid REFERENCES public.vertice_alumni_survey_responses(id),question_id uuid REFERENCES public.vertice_alumni_survey_questions(id),answer_value text,previous_value text,corrected_at timestamptz,UNIQUE(response_id,question_id));
CREATE TABLE public.vertice_alumni_survey_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),survey_id uuid,profile_id uuid,delivery_status text);
CREATE TABLE public.vertice_alumni_employment(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid,education_id uuid,employment_status text CHECK(employment_status IN ('empregado_clt','servidor_publico','autonomo','empresario','estagiario','desempregado','nao_informado')),employment_type text,field_relation text,related_to_degree boolean,seeking_work boolean,source text,reference_date date);
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
`);
await db.exec(readFileSync(new URL('../../migrations/20261115232606_conecta_longitudinal_surveys.sql',import.meta.url),'utf8'));
const hash=c=>c.repeat(64);
async function admin(action,payload={},institution=inst){return (await db.query('select public.vertice_conecta_longitudinal($1,$2,$3) r',[institution,action,payload])).rows[0].r;}
async function own(action,payload={},session=hash('b')){await db.exec('SET ROLE service_role');try{return (await db.query('select public.vertice_conecta_surveys_student($1,$2,$3) r',[session,action,payload])).rows[0].r;}finally{await db.exec('RESET ROLE');}}
const surveyId='40000000-0000-4000-8000-000000000001',futureSurvey='40000000-0000-4000-8000-000000000002',wrongSurvey='40000000-0000-4000-8000-000000000003';
let canonical,donor,link;
const campaign=()=>({request_id:surveyId,title:'Acompanhamento da turma',course_id:course,conclusion_year:new Date().getUTCFullYear()-1,conclusion_semester:2,followup_months:6,opens_at:new Date(Date.now()-86400000).toISOString(),closes_at:new Date(Date.now()+7*86400000).toISOString(),target_audience:'egressos'});

const schema=JSON.parse(readFileSync(new URL('./conecta-alumni-schema.json',import.meta.url),'utf8'));
await db.exec("update public.vertice_student_registry set email='synthetic@example.test' where email is null");
for(const col of schema.columns){
 const present=(await db.query('select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3',['public',col.table_name,col.column_name])).rows.length;
 if(!present)await db.exec(`ALTER TABLE public.${col.table_name} ADD COLUMN ${col.column_name} ${col.data_type}${col.column_default?' DEFAULT '+col.column_default:''}`);
 if(col.column_default)await db.exec(`ALTER TABLE public.${col.table_name} ALTER COLUMN ${col.column_name} SET DEFAULT ${col.column_default}`);
 if(col.is_nullable==='NO')await db.exec(`ALTER TABLE public.${col.table_name} ALTER COLUMN ${col.column_name} SET NOT NULL`);
}
for(const k of schema.constraints){if(k.regra.startsWith('PRIMARY KEY'))continue;
 if(!(await db.query('select 1 from pg_constraint where conrelid=$1::regclass and conname=$2',['public.'+k.tabela,k.conname])).rows.length)await db.exec(`ALTER TABLE public.${k.tabela} ADD CONSTRAINT ${k.conname} ${k.regra}`);
}
await db.exec(`ALTER TABLE public.vertice_courses ADD COLUMN modality text;
CREATE TABLE public.vertice_alumni_further_ed(id uuid primary key default gen_random_uuid(),profile_id uuid,status text);
GRANT USAGE ON SCHEMA vertice_private TO authenticated,service_role;
GRANT SELECT ON public.vertice_admins,public.vertice_memberships TO authenticated;
`);
for(const table of ['vertice_alumni_profiles','vertice_alumni_education','vertice_alumni_employment','vertice_alumni_surveys','vertice_alumni_survey_questions','vertice_alumni_survey_invitations','vertice_alumni_survey_responses','vertice_alumni_survey_answers']){
 await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated;ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;CREATE POLICY legacy_permissive ON public.${table} FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
}
const uid=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.query("insert into public.vertice_alumni_profiles(id,full_name,email) values($1,'Egresso Teste 1','teste1@example.com')",[uid(900)]);
await db.query("insert into public.vertice_alumni_education(id,profile_id,institution_id,enrollment_id,academic_status,conclusion_year,conclusion_semester)values($1,$2,$3,'TST00001','formado',2024,2)",[uid(901),uid(900),inst]);
await db.query("insert into public.vertice_alumni_surveys(id,institution_id,title,status)values($1,$2,'[TESTE] Pesquisa Inicial de Egressos','ativa')",[uid(902),inst]);
await db.query("insert into public.vertice_alumni_survey_responses(survey_id,profile_id,education_id,status)values($1,$2,$3,'concluida')",[uid(902),uid(900),uid(901)]);
await db.exec(readFileSync(new URL('../../migrations/20261115234418_conecta_academic_course_name.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../../migrations/20261116072903_conecta_homologation_corrections.sql',import.meta.url),'utf8'));
export {db,auth,api,admin,own,ids,inst,other,course,otherCourse,actor,coord,student,profile,education,hash,uid,campaign,surveyId};
