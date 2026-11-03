"""Only targets the named disposable Docker PostgreSQL container; no remote credentials."""
import subprocess
from concurrent.futures import ThreadPoolExecutor

def sql(command):
    return subprocess.run(['docker','exec','-i','vertice-branding-postgres','psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'],input=command,text=True,capture_output=True)
uid='94000000-0000-4000-8000-000000000001'
iid='95000000-0000-4000-8000-000000000001'
setup=sql(f"insert into auth.users(id,email) values ('{uid}','concurrent@example.invalid'); insert into public.vertice_institutions(id,name) values ('{iid}','Synthetic concurrency'); insert into public.vertice_memberships(user_id,institution_id,role) values ('{uid}','{iid}','gestor'); select updated_at from public.vertice_institutions where id='{iid}';")
assert setup.returncode==0,setup.stderr
version=setup.stdout.strip().splitlines()[-1]
try:
    def write(n):
        return sql(f'''set role authenticated; set request.jwt.claims='{{"sub":"{uid}","aal":"aal2"}}'; select public.vertice_save_document_branding('{iid}','{version}','{{"header_text":"Writer {n}","theme_color":null,"logo_data":null}}');''')
    with ThreadPoolExecutor(2) as pool: results=list(pool.map(write,[1,2]))
    assert sum(r.returncode==0 for r in results)==1,[(r.returncode,r.stderr) for r in results]
    assert any('Registro alterado' in r.stderr for r in results)
    print('PASS: two concurrent writers; exactly one succeeds, one gets stale-version error')
finally:
    sql(f"delete from public.vertice_memberships where user_id='{uid}'; delete from public.vertice_institutions where id='{iid}'; delete from auth.users where id='{uid}';")
