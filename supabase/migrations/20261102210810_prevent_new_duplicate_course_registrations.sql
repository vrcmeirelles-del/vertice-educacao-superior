-- Preserva bases históricas; bloqueia novas colisões de código/modalidade por IES.
create function vertice_private.prevent_new_duplicate_course() returns trigger
language plpgsql security invoker set search_path='' as $$
declare course_code text:=lower(trim(coalesce(new.code,'')));course_mode text:=lower(trim(coalesce(new.modality,'')));
begin
 if course_code='' then return new;end if;
 if tg_op='UPDATE' and new.institution_id=old.institution_id and course_code=lower(trim(coalesce(old.code,''))) and course_mode=lower(trim(coalesce(old.modality,''))) then return new;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.institution_id::text||'|'||course_code||'|'||course_mode,0));
 if exists(select 1 from public.vertice_courses c where c.institution_id=new.institution_id and c.id<>new.id and lower(trim(coalesce(c.code,'')))=course_code and lower(trim(coalesce(c.modality,'')))=course_mode) then
  raise exception 'Já existe cadastro com este código e modalidade nesta instituição. Utilize o cadastro existente.' using errcode='23505';
 end if;
 return new;
end;$$;
revoke all on function vertice_private.prevent_new_duplicate_course() from public,anon;
create trigger prevent_new_duplicate_course before insert or update of institution_id,code,modality on public.vertice_courses for each row execute function vertice_private.prevent_new_duplicate_course();
