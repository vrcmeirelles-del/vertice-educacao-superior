#!/usr/bin/env bash
# Concorrência real (sessões paralelas) da migração candidata em PostgreSQL descartável local.
# Uso: PGHOST=/caminho/do/socket PGUSER=postgres bash scripts/tests/automacao360-sql/concorrencia-pg.sh
# Não usa produção. Requer PostgreSQL >= 15 (UNIQUE NULLS NOT DISTINCT).
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"; R="$D/../../.."
DB="auto360_conc_$$"
Q() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
psql -X -q -d postgres -c "create database $DB"
trap 'psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
Q -f "$D/fixture.sql"
awk '/create function vertice_private.course_function\(/,/^\$\$;/' "$R/supabase/migrations/20261122170000_course_staff_functions.sql" | Q
Q -f "$R/supabase/migrations/20261124210000_automacao360_nucleo.sql"
Q -f "$R/supabase/migrations/20261124210001_automacao360_catalogo.sql"
I=00000000-0000-4000-8000-000000000101; C=00000000-0000-4000-8000-000000000201
G1=00000000-0000-4000-8000-000000000002; G2=00000000-0000-4000-8000-000000000003
Q -c "insert into vertice_institutions values ('$I','UNITOP sintética','superior'); insert into vertice_courses values ('$C','$I','Direito','DIR');
      insert into vertice_memberships values ('$G1','$I','gestor'),('$G2','$I','gestor');"
as_user() { printf "set request.jwt.claim.sub='%s'; set request.jwt.claim.aal='aal2'; set role authenticated;\n" "$1"; }
pass=0; fail=0; ok() { echo "OK   - $1"; pass=$((pass+1)); }; ko() { echo "FALHA - $1"; fail=$((fail+1)); }

# 1. Duas propostas simultâneas com a mesma revisão esperada: só uma pode vencer.
( as_user $G1; echo "begin; select vertice_automation_propose_config('$I',null,'{repo.due}',true,'operational',24,0,'Sessão A concorrente'); select pg_sleep(2); commit;" ) | Q >/tmp/conc_a.log 2>&1 &
sleep 0.5
( as_user $G2; echo "begin; select vertice_automation_propose_config('$I',null,'{repo.due}',true,'operational',24,0,'Sessão B concorrente'); commit;" ) | Q >/tmp/conc_b.log 2>&1 || true
wait
n=$(Q -tAc "select count(*) from vertice_automation.config_revision")
[ "$n" = 1 ] && grep -q "revisão concorrente" /tmp/conc_b.log && ok "propostas concorrentes: 1 revisão gravada, a segunda recusada por CAS" || ko "propostas concorrentes (revisões=$n)"

# Aprova (G2) e grava uma execução operacional com um alerta, como o executor do servidor.
cfg=$(Q -tAc "select id from vertice_automation.config_revision")
( as_user $G2; echo "select vertice_automation_approve_config($cfg,'Aprovação para o teste');" ) | Q >/dev/null
RUN=00000000-0000-4000-8000-0000000000e1; K=$(printf 'a%.0s' {1..64})
P="{\"runId\":\"$RUN\",\"institutionId\":\"$I\",\"courseId\":null,\"configRevision\":1,\"asOf\":\"2026-11-24T12:00:00Z\",\"status\":\"evaluated\",\"sourceCount\":1,\"unmappedCount\":0,\"digest\":\"$K\",\"alerts\":[{\"key\":\"$K\",\"rule\":\"repo.due\",\"version\":\"2026.11-proposal.1\",\"priority\":\"P0\"}]}"

# 2. Duas gravações simultâneas do mesmo run_id: nenhuma duplicata.
( echo "set role service_role; begin; select vertice_automation_record_run('$P'); select pg_sleep(2); commit;" ) | Q >/tmp/conc_c.log 2>&1 &
sleep 0.5
( echo "set role service_role; select vertice_automation_record_run('$P');" ) | Q >/tmp/conc_d.log 2>&1 || true
wait
runs=$(Q -tAc "select count(*) from vertice_automation.run"); alerts=$(Q -tAc "select count(*) from vertice_automation.alert")
[ "$runs" = 1 ] && [ "$alerts" = 1 ] && grep -q existing /tmp/conc_d.log && ok "gravações concorrentes do mesmo run_id: 1 execução, 1 alerta e confirmação existing" || ko "gravações concorrentes (runs=$runs alerts=$alerts)"

# 3. Duas decisões simultâneas sobre o mesmo alerta com a mesma revisão: só uma.
A=$(Q -tAc "select id from vertice_automation.alert")
due=$(date -u -d '+7 day' +%Y-%m-%dT%H:%M:%SZ)
( as_user $G1; echo "begin; select vertice_automation_decide('$A','approve',0,'Decisão da sessão A','$G1','$due'); select pg_sleep(2); commit;" ) | Q >/tmp/conc_e.log 2>&1 &
sleep 0.5
( as_user $G2; echo "begin; select vertice_automation_decide('$A','reject',0,'Decisão da sessão B'); commit;" ) | Q >/tmp/conc_f.log 2>&1 || true
wait
st=$(Q -tAc "select status||'/'||revision from vertice_automation.alert"); ev=$(Q -tAc "select count(*) from vertice_automation.event where entity='alert'")
[ "$st" = "approved/1" ] && [ "$ev" = 1 ] && grep -q "revisão concorrente" /tmp/conc_f.log && ok "decisões concorrentes: aprovada uma vez, a outra recusada por CAS" || ko "decisões concorrentes (estado=$st eventos=$ev)"

echo "Resultado: $pass aprovados, $fail falhas"; [ "$fail" = 0 ]
