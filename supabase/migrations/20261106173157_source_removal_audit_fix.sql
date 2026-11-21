create or replace function vertice_private.source_removal_audit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.vertice_source_removal_events(institution_id,record_type,record_id,name,actor)
 values(old.institution_id,
  case when tg_table_name='vertice_source_uploads' then 'arquivo' else 'link' end,
  old.id,
  coalesce(to_jsonb(old)->>'original_name',to_jsonb(old)->>'source_name','Registro de origem'),
  auth.uid());
 return null;
end $$;
revoke all on function vertice_private.source_removal_audit() from public,anon,authenticated;