-- Automação 360° — índices das chaves estrangeiras apontadas pelo verificador de desempenho do Supabase
-- (unindexed_foreign_keys) e das leituras do painel. Tabelas vazias em 25/11/2026: criação imediata.
begin;
create index if not exists config_revision_course_inst_idx on vertice_automation.config_revision(course_id, institution_id);
create index if not exists run_config_idx on vertice_automation.run(config_id);
create index if not exists run_scope_recent_idx on vertice_automation.run(institution_id, course_id, recorded_at desc);
create index if not exists run_alert_rule_idx on vertice_automation.run_alert(rule_id);
create index if not exists alert_course_inst_idx on vertice_automation.alert(course_id, institution_id);
create index if not exists alert_rule_idx on vertice_automation.alert(rule_id);
create index if not exists alert_source_run_idx on vertice_automation.alert(source_run);
create index if not exists event_scope_recent_idx on vertice_automation.event(institution_id, course_id, id desc);
commit;
