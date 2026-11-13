-- Aplicada no projeto em 13/11/2026 (versão 20261113214910).
-- O módulo Atividades Complementares grava em ac/<institution_id>/<student_id>/...
-- As políticas de isolamento do bucket exigiam institution_id na 1ª pasta e bloqueavam esse caminho.
-- Mantém o isolamento por IES: a pasta da instituição é a 1ª, ou a 2ª quando a 1ª é 'ac'.
alter policy doc_read on storage.objects to authenticated
  using (bucket_id = 'vertice-documents' and (
    ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[1] = 'ac' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[2])::uuid))));

alter policy doc_upload on storage.objects to authenticated
  with check (bucket_id = 'vertice-documents' and (
    ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[1] = 'ac' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[2])::uuid))));

alter policy doc_delete on storage.objects to authenticated
  using (bucket_id = 'vertice-documents' and (
    ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[1] = 'ac' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and vertice_private.can_read_institution(((storage.foldername(name))[2])::uuid))));
