-- Avalia 360° — importação de competências da Construção Curricular.
-- Problemas corrigidos:
--  1. o cliente consultava vertice_app.* como se fosse public (tabelas inexistentes no schema público);
--  2. authenticated não tem uso do schema vertice_app (leitura direta impossível);
--  3. as colunas de período (origin_period, period_status) esperadas pela importação não existiam.
-- A leitura passa a ser por RPC com o mesmo escopo do Avalia 360° (AAL2 + papel + vínculo de curso).
--
-- Identidade da competência (ajuste do bloco 1): a Construção Curricular recria as competências
-- (novos ids) a cada salvamento; por isso a chave estável passa a ser código + título normalizados,
-- para competências curriculares e declaradas: 'cmp:<código>|<título>'.
begin;

alter table vertice_app.curriculum_competencies
 add column if not exists origin_period smallint check (origin_period is null or origin_period between 1 and 12),
 add column if not exists period_status text check (period_status is null or period_status in ('proposed','validated'));
comment on column vertice_app.curriculum_competencies.origin_period is 'Período de origem da competência na matriz (1–12). Opcional até a homologação do PPC.';
comment on column vertice_app.curriculum_competencies.period_status is 'proposed = período declarado; validated = homologado no PPC.';

create function public.vertice_avalia_curriculum_import(p_institution uuid,p_course uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b vertice_app.curriculum_builds;
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Leitura da matriz restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 select * into b from vertice_app.curriculum_builds x
  where x.institution_id=p_institution and x.course_id=p_course and x.status='published'
  order by x.version desc, x.updated_at desc nulls last limit 1;
 if not found then return jsonb_build_object('build',null,'competencies','[]'::jsonb,'links','[]'::jsonb); end if;
 return jsonb_build_object(
  'build',jsonb_build_object('id',b.id,'institution_id',b.institution_id,'course_id',b.course_id,'version',b.version,'status',b.status),
  'competencies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'build_id',c.build_id,'code',c.code,'title',c.title,
     'origin_period',c.origin_period,'period_status',c.period_status) order by c.sort_order nulls last, c.code)
    from vertice_app.curriculum_competencies c where c.build_id=b.id),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(jsonb_build_object('competency_id',l.competency_id,'discipline_name',l.discipline_name))
    from vertice_app.curriculum_discipline_links l join vertice_app.curriculum_competencies c on c.id=l.competency_id
    where c.build_id=b.id),'[]'::jsonb));
end $$;
revoke all on function public.vertice_avalia_curriculum_import(uuid,uuid) from public,anon;
grant execute on function public.vertice_avalia_curriculum_import(uuid,uuid) to authenticated;

-- Chave estável da competência: código + título normalizados (independe do id recriado pela matriz).
create or replace function vertice_private.avalia_competency_key(p_course uuid, c jsonb) returns text
language sql immutable set search_path='' as $$
 select 'cmp:'||lower(regexp_replace(btrim(coalesce(c->>'code','')),'\s+',' ','g'))||'|'||lower(regexp_replace(btrim(coalesce(c->>'title','')),'\s+',' ','g'))
$$;

notify pgrst, 'reload schema';
commit;
