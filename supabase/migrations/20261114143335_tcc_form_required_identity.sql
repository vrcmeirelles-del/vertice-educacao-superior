begin;
-- A course-wide notice may omit individual authors/advisor; other document
-- definitions retain the identity fields required by their source structures.
update public.vertice_tcc_form_templates t set definition=jsonb_set(t.definition,'{fields}',(
 select jsonb_agg(case when item->>'key' in ('authors','advisor') then jsonb_set(item,'{required}','true'::jsonb) else item end order by position)
 from jsonb_array_elements(t.definition->'fields') with ordinality as fields(item,position)
)) where t.code<>'edital';
commit;
