begin;
-- Only the branding needed for institutional entry is public; no institution rows are exposed.
create table public.vertice_institution_addresses (
 institution_id uuid primary key references public.vertice_institutions(id) on delete cascade,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 80),
 display_name text not null,
 tier text not null,
 logo_url text,
 active boolean not null default true
);
alter table public.vertice_institution_addresses enable row level security;
revoke all on public.vertice_institution_addresses from public,anon,authenticated;
grant select on public.vertice_institution_addresses to anon,authenticated;
create policy institution_address_read on public.vertice_institution_addresses for select to anon,authenticated using(active);
create or replace function vertice_private.address_slug(value text) returns text language sql immutable set search_path='' as $$
 select trim(both '-' from regexp_replace(lower(translate(coalesce(value,''),'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),'[^a-z0-9]+','-','g'));
$$;
create or replace function vertice_private.address_reserved(value text) returns boolean language sql immutable set search_path='' as $$
 select value = any(array['master','entrar','redefinir-senha','api','assets','mobile','experience','demonstracao','painel','diagnostico','regulador','admin-ies','gestor','matriz','metas','plano','competencias','metodologia','premissas','apresentacao','aquisicoes','servicos','plataforma','metodo','sobre','fundador','caso-real','guia','reitor','plataforma-ies','contato','privacidade','bi-demonstrativo','painel-real','favicon','robots','sitemap']);
$$;
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
 logo_url=case when new.document_branding->>'logo_url' ~ '^https://' then new.document_branding->>'logo_url' else null end
 where institution_id=new.id;
 return new;
end;
$$;
revoke all on function vertice_private.sync_institution_address() from public,anon,authenticated;
create trigger vertice_sync_institution_address after insert or update of name,acronym,status,tier,document_branding on public.vertice_institutions for each row execute function vertice_private.sync_institution_address();
-- Trigger backfills from existing records without changing business attributes.
update public.vertice_institutions set name=name;
create or replace function vertice_private.set_institution_address(target uuid,new_slug text) returns text language plpgsql security definer set search_path='' as $$
declare normalized text;
begin
 if auth.uid() is null or not vertice_private.is_master() then raise exception 'access_denied'; end if;
 normalized:=vertice_private.address_slug(new_slug);
 if normalized is distinct from new_slug or length(normalized) not between 2 and 80 or vertice_private.address_reserved(normalized) then raise exception 'invalid_address'; end if;
 perform pg_advisory_xact_lock(6111101);
 update public.vertice_institution_addresses set slug=normalized where institution_id=target;
 if not found then raise exception 'institution_not_found'; end if;
 insert into public.vertice_audit(actor,action,table_name,record_id) values(auth.uid(),'update','vertice_institution_addresses',target::text);
 return normalized;
end;
$$;
revoke all on function vertice_private.set_institution_address(uuid,text) from public,anon;
grant execute on function vertice_private.set_institution_address(uuid,text) to authenticated;
create or replace function public.vertice_set_institution_address(target uuid,new_slug text) returns text language sql security invoker set search_path='' as $$
 select vertice_private.set_institution_address(target,new_slug);
$$;
revoke all on function public.vertice_set_institution_address(uuid,text) from public,anon;
grant execute on function public.vertice_set_institution_address(uuid,text) to authenticated;
commit;
