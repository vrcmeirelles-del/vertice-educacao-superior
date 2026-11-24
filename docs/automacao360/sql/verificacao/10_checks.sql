-- Cada verificação imprime OK/FALHA. Executado como superusuário, exceto onde SET ROLE.
\set ON_ERROR_STOP 0
\set A '00000000-0000-4000-8000-0000000000a1'
\set CA '00000000-0000-4000-8000-0000000000a2'
\set CB '00000000-0000-4000-8000-0000000000b2'
\set U1 '00000000-0000-4000-8000-000000000001'
\set U2 '00000000-0000-4000-8000-000000000002'
CREATE FUNCTION pg_temp.expect_error(sql text, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN 'FALHA (aceitou): '||label;
EXCEPTION WHEN OTHERS THEN RETURN 'OK (recusou: '||SQLSTATE||'): '||label; END $$;
CREATE FUNCTION pg_temp.expect_ok(sql text, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN 'ACEITO: '||label;
EXCEPTION WHEN OTHERS THEN RETURN 'RECUSADO ('||SQLSTATE||' '||SQLERRM||'): '||label; END $$;

-- 1. Revisão válida aprovada por outra pessoa
SELECT pg_temp.expect_ok(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,enabled,rule_ids,configured_by,approved_by,approved_at) VALUES (%L,%L,1,true,'{repo.overdue}',%L,%L,now()+interval '1 minute')$q$, :'A', :'CA', :'U1', :'U2'), 'configuração válida com aprovador distinto');
-- 2. Autoaprovação
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,enabled,rule_ids,configured_by,approved_by,approved_at) VALUES (%L,%L,2,true,'{repo.overdue}',%L,%L,now())$q$, :'A', :'CA', :'U1', :'U1'), 'autoaprovação');
-- 3. Aprovação incompleta (aprovador sem data)
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,rule_ids,configured_by,approved_by) VALUES (%L,%L,3,'{}',%L,%L)$q$, :'A', :'CA', :'U1', :'U2'), 'aprovador sem data');
-- 4. Revisão duplicada no escopo institucional (course_id NULL) — NULLS NOT DISTINCT
SELECT pg_temp.expect_ok(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,rule_ids,configured_by) VALUES (%L,NULL,1,'{}',%L)$q$, :'A', :'U1'), 'escopo institucional revisão 1');
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,rule_ids,configured_by) VALUES (%L,NULL,1,'{}',%L)$q$, :'A', :'U1'), 'revisão 1 duplicada no escopo institucional');
-- 5. Revisão zero
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,rule_ids,configured_by) VALUES (%L,%L,0,'{}',%L)$q$, :'A', :'CA', :'U1'), 'revisão zero');
-- 6. Curso de outra IES (vínculo composto ausente)
SELECT pg_temp.expect_ok(format($q$INSERT INTO vertice_automation_candidate.config_revision(institution_id,course_id,revision,rule_ids,configured_by) VALUES (%L,%L,1,'{}',%L)$q$, :'A', :'CB', :'U1'), 'IES A com curso da IES B (deveria ser recusado)');
-- 7. Digest inválido e prioridade inválida
SELECT pg_temp.expect_error($q$INSERT INTO vertice_automation_candidate.shadow_run(run_id,config_id,as_of,status,digest,source_count,unmapped_count) VALUES (gen_random_uuid(),1,now(),'evaluated','xyz',0,0)$q$, 'digest fora do formato');
SELECT pg_temp.expect_error($q$INSERT INTO vertice_automation_candidate.shadow_run(run_id,config_id,as_of,status,digest,source_count,unmapped_count) VALUES (gen_random_uuid(),1,now(),'live',repeat('a',64),0,0)$q$, 'status live');
SELECT pg_temp.expect_ok($q$INSERT INTO vertice_automation_candidate.shadow_run(run_id,config_id,as_of,status,digest,source_count,unmapped_count) VALUES ('00000000-0000-4000-8000-0000000000f1',1,now(),'partial',repeat('a',64),2,1)$q$, 'execução sombra parcial válida');
SELECT pg_temp.expect_error($q$INSERT INTO vertice_automation_candidate.shadow_run(run_id,config_id,as_of,status,digest,source_count,unmapped_count) VALUES ('00000000-0000-4000-8000-0000000000f1',1,now(),'partial',repeat('b',64),2,1)$q$, 'mesmo run_id com digest diferente (replay conflitante)');
SELECT pg_temp.expect_error($q$INSERT INTO vertice_automation_candidate.shadow_alert(run_id,alert_key,rule_id,rule_version,priority) VALUES ('00000000-0000-4000-8000-0000000000f1',repeat('c',64),'repo.overdue','v','P9')$q$, 'prioridade P9');
SELECT pg_temp.expect_ok($q$INSERT INTO vertice_automation_candidate.shadow_alert(run_id,alert_key,rule_id,rule_version,priority) VALUES ('00000000-0000-4000-8000-0000000000f1',repeat('c',64),'repo.overdue','v','P0')$q$, 'alerta válido');
SELECT pg_temp.expect_error($q$INSERT INTO vertice_automation_candidate.shadow_alert(run_id,alert_key,rule_id,rule_version,priority) VALUES ('00000000-0000-4000-8000-0000000000f1',repeat('c',64),'repo.overdue','v','P0')$q$, 'alerta duplicado na mesma execução');
-- 8. Evidência vazia na auditoria
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.audit_event(config_id,actor_id,action,evidence_ref) VALUES (1,%L,'approve','')$q$, :'U1'), 'auditoria sem evidência');
-- 9. Auditoria não é append-only no banco (UPDATE/DELETE pelo proprietário)
SELECT pg_temp.expect_ok(format($q$INSERT INTO vertice_automation_candidate.audit_event(config_id,actor_id,action,evidence_ref) VALUES (1,%L,'approve','ev-1')$q$, :'U1'), 'auditoria válida');
SELECT pg_temp.expect_ok($q$UPDATE vertice_automation_candidate.audit_event SET evidence_ref='alterado'$q$, 'UPDATE em audit_event pelo proprietário (deveria ser imutável)');

-- 10. Papéis da API: nenhum acesso
SET ROLE authenticated;
SELECT pg_temp.expect_error('SELECT 1 FROM vertice_automation_candidate.config_revision', 'authenticated lê config_revision');
SELECT pg_temp.expect_error('SELECT 1 FROM vertice_automation_candidate.shadow_alert', 'authenticated lê shadow_alert');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error('SELECT 1 FROM vertice_automation_candidate.shadow_run', 'anon lê shadow_run');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.expect_error('SELECT 1 FROM vertice_automation_candidate.audit_event', 'service_role (BYPASSRLS) lê audit_event');
SELECT pg_temp.expect_error(format($q$INSERT INTO vertice_automation_candidate.audit_event(config_id,actor_id,action,evidence_ref) VALUES (1,%L,'review','x')$q$, :'U1'), 'service_role grava audit_event');
RESET ROLE;
