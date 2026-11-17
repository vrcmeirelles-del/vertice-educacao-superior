import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function fixture(t){
 const db=new PGlite();await db.waitReady;t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema vertice_private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 create table vertice_courses(id uuid,institution_id uuid,primary key(id,institution_id));create table vertice_learning_staff_scope(user_id uuid,institution_id uuid,course_id uuid,active boolean);
 create function vertice_private.member_role(uuid) returns text language sql stable as $$select current_setting('test.role',true)$$;
 create table vertice_documents(id uuid,institution_id uuid,course_id uuid,title text,extracted_text text,sha256 text);
 create table vertice_repository_requests(id uuid,institution_id uuid,course_id uuid);
 create table vertice_repository_files(id uuid,institution_id uuid,request_id uuid,file_name text);
 create table vertice_doc_prevalidation(id uuid,institution_id uuid,repository_file_id uuid,extracted_text text,source_sha256 text,extraction_status text,extracted_at timestamptz);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,public to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117171929_discursiva360.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117175935_discursiva_clinical_profiles.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261117183540_discursiva_fo_exchange.sql',import.meta.url),'utf8'));
 await db.query('insert into vertice_courses values($1,$2),($3,$2),($4,$5)',[id(21),id(11),id(22),id(23),id(12)]);
 await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${id(1)}';set "request.jwt.claim.aal"='aal2';set "test.role"='master'`);
 const rpc=async(action,payload={},inst=id(11),course=id(21))=>(await db.query('select public.vertice_discursiva($1,$2,$3,$4) result',[inst,course,action,payload])).rows[0].result;
 return{db,rpc};
}
