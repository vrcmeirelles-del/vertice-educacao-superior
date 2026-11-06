-- Dicionário de preenchimento derivado de dados existentes DA MESMA instituição.
-- Somente valores recorrentes, sem nomes de responsáveis, CNPJ, dados de alunos ou dados sigilosos da DD.
create or replace function public.vertice_form_vocabulary(p_institution uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal')<>'aal2',true)
    or not vertice_private.can_read_institution(p_institution) then
  raise exception 'Acesso institucional não autorizado' using errcode='42501';
 end if;
 with items as (
   select 'title'::text field,title::text val from public.vertice_goals where institution_id=p_institution
   union all select 'indicator',indicator from public.vertice_goals where institution_id=p_institution
   union all select 'source',source from public.vertice_goals where institution_id=p_institution
   union all select 'formula',formula from public.vertice_goals where institution_id=p_institution
   union all select 'notes',notes from public.vertice_goals where institution_id=p_institution
   union all select 'what',what from public.vertice_actions where institution_id=p_institution
   union all select 'why',why from public.vertice_actions where institution_id=p_institution
   union all select 'how',how from public.vertice_actions where institution_id=p_institution
   union all select 'evidence',evidence from public.vertice_actions where institution_id=p_institution
 ),
 grouped as (
   select field,min(btrim(val)) as value,count(*) uses
   from items
   where val is not null and length(btrim(val)) between 12 and 280
   group by field,lower(regexp_replace(btrim(val),'[[:space:]]+',' ','g'))
   having count(*)>=2
 ),
 ranked as (
   select field,value,uses,row_number() over(partition by field order by uses desc,value) rn
   from grouped
 ),
 fields as (
   select field,jsonb_agg(value order by uses desc,value) suggestions
   from ranked where rn<=12 group by field
 )
 select coalesce(jsonb_object_agg(field,suggestions),'{}'::jsonb) into output from fields;
 return output;
end $$;
revoke all on function public.vertice_form_vocabulary(uuid) from public,anon;
grant execute on function public.vertice_form_vocabulary(uuid) to authenticated;
