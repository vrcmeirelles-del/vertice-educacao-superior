begin;
alter table public.vertice_repository_files
 add column reference text check (reference is null or length(reference)<=250),
 add column upload_note text check (upload_note is null or length(upload_note)<=4000);
-- Metadata is written on INSERT only. Existing column-level review grants remain unchanged.
comment on column public.vertice_repository_files.reference is 'Referência informada pelo remetente para esta versão do arquivo';
comment on column public.vertice_repository_files.upload_note is 'Observação do remetente para a gestão; preservada com a versão';
commit;
