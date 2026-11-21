create table public.vertice_registry_contacts (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 course_id uuid references public.vertice_courses(id) on delete cascade,
 position text not null check (position in ('gestor','coordenador','nde')),
 name text not null check (length(trim(name)) between 1 and 160),
 email text not null check (length(email)<=254 and email=lower(trim(email)) and email like '%_@_%._%'),
 phone text not null check (phone ~ '^\+[1-9][0-9]{9,14}$'),
 check ((position='gestor') = (course_id is null)),
 unique nulls not distinct (institution_id, course_id, position, email)
);
alter table public.vertice_registry_contacts enable row level security;
revoke all on public.vertice_registry_contacts from anon,authenticated;
grant select,insert,update,delete on public.vertice_registry_contacts to authenticated;
create policy registry_contact_management on public.vertice_registry_contacts for all to authenticated
 using (vertice_private.member_role(institution_id) in ('master','gestor'))
 with check (vertice_private.member_role(institution_id) in ('master','gestor') and
 (course_id is null or exists (select 1 from public.vertice_courses c where c.id=course_id and c.institution_id=vertice_registry_contacts.institution_id)));

create table public.vertice_channel_choices (
 id bigint generated always as identity primary key,
 institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 email_address text not null,
 email_enabled boolean not null,
 whatsapp_phone text,
 recorded_at timestamptz not null default now(),
 notice_version text not null default '2026-11-03-v1'
);
alter table public.vertice_channel_choices enable row level security;
revoke all on public.vertice_channel_choices from anon,authenticated;
grant select on public.vertice_channel_choices to authenticated;
create policy channel_choice_self on public.vertice_channel_choices for select to authenticated
 using (user_id=auth.uid() and vertice_private.member_role(institution_id) is not null);

create function public.vertice_record_channel_choices(target uuid, allow_email boolean, whatsapp text)
returns void language plpgsql security definer set search_path='' as $$
declare mail text;
begin
 if vertice_private.member_role(target) is null or allow_email is null then
   raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Confirme seu e-mail antes de salvar'; end if;
 if whatsapp is not null and whatsapp !~ '^\+[1-9][0-9]{9,14}$' then raise exception 'Informe um telefone com código do país'; end if;
 insert into public.vertice_channel_choices(institution_id,user_id,email_address,email_enabled,whatsapp_phone)
 values (target,auth.uid(),mail,allow_email,whatsapp);
end;
$$;
revoke all on function public.vertice_record_channel_choices(uuid,boolean,text) from public,anon;
grant execute on function public.vertice_record_channel_choices(uuid,boolean,text) to authenticated;
