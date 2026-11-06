#!/usr/bin/env python3
"""Bootstrap a fresh private PostgreSQL cluster and test real concurrent sessions.

No DSN, host, credential, existing cluster or production target is accepted.
Only Python stdlib and installed official PostgreSQL binaries are required.
Without --execute-isolated, this is a read-only prerequisite check.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import select
import shutil
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
DRAFT = HERE.parent / 'proposal.sql'
BASELINE = HERE / 'baseline-foundation.sql'
BASELINE_SHA256 = '0a79566238fe1b43076690bf26d66fb646fc02dbbaa9698f637795990c241fcd'
DBNAME = 'vertice_master_concurrency_test'
PORT = '65438'  # Unix socket name only: TCP listeners are explicitly disabled.
SIGNATURES = [
    'public.vertice_list_masters(integer,timestamptz,uuid)',
    'public.vertice_list_master_invitations(integer,timestamptz,uuid)',
    'public.vertice_issue_master_invitation(text,text)',
    'public.vertice_preview_master_invitation(uuid,text)',
    'public.vertice_accept_master_invitation(uuid,text)',
    'public.vertice_revoke_master_invitation(uuid)',
]


def uid(n):
    return f'20000000-0000-4000-8000-{n:012d}'


def token(n):
    return base64.urlsafe_b64encode(hashlib.sha256(f'NO-EXTERNAL-VALIDITY-native-{n}'.encode()).digest()).decode().rstrip('=')


def digest(n):
    return hashlib.sha256(token(n).encode()).hexdigest()


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def actor(n):
    if n is None:
        return ''  # Isolated bootstrap owner; only for synthetic administrative races.
    claims = json.dumps({'sub': uid(n), 'aal': 'aal2', 'role': 'authenticated'})
    return f"select set_config('request.jwt.claims',{quote(claims)},true);set local role authenticated;"


def find_bin(explicit):
    candidates = [Path(explicit)] if explicit else []
    if not explicit:
        found = shutil.which('initdb')
        if found:
            candidates.append(Path(found).resolve().parent)
        candidates.extend(sorted(Path('/usr/lib/postgresql').glob('*/bin'), reverse=True))
    required = ('initdb', 'pg_ctl', 'postgres', 'psql')
    for directory in candidates:
        directory = directory.resolve()
        if all((directory / name).is_file() and os.access(directory / name, os.X_OK) for name in required):
            return directory
    return None


class NativeRun:
    def __init__(self, binaries, report):
        self.binaries = binaries
        self.report = report
        self.started = False
        self.root = None
        self.env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
        self.env['LC_ALL'] = 'C'
        self.user = pwd.getpwuid(os.geteuid()).pw_name
        self.race_number = 0

    def executable(self, name):
        return str(self.binaries / name)

    def command(self, args, timeout=40):
        result = subprocess.run(args, capture_output=True, text=True, env=self.env, timeout=timeout)
        if result.returncode:
            # No real credentials/data can exist here; include useful local startup diagnostics.
            raise RuntimeError(f'{Path(args[0]).name} failed: {result.stderr[-1500:]}')
        return result

    def start(self):
        if os.geteuid() == 0:
            raise RuntimeError('Run as a non-root Unix user; initdb refuses root. No server started.')
        self.root = Path(tempfile.mkdtemp(prefix='vertice-mpg-'))
        self.root.chmod(0o700)
        self.data = self.root / 'data'
        self.socket = self.root / 'socket'
        self.socket.mkdir(mode=0o700)
        self.env['PGPASSFILE'] = str(self.root / 'no-password-file')
        self.command([self.executable('initdb'), '-D', str(self.data), '-U', self.user,
                      '--auth-local=peer', '--auth-host=reject', '--encoding=UTF8', '--no-locale'])
        # Fresh private cluster only. No TCP listener, password, shared account or
        # persistent external access is created. Filesystem mode 0700 scopes peer.
        with (self.data / 'postgresql.conf').open('a') as config:
            config.write("\nlisten_addresses = ''\n")
            config.write(f'unix_socket_directories = {quote(self.socket)}\n')
            config.write('unix_socket_permissions = 0700\n')
            config.write(f'port = {PORT}\n')
            config.write("log_statement = 'none'\nlog_min_error_statement = 'panic'\n")
        self.command([self.executable('pg_ctl'), '-D', str(self.data), '-l', str(self.root / 'server.log'), '-w', 'start'])
        self.started = True
        self.args = [self.executable('psql'), '-X', '--no-password', '-h', str(self.socket),
                     '-p', PORT, '-U', self.user, '-d', DBNAME, '-qAt',
                     '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
        initial = self.args.copy()
        initial[initial.index(DBNAME)] = 'postgres'
        result = subprocess.run(initial, input=f'create database {DBNAME};', capture_output=True,
                                text=True, env=self.env, timeout=20)
        if result.returncode:
            raise RuntimeError('Failed to create fresh synthetic database: ' + result.stderr[-1000:])
        assert self.scalar(f"select current_database()={quote(DBNAME)} and inet_server_addr() is null and current_setting('listen_addresses')='' and current_setting('data_directory')={quote(self.data)}") == 't'
        assert int(self.scalar("select current_setting('server_version_num')")) >= 150000
        assert self.scalar("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')") == '0'
        self.report['server_version'] = self.scalar('select version()')
        self.report['isolated_cluster_directory'] = str(self.root)
        self.report['tcp_enabled'] = False

    def stop(self):
        # pg_ctl may time out after postgres actually starts. Check only the
        # freshly generated cluster's PID file before leaving an uncertain start.
        if self.started or (self.root and (self.root / 'data' / 'postmaster.pid').exists()):
            self.command([self.executable('pg_ctl'), '-D', str(self.data), '-m', 'fast', '-w', 'stop'])
            self.started = False
            self.report['server_stopped'] = True

    def run(self, sql, name='vm_control', check=True):
        prefix = f"set application_name={quote(name)};set statement_timeout='20s';set lock_timeout='15s';"
        result = subprocess.run(self.args, input=prefix + sql, text=True, capture_output=True,
                                env=self.env, timeout=25)
        if check and result.returncode:
            # Error contains only synthetic SQL. Preserve actionable SQLSTATE.
            raise RuntimeError(f'{name}: {result.stderr[-1600:]}')
        return result

    def scalar(self, sql):
        lines = self.run(sql).stdout.strip().splitlines()
        if not lines:
            raise AssertionError('Expected scalar output')
        return lines[-1]

    def as_scalar(self, n, sql):
        return self.scalar('begin;' + actor(n) + sql + ';commit;')

    def assert_value(self, sql, expected, label):
        actual = self.scalar(sql)
        if actual != str(expected):
            raise AssertionError(f'{label}: expected {expected!r}, got {actual!r}')

    def passed(self, name, **details):
        self.report['results'].append({'name': name, 'status': 'passed', **details})
        print('PASS ' + name, flush=True)

    def invite(self, recipient, issuer=1, fixture=None):
        fixture = recipient if fixture is None else fixture
        response = json.loads(self.as_scalar(issuer, f"select public.vertice_issue_master_invitation('native-{recipient}@example.invalid','{digest(fixture)}')"))
        assert set(response) == {'id', 'email', 'expires_at'}
        return response['id']

    def accept_sql(self, invitation, fixture):
        return f"select public.vertice_accept_master_invitation('{invitation}','{token(fixture)}')"

    def assert_acceptance(self, invitation, recipient, expected, label):
        self.assert_value(f"select count(*) from public.vertice_admins where user_id='{uid(recipient)}'", expected, label + ': grant')
        self.assert_value(f"select count(*) from vertice_private.master_invitation_audit where invitation_id='{invitation}' and event='accepted'", expected, label + ': audit')
        self.assert_value(f"select count(*) from vertice_private.master_invitations where id='{invitation}' and accepted_at is not null", expected, label + ': consumed')

    def race(self, name, a_actor, a_sql, b_actor, b_sql, expected_b_code=None, expected_b_message=None, hold_after_block=0):
        """A owns real locks, B is observed blocked by A, then A commits."""
        self.race_number += 1
        a_name, b_name = f'vm_a_{self.race_number}', f'vm_b_{self.race_number}'
        a = subprocess.Popen(self.args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, env=self.env)
        b = None
        try:
            a.stdin.write(f"set application_name='{a_name}';set statement_timeout='20s';set lock_timeout='15s';begin;{actor(a_actor)}{a_sql};\n\\echo VM_A_BARRIER\n")
            a.stdin.flush()
            output = b''
            deadline = time.monotonic() + 15
            while b'VM_A_BARRIER\n' not in output and time.monotonic() < deadline:
                readable, _, _ = select.select([a.stdout], [], [], 0.1)
                if readable:
                    chunk = os.read(a.stdout.fileno(), 4096)
                    output += chunk
                    if not chunk:
                        break
            if b'VM_A_BARRIER\n' not in output:
                raise AssertionError(name + ': A failed before lock barrier')
            b = subprocess.Popen(self.args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, env=self.env)
            b.stdin.write(f"set application_name='{b_name}';set statement_timeout='20s';set lock_timeout='15s';begin;{actor(b_actor)}{b_sql};commit;\n")
            b.stdin.close()
            b.stdin = None
            blocked = False
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                blocking = self.scalar(f"select exists(select 1 from pg_stat_activity b join pg_stat_activity a on a.application_name='{a_name}' where b.application_name='{b_name}' and b.wait_event_type='Lock' and a.pid=any(pg_blocking_pids(b.pid)))")
                if blocking == 't':
                    blocked = True
                    break
                if b.poll() is not None:
                    break
                time.sleep(0.03)
            if not blocked:
                raise AssertionError(name + ': B was not observed blocked by A; no concurrency PASS claimed')
            self.report['real_concurrency_executed'] = True
            if hold_after_block:
                time.sleep(hold_after_block)
            a.stdin.write('commit;\n')
            a.stdin.close()
            a.stdin = None
            _, a_error = a.communicate(timeout=20)
            _, b_error = b.communicate(timeout=20)
            if a.returncode:
                raise AssertionError(name + ': A commit failed: ' + a_error[-500:])
            if expected_b_code:
                if b.returncode == 0 or not re.search(r'\b' + re.escape(expected_b_code) + r'\b', b_error):
                    raise AssertionError(name + ': B did not return SQLSTATE ' + expected_b_code + ': ' + b_error[-800:])
                if expected_b_message and expected_b_message not in b_error:
                    raise AssertionError(name + ': B returned the wrong error: ' + b_error[-800:])
            elif b.returncode:
                raise AssertionError(name + ': B unexpectedly failed: ' + b_error[-800:])
            self.passed(name, observed_blocking=True, waiting_session='B', blocker='A', b_sqlstate=expected_b_code or '00000')
        finally:
            for process in (a, b):
                if process and process.poll() is None:
                    process.kill()
                    process.communicate()

    def exercise(self):
        self.run((HERE / 'auth-stub.sql').read_text())
        # Exact repository foundation, NOT a hand-copied minimal replacement.
        self.run(BASELINE.read_text())
        self.run('''grant usage on schema vertice_private to service_role;
          alter default privileges in schema public,vertice_private grant all on tables to service_role;
          alter default privileges in schema public,vertice_private grant all on sequences to service_role;
          alter default privileges in schema public,vertice_private grant all on functions to service_role;''')
        self.run(DRAFT.read_text())
        for role in ['anon', 'authenticated', 'service_role']:
            for signature in SIGNATURES:
                self.assert_value(f"select has_function_privilege('{role}',{quote(signature)},'EXECUTE')", 'f', 'default RPC ACL')
        for table in ['master_invitation_config', 'master_invitations', 'master_invitation_audit']:
            for privilege in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']:
                self.assert_value(f"select has_table_privilege('service_role','vertice_private.{table}','{privilege}')", 'f', 'service role direct ACL')
        self.assert_value('select enabled from vertice_private.master_invitation_config', 'f', 'feature disabled')
        self.passed('actual foundation loads; default service_role privileges revoked; feature disabled')
        self.run(f"insert into auth.users(id,email,email_confirmed_at) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'native-'||n||'@example.invalid',now() from generate_series(1,60)n;insert into public.vertice_admins(user_id) values('{uid(1)}'),('{uid(2)}');")
        self.run('grant execute on function ' + ','.join(SIGNATURES) + ' to authenticated;update vertice_private.master_invitation_config set enabled=true;')

        # 1: Two issues against absent row: advisory lock, not only row locking.
        issue = lambda n: f"select public.vertice_issue_master_invitation('native-10@example.invalid','{digest(n)}')"
        self.race('same-email issue: exactly one invitation', 1, issue(10), 2, issue(1010), 'P0001', 'duplicate_master_invitation')
        self.assert_value("select count(*) from vertice_private.master_invitations where target_email='native-10@example.invalid'", 1, 'one issued row')
        self.assert_value("select count(*) from vertice_private.master_invitation_audit where target_email='native-10@example.invalid' and event='issued'", 1, 'one issue audit')

        # 2: Only first acceptance grants/consumes/audits.
        inv = self.invite(11)
        self.race('double accept: exactly one grant', 11, self.accept_sql(inv, 11), 11, self.accept_sql(inv, 11), 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 11, 1, 'double accept')

        # 3 and 4: Both orderings of revoke versus accept.
        inv = self.invite(12)
        self.race('revoke wins before waiting accept', 1, f"select public.vertice_revoke_master_invitation('{inv}')", 12, self.accept_sql(inv, 12), 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 12, 0, 'revoke wins')
        inv = self.invite(13)
        self.race('accept wins before waiting revoke', 13, self.accept_sql(inv, 13), 1, f"select public.vertice_revoke_master_invitation('{inv}')", 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 13, 1, 'accept wins')

        # 5 and 6: Current issuer authority is locked, never just JWT cached.
        inv = self.invite(14, issuer=2)
        self.race('issuer removal wins before waiting accept', None, f"delete from public.vertice_admins where user_id='{uid(2)}'", 14, self.accept_sql(inv, 14), 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 14, 0, 'issuer removal wins')
        self.run(f"insert into public.vertice_admins(user_id) values('{uid(2)}')")
        inv = self.invite(15, issuer=2)
        self.race('accepted transaction holds issuer authority until commit', 15, self.accept_sql(inv, 15), None, f"delete from public.vertice_admins where user_id='{uid(2)}'")
        self.assert_acceptance(inv, 15, 1, 'accept before issuer removal')
        self.run(f"insert into public.vertice_admins(user_id) values('{uid(2)}')")

        # 7 and 8: The recipient identity and confirmation cannot change mid-grant.
        inv = self.invite(16)
        self.race('recipient email change wins before waiting accept', None, f"update auth.users set email='changed-16@example.invalid' where id='{uid(16)}'", 16, self.accept_sql(inv, 16), 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 16, 0, 'email change wins')
        inv = self.invite(17)
        self.race('recipient confirmation removal wins before waiting accept', None, f"update auth.users set email_confirmed_at=null where id='{uid(17)}'", 17, self.accept_sql(inv, 17), 'P0001', 'invitation_unavailable')
        self.assert_acceptance(inv, 17, 0, 'confirmation removal wins')

        # 9: The FK on a manual admin insertion locks the recipient identity.
        # Acceptance must recheck Master membership after that wait completes.
        inv = self.invite(18)
        self.race('manual Master grant races accept: no partial consumption', None, f"insert into public.vertice_admins(user_id) values('{uid(18)}')", 18, self.accept_sql(inv, 18), 'P0001', 'invitation_unavailable')
        self.assert_value(f"select count(*) from public.vertice_admins where user_id='{uid(18)}'", 1, 'one manual grant')
        self.assert_value(f"select count(*) from vertice_private.master_invitation_audit where invitation_id='{inv}' and event='accepted'", 0, 'no partial acceptance audit')
        self.assert_value(f"select accepted_at is null from vertice_private.master_invitations where id='{inv}'", 't', 'not consumed after conflict')

        # 10 and 11: Both orderings for the kill switch versus in-flight grant.
        inv = self.invite(19)
        self.race('disable wins before waiting accept', None, 'update vertice_private.master_invitation_config set enabled=false', 19, self.accept_sql(inv, 19), 'P0001', 'master_invitations_disabled')
        self.assert_acceptance(inv, 19, 0, 'disable wins')
        self.run('update vertice_private.master_invitation_config set enabled=true')
        inv = self.invite(20)
        self.race('accepted transaction holds configuration until commit', 20, self.accept_sql(inv, 20), None, 'update vertice_private.master_invitation_config set enabled=false')
        self.assert_acceptance(inv, 20, 1, 'accept before disable')
        self.run('update vertice_private.master_invitation_config set enabled=true')

        # 12: Expiration can pass during an authority lock wait: recheck clock.
        inv = self.invite(21, issuer=2)
        self.run(f"update vertice_private.master_invitations set created_at=clock_timestamp()-interval '1 day',expires_at=clock_timestamp()+interval '3 seconds' where id='{inv}'")
        self.race('expiration rechecked after waiting issuer lock', None, f"select 1 from public.vertice_admins where user_id='{uid(2)}' for update", 21, self.accept_sql(inv, 21), 'P0001', 'invitation_unavailable', hold_after_block=3.3)
        self.assert_acceptance(inv, 21, 0, 'expired while waiting')

        # Serial transaction fault injection on the real engine, separate from races.
        inv = self.invite(22)
        self.run("""create function vertice_private.native_fail_audit() returns trigger language plpgsql as $$begin if new.event='accepted' then raise exception 'SYNTHETIC_AUDIT_FAILURE';end if;return new;end$$;
          create trigger native_fail_audit before insert on vertice_private.master_invitation_audit for each row execute function vertice_private.native_fail_audit();""")
        result = self.run('begin;' + actor(22) + self.accept_sql(inv, 22) + ';commit;', check=False)
        assert result.returncode != 0 and 'SYNTHETIC_AUDIT_FAILURE' in result.stderr
        self.assert_acceptance(inv, 22, 0, 'audit rollback')
        self.assert_value(f"select count(*) from public.vertice_audit where table_name='vertice_admins' and action='INSERT' and record_id='{uid(22)}'", 0, 'legacy audit rolled back')
        self.run('drop trigger native_fail_audit on vertice_private.master_invitation_audit;drop function vertice_private.native_fail_audit();')
        self.passed('native transaction: audit failure rolls back grant and both ledgers')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', help='Directory of already installed official PostgreSQL binaries')
    parser.add_argument('--execute-isolated', action='store_true', help='Initialize NEW private temporary cluster, test, then stop it')
    options = parser.parse_args()
    report = {'status': 'prerequisites_only', 'production_access': False, 'network_used': False,
              'real_concurrency_executed': False, 'results': []}
    report_file = HERE / ('native-run-results.json' if options.execute_isolated else 'native-prerequisites.json')
    run = None
    exit_code = 0
    try:
        if hashlib.sha256(BASELINE.read_bytes()).hexdigest() != BASELINE_SHA256:
            raise RuntimeError('Pinned repository foundation hash mismatch; review baseline before any SQL execution.')
        report['baseline_sha256'] = BASELINE_SHA256
        report['proposal_sha256'] = hashlib.sha256(DRAFT.read_bytes()).hexdigest()
        binaries = find_bin(options.pg_bin)
        report['binaries_found'] = str(binaries) if binaries else None
        if not binaries:
            report['status'] = 'blocked'
            report['blocker'] = 'PostgreSQL initdb, pg_ctl, postgres and psql are not installed. No server or concurrent tests executed.'
            exit_code = 2
        elif not options.execute_isolated:
            report['status'] = 'ready_not_executed'
        else:
            run = NativeRun(binaries, report)
            run.start()
            run.exercise()
            report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        exit_code = 1
    finally:
        if run:
            try:
                run.stop()
            except Exception as error:
                report['status'] = 'failed'
                report['shutdown_error'] = str(error)
                exit_code = 1
        report_file.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
