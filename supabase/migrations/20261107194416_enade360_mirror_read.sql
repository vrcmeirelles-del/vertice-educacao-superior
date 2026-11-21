-- O espelho do ENADE tem agregados por curso/semestre, sem registros nominais.
-- Leitura somente após MFA e vínculo com a instituição; nunca conceder acesso anon.
create policy eorbit_enade_enade360_read on public.vertice_eorbit_enade
 for select to authenticated
 using (
   vertice_private.can_read_institution(instituicao_id)
   and vertice_private.has_role(instituicao_id,array[
     'gestor','equipe','reitor','diretor_geral','diretor_pedagogico','procurador','cpa'
   ])
 );
grant select on public.vertice_eorbit_enade to authenticated;
