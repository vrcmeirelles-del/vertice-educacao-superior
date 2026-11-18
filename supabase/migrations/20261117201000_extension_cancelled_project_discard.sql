begin;

-- Legacy projects could begin as "pendente". Restrict that case to cancelled
-- projects with no review, completion, approval, or recorded submission.
create or replace function vertice_private.extension_project_is_draft(p public.vertice_extension_projects)
returns boolean language sql stable security definer set search_path='' as $$
 select p.first_submitted_at is null
  and (
   (p.status='planejamento' and p.review_status='rascunho')
   or (p.status='cancelado' and p.review_status in ('rascunho','pendente')
       and p.completed_at is null and p.approved_at is null)
  )
  and not exists (select 1 from public.vertice_extension_project_history h
   where h.project_id=p.id and h.field_changed='review_status'
    and (h.old_value not in ('rascunho','pendente') or h.new_value not in ('rascunho','pendente')))
  and not exists (select 1 from public.vertice_extension_reviews r where r.project_id=p.id);
$$;

create function public.vertice_extension_discardable_projects(p_institution uuid)
returns setof uuid language sql stable security definer set search_path='' as $$
 select p.id from public.vertice_extension_projects p
 where p.institution_id=p_institution
  and vertice_private.extension_project_manager(p)
  and vertice_private.extension_project_is_draft(p);
$$;

revoke all on function public.vertice_extension_discardable_projects(uuid) from public,anon;
grant execute on function public.vertice_extension_discardable_projects(uuid) to authenticated;

commit;
