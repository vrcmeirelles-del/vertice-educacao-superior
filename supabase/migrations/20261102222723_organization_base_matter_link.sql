begin;
create table public.vertice_base_matter_links(
 institution_id uuid not null references public.vertice_institutions(id),
 matter_id uuid not null unique references public.dd_matters(id),
 created_by uuid not null default auth.uid(),created_at timestamptz not null default now(),
 primary key(institution_id,matter_id)
);
alter table public.vertice_base_matter_links enable row level security;
revoke all on public.vertice_base_matter_links from public,anon,authenticated;
grant select on public.vertice_base_matter_links to authenticated;
create policy base_matter_links_read on public.vertice_base_matter_links for select to authenticated
 using(vertice_private.has_role(institution_id,array['gestor']) and dd_private.can_access(matter_id));
create function public.vertice_base_link_matter(target uuid,matter uuid) returns void language plpgsql security definer set search_path='' as $$
declare inst uuid;root text;cnpj text;
begin
 if not coalesce(vertice_private.has_role(target,array['gestor']) and dd_private.can_access(matter) and public.dd_is_matter_lead(matter),false) then raise exception 'access_denied' using errcode='42501';end if;
 select i.cnpj into cnpj from public.vertice_institutions i where i.id=target and i.status='ativa';
 if not found then raise exception 'access_denied' using errcode='42501';end if;
 select m.institution_id,m.target_cnpj_root into inst,root from public.dd_matters m where m.id=matter;
 if not found or (inst is not null and inst<>target) then raise exception 'matter_scope_denied' using errcode='42501';end if;
 if root is not null and root<>'' and substr(upper(regexp_replace(coalesce(cnpj,''),'[./[:space:]-]','','g')),1,8)<>root then raise exception 'cnpj_mismatch' using errcode='22023';end if;
 insert into public.vertice_base_matter_links(institution_id,matter_id) values(target,matter) on conflict(institution_id,matter_id) do nothing;
end;$$;
create function public.vertice_base_matters(target uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not vertice_private.has_role(target,array['gestor']) then raise exception 'access_denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'code',m.code,'title',m.title) order by m.created_at)
 from public.dd_matters m where (m.institution_id=target or exists(select 1 from public.vertice_base_matter_links l where l.institution_id=target and l.matter_id=m.id)) and dd_private.can_access(m.id)),'[]'::jsonb);
end;$$;
revoke all on function public.vertice_base_link_matter(uuid,uuid),public.vertice_base_matters(uuid) from public,anon;
grant execute on function public.vertice_base_link_matter(uuid,uuid),public.vertice_base_matters(uuid) to authenticated;
commit;
