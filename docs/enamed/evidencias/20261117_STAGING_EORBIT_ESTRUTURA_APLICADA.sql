BEGIN;
CREATE SEQUENCE public.vertice_eorbit_quantitativo_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_turmas_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_alunos_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_professores_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_diario_classe_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_compliance_plano_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_compliance_plano_detalhe_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_compliance_notas_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_compliance_notas_detalhe_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_enade_habilitados_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_vestibular_editais_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_vestibular_cursos_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_biblioteca_resumo_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_biblioteca_area_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_frequencia_conteudo_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_cursos_normalizados_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_biblioteca_cdd_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE SEQUENCE public.vertice_eorbit_biblioteca_decada_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
CREATE TABLE public."vertice_eorbit_alunos" (
"id" bigint DEFAULT nextval('vertice_eorbit_alunos_id_seq'::regclass) NOT NULL,
"semestre_id" bigint NOT NULL,
"curso_id" bigint NOT NULL,
"turma_nome" text,
"nome_aluno" text NOT NULL,
"matricula" text,
"situacao" text,
"periodo" text,
"instituicao_id" uuid NOT NULL,
"data_extracao" date,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_biblioteca_area" (
"id" bigint DEFAULT nextval('vertice_eorbit_biblioteca_area_id_seq'::regclass) NOT NULL,
"area_cdd" text NOT NULL,
"titulos" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_biblioteca_cdd" (
"id" bigint DEFAULT nextval('vertice_eorbit_biblioteca_cdd_id_seq'::regclass) NOT NULL,
"area_cdd" text NOT NULL,
"quantidade" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_biblioteca_decada" (
"id" bigint DEFAULT nextval('vertice_eorbit_biblioteca_decada_id_seq'::regclass) NOT NULL,
"decada" text NOT NULL,
"quantidade" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_biblioteca_resumo" (
"id" bigint DEFAULT nextval('vertice_eorbit_biblioteca_resumo_id_seq'::regclass) NOT NULL,
"total_titulos" integer DEFAULT 0,
"total_exemplares" integer DEFAULT 0,
"media_exemplares_por_titulo" numeric(5,2) DEFAULT 0,
"total_autores_distintos" integer DEFAULT 0,
"periodo_publicacao" text,
"data_extracao" date,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_compliance_notas" (
"id" bigint DEFAULT nextval('vertice_eorbit_compliance_notas_id_seq'::regclass) NOT NULL,
"semestre_id" integer NOT NULL,
"semestre" text NOT NULL,
"curso_id" integer NOT NULL,
"curso" text NOT NULL,
"total_disciplinas" integer DEFAULT 0,
"notas_postadas" integer DEFAULT 0,
"notas_nao_postadas" integer DEFAULT 0,
"notas_nao_cadastrado" integer DEFAULT 0,
"percentual_conformidade" numeric(5,2) DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_compliance_notas_detalhe" (
"id" bigint DEFAULT nextval('vertice_eorbit_compliance_notas_detalhe_id_seq'::regclass) NOT NULL,
"semestre_id" integer NOT NULL,
"curso_id" integer NOT NULL,
"professor_id" integer NOT NULL,
"disciplina_codigo" integer NOT NULL,
"disciplina_nome" text NOT NULL,
"status_notas" text,
"professor_nome" text NOT NULL,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_compliance_plano" (
"id" bigint DEFAULT nextval('vertice_eorbit_compliance_plano_id_seq'::regclass) NOT NULL,
"semestre_id" integer NOT NULL,
"semestre" text NOT NULL,
"curso_id" integer NOT NULL,
"curso" text NOT NULL,
"total_disciplinas" integer DEFAULT 0,
"plano_postado" integer DEFAULT 0,
"plano_enviado" integer DEFAULT 0,
"plano_nao_enviado" integer DEFAULT 0,
"percentual_conformidade" numeric(5,2) DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_compliance_plano_detalhe" (
"id" bigint DEFAULT nextval('vertice_eorbit_compliance_plano_detalhe_id_seq'::regclass) NOT NULL,
"semestre_id" integer NOT NULL,
"curso_id" integer NOT NULL,
"professor_id" integer NOT NULL,
"disciplina_codigo" integer NOT NULL,
"disciplina_nome" text NOT NULL,
"status_plano" text,
"professor_nome" text NOT NULL,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_cursos_normalizados" (
"id" bigint DEFAULT nextval('vertice_eorbit_cursos_normalizados_id_seq'::regclass) NOT NULL,
"seq" integer,
"curso_canonico" text NOT NULL,
"id_canonico" text NOT NULL,
"modalidade" text,
"status" text DEFAULT 'ativo'::text,
"ids_portal" jsonb DEFAULT '[]'::jsonb,
"ids_duplicados" jsonb DEFAULT '[]'::jsonb,
"observacao" text,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_diario_classe" (
"id" bigint DEFAULT nextval('vertice_eorbit_diario_classe_id_seq'::regclass) NOT NULL,
"semestre_id" integer NOT NULL,
"semestre" text NOT NULL,
"curso_id" integer NOT NULL,
"curso" text NOT NULL,
"professor_id" integer NOT NULL,
"professor_nome" text NOT NULL,
"disciplina_codigo" integer NOT NULL,
"periodo_turma" text,
"disciplina_nome" text NOT NULL,
"status_plano" character(1),
"status_notas" character(1),
"status_conteudo" character(1),
"status_cadastro" character(1),
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_direito_raio_x" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"institution_id" uuid DEFAULT 'cda828bd-4f55-432a-a824-387716c3cb2b'::uuid,
"tipo" text NOT NULL,
"semestre" text,
"dados" jsonb NOT NULL,
"data_extracao" date DEFAULT CURRENT_DATE,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_enade_habilitados" (
"id" bigint DEFAULT nextval('vertice_eorbit_enade_habilitados_id_seq'::regclass) NOT NULL,
"semestre" text NOT NULL,
"curso" text NOT NULL,
"curso_id" text NOT NULL,
"habilitados" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_frequencia_conteudo" (
"id" bigint DEFAULT nextval('vertice_eorbit_frequencia_conteudo_id_seq'::regclass) NOT NULL,
"semestre" text NOT NULL,
"curso_nome" text NOT NULL,
"professor_nome" text NOT NULL,
"disciplina_codigo" text NOT NULL,
"disciplina_nome" text NOT NULL,
"periodo_turma" text,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_grades" (
"id" bigint NOT NULL,
"curso_id" bigint NOT NULL,
"versao" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_institution_map" (
"eorbit_instituicao_id" uuid NOT NULL,
"institution_id" uuid NOT NULL,
"mapped_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."vertice_eorbit_professores" (
"id" bigint DEFAULT nextval('vertice_eorbit_professores_id_seq'::regclass) NOT NULL,
"professor_id" integer NOT NULL,
"nome" text NOT NULL,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_quantitativo" (
"id" bigint DEFAULT nextval('vertice_eorbit_quantitativo_id_seq'::regclass) NOT NULL,
"semestre_id" bigint NOT NULL,
"curso_id" bigint NOT NULL,
"grade_id" bigint,
"total_vinculos" integer DEFAULT 0,
"total_matriculados" integer DEFAULT 0,
"total_turmas" integer DEFAULT 0,
"data_extracao" date,
"fonte" text DEFAULT 'eorbit_manual'::text,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"pre_matriculado" integer DEFAULT 0,
"transferido" integer DEFAULT 0,
"trancado" integer DEFAULT 0,
"abandono" integer DEFAULT 0,
"concluido" integer DEFAULT 0,
"graduado" integer DEFAULT 0,
"cancelado" integer DEFAULT 0,
"troca_curso" integer DEFAULT 0,
"falecido" integer DEFAULT 0,
"troca_de_curso" integer DEFAULT 0
);
CREATE TABLE public."vertice_eorbit_semestres" (
"id" bigint NOT NULL,
"semestre" text NOT NULL,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_turmas" (
"id" bigint DEFAULT nextval('vertice_eorbit_turmas_id_seq'::regclass) NOT NULL,
"quantitativo_id" bigint NOT NULL,
"turma_nome" text NOT NULL,
"matriculados" integer DEFAULT 0,
"total_vinculos" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_vestibular_cursos" (
"id" bigint DEFAULT nextval('vertice_eorbit_vestibular_cursos_id_seq'::regclass) NOT NULL,
"edital_id" text NOT NULL,
"curso" text NOT NULL,
"vagas" integer DEFAULT 0,
"inscritos" integer DEFAULT 0,
"concorrencia" numeric(6,4) DEFAULT 0,
"aprovados" integer DEFAULT 0,
"reprovados" integer DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE public."vertice_eorbit_vestibular_editais" (
"id" bigint DEFAULT nextval('vertice_eorbit_vestibular_editais_id_seq'::regclass) NOT NULL,
"edital_id" text NOT NULL,
"edital_nome" text NOT NULL,
"total_cursos" integer DEFAULT 0,
"total_vagas" integer DEFAULT 0,
"total_inscritos" integer DEFAULT 0,
"total_aprovados" integer DEFAULT 0,
"total_reprovados" integer DEFAULT 0,
"concorrencia_media" numeric(6,4) DEFAULT 0,
"instituicao_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE public."vertice_eorbit_alunos" ADD CONSTRAINT "vertice_eorbit_alunos_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_alunos" ADD CONSTRAINT "vertice_eorbit_alunos_unique" UNIQUE (matricula, semestre_id, curso_id, turma_nome, instituicao_id);
ALTER TABLE public."vertice_eorbit_biblioteca_area" ADD CONSTRAINT "vertice_eorbit_biblioteca_area_area_cdd_instituicao_id_key" UNIQUE (area_cdd, instituicao_id);
ALTER TABLE public."vertice_eorbit_biblioteca_area" ADD CONSTRAINT "vertice_eorbit_biblioteca_area_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_biblioteca_cdd" ADD CONSTRAINT "vertice_eorbit_biblioteca_cdd_area_cdd_instituicao_id_key" UNIQUE (area_cdd, instituicao_id);
ALTER TABLE public."vertice_eorbit_biblioteca_cdd" ADD CONSTRAINT "vertice_eorbit_biblioteca_cdd_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_biblioteca_decada" ADD CONSTRAINT "vertice_eorbit_biblioteca_decada_decada_instituicao_id_key" UNIQUE (decada, instituicao_id);
ALTER TABLE public."vertice_eorbit_biblioteca_decada" ADD CONSTRAINT "vertice_eorbit_biblioteca_decada_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_biblioteca_resumo" ADD CONSTRAINT "vertice_eorbit_biblioteca_resumo_instituicao_id_key" UNIQUE (instituicao_id);
ALTER TABLE public."vertice_eorbit_biblioteca_resumo" ADD CONSTRAINT "vertice_eorbit_biblioteca_resumo_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_compliance_notas" ADD CONSTRAINT "vertice_eorbit_compliance_not_semestre_id_curso_id_institui_key" UNIQUE (semestre_id, curso_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_compliance_notas" ADD CONSTRAINT "vertice_eorbit_compliance_notas_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_compliance_notas_detalhe" ADD CONSTRAINT "vertice_eorbit_compliance_not_semestre_id_curso_id_professo_key" UNIQUE (semestre_id, curso_id, professor_id, disciplina_codigo, instituicao_id);
ALTER TABLE public."vertice_eorbit_compliance_notas_detalhe" ADD CONSTRAINT "vertice_eorbit_compliance_notas_detalhe_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_compliance_plano" ADD CONSTRAINT "vertice_eorbit_compliance_pla_semestre_id_curso_id_institui_key" UNIQUE (semestre_id, curso_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_compliance_plano" ADD CONSTRAINT "vertice_eorbit_compliance_plano_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_compliance_plano_detalhe" ADD CONSTRAINT "vertice_eorbit_compliance_pla_semestre_id_curso_id_professo_key" UNIQUE (semestre_id, curso_id, professor_id, disciplina_codigo, instituicao_id);
ALTER TABLE public."vertice_eorbit_compliance_plano_detalhe" ADD CONSTRAINT "vertice_eorbit_compliance_plano_detalhe_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_cursos_normalizados" ADD CONSTRAINT "vertice_eorbit_cursos_normalizad_id_canonico_instituicao_id_key" UNIQUE (id_canonico, instituicao_id);
ALTER TABLE public."vertice_eorbit_cursos_normalizados" ADD CONSTRAINT "vertice_eorbit_cursos_normalizados_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_diario_classe" ADD CONSTRAINT "vertice_eorbit_diario_classe_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_diario_classe" ADD CONSTRAINT "vertice_eorbit_diario_classe_semestre_id_curso_id_professor_key" UNIQUE (semestre_id, curso_id, professor_id, disciplina_codigo, instituicao_id);
ALTER TABLE public."vertice_eorbit_direito_raio_x" ADD CONSTRAINT "vertice_eorbit_direito_raio_x_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_enade_habilitados" ADD CONSTRAINT "vertice_eorbit_enade_habilita_semestre_curso_id_instituicao_key" UNIQUE (semestre, curso_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_enade_habilitados" ADD CONSTRAINT "vertice_eorbit_enade_habilitados_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_frequencia_conteudo" ADD CONSTRAINT "vertice_eorbit_frequencia_con_semestre_curso_codigo_profess_key" UNIQUE (semestre, curso_nome, disciplina_codigo, professor_nome, instituicao_id);
ALTER TABLE public."vertice_eorbit_frequencia_conteudo" ADD CONSTRAINT "vertice_eorbit_frequencia_conteudo_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_grades" ADD CONSTRAINT "vertice_eorbit_grades_id_curso_id_key" UNIQUE (id, curso_id);
ALTER TABLE public."vertice_eorbit_grades" ADD CONSTRAINT "vertice_eorbit_grades_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_institution_map" ADD CONSTRAINT "vertice_eorbit_institution_map_pkey" PRIMARY KEY (eorbit_instituicao_id);
ALTER TABLE public."vertice_eorbit_professores" ADD CONSTRAINT "vertice_eorbit_professores_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_professores" ADD CONSTRAINT "vertice_eorbit_professores_professor_id_instituicao_id_key" UNIQUE (professor_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_quantitativo" ADD CONSTRAINT "vertice_eorbit_quantitativo_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_quantitativo" ADD CONSTRAINT "vertice_eorbit_quantitativo_semestre_id_curso_id_grade_id_i_key" UNIQUE (semestre_id, curso_id, grade_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_semestres" ADD CONSTRAINT "vertice_eorbit_semestres_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_semestres" ADD CONSTRAINT "vertice_eorbit_semestres_semestre_instituicao_id_key" UNIQUE (semestre, instituicao_id);
ALTER TABLE public."vertice_eorbit_turmas" ADD CONSTRAINT "vertice_eorbit_turmas_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_turmas" ADD CONSTRAINT "vertice_eorbit_turmas_quantitativo_id_turma_nome_key" UNIQUE (quantitativo_id, turma_nome);
ALTER TABLE public."vertice_eorbit_vestibular_cursos" ADD CONSTRAINT "vertice_eorbit_vestibular_cur_edital_id_curso_instituicao_i_key" UNIQUE (edital_id, curso, instituicao_id);
ALTER TABLE public."vertice_eorbit_vestibular_cursos" ADD CONSTRAINT "vertice_eorbit_vestibular_cursos_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_vestibular_editais" ADD CONSTRAINT "vertice_eorbit_vestibular_editais_edital_id_instituicao_id_key" UNIQUE (edital_id, instituicao_id);
ALTER TABLE public."vertice_eorbit_vestibular_editais" ADD CONSTRAINT "vertice_eorbit_vestibular_editais_pkey" PRIMARY KEY (id);
ALTER TABLE public."vertice_eorbit_alunos" ADD CONSTRAINT "vertice_eorbit_alunos_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES vertice_eorbit_cursos(id);
ALTER TABLE public."vertice_eorbit_alunos" ADD CONSTRAINT "vertice_eorbit_alunos_semestre_id_fkey" FOREIGN KEY (semestre_id) REFERENCES vertice_eorbit_semestres(id);
ALTER TABLE public."vertice_eorbit_grades" ADD CONSTRAINT "vertice_eorbit_grades_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES vertice_eorbit_cursos(id);
ALTER TABLE public."vertice_eorbit_institution_map" ADD CONSTRAINT "vertice_eorbit_institution_map_institution_id_fkey" FOREIGN KEY (institution_id) REFERENCES vertice_institutions(id);
ALTER TABLE public."vertice_eorbit_quantitativo" ADD CONSTRAINT "vertice_eorbit_quantitativo_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES vertice_eorbit_cursos(id);
ALTER TABLE public."vertice_eorbit_quantitativo" ADD CONSTRAINT "vertice_eorbit_quantitativo_grade_id_fkey" FOREIGN KEY (grade_id) REFERENCES vertice_eorbit_grades(id);
ALTER TABLE public."vertice_eorbit_quantitativo" ADD CONSTRAINT "vertice_eorbit_quantitativo_semestre_id_fkey" FOREIGN KEY (semestre_id) REFERENCES vertice_eorbit_semestres(id);
ALTER TABLE public."vertice_eorbit_turmas" ADD CONSTRAINT "vertice_eorbit_turmas_quantitativo_id_fkey" FOREIGN KEY (quantitativo_id) REFERENCES vertice_eorbit_quantitativo(id) ON DELETE CASCADE;
ALTER TABLE public."vertice_eorbit_alunos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_alunos" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_alunos" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_alunos_id_seq OWNED BY public."vertice_eorbit_alunos"."id";
ALTER TABLE public."vertice_eorbit_biblioteca_area" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_biblioteca_area" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_biblioteca_area" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_biblioteca_area_id_seq OWNED BY public."vertice_eorbit_biblioteca_area"."id";
ALTER TABLE public."vertice_eorbit_biblioteca_cdd" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_biblioteca_cdd" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_biblioteca_cdd" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_biblioteca_cdd_id_seq OWNED BY public."vertice_eorbit_biblioteca_cdd"."id";
ALTER TABLE public."vertice_eorbit_biblioteca_decada" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_biblioteca_decada" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_biblioteca_decada" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_biblioteca_decada_id_seq OWNED BY public."vertice_eorbit_biblioteca_decada"."id";
ALTER TABLE public."vertice_eorbit_biblioteca_resumo" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_biblioteca_resumo" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_biblioteca_resumo" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_biblioteca_resumo_id_seq OWNED BY public."vertice_eorbit_biblioteca_resumo"."id";
ALTER TABLE public."vertice_eorbit_compliance_notas" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_compliance_notas" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_compliance_notas" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_compliance_notas_id_seq OWNED BY public."vertice_eorbit_compliance_notas"."id";
ALTER TABLE public."vertice_eorbit_compliance_notas_detalhe" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_compliance_notas_detalhe" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_compliance_notas_detalhe" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_compliance_notas_detalhe_id_seq OWNED BY public."vertice_eorbit_compliance_notas_detalhe"."id";
ALTER TABLE public."vertice_eorbit_compliance_plano" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_compliance_plano" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_compliance_plano" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_compliance_plano_id_seq OWNED BY public."vertice_eorbit_compliance_plano"."id";
ALTER TABLE public."vertice_eorbit_compliance_plano_detalhe" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_compliance_plano_detalhe" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_compliance_plano_detalhe" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_compliance_plano_detalhe_id_seq OWNED BY public."vertice_eorbit_compliance_plano_detalhe"."id";
ALTER TABLE public."vertice_eorbit_cursos_normalizados" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_cursos_normalizados" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_cursos_normalizados" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_cursos_normalizados_id_seq OWNED BY public."vertice_eorbit_cursos_normalizados"."id";
ALTER TABLE public."vertice_eorbit_diario_classe" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_diario_classe" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_diario_classe" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_diario_classe_id_seq OWNED BY public."vertice_eorbit_diario_classe"."id";
ALTER TABLE public."vertice_eorbit_direito_raio_x" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_direito_raio_x" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_direito_raio_x" TO service_role;
ALTER TABLE public."vertice_eorbit_enade_habilitados" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_enade_habilitados" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_enade_habilitados" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_enade_habilitados_id_seq OWNED BY public."vertice_eorbit_enade_habilitados"."id";
ALTER TABLE public."vertice_eorbit_frequencia_conteudo" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_frequencia_conteudo" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_frequencia_conteudo" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_frequencia_conteudo_id_seq OWNED BY public."vertice_eorbit_frequencia_conteudo"."id";
ALTER TABLE public."vertice_eorbit_grades" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_grades" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_grades" TO service_role;
ALTER TABLE public."vertice_eorbit_institution_map" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_institution_map" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_institution_map" TO service_role;
ALTER TABLE public."vertice_eorbit_professores" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_professores" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_professores" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_professores_id_seq OWNED BY public."vertice_eorbit_professores"."id";
ALTER TABLE public."vertice_eorbit_quantitativo" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_quantitativo" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_quantitativo" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_quantitativo_id_seq OWNED BY public."vertice_eorbit_quantitativo"."id";
ALTER TABLE public."vertice_eorbit_semestres" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_semestres" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_semestres" TO service_role;
ALTER TABLE public."vertice_eorbit_turmas" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_turmas" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_turmas" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_turmas_id_seq OWNED BY public."vertice_eorbit_turmas"."id";
ALTER TABLE public."vertice_eorbit_vestibular_cursos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_vestibular_cursos" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_vestibular_cursos" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_vestibular_cursos_id_seq OWNED BY public."vertice_eorbit_vestibular_cursos"."id";
ALTER TABLE public."vertice_eorbit_vestibular_editais" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."vertice_eorbit_vestibular_editais" FROM anon,authenticated;
GRANT ALL ON public."vertice_eorbit_vestibular_editais" TO service_role;
ALTER SEQUENCE public.vertice_eorbit_vestibular_editais_id_seq OWNED BY public."vertice_eorbit_vestibular_editais"."id";
COMMIT;