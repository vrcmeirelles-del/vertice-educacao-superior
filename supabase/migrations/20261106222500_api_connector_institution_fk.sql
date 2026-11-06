-- Proteção adicional: cada lote deve usar conexão pertencente à mesma instituição.
alter table vertice_private.api_connections
  add constraint api_connections_id_institution_unique unique(id,institution_id);
alter table vertice_private.api_sync_batches
  add constraint api_sync_batch_connection_institution_fkey
  foreign key (connection_id,institution_id)
  references vertice_private.api_connections(id,institution_id) on delete restrict;
