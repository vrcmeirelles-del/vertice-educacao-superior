-- Considerações finais, evidências (fotos/atas/clipagens) e planilha de conciliação AC.
begin;

alter table public.vertice_teaching_activities
  add column final_remarks text,                                   -- Considerações finais
  add column evidence_photos jsonb default '[]'::jsonb,            -- [{path, name, uploaded_at}]
  add column evidence_attendance jsonb default '[]'::jsonb,        -- Listas de frequência [{path, name}]
  add column evidence_clippings jsonb default '[]'::jsonb,         -- Clipagens [{path, name}]
  add column roster_spreadsheet_path text,                         -- Caminho no Storage da planilha nome+matrícula
  add column roster_spreadsheet_name text;                         -- Nome original do arquivo

comment on column public.vertice_teaching_activities.final_remarks is 'Considerações finais do relatório.';
comment on column public.vertice_teaching_activities.evidence_photos is 'Registro fotográfico: array JSON de objetos {path, name, uploaded_at}.';
comment on column public.vertice_teaching_activities.evidence_attendance is 'Listas de frequência/participação: array JSON de objetos {path, name}.';
comment on column public.vertice_teaching_activities.roster_spreadsheet_path is 'Planilha com nome e matrícula para conciliação com Atividades Complementares.';

notify pgrst,'reload schema';
commit;
