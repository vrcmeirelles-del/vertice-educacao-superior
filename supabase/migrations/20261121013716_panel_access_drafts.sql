begin;

create table vertice_private.panel_access_drafts (
  user_id uuid not null,
  institution_id uuid not null,
  tabs text[] not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, institution_id),
  foreign key (user_id, institution_id)
    references public.vertice_memberships (user_id, institution_id) on delete cascade
);
alter table vertice_private.panel_access_drafts enable row level security;
revoke all on vertice_private.panel_access_drafts from public, anon, authenticated;

create function public.vertice_panel_access_draft(
  p_institution uuid, p_member uuid, p_tabs text[] default null
) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  selected text[];
begin
  if actor is null or actor = p_member
    or (auth.jwt()->>'aal') is distinct from 'aal2'
    or not exists (
      select 1 from public.vertice_memberships m
      where m.institution_id = p_institution and m.user_id = p_member
        and m.role in ('equipe', 'leitor')
    )
    or not (
      vertice_private.is_master() or exists (
        select 1 from public.vertice_memberships m
        where m.institution_id = p_institution and m.user_id = actor and m.role = 'gestor'
      )
    )
  then
    raise exception 'Acesso indisponível' using errcode = '42501';
  end if;

  if p_tabs is null then
    select d.tabs into selected
    from vertice_private.panel_access_drafts d
    where d.user_id = p_member and d.institution_id = p_institution;
    return coalesce(selected, '{}'::text[]);
  end if;

  if cardinality(p_tabs) > 100 or exists (
    select 1 from unnest(p_tabs) as t(tab)
    where tab is null or tab !~ '^[a-z0-9_]+(-[a-z0-9_]+)*$' or length(tab) > 80
  ) then
    raise exception 'Seleção inválida' using errcode = '22023';
  end if;
  selected := array(select distinct tab from unnest(p_tabs) as t(tab) order by tab);

  insert into vertice_private.panel_access_drafts (user_id, institution_id, tabs)
  values (p_member, p_institution, selected)
  on conflict (user_id, institution_id) do update
    set tabs = excluded.tabs, updated_at = now();
  insert into public.vertice_audit (actor, table_name, action, record_id)
  values (actor, 'panel_access_drafts', 'save_draft', p_institution::text || ':' || p_member::text);
  return selected;
end;
$$;
revoke all on function public.vertice_panel_access_draft(uuid, uuid, text[]) from public, anon;
grant execute on function public.vertice_panel_access_draft(uuid, uuid, text[]) to authenticated;

commit;
