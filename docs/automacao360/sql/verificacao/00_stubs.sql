-- Stubs mínimos, copiados da forma de supabase/migrations/202610260001_access_foundation.sql.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.vertice_institutions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 250),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vertice_courses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 250),
 code text,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.vertice_institutions(id,name) VALUES
 ('00000000-0000-4000-8000-0000000000a1','IES A'),('00000000-0000-4000-8000-0000000000b1','IES B');
INSERT INTO public.vertice_courses(id,institution_id,name) VALUES
 ('00000000-0000-4000-8000-0000000000a2','00000000-0000-4000-8000-0000000000a1','Direito A'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000b1','Direito B');
