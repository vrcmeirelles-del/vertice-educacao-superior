import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE SCHEMA auth;CREATE SCHEMA vertice_app;CREATE SCHEMA vertice_private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 CREATE FUNCTION vertice_private.member_role(uuid) RETURNS text LANGUAGE sql STABLE
 AS $$SELECT current_setting('test.role',true)$$;
 CREATE TABLE public.vertice_courses(id uuid,institution_id uuid,PRIMARY KEY(id,institution_id));
 CREATE TABLE public.vertice_learning_staff_scope(user_id uuid,institution_id uuid,course_id uuid,subject_code text,active boolean);
 CREATE TABLE vertice_app.curriculum_builds(id uuid PRIMARY KEY,institution_id uuid,course_id uuid,status text);
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated;`);
 await db.query('INSERT INTO auth.users(id) VALUES($1),($2),($3)',[id(1),id(2),id(3)]);
 await db.query('INSERT INTO public.vertice_courses(id,institution_id) VALUES($1,$2),($3,$2),($4,$5)',[id(21),id(11),id(22),id(31),id(12)]);
 await db.query('INSERT INTO public.vertice_learning_staff_scope VALUES($1,$2,$3,$4,$5)',[id(1),id(11),id(21),'civil',true]);
 const sql=await readFile(new URL('../../../docs/avalia360/sql/RASCUNHOS_RPC_STAGING_V1.sql',import.meta.url),'utf8');
 await db.exec(sql);
 async function session(user=id(1),institutionRole='equipe',aal='aal2'){
   await db.exec(`RESET ROLE;SET ROLE authenticated;
   SET "request.jwt.claim.sub"='${user}';
   SET "request.jwt.claim.aal"='${aal}';
   SET "test.role"='${institutionRole}'`);
 }
 await session();
 const rpc=async(action,payload={},course=id(21),inst=id(11),discipline='civil')=>{
   const r=await db.query('SELECT public.vertice_avalia_draft($1,$2,$3,$4,$5) result',
     [inst,course,discipline,action,payload]);return r.rows[0].result;
 };
 const q={id:'q-1',disciplineId:'civil',statement:'Analise o seguinte caso de responsabilidade civil.',
   topicIds:['tema1'],competencyIds:['c1'],pendingImageCount:0,points:2,
   kind:'objetiva',options:[{id:'A',text:'A'},{id:'B',text:'B'}],correctOptionId:'A'};
 return {db,session,rpc,question:q};
}
