-- Somente ampliação do catálogo e restrição do anexo de declarações.
alter table public.dd_shared_data drop constraint dd_shared_data_key_check;
alter table public.dd_shared_data add constraint dd_shared_data_key_check check(key in ('institution','courses','faculty','students','financial','contracts','disputes','premises','systems','privacy','tax','legal_cases','dismissals','certificates','deal_disclosures'));
drop policy shared_read on public.dd_shared_data;
create policy shared_read on public.dd_shared_data for select to authenticated using(dd_private.shared_visible(matter_id,front_scope) and (key<>'deal_disclosures' or public.dd_is_matter_lead(matter_id)));
