BEGIN;
CREATE SEQUENCE public.vertice_eorbit_enade_id_seq AS bigint;
CREATE TABLE public."vertice_eorbit_cursos" (
"id" bigint NOT NULL,
"nome" text NOT NULL,
"modalidade" text,
"instituicao_id" uuid NOT NULL,
"ativo" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_enade" (
"id" bigint DEFAULT nextval('vertice_eorbit_enade_id_seq'::regclass) NOT NULL,
"semestre" text NOT NULL,
"curso_id" bigint,
"curso_nome" text NOT NULL,
"habilitados" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE public."vertice_eorbit_cursos" ADD CONSTRAINT "vertice_eorbit_cursos_id_instituicao_id_key" UNIQUE (id, instituicao_id);
ALTER TABLE public."vertice_eorbit_cursos" ADD CONSTRAINT "vertice_eorbit_cursos_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_enade" ADD CONSTRAINT "vertice_eorbit_enade_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_enade" ADD CONSTRAINT "vertice_eorbit_enade_semestre_curso_nome_instituicao_id_key" UNIQUE (semestre, curso_nome, instituicao_id);
ALTER TABLE public."vertice_eorbit_enade" ADD CONSTRAINT "vertice_eorbit_enade_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES vertice_eorbit_cursos(id);
ALTER TABLE public."vertice_eorbit_cursos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_cursos" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_cursos" TO service_role;
ALTER TABLE public."vertice_eorbit_enade" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_enade" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_enade" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_enade_id_seq OWNED BY public.vertice_eorbit_enade.id;
COMMIT;