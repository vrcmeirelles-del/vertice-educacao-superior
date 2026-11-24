-- Estruturas mínimas na forma de produção (information_schema e pg_constraint lidos em 24/11/2026).
-- Somente colunas e restrições usadas pela Automação 360°. Dados 100% sintéticos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth; CREATE SCHEMA vertice_private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.role',true),'')$$;

CREATE TABLE public.vertice_institutions(id uuid PRIMARY KEY, name text NOT NULL, tier text DEFAULT 'superior');
CREATE TABLE public.vertice_courses(id uuid PRIMARY KEY, institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE, name text NOT NULL, code text);
CREATE UNIQUE INDEX vertice_courses_scope_key ON public.vertice_courses(id, institution_id);
CREATE TABLE public.vertice_admins(user_id uuid PRIMARY KEY);
CREATE TABLE public.vertice_memberships(user_id uuid NOT NULL, institution_id uuid NOT NULL, role text NOT NULL);
CREATE TABLE public.vertice_course_staff_functions(institution_id uuid NOT NULL, course_id uuid NOT NULL, user_id uuid NOT NULL, course_role text NOT NULL CHECK (course_role IN ('coordenador','nde')), active boolean NOT NULL DEFAULT true, PRIMARY KEY(institution_id,course_id,user_id,course_role));

-- Funções nativas copiadas literalmente de produção (pg_get_functiondef, 24/11/2026).
CREATE OR REPLACE FUNCTION vertice_private.is_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (
      select 1 from public.vertice_admins where user_id = (select auth.uid())
    );
$function$;
CREATE OR REPLACE FUNCTION vertice_private.member_role(target uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 select case
  when not coalesce((select auth.jwt()->>'aal') = 'aal2', false) then null
  when vertice_private.is_master() then 'master'
  else (select m.role from public.vertice_memberships m
        where m.user_id = (select auth.uid()) and m.institution_id = target)
 end;
$function$;

CREATE TABLE public.vertice_goals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL, course_id uuid, title text NOT NULL, indicator text NOT NULL DEFAULT 'ind', target numeric NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('planejada','ativa','concluida','cancelada')));
CREATE TABLE public.vertice_actions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL, course_id uuid, goal_id uuid REFERENCES public.vertice_goals(id) ON DELETE SET NULL,
  what text NOT NULL CHECK (length(what) BETWEEN 1 AND 500), why text CHECK (why IS NULL OR length(why) <= 2000), where_at text, who text, how text, how_much text,
  start_date date, due_date date, status text NOT NULL DEFAULT 'nao_iniciada' CHECK (status IN ('nao_iniciada','em_andamento','concluida','bloqueada','cancelada')),
  progress integer NOT NULL DEFAULT 0, responsible_user_id uuid, created_by uuid, origin_type text, origin_ref uuid, origin_label text,
  CONSTRAINT vertice_actions_origin_type_check CHECK (origin_type = ANY (ARRAY['nde','colegiado','coordenacao','cpa','bi_academico','egressos','inclusao','acompanhamento_especial','comply','auditoria','demanda_institucional','manual'])));
CREATE TABLE public.vertice_action_governance(action_id uuid PRIMARY KEY REFERENCES public.vertice_actions(id) ON DELETE CASCADE, institution_id uuid NOT NULL,
  review_status text NOT NULL DEFAULT 'rascunho' CHECK (review_status IN ('rascunho','enviado','aprovado','devolvido')));

CREATE TABLE public.vertice_repository_requests(id uuid PRIMARY KEY, institution_id uuid NOT NULL, course_id uuid, title text, due_date date, active boolean DEFAULT true, not_applicable boolean DEFAULT false, updated_at timestamptz DEFAULT now());
CREATE TABLE public.vertice_repository_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid NOT NULL, request_id uuid NOT NULL, status text NOT NULL, file_name text);

CREATE TABLE public.vertice_cpa_findings(id uuid PRIMARY KEY, institution_id uuid NOT NULL, course_id uuid, title text);
CREATE TABLE public.vertice_cpa_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), finding_id uuid, institution_id uuid NOT NULL, title text, status text, due_date date, evidence_description text, evidence_url text);

CREATE TABLE public.vertice_module_catalog(code text PRIMARY KEY, name text, tier text, package text, description text, tabs text[], depends_on text[], display_order smallint, active boolean);

GRANT USAGE ON SCHEMA public, auth, vertice_private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt(), auth.role() TO authenticated, service_role;
