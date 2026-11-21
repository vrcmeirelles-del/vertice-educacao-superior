-- Contexto determinístico de cruzamento para agente da Base da Organização.
-- Agregações autorizadas por IES com MFA; sem detalhes sigilosos de mandatos.
create or replace function public.vertice_ai_crosschecks(p_institution uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare q2026 integer; q2025 integer; snapshots2026 integer;
        last_source date; result jsonb; goals_total integer; goals_unassigned integer;
        measurements_total integer; actions_total integer; docs_sent integer; docs_validated integer;
        req_unassigned integer; institution_cnpj text; valid_root text; visible_mandates integer;
begin
 if auth.uid() is null or not coalesce((select auth.jwt()->>'aal')='aal2',false)
    or not vertice_private.has_role(p_institution,array['gestor']) then
    raise exception 'access_denied' using errcode='42501';
 end if;
 select upper(regexp_replace(coalesce(cnpj,''),'[^0-9A-Za-z]','','g')) into institution_cnpj
 from public.vertice_institutions where id=p_institution;
 if not found then raise exception 'institution_not_found' using errcode='22023'; end if;

 select sum(q.total_matriculados)::integer,max(q.data_extracao)
 into q2026,last_source
 from public.vertice_eorbit_quantitativo q
 join public.vertice_eorbit_semestres s on s.id=q.semestre_id
 where q.instituicao_id=p_institution and s.semestre='2026/02';

 select sum(q.total_matriculados)::integer into q2025
 from public.vertice_eorbit_quantitativo q
 join public.vertice_eorbit_semestres s on s.id=q.semestre_id
 where q.instituicao_id=p_institution and s.semestre='2025/02';

 select sum(enrolled)::integer into snapshots2026 from public.vertice_enrollment_snapshots
 where institution_id=p_institution and semester='2026/02' and student_status='MATRICULADO';

 select count(*)::integer,count(*) filter(where owner_user_id is null)::integer
 into goals_total,goals_unassigned from public.vertice_goals where institution_id=p_institution;

 select count(*)::integer into measurements_total from public.vertice_goal_measurements where institution_id=p_institution;
 select count(*)::integer into actions_total from public.vertice_actions where institution_id=p_institution;

 select count(*) filter(where status='enviado')::integer,count(*) filter(where status='validado')::integer
 into docs_sent,docs_validated from public.vertice_repository_files where institution_id=p_institution;

 select count(*) filter(where assigned_to is null)::integer into req_unassigned
 from public.vertice_repository_requests where institution_id=p_institution and active=true;

 valid_root:=case when length(institution_cnpj)=14 then left(institution_cnpj,8) else null end;
 select count(*)::integer into visible_mandates from public.dd_matters m
 where dd_private.can_access(m.id)
 and (m.institution_id=p_institution or
 (valid_root is not null and valid_root<>'00000000' and m.target_cnpj_root=valid_root));

 return jsonb_build_object(
   'institution_id',p_institution,'observed_at',now(),
   'matriculas',jsonb_build_object(
     'semester','2026/02','eorbit_quantitativo',q2026,
     'legacy_snapshots',snapshots2026,
     'difference',case when q2026 is not null and snapshots2026 is not null then q2026-snapshots2026 else null end,
     'year_prior_same_semester',q2025,
     'extraction_date',last_source,
     'validation','Fontes diferentes; comparar grão, cobertura e status antes de afirmar alunos únicos'),
   'governanca',jsonb_build_object('metas',goals_total,'metas_sem_conta_vinculada',goals_unassigned,
     'medicoes',measurements_total,'acoes_5w2h',actions_total),
   'documentos',jsonb_build_object('enviados',docs_sent,'validados',docs_validated,
     'solicitacoes_ativas_sem_executor',req_unassigned),
   'aquisicoes',jsonb_build_object('mandatos_visiveis_autorizados',visible_mandates,
     'cnpj',institution_cnpj,'aviso','Mandatos são segregados; CNPJ-raiz indica correspondência potencial, não autoriza troca de documentos'),
   'limites','Somente agregações autorizadas para esta IES. Sem acesso ao conteúdo dos documentos ou a dados pessoais. Divergências não devem ser corrigidas automaticamente.');
end $$;
revoke all on function public.vertice_ai_crosschecks(uuid) from public,anon;
grant execute on function public.vertice_ai_crosschecks(uuid) to authenticated;
