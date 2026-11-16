begin;
-- Public identity is already readable through the active-only address directory.
-- Project only a bounded raster logo / HTTPS image; no private JSON, grants or RLS change.
create or replace function vertice_private.public_institution_logo(branding jsonb)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare source text; bytes bytea; mime text; signature text;
begin
 source:=branding->>'logo_data';
 if length(source)<=3000000 and source ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' then
  begin
   bytes:=decode(split_part(source,',',2),'base64');
   mime:=split_part(split_part(source,';',1),':',2);
   signature:=encode(substring(bytes from 1 for 12),'hex');
   if octet_length(bytes)<=2097152 and (
    (mime='image/png' and left(signature,16)='89504e470d0a1a0a') or
    (mime='image/jpeg' and left(signature,6)='ffd8ff') or
    (mime='image/webp' and left(signature,8)='52494646' and substring(signature from 17 for 8)='57454250')
   ) then return source; end if;
  exception when others then null;
  end;
 end if;
 source:=branding->>'logo_url';
 if length(source)<=4096 and source ~ '^https://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$' then return source; end if;
 return null;
end;
$$;
revoke all on function vertice_private.public_institution_logo(jsonb) from public,anon,authenticated;
create or replace function vertice_private.sync_institution_address() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer:=1;
begin
 perform pg_advisory_xact_lock(6111101);
 if not exists(select 1 from public.vertice_institution_addresses where institution_id=new.id) then
  base:=left(vertice_private.address_slug(coalesce(nullif(new.acronym,''),new.name)),65);
  base:=trim(both '-' from base);
  if length(base)<2 then base:='instituicao'; end if;
  if vertice_private.address_reserved(base) then base:='instituicao-'||base; end if;
  candidate:=base;
  while exists(select 1 from public.vertice_institution_addresses where slug=candidate) loop
   suffix:=suffix+1; candidate:=base||'-'||suffix;
  end loop;
  insert into public.vertice_institution_addresses(institution_id,slug,display_name,tier,active)
   values(new.id,candidate,new.name,coalesce(new.tier,'superior'),new.status='ativa');
 end if;
 update public.vertice_institution_addresses set display_name=new.name,tier=coalesce(new.tier,'superior'),active=new.status='ativa',
 logo_url=vertice_private.public_institution_logo(new.document_branding)
 where institution_id=new.id;
 return new;
end;
$$;
-- Backfill only the existing public projection; preserve institutions, slugs and all access policies.
update public.vertice_institution_addresses a
set logo_url=vertice_private.public_institution_logo(i.document_branding)
from public.vertice_institutions i
where i.id=a.institution_id and a.logo_url is distinct from vertice_private.public_institution_logo(i.document_branding);
commit;
