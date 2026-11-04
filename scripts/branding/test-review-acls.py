"""Reconcile ACLs only in fresh databases of the named disposable Docker container."""
import json
import subprocess
import uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2]
container='vertice-branding-postgres'
def sql(db,statement):
    return subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True)
def checked(db,statement):
    result=sql(db,statement)
    assert result.returncode==0,result.stderr
    return result.stdout.strip()
baseline=['supabase/migrations/202610260001_access_foundation.sql','supabase/migrations/202610300001_area_real.sql','supabase/migrations/20261101224102_institutional_inep_library.sql']
permissions="""select jsonb_object_agg(attname,jsonb_build_array(has_column_privilege('authenticated',attrelid,attnum,'UPDATE'),has_column_privilege('authenticated',attrelid,attnum,'UPDATE WITH GRANT OPTION'))) from pg_attribute where attrelid='public.vertice_institutions'::regclass and attnum>0 and not attisdropped and attname<>'document_branding';"""
for case,restrict in [
 ('broad',''),
 ('broad_column_grant','grant update(name) on public.vertice_institutions to authenticated with grant option;'),
 ('broad_grant','grant update on public.vertice_institutions to authenticated with grant option;'),
 ('columns', 'revoke update on public.vertice_institutions from authenticated; grant update(name) on public.vertice_institutions to authenticated with grant option; grant update(notes) on public.vertice_institutions to authenticated;'),
 ('none','revoke update on public.vertice_institutions from authenticated;'),
 ('inherited','grant update on public.vertice_institutions to public;')]:
    db='branding_acl_'+uuid.uuid4().hex[:12]
    checked('postgres','create database '+db)
    try:
        # Cluster roles already exist from bootstrap; schemas are new per test database.
        checked(db,'\n'.join((root/'scripts/branding/bootstrap-test-db.sql').read_text().splitlines()[4:]))
        for path in baseline: checked(db,(root/path).read_text())
        checked(db,restrict)
        before=json.loads(checked(db,permissions))
        result=sql(db,(root/'supabase/review/institution_document_branding.sql').read_text())
        if case=='inherited':
            assert result.returncode!=0 and 'explicit ACL reconciliation' in result.stderr,result.stderr
            assert checked(db,"select count(*) from information_schema.columns where table_name='vertice_institutions' and column_name='document_branding'")=='0'
        else:
            assert result.returncode==0,result.stderr
            assert checked(db,"select has_column_privilege('authenticated','public.vertice_institutions','document_branding','UPDATE')")=='f'
        assert json.loads(checked(db,permissions))==before,case+' changed existing permissions'
        if case=='broad':
            for test in ['institution_document_branding.sql','institution_logo.sql','inep_library.sql']:
                checked(db,(root/'supabase/tests'/test).read_text())
        print('PASS ACL '+case+': existing column rights/grant options preserved; '+('unsafe inheritance rejected with rollback' if case=='inherited' else 'direct branding UPDATE denied'))
    finally:
        checked('postgres','drop database '+db)
