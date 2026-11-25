-- Instrumentos, passo 2: registros de avaliação gravados e com escrita restrita a gestão.
-- Depende de 20261125150000_instrumentos_catalogos (catálogo do Recredenciamento 2017 e UNIQUE(id, institution_id)).
--
-- A. vertice_avaliacao_simulada (Reconhecimento, conceito por indicador e curso) foi criada em produção fora
--    das migrações. Este arquivo versiona a estrutura vigente (create if not exists, idêntica à de produção em
--    25/11/2026) e corrige três pontos, sem tocar nos 39 registros:
--    - chaves estrangeiras de instituição e de curso da mesma instituição (diretriz: não misturar IES ou cursos);
--    - escrita (inclusão e alteração) só para gestor e equipe com MFA, como no Novo Instrumento; antes bastava ler;
--    - autor e data da alteração gravados pelo banco (o campo updated_by estava vazio em todos os registros).
-- B. Conceito por eixo do Recredenciamento 2017, que a tela calculava e descartava ao sair.

-- ------------------------------------------------------------------ A
CREATE TABLE IF NOT EXISTS public.vertice_avaliacao_simulada (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL,
 course_id uuid NOT NULL,
 indicador text NOT NULL,
 dimensao smallint NOT NULL,
 conceito_atual smallint CHECK (conceito_atual >= 1 AND conceito_atual <= 5),
 conceito_viavel smallint CHECK (conceito_viavel >= 1 AND conceito_viavel <= 5),
 parecer text DEFAULT '',
 lacunas text DEFAULT '',
 plano_nde text DEFAULT '',
 perguntas_comissao text DEFAULT '',
 updated_by uuid,
 updated_at timestamptz DEFAULT now(),
 created_at timestamptz DEFAULT now(),
 UNIQUE (institution_id, course_id, indicador)
);
CREATE INDEX IF NOT EXISTS idx_avs_inst_course ON public.vertice_avaliacao_simulada(institution_id, course_id);
ALTER TABLE public.vertice_avaliacao_simulada
 ADD CONSTRAINT vertice_avaliacao_simulada_institution_fk FOREIGN KEY (institution_id) REFERENCES public.vertice_institutions(id),
 ADD CONSTRAINT vertice_avaliacao_simulada_course_fk FOREIGN KEY (course_id, institution_id) REFERENCES public.vertice_courses(id, institution_id);
ALTER TABLE public.vertice_avaliacao_simulada ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION vertice_private.avaliacao_stamp() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 NEW.updated_by := (SELECT auth.uid());
 NEW.updated_at := now();
 IF TG_OP = 'UPDATE' THEN
  NEW.institution_id := OLD.institution_id;
  IF TG_TABLE_NAME = 'vertice_avaliacao_simulada' THEN NEW.course_id := OLD.course_id; NEW.indicador := OLD.indicador; NEW.created_at := OLD.created_at; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_private.avaliacao_stamp() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS vertice_avaliacao_simulada_stamp ON public.vertice_avaliacao_simulada;
CREATE TRIGGER vertice_avaliacao_simulada_stamp BEFORE INSERT OR UPDATE ON public.vertice_avaliacao_simulada
 FOR EACH ROW EXECUTE FUNCTION vertice_private.avaliacao_stamp();

DROP POLICY IF EXISTS avs_select ON public.vertice_avaliacao_simulada;
DROP POLICY IF EXISTS avs_insert ON public.vertice_avaliacao_simulada;
DROP POLICY IF EXISTS avs_update ON public.vertice_avaliacao_simulada;
DROP POLICY IF EXISTS avs_delete ON public.vertice_avaliacao_simulada;
CREATE POLICY avs_select ON public.vertice_avaliacao_simulada FOR SELECT TO authenticated
 USING (vertice_private.is_master() OR vertice_private.can_read_institution(institution_id));
CREATE POLICY avs_insert ON public.vertice_avaliacao_simulada FOR INSERT TO authenticated
 WITH CHECK (vertice_private.instrumento_can_record(institution_id));
CREATE POLICY avs_update ON public.vertice_avaliacao_simulada FOR UPDATE TO authenticated
 USING (vertice_private.instrumento_can_record(institution_id)) WITH CHECK (vertice_private.instrumento_can_record(institution_id));
CREATE POLICY avs_delete ON public.vertice_avaliacao_simulada FOR DELETE TO authenticated
 USING (vertice_private.is_master());
REVOKE ALL ON public.vertice_avaliacao_simulada FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vertice_avaliacao_simulada TO authenticated;

-- ------------------------------------------------------------------ B
CREATE TABLE public.vertice_avaliacao_institucional_eixos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 catalog_id uuid NOT NULL,
 axis_code smallint NOT NULL,
 conceito smallint CHECK (conceito BETWEEN 1 AND 5),
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (institution_id, catalog_id, axis_code),
 FOREIGN KEY (catalog_id, institution_id) REFERENCES public.vertice_instrument_catalog(id, institution_id)
);
COMMENT ON TABLE public.vertice_avaliacao_institucional_eixos IS 'Conceito simulado por eixo (instrumento institucional). Mesa de trabalho da IES: não é o conceito oficial do INEP. conceito nulo = sem nota.';

CREATE OR REPLACE FUNCTION vertice_private.avaliacao_eixo_valido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.vertice_instrument_catalog c
  WHERE c.id = NEW.catalog_id AND c.institution_id = NEW.institution_id AND c.scope = 'instituicao'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.structure->'dimensions') d WHERE (d->>'code')::int = NEW.axis_code)) THEN
  RAISE EXCEPTION 'eixo inexistente no catalogo institucional' USING errcode = '23514';
 END IF;
 IF TG_OP = 'UPDATE' THEN NEW.catalog_id := OLD.catalog_id; NEW.axis_code := OLD.axis_code; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vertice_private.avaliacao_eixo_valido() FROM PUBLIC, anon;
CREATE TRIGGER vertice_avaliacao_institucional_eixos_valido BEFORE INSERT OR UPDATE ON public.vertice_avaliacao_institucional_eixos
 FOR EACH ROW EXECUTE FUNCTION vertice_private.avaliacao_eixo_valido();
CREATE TRIGGER vertice_avaliacao_institucional_eixos_stamp BEFORE INSERT OR UPDATE ON public.vertice_avaliacao_institucional_eixos
 FOR EACH ROW EXECUTE FUNCTION vertice_private.avaliacao_stamp();

ALTER TABLE public.vertice_avaliacao_institucional_eixos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_avaliacao_institucional_eixos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vertice_avaliacao_institucional_eixos TO authenticated;
CREATE POLICY avie_select ON public.vertice_avaliacao_institucional_eixos FOR SELECT TO authenticated
 USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY avie_insert ON public.vertice_avaliacao_institucional_eixos FOR INSERT TO authenticated
 WITH CHECK (vertice_private.instrumento_can_record(institution_id));
CREATE POLICY avie_update ON public.vertice_avaliacao_institucional_eixos FOR UPDATE TO authenticated
 USING (vertice_private.instrumento_can_record(institution_id)) WITH CHECK (vertice_private.instrumento_can_record(institution_id));
