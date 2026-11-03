-- REVIEW ONLY: not applied to production and intentionally outside migrations/.
-- Reconcile column grants with the other concurrent branches before promotion.
begin;
alter table public.vertice_institutions add column document_branding jsonb;
create function vertice_private.valid_document_branding(b jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare image bytea; payload text; pos integer; chunk_length bigint; crc bigint; expected_crc bigint; i integer; bit integer; kind text; saw_idat boolean := false;
begin
 if b is null then return true; end if;
 if jsonb_typeof(b) <> 'object' or not (b ?& array['header_text','theme_color','logo_data'])
   or (b - array['header_text','theme_color','logo_data']) <> '{}'::jsonb
   or jsonb_typeof(b->'header_text') <> 'string' or char_length(b->>'header_text') > 600
   or (b->>'header_text') ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then return false; end if;
 if b->'theme_color' <> 'null'::jsonb and (jsonb_typeof(b->'theme_color') <> 'string' or (b->>'theme_color') !~ '^#[0-9A-Fa-f]{6}$') then return false; end if;
 if b->'logo_data' <> 'null'::jsonb then
  payload := b->>'logo_data';
  if jsonb_typeof(b->'logo_data') <> 'string' or length(payload) > 2800000 or payload !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
  image := decode(substr(payload,23),'base64');
  if octet_length(image) < 57 or octet_length(image) > 2097152
    or substring(image from 1 for 16) <> decode('89504e470d0a1a0a0000000d49484452','hex')
    or substring(image from 17 for 8) <> decode('0000012c00000078','hex')
    or substring(image from octet_length(image)-11 for 12) <> decode('0000000049454e44ae426082','hex') then return false; end if;
  pos := 8;
  while pos < octet_length(image) loop
   if pos + 12 > octet_length(image) then return false; end if;
   chunk_length := get_byte(image,pos)::bigint*16777216 + get_byte(image,pos+1)*65536 + get_byte(image,pos+2)*256 + get_byte(image,pos+3);
   if chunk_length > 2097152 or pos + chunk_length + 12 > octet_length(image) then return false; end if;
   kind := convert_from(substring(image from pos+5 for 4),'UTF8');
   if pos > 8 and kind='IHDR' then return false; end if;
   if kind in ('acTL','fcTL','fdAT') then return false; end if;
   crc := 4294967295;
   for i in pos+4..pos+7+chunk_length loop
    crc := crc # get_byte(image,i);
    for bit in 1..8 loop
     if (crc & 1)=1 then crc := (crc >> 1) # 3988292384; else crc := crc >> 1; end if;
    end loop;
   end loop;
   crc := crc # 4294967295;
   i := pos+8+chunk_length;
   expected_crc := get_byte(image,i)::bigint*16777216 + get_byte(image,i+1)*65536 + get_byte(image,i+2)*256 + get_byte(image,i+3);
   if crc <> expected_crc then return false; end if;
   if kind='IDAT' then saw_idat := true; end if;
   pos := pos+12+chunk_length;
   if kind='IEND' then return chunk_length=0 and saw_idat and pos=octet_length(image); end if;
  end loop;
  return false;
 end if;
 return true;
exception when others then return false;
end; $$;
revoke all on function vertice_private.valid_document_branding(jsonb) from public, anon;
grant execute on function vertice_private.valid_document_branding(jsonb) to authenticated;
alter table public.vertice_institutions add constraint vertice_document_branding_valid check (vertice_private.valid_document_branding(document_branding));
-- Keep existing non-branding update permissions. Branding is changed only by the CAS RPC.
revoke update on public.vertice_institutions from authenticated;
do $$ declare columns text; begin
 select string_agg(quote_ident(attname), ',') into columns from pg_attribute
 where attrelid='public.vertice_institutions'::regclass and attnum>0 and not attisdropped and attname <> 'document_branding';
 execute 'grant update (' || columns || ') on public.vertice_institutions to authenticated';
end $$;
create function vertice_private.branding_version() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond'); return new; end; $$;
revoke all on function vertice_private.branding_version() from public, anon, authenticated;
create trigger zz_vertice_branding_version before update on public.vertice_institutions for each row execute function vertice_private.branding_version();
create function vertice_private.save_document_branding(institution uuid, expected_updated_at timestamptz, branding jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not vertice_private.has_role(institution,array['gestor']) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if expected_updated_at is null then raise exception 'Versão obrigatória' using errcode='40001'; end if;
 update public.vertice_institutions i set document_branding=branding
 where i.id=institution and i.updated_at=expected_updated_at
 returning jsonb_build_object('document_branding',i.document_branding,'updated_at',i.updated_at) into result;
 if result is null then raise exception 'Registro alterado; recarregue antes de salvar' using errcode='40001'; end if;
 return result;
end; $$;
revoke all on function vertice_private.save_document_branding(uuid,timestamptz,jsonb) from public, anon;
grant execute on function vertice_private.save_document_branding(uuid,timestamptz,jsonb) to authenticated;
create function public.vertice_save_document_branding(institution uuid, expected_updated_at timestamptz, branding jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select vertice_private.save_document_branding(institution,expected_updated_at,branding);
$$;
revoke all on function public.vertice_save_document_branding(uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.vertice_save_document_branding(uuid,timestamptz,jsonb) to authenticated;
alter table public.vertice_inep_library
 add column template_object_path text,
 add column template_sha256 text,
 add column template_source_sha256 text,
 add column template_review_ref text,
 add constraint vertice_reviewed_template check (
  (template_object_path is null and template_sha256 is null and template_source_sha256 is null and template_review_ref is null)
  or (format='docx' and template_object_path is not null and template_sha256 is not null
   and template_source_sha256 is not null and template_review_ref is not null
   and template_object_path = institution_id::text || '/templates/' || template_sha256 || '.docx'
   and template_object_path <> object_path
   and template_sha256 ~ '^[a-f0-9]{64}$' and template_source_sha256=sha256
   and length(trim(template_review_ref)) between 1 and 500));
-- No registration, Storage write, activation, role change, or new Storage policy.
commit;
