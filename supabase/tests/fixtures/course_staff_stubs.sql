-- Complemento dos stubs para supabase/tests/course_staff_functions.sql (aplicar após avalia360_stubs.sql,
-- antes das migrações 20261122150000 e 20261122170000; depois delas, rode a última linha).
alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz;
alter table public.vertice_courses add constraint vc_id_inst unique(id,institution_id);
create table public.vertice_memberships(user_id uuid,institution_id uuid,role text,primary key(user_id,institution_id));
-- após as migrações:
-- grant usage on schema vertice_private to authenticated; grant execute on function vertice_private.teaching_access(uuid,uuid,text) to authenticated;
