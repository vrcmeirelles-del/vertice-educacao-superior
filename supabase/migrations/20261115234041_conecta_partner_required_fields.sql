CREATE OR REPLACE FUNCTION vertice_conecta.partner_data(d jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text;r jsonb:='{}';BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' THEN RAISE EXCEPTION 'Cadastro inválido';END IF;
 FOREACH k IN ARRAY ARRAY['name','trade_name','identifier','partner_type','contact_name','contact_email','contact_phone','address','city','state','sector'] LOOP
  IF d ? k THEN
   IF jsonb_typeof(d->k)<>'string' OR length(d->>k)>(CASE WHEN k='address' THEN 1000 ELSE 250 END) THEN RAISE EXCEPTION 'Campo inválido: %',k;END IF;
   r:=r||jsonb_build_object(k,btrim(d->>k));
  END IF;
 END LOOP;
 IF length(coalesce(r->>'name','')) NOT BETWEEN 3 AND 250 OR length(coalesce(r->>'contact_name',''))<3 THEN RAISE EXCEPTION 'Organização e responsável são obrigatórios';END IF;
 IF coalesce(r->>'partner_type','') NOT IN ('escritorio','consultorio','clinica','empresa','organizacao','governo','ong','comunidade','pessoa_fisica') THEN RAISE EXCEPTION 'Tipo de parceiro inválido';END IF;
 FOREACH k IN ARRAY ARRAY['identifier','contact_email','contact_phone','address','city','state','sector'] LOOP
  IF coalesce(r->>k,'')='' THEN RAISE EXCEPTION 'Campo obrigatório: %',k;END IF;
 END LOOP;
 IF r->>'contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail inválido';END IF;
 IF coalesce(r->>'contact_phone','')<>'' AND length(regexp_replace(r->>'contact_phone','[^0-9]','','g')) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'Telefone inválido';END IF;
 IF coalesce(r->>'contact_email','')='' AND coalesce(r->>'contact_phone','')='' THEN RAISE EXCEPTION 'Informe ao menos um contato: telefone ou e-mail';END IF;
 IF coalesce(r->>'identifier','')<>'' THEN
  k:=regexp_replace(r->>'identifier','[^0-9]','','g');
  IF length(k) NOT IN (11,14) OR k = repeat(left(k,1),length(k)) THEN RAISE EXCEPTION 'CPF/CNPJ inválido';END IF;
  r:=r||jsonb_build_object('identifier',k);
 END IF;
 RETURN r;
END $$;
ALTER TABLE public.vertice_extension_partners DROP CONSTRAINT vertice_extension_partners_partner_type_check;
ALTER TABLE public.vertice_extension_partners ADD CONSTRAINT vertice_extension_partners_partner_type_check CHECK (partner_type IN ('organizacao','empresa','governo','ong','comunidade','pessoa_fisica','escritorio','consultorio','clinica'));
