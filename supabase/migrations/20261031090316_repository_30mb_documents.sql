begin;
alter table public.vertice_repository_files drop constraint vertice_repository_files_size_bytes_check;
alter table public.vertice_repository_files add constraint vertice_repository_files_size_bytes_check check(size_bytes between 1 and 31457280);
update storage.buckets set file_size_limit=31457280 where id='vertice-repositorios';
commit;
