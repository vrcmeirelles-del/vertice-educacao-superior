-- Retira a execução direta de course_function/has_course_function por usuários autenticados,
-- concedida em 20261122210000. Desnecessária: vertice_conecta.allowed (security invoker) não é
-- executável por authenticated e só roda dentro de funções security definer (dono postgres).
-- Nenhuma política, visão ou função security invoker chama course_function/has_course_function.
begin;
revoke execute on function vertice_private.course_function(uuid,uuid) from public,anon,authenticated;
revoke execute on function vertice_private.has_course_function(uuid) from public,anon,authenticated;
commit;
