-- Avalia 360° — análise de itens pela Teoria Clássica dos Testes (sem IA).
-- Entram só folhas completas (sem discursiva pendente). Fórmulas explícitas:
--  facilidade p = média de (nota do item / valor do item)
--  discriminação D = p(27% superior) - p(27% inferior), ordem por nota total e id (desempate determinístico)
--  ponto-bisserial corrigido = correlação de Pearson entre o item e (total - item)
--  alfa de Cronbach = k/(k-1) * (1 - soma das variâncias dos itens / variância do total) (= KR-20 em prova só objetiva)
-- Variâncias populacionais. A interpretação (faixas) fica no cliente, versionada.
begin;

create function public.vertice_avalia_item_analysis(p_institution uuid,p_course uuid,p_application uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.vertice_avalia_applications; snap jsonb; v_n integer; v_g integer; total_sheets integer; result jsonb;
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Análise restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 a := vertice_private.avalia_application_access(p_application,false);
 if a.institution_id<>p_institution or a.course_id<>p_course then raise exception 'Aplicação não localizada.' using errcode='P0002'; end if;
 snap := (select v.snapshot from public.vertice_avalia_draft_revisions v where v.draft_id=a.draft_id and v.revision=a.revision);
 select count(*) into total_sheets from public.vertice_avalia_sheets s where s.application_id=a.id;
 select count(*) into v_n from public.vertice_avalia_sheets s where s.application_id=a.id
  and not exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.outcome='pending');
 v_g := greatest(1, round(0.27*v_n)::integer);

 with ok as (
  select s.id, s.total_score::numeric total from public.vertice_avalia_sheets s
  where s.application_id=a.id and not exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.outcome='pending')
 ), ranked as (
  select ok.*, row_number() over (order by total desc, id) rk_hi, row_number() over (order by total asc, id) rk_lo from ok
 ), items as (
  select i.question_id, i.kind, i.outcome, i.chosen_option, i.score::numeric score, i.max_score::numeric mx,
   case when i.max_score>0 then i.score::numeric/i.max_score else 0 end frac,
   r.total - i.score::numeric rest, r.rk_hi<=v_g up, r.rk_lo<=v_g lo
  from public.vertice_avalia_item_scores i join ranked r on r.id=i.sheet_id
 ), stats as (
  select question_id, max(kind) kind, max(mx) mx, count(*) n,
   avg(frac) p, avg(frac) filter (where up) p_up, avg(frac) filter (where lo) p_lo,
   corr(frac, rest) rpb, var_pop(score) var_item,
   count(*) filter (where outcome='blank') blanks, count(*) filter (where outcome='multiple') multiples
  from items group by question_id
 ), opts as (
  select question_id, chosen_option, count(*) n, count(*) filter (where up) n_up, count(*) filter (where lo) n_lo
  from items where kind='objetiva' and chosen_option is not null group by question_id, chosen_option
 ), qs as (
  select q.value v, q.ordinality::int ord from jsonb_array_elements(snap->'questions') with ordinality q
 )
 select jsonb_build_object(
  'applicationId',a.id,'classLabel',a.class_label,'appliedOn',a.applied_on,'status',a.status,
  'sheets',total_sheets,'complete',v_n,'groupSize',v_g,
  'meanScore',(select round(avg(total),3) from ok),
  'sdScore',(select round(stddev_pop(total),3) from ok),
  'maxScore',(select coalesce(sum((v->>'points')::numeric),0) from qs),
  'alpha',(select case when count(*)>1 and (select var_pop(total) from ok)>0
     then round((count(*)::numeric/(count(*)-1))*(1-sum(var_item)/(select var_pop(total) from ok)),4) end from stats),
  'scoreDistribution',coalesce((select jsonb_agg(jsonb_build_object('bin',b,'count',c) order by b) from (
     select least(9,floor(10*total/nullif((select sum((v->>'points')::numeric) from qs),0)))::int b,count(*) c from ok group by 1) d),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
     'questionId',q.v->>'id','order',q.ord,'kind',q.v->>'kind','statement',left(q.v->>'statement',200),
     'points',(q.v->>'points')::numeric,'declaredDifficulty',(q.v->>'estimatedDifficulty')::numeric,
     'sourceBankId',q.v->>'sourceBankId','correctOptionId',q.v->>'correctOptionId',
     'n',st.n,'p',round(st.p,4),'pUpper',round(st.p_up,4),'pLower',round(st.p_lo,4),
     'discrimination',case when v_n>=4 then round(st.p_up-st.p_lo,4) end,
     'pointBiserial',case when v_n>=4 then round(st.rpb::numeric,4) end,
     'blanks',st.blanks,'multiples',st.multiples,
     'options',case when q.v->>'kind'='objetiva' then (select jsonb_agg(jsonb_build_object('optionId',o->>'id',
         'correct',o->>'id'=q.v->>'correctOptionId','n',coalesce(op.n,0),'nUpper',coalesce(op.n_up,0),'nLower',coalesce(op.n_lo,0)) order by oo)
        from jsonb_array_elements(q.v->'options') with ordinality x(o,oo)
        left join opts op on op.question_id=q.v->>'id' and op.chosen_option=o->>'id') end
    ) order by q.ord)
   from qs q left join stats st on st.question_id=q.v->>'id'),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.vertice_avalia_item_analysis(uuid,uuid,uuid) from public,anon;
grant execute on function public.vertice_avalia_item_analysis(uuid,uuid,uuid) to authenticated;

-- Calibração do Banco de Questões: só aplicações ENCERRADAS (dados finais).
-- p agregado sobre todas as folhas completas; D = média de D por aplicação, ponderada pelo n.
create function public.vertice_avalia_bank_calibration(p_institution uuid,p_course uuid,p_discipline text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not vertice_private.avalia_access(p_institution,p_course,'record') then
  raise exception 'Calibração restrita à equipe autorizada deste curso, com MFA.' using errcode='42501';
 end if;
 return coalesce((
  with apps as (
   select x.id, v.snapshot from public.vertice_avalia_applications x
   join public.vertice_avalia_draft_revisions v on v.draft_id=x.draft_id and v.revision=x.revision
   where x.institution_id=p_institution and x.course_id=p_course and x.status='closed'
     and lower(x.discipline)=lower(vertice_private.avalia_discipline(p_discipline))
  ), qmap as (
   select apps.id app, q->>'id' qid, q->>'sourceBankId' bank from apps, jsonb_array_elements(apps.snapshot->'questions') q
   where nullif(q->>'sourceBankId','') is not null
  ), ok as (
   select s.id, s.application_id app, s.total_score::numeric total from public.vertice_avalia_sheets s
   where s.application_id in (select id from apps)
     and not exists(select 1 from public.vertice_avalia_item_scores i where i.sheet_id=s.id and i.outcome='pending')
  ), ranked as (
   select ok.*, count(*) over (partition by app) n_app,
    row_number() over (partition by app order by total desc, id) rk_hi,
    row_number() over (partition by app order by total asc, id) rk_lo from ok
  ), items as (
   select m.bank, r.app, r.n_app, case when i.max_score>0 then i.score::numeric/i.max_score else 0 end frac,
    r.rk_hi<=greatest(1,round(0.27*r.n_app)) up, r.rk_lo<=greatest(1,round(0.27*r.n_app)) lo
   from public.vertice_avalia_item_scores i join ranked r on r.id=i.sheet_id
   join qmap m on m.app=r.app and m.qid=i.question_id
  ), per_app as (
   select bank, app, count(*) n, avg(frac) p,
    case when max(n_app)>=4 then avg(frac) filter (where up) - avg(frac) filter (where lo) end d
   from items group by bank, app
  )
  select jsonb_object_agg(bank, jsonb_build_object('applications',apps_n,'n',n,'p',round(p,4),'discrimination',round(d,4)))
  from (select bank, count(*) apps_n, sum(n) n, sum(p*n)/sum(n) p,
          sum(d*n) filter (where d is not null)/nullif(sum(n) filter (where d is not null),0) d
        from per_app group by bank) z
 ),'{}'::jsonb);
end $$;
revoke all on function public.vertice_avalia_bank_calibration(uuid,uuid,text) from public,anon;
grant execute on function public.vertice_avalia_bank_calibration(uuid,uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
