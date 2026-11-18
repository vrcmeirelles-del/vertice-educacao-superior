begin;

create table vertice_private.extension_project_numbers (
  institution_id uuid primary key references public.vertice_institutions(id) on delete cascade,
  last_number numeric not null
);
revoke all on vertice_private.extension_project_numbers from public, anon, authenticated;

-- Seed from numeric codes and the sequence portion of older EXT-YYYY-N codes.
-- Include archived projects so their numbers are never issued again.
lock table public.vertice_extension_projects in share row exclusive mode;
insert into vertice_private.extension_project_numbers(institution_id, last_number)
select institution_id,
       max(substring(btrim(code) from '^(?:EXT-[0-9]{4}-)?([0-9]+)$')::numeric)
from public.vertice_extension_projects
where institution_id is not null and btrim(code) ~ '^(EXT-[0-9]{4}-)?[0-9]+$'
group by institution_id;

create function vertice_private.issue_extension_project_number()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into vertice_private.extension_project_numbers as sequence(institution_id, last_number)
  values (new.institution_id, 1)
  on conflict (institution_id) do update set last_number = sequence.last_number + 1
  returning last_number::text into new.code;
  return new;
end $$;
revoke all on function vertice_private.issue_extension_project_number() from public, anon, authenticated;

create trigger zz_extension_project_number
before insert on public.vertice_extension_projects
for each row execute function vertice_private.issue_extension_project_number();

commit;
