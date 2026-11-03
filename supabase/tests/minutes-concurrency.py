"""Real overlapping PostgreSQL transactions; Python stdlib + psql only.

Connects ONLY to 127.0.0.1. Creates a randomly named disposable database,
loads bootstrap/migration/fixtures, and drops that database in finally.
Two authenticated writers plus a read-only lock observer are used. No timing
assumption releases the winning transaction: pg_blocking_pids must first prove
that the second writer is blocked by the first. Any timeout fails the test.
"""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--pg-bin', required=True, type=Path)
parser.add_argument('--port', required=True, type=int)
args = parser.parse_args()
psql = str(args.pg_bin / ('psql.exe' if os.name == 'nt' else 'psql'))
database = 'minutes_concurrency_' + uuid.uuid4().hex
root = Path(__file__).resolve().parents[1]
base = [psql, '-X', '-h', '127.0.0.1', '-p', str(args.port), '-U', 'postgres', '-A', '-t', '-q']
# Never inherit a service/connection string or password from another environment.
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['PGCLIENTENCODING'] = 'UTF8'
env['PGCONNECT_TIMEOUT'] = '5'

def run(sql=None, file=None, db=database):
    cmd = base + ['-d', db, '-v', 'ON_ERROR_STOP=1']
    if file:
        cmd += ['-f', str(file)]
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True,
                            encoding='utf-8', env=env, timeout=30)
    if result.returncode:
        raise AssertionError(result.stderr + result.stdout)
    return result.stdout.strip()

class Connection:
    def __init__(self):
        self.proc = subprocess.Popen(base + ['-d', database, '-v', 'ON_ERROR_STOP=0',
                                            '-v', 'VERBOSITY=verbose'],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True,
                                     encoding='utf-8', bufsize=1, env=env)
        self.lines = queue.Queue()
        def read():
            for line in self.proc.stdout:
                self.lines.put(line.rstrip('\n'))
            self.lines.put(None)
        threading.Thread(target=read, daemon=True).start()
        self.pid = int(self.query('select pg_backend_pid();')[0])

    def query(self, sql, expected='00000'):
        marker = 'END_' + uuid.uuid4().hex
        self.proc.stdin.write(sql + '\n\\echo ' + marker + ' :SQLSTATE\n')
        self.proc.stdin.flush()
        output = []
        deadline = time.monotonic() + 20
        while True:
            line = self.lines.get(timeout=max(.01, deadline - time.monotonic()))
            if line is None:
                raise AssertionError('psql terminated: ' + '\n'.join(output))
            if line.startswith(marker):
                state = line.split()[-1]
                assert state == expected, (state, expected, output)
                return output
            if line:
                output.append(line)

    def begin(self):
        self.query("begin; set local statement_timeout='15s'; set local role authenticated; "
                   "select set_config('request.jwt.claims',"
                   "'{\"sub\":\"10000000-0000-4000-8000-000000000001\",\"aal\":\"aal2\"}',true);")

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.write('rollback;\n\\q\n')
            self.proc.stdin.flush()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=5)

body = json.dumps(dict(meetingType='ordinaria', number='', date='', time='',
    location='', chair='', secretary='', quorum='', agenda='PPC', previousMinutes='',
    discussion='', decisions='', nextMeeting='', participants='', actions=[]))
inst = '20000000-0000-4000-8000-000000000001'
course = '30000000-0000-4000-8000-000000000001'
source = '40000000-0000-4000-8000-000000000001'

def rpc(doc, version, mutation, title):
    assert title.isascii() and "'" not in title
    return (f"select public.vertice_save_minutes_draft('{doc}','{inst}','{course}',"
            f"'{source}','{title}','{body}'::jsonb,{version},'{mutation}');")

def direct(doc, version, mutation, title):
    assert title.isascii() and "'" not in title
    return (f"update public.vertice_minutes_drafts set title='{title}',"
            f"version={version + 1},mutation_id='{mutation}' where id='{doc}';")

def verify(observer, doc, title, version):
    result = observer.query(f"select jsonb_build_object('title',title,'version',version,"
        f"'revisions',(select count(*) from public.vertice_minutes_revisions where draft_id='{doc}'),"
        f"'audit',(select count(*) from public.vertice_audit where table_name='vertice_minutes_drafts' and record_id='{doc}'),"
        f"'titles',(select jsonb_agg(snapshot->>'title' order by version) from public.vertice_minutes_revisions where draft_id='{doc}')) "
        f"from public.vertice_minutes_drafts where id='{doc}';")
    actual = json.loads(result[0])
    assert actual == dict(title=title, version=version, revisions=version, audit=version,
                         titles=([title] if version == 1 else ['Initial', title])), actual

def overlap(a, b, observer, first, second, expected):
    a.begin()
    first_result = a.query(first)
    b.begin()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(b.query, second, expected)
        try:
            deadline = time.monotonic() + 10
            while True:
                blocked = observer.query(f'select {a.pid}=any(pg_blocking_pids({b.pid}));')[0]
                if blocked == 't':
                    break
                assert not pending.done(), 'second writer did not overlap/block'
                assert time.monotonic() < deadline, 'lock overlap not observed'
                time.sleep(.025)
            assert not pending.done(), 'waiter completed before winner commit'
            a.query('commit;')
            second_result = pending.result(timeout=15)
            b.query('commit;' if expected == '00000' else 'rollback;')
        except BaseException:
            a.query('rollback;')
            raise
    return first_result, second_result

created = False
connections = []
try:
    run(f'create database {database};', db='postgres')
    created = True
    run(file=root / 'tests/minutes-bootstrap.sql')
    run(file=root / 'migrations/20261103160346_inep_minutes_drafts.sql')
    run(file=root / 'tests/minutes-drafts.sql')
    print('PASS sequential SQL regression including null course/source rejection; fixtures rolled back', flush=True)
    # Reuse the same synthetic fixture inserts as the sequential regression suite.
    seed = (root / 'tests/minutes-drafts.sql').read_text(encoding='utf-8').split('create function pg_temp.body()', 1)[0]
    assert seed.count('begin;') == 1 and 'rollback;' not in seed
    run(seed + '\ncommit;')
    a, b, observer = [Connection() for _ in range(3)]
    connections.extend([a, b, observer])
    for label, writer, waiter in [('RPC vs RPC', rpc, rpc),
                                  ('direct UPDATE vs RPC', direct, rpc),
                                  ('RPC vs direct UPDATE', rpc, direct)]:
        doc = str(uuid.uuid4())
        a.begin(); a.query(rpc(doc, 0, str(uuid.uuid4()), 'Initial')); a.query('commit;')
        overlap(a, b, observer, writer(doc, 1, str(uuid.uuid4()), 'Winner'),
                waiter(doc, 1, str(uuid.uuid4()), 'Loser'), '40001')
        verify(observer, doc, 'Winner', 2)
        print(f'PASS {label}: observed blocking; winner committed; loser SQLSTATE 40001; original and winner history intact; exactly 2 revisions/audits', flush=True)
    doc, mutation = str(uuid.uuid4()), str(uuid.uuid4())
    left, right = overlap(a, b, observer, rpc(doc, 0, mutation, 'Same operation'),
                          rpc(doc, 0, mutation, 'Same operation'), '00000')
    assert json.loads(left[0]) == json.loads(right[0]), 'retry returned a different snapshot'
    verify(observer, doc, 'Same operation', 1)
    print('PASS concurrent create/retry: observed blocking; identical returned snapshot; exactly 1 document/version/audit', flush=True)
    doc = str(uuid.uuid4())
    overlap(a, b, observer, rpc(doc, 0, str(uuid.uuid4()), 'Create winner'),
            rpc(doc, 0, str(uuid.uuid4()), 'Create loser'), '40001')
    verify(observer, doc, 'Create winner', 1)
    print('PASS concurrent distinct creates: observed blocking; loser SQLSTATE 40001; exactly 1 document/version/audit', flush=True)
finally:
    for connection in connections:
        connection.close()
    if created:
        run(f'drop database {database};', db='postgres')
        print('CLEANUP disposable concurrency database dropped; no production connection', flush=True)
