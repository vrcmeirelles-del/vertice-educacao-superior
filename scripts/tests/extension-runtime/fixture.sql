create role anon; create role authenticated;
create schema auth; create schema storage; create schema vertice_private;
grant usage on schema auth,vertice_private,public to authenticated;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.vertice_institutions(id uuid primary key,name text);
create table public.vertice_courses(id uuid primary key,institution_id uuid,name text);
create table public.vertice_memberships(user_id uuid,institution_id uuid,role text);
create function vertice_private.can_read_institution(i uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.vertice_memberships where user_id=auth.uid() and institution_id=i)$$;
create function vertice_private.has_role(i uuid,r text[]) returns boolean language sql stable security definer as $$select current_setting('request.jwt.claim.aal',true)='aal2' and exists(select 1 from public.vertice_memberships where user_id=auth.uid() and institution_id=i and role=any(r))$$;
create table public.vertice_doc_categories(code text primary key,label text,tier text,linked_module text,linked_tab text,sort_order int);
create table public.vertice_extension_projects(id uuid primary key,institution_id uuid,title text,course_ids uuid[],coordinator_name text,coordinator_email text,status text,review_status text,completed_at timestamptz,evidence_pdf_path text,semester text,description text,social_problem text,general_objective text,methodology text,target_community text,updated_at timestamptz,total_hours numeric,budget_estimated numeric,budget_executed numeric,start_date date,end_date date);
create table public.vertice_documents(id uuid primary key default gen_random_uuid(),institution_id uuid,category_code text references public.vertice_doc_categories(code),title text,description text,storage_path text,file_name text,file_size bigint,mime_type text,sha256 text,course_id uuid,tags text[],linked_module text,linked_entity_type text,linked_entity_id uuid,uploaded_by uuid,ai_status text);
create table public.vertice_extension_deliverables(id uuid default gen_random_uuid(),institution_id uuid,project_id uuid,title text,deliverable_type text,document_id uuid,delivered_at date);
create table storage.objects(bucket_id text,name text,metadata jsonb,owner_id text,id uuid default gen_random_uuid());

create table public.vertice_repository_requests(id uuid primary key default gen_random_uuid(),institution_id uuid,course_id uuid,title text,document_code text,semester text,instructions text,assigned_to uuid,created_by uuid,repository_section text);
create table public.vertice_repository_files(id uuid primary key default gen_random_uuid(),institution_id uuid,request_id uuid,storage_path text,file_name text,size_bytes bigint,mime_type text,uploaded_by uuid,status text,document_category text,upload_note text);

create table public.vertice_admins(user_id uuid);
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('role','authenticated')$$;
alter table public.vertice_repository_files add column uploaded_email text,add column created_at timestamptz,add column reviewed_by uuid,add column reviewed_at timestamptz,add column review_note text;
