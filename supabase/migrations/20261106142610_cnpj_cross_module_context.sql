-- Vértice: cruzamento de cadastro institucional e mandatos, apenas em leitura.
-- Raiz de CNPJ identifica família de estabelecimentos, NÃO prova identidade da filial.
-- Nunca usar nomes aproximados ou marcador 00000000 para autorizar intercâmbio.
create or replace function public.vertice_cnpj_matter_context(p_matter uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.dd_matters%rowtype; root text; valid_root boolean; candidates jsonb; sponsor jsonb;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal')<>'aal2',true)
   or not coalesce(dd_private.can_access(p_matter),false) then
  raise exception 'Acesso ao mandato não autorizado' using errcode='42501';
 end if;
 select * into m from public.dd_matters where id=p_matter;
 if not found then raise exception 'Mandato não encontrado' using errcode='22023'; end if;
 root:=upper(regexp_replace(coalesce(m.target_cnpj_root,''),'[^[:alnum:]]','','g'));
 valid_root:=length(root)=8 and root~'^[0-9A-Z]{8}$' and root<>'00000000';
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i.id,'name',i.name,'cnpj',i.cnpj,'emec_code',i.emec_code,'city',i.city,'state',i.state,
  'courses',(select count(*) from public.vertice_courses c where c.institution_id=i.id),
  'goals',(select count(*) from public.vertice_goals g where g.institution_id=i.id),
  'requests',(select count(*) from public.vertice_repository_requests r where r.institution_id=i.id)
 ) order by i.name),'[]'::jsonb) into candidates
 from public.vertice_institutions i
 where valid_root and i.status='ativa'
 and length(upper(regexp_replace(coalesce(i.cnpj,''),'[^[:alnum:]]','','g')))=14
 and left(upper(regexp_replace(i.cnpj,'[^[:alnum:]]','','g')),8)=root
 and vertice_private.can_read_institution(i.id);
 select jsonb_build_object('id',i.id,'name',i.name,'cnpj',i.cnpj) into sponsor
 from public.vertice_institutions i where i.id=m.institution_id and vertice_private.can_read_institution(i.id);
 return jsonb_build_object('matter_id',p_matter,'matter_code',m.code,'target',m.target_name,'cnpj_root',root,
  'status',case when not valid_root then 'cnpj_alvo_pendente'
                when jsonb_array_length(candidates)=0 then 'sem_correspondencia_autorizada'
                else 'raiz_correspondente_conferencia_necessaria' end,
  'contracting_institution',sponsor,'academic_candidates',candidates,
  'notice','Correspondência por raiz de CNPJ não identifica automaticamente o estabelecimento. Não mistura dados de mandatos e respeita as permissões.');
end $$;
revoke all on function public.vertice_cnpj_matter_context(uuid) from public,anon;
grant execute on function public.vertice_cnpj_matter_context(uuid) to authenticated;

create or replace function public.vertice_cnpj_academic_context(p_institution uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare root text; title text; full_cnpj text;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal')<>'aal2',true)
    or not vertice_private.can_read_institution(p_institution) then
  raise exception 'Acesso institucional não autorizado' using errcode='42501';
 end if;
 select upper(regexp_replace(coalesce(cnpj,''),'[^[:alnum:]]','','g')),name
 into full_cnpj,title from public.vertice_institutions where id=p_institution and status='ativa';
 if not found then raise exception 'Instituição não encontrada' using errcode='22023'; end if;
 root:=case when length(full_cnpj)=14 then left(full_cnpj,8) else null end;
 return jsonb_build_object(
 'institution_id',p_institution,'institution',title,'cnpj',full_cnpj,
 'matters',coalesce((select jsonb_agg(jsonb_build_object(
  'id',m.id,'code',m.code,'target',m.target_name,
  'relation',case when root is not null and root<>'00000000' and m.target_cnpj_root=root then 'raiz_do_alvo'
   else 'instituicao_contratante' end
 ) order by m.created_at desc)
 from public.dd_matters m where dd_private.can_access(m.id)
 and ((m.institution_id=p_institution) or
      (root is not null and root<>'00000000' and m.target_cnpj_root=root))
 ),'[]'::jsonb),
 'notice','Somente mandatos acessíveis ao usuário. Raiz coincidente exige conferência da pessoa jurídica e do perímetro do mandato.');
end $$;
revoke all on function public.vertice_cnpj_academic_context(uuid) from public,anon;
grant execute on function public.vertice_cnpj_academic_context(uuid) to authenticated;
