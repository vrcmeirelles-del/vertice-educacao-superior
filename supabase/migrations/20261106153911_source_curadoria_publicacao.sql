-- Etapas 2, 3 e 4: referencias externas, curadoria e publicação em BI segregado.
-- A aprovação torna os registros visíveis em "Indicadores externos homologados".
-- Nenhuma tabela legada de matrículas ou indicadores é sobrescrita.

ALTER TABLE public.vertice_source_uploads
 ADD COLUMN IF NOT EXISTS drive_url text
 CHECK (drive_url IS NULL OR (length(drive_url)<=1800 AND drive_url ~* '^https://(drive[.]google[.]com|docs[.]google[.]com|[a-z0-9.-]+[.]sharepoint[.]com|onedrive[.]live[.]com|1drv[.]ms)/'));

-- Adicionar a URL à proteção imutável do upload original.
CREATE OR REPLACE FUNCTION vertice_private.source_upload_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF new.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'actor_mismatch' USING errcode='42501';END IF;
  IF new.storage_path<>new.institution_id::text||'/'||new.id::text||'/'||new.original_name THEN
   RAISE EXCEPTION 'invalid_path' USING errcode='23514';END IF;
 ELSE
  IF new.id IS DISTINCT FROM old.id OR new.institution_id IS DISTINCT FROM old.institution_id OR
    new.storage_path IS DISTINCT FROM old.storage_path OR new.original_name IS DISTINCT FROM old.original_name OR
    new.source_kind IS DISTINCT FROM old.source_kind OR new.source_url IS DISTINCT FROM old.source_url OR
    new.source_name IS DISTINCT FROM old.source_name OR new.reference_period IS DISTINCT FROM old.reference_period OR
    new.extracted_on IS DISTINCT FROM old.extracted_on OR new.mime_type IS DISTINCT FROM old.mime_type OR
    new.bytes IS DISTINCT FROM old.bytes OR new.description IS DISTINCT FROM old.description OR
    new.drive_url IS DISTINCT FROM old.drive_url OR
    new.created_by IS DISTINCT FROM old.created_by OR new.created_at IS DISTINCT FROM old.created_at OR
    new.review_status IS DISTINCT FROM old.review_status OR
    (old.upload_status='recebido' AND new.upload_status<>'recebido') THEN
    RAISE EXCEPTION 'immutable_record' USING errcode='42501';
  END IF;
  IF (old.upload_status='aguardando_arquivo' AND new.upload_status NOT IN ('recebido','falhou'))
     OR (old.upload_status='falhou' AND new.upload_status NOT IN ('falhou','recebido')) THEN
    RAISE EXCEPTION 'invalid_transition' USING errcode='23514';
  END IF;
  IF new.upload_status='recebido' THEN
   IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='vertice-fontes-ies' AND o.name=new.storage_path) THEN
    RAISE EXCEPTION 'object_not_uploaded' USING errcode='23514';
   END IF;
   new.received_at=now();
  END IF;
 END IF;
 RETURN new;
END $$;

CREATE TABLE public.vertice_source_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 source_kind text NOT NULL CHECK(source_kind IN ('eorbit','emec','censo','enade','secretaria','site_institucional','outro')),
 source_name text NOT NULL CHECK(length(source_name) BETWEEN 2 AND 180),
 drive_url text NOT NULL CHECK(length(drive_url)<=1800 AND drive_url ~* '^https://(drive[.]google[.]com|docs[.]google[.]com|[a-z0-9.-]+[.]sharepoint[.]com|onedrive[.]live[.]com|1drv[.]ms)/'),
 reference_period text CHECK(reference_period IS NULL OR length(reference_period)<=35),
 extracted_on date,
 description text CHECK(description IS NULL OR length(description)<=1500),
 link_status text NOT NULL DEFAULT 'aguarda_acesso' CHECK(link_status='aguarda_acesso'),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vertice_source_links_inst_idx ON public.vertice_source_links(institution_id,created_at DESC);
ALTER TABLE public.vertice_source_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_source_links FROM anon,authenticated;
GRANT SELECT,INSERT ON public.vertice_source_links TO authenticated;
CREATE POLICY vx_source_links_read ON public.vertice_source_links FOR SELECT TO authenticated
 USING (vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_source_links_insert ON public.vertice_source_links FOR INSERT TO authenticated
 WITH CHECK (vertice_private.has_role(institution_id,ARRAY['gestor'])
 AND created_by=auth.uid() AND link_status='aguarda_acesso');

CREATE TABLE public.vertice_source_analyses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 upload_id uuid NOT NULL UNIQUE REFERENCES public.vertice_source_uploads(id),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 candidate_rows jsonb NOT NULL CHECK(jsonb_typeof(candidate_rows)='array'),
 row_count integer NOT NULL CHECK(row_count BETWEEN 1 AND 500),
 analysis_note text NOT NULL DEFAULT '' CHECK(length(analysis_note)<=2500),
 state text NOT NULL DEFAULT 'analisado' CHECK(state IN ('analisado','submetido','aprovado','devolvido')),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 submitted_by uuid,
 submitted_at timestamptz,
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vx_source_analyses_inst_idx ON public.vertice_source_analyses(institution_id,state,created_at DESC);
ALTER TABLE public.vertice_source_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_source_analyses FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.vertice_source_analyses TO authenticated;
CREATE POLICY vx_source_analyses_read ON public.vertice_source_analyses FOR SELECT TO authenticated
 USING(vertice_private.has_role(institution_id,ARRAY['gestor']));
CREATE POLICY vx_source_analyses_insert ON public.vertice_source_analyses FOR INSERT TO authenticated
 WITH CHECK(vertice_private.has_role(institution_id,ARRAY['gestor']) AND created_by=auth.uid());
CREATE POLICY vx_source_analyses_update ON public.vertice_source_analyses FOR UPDATE TO authenticated
 USING(vertice_private.has_role(institution_id,ARRAY['gestor']))
 WITH CHECK(vertice_private.has_role(institution_id,ARRAY['gestor']));

CREATE TABLE public.vertice_source_analysis_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 analysis_id uuid NOT NULL REFERENCES public.vertice_source_analyses(id),
 institution_id uuid NOT NULL REFERENCES public.vertice_institutions(id),
 actor uuid,
 event text NOT NULL CHECK(event IN ('analisado','submetido','aprovado','devolvido')),
 row_count integer NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vx_source_analysis_events_inst_idx ON public.vertice_source_analysis_events(institution_id,occurred_at DESC);
ALTER TABLE public.vertice_source_analysis_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vertice_source_analysis_events FROM anon,authenticated;
GRANT SELECT ON public.vertice_source_analysis_events TO authenticated;
CREATE POLICY vx_source_analysis_events_read ON public.vertice_source_analysis_events FOR SELECT TO authenticated
 USING(vertice_private.has_role(institution_id,ARRAY['gestor']));

-- Não admitir colunas livres/PII no dataset publicado: indicador, período, valor e unidade.
CREATE OR REPLACE FUNCTION vertice_private.source_analysis_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; source_inst uuid; source_status text; j text;
BEGIN
 SELECT institution_id,upload_status INTO source_inst,source_status
 FROM public.vertice_source_uploads WHERE id=new.upload_id;
 IF NOT FOUND OR source_inst IS DISTINCT FROM new.institution_id OR source_status<>'recebido' THEN
  RAISE EXCEPTION 'uploaded_source_not_ready' USING errcode='23514';
 END IF;
 IF NOT vertice_private.has_role(new.institution_id,ARRAY['gestor']) THEN
  RAISE EXCEPTION 'not_authorized' USING errcode='42501';
 END IF;
 IF jsonb_array_length(new.candidate_rows)<>new.row_count THEN
  RAISE EXCEPTION 'rows_count_mismatch' USING errcode='23514';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(new.candidate_rows) LOOP
  IF jsonb_typeof(item)<>'object'
     OR (SELECT count(*) FROM jsonb_object_keys(item))<>4
     OR NOT (item ?& ARRAY['indicador','periodo','valor','unidade'])
     OR jsonb_typeof(item->'indicador')<>'string'
     OR jsonb_typeof(item->'periodo')<>'string'
     OR jsonb_typeof(item->'unidade')<>'string'
     OR jsonb_typeof(item->'valor')<>'number'
     OR length(btrim(item->>'indicador')) NOT BETWEEN 3 AND 150
     OR (item->>'periodo') !~ '^20[0-9]{2}/0?[12]$'
     OR length(item->>'unidade')>30
     OR abs((item->>'valor')::numeric)>1000000000000
  THEN RAISE EXCEPTION 'invalid_indicator_row' USING errcode='23514'; END IF;
 END LOOP;
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(new.candidate_rows) r
  GROUP BY lower(btrim(r->>'indicador')),r->>'periodo'
  HAVING count(*)>1
 ) THEN RAISE EXCEPTION 'duplicate_indicator_period' USING errcode='23505'; END IF;

 IF TG_OP='INSERT' THEN
  IF new.created_by IS DISTINCT FROM auth.uid() OR new.state<>'analisado'
    OR new.submitted_by IS NOT NULL OR new.reviewed_by IS NOT NULL
    OR new.submitted_at IS NOT NULL OR new.reviewed_at IS NOT NULL THEN
   RAISE EXCEPTION 'invalid_initial_analysis' USING errcode='42501';
  END IF;
 ELSE
  IF new.id IS DISTINCT FROM old.id OR new.upload_id IS DISTINCT FROM old.upload_id
    OR new.institution_id IS DISTINCT FROM old.institution_id OR new.created_by IS DISTINCT FROM old.created_by
    OR new.created_at IS DISTINCT FROM old.created_at THEN
   RAISE EXCEPTION 'immutable_analysis_identity' USING errcode='42501';
  END IF;
  IF old.state='aprovado' THEN RAISE EXCEPTION 'approved_analysis_immutable' USING errcode='42501';END IF;
  IF new.state='analisado' AND old.state IN ('analisado','devolvido') THEN
   IF auth.uid()<>old.created_by THEN RAISE EXCEPTION 'author_only' USING errcode='42501';END IF;
   new.submitted_by=NULL;new.submitted_at=NULL;new.reviewed_by=NULL;new.reviewed_at=NULL;new.review_note=NULL;
  ELSIF new.state='submetido' AND old.state IN ('analisado','devolvido') THEN
   IF auth.uid()<>old.created_by THEN RAISE EXCEPTION 'author_only' USING errcode='42501';END IF;
   new.submitted_by=auth.uid();new.submitted_at=now();
   new.reviewed_by=NULL;new.reviewed_at=NULL;new.review_note=NULL;
  ELSIF new.state IN ('aprovado','devolvido') AND old.state='submetido' THEN
   IF auth.uid()=old.submitted_by OR length(btrim(coalesce(new.review_note,'')))<8 THEN
    RAISE EXCEPTION 'independent_review_and_reason_required' USING errcode='42501';
   END IF;
   IF new.candidate_rows IS DISTINCT FROM old.candidate_rows OR new.file_sha256 IS DISTINCT FROM old.file_sha256
     OR new.row_count IS DISTINCT FROM old.row_count OR new.analysis_note IS DISTINCT FROM old.analysis_note THEN
    RAISE EXCEPTION 'cannot_change_submitted_analysis' USING errcode='23514';
   END IF;
   new.reviewed_by=auth.uid();new.reviewed_at=now();
  ELSE RAISE EXCEPTION 'invalid_analysis_transition' USING errcode='23514';END IF;
 END IF;
 new.updated_at=now();
 RETURN new;
END $$;

CREATE TRIGGER vx_source_analysis_guard BEFORE INSERT OR UPDATE ON public.vertice_source_analyses
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_analysis_guard();

CREATE OR REPLACE FUNCTION vertice_private.source_analysis_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.vertice_source_analysis_events(analysis_id,institution_id,actor,event,row_count)
 VALUES(new.id,new.institution_id,auth.uid(),new.state,new.row_count);
 RETURN null;
END $$;
REVOKE ALL ON FUNCTION vertice_private.source_analysis_audit() FROM public,anon,authenticated;
CREATE TRIGGER vx_source_analysis_audit AFTER INSERT OR UPDATE ON public.vertice_source_analyses
 FOR EACH ROW EXECUTE FUNCTION vertice_private.source_analysis_audit();

-- Apenas prévia de diferenças, não substitui o dado anterior.
CREATE OR REPLACE FUNCTION public.vertice_source_conflicts(p_analysis uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE output jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'indicador',candidate->>'indicador','periodo',candidate->>'periodo',
   'valor_proposto',candidate->'valor','valor_homologado',previous->'valor'
  )),'[]'::jsonb) INTO output
 FROM public.vertice_source_analyses a
 CROSS JOIN LATERAL jsonb_array_elements(a.candidate_rows) candidate
 JOIN public.vertice_source_analyses old ON old.institution_id=a.institution_id
   AND old.state='aprovado' AND old.id<>a.id
 CROSS JOIN LATERAL jsonb_array_elements(old.candidate_rows) previous
 WHERE a.id=p_analysis
 AND lower(btrim(candidate->>'indicador'))=lower(btrim(previous->>'indicador'))
 AND candidate->>'periodo'=previous->>'periodo'
 AND candidate->'valor'<>previous->'valor';
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.vertice_source_conflicts(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.vertice_source_conflicts(uuid) TO authenticated;
