// Busca de evidências com filtro por seção (migração 20261125210000): a função nova tem de ser a vigente
// (20261125140000) mais exatamente quatro inserções — parâmetro, coluna de seção em cada fonte e o filtro.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const NAME = '20261125210000_busca_evidencias_secao.sql';
const novo = read((existsSync(new URL('supabase/migrations/' + NAME, root)) ? 'supabase/migrations/' : 'supabase/migrations_nao_aplicadas/') + NAME);
const vigente = read('supabase/migrations/20261125140000_enade360_busca_texto_preanalisado.sql');
const corpo = (s) => { const i = s.indexOf('FUNCTION public.vertice_evidence_search'); return s.slice(i, s.indexOf('$function$;', i)); };

test('sem seção, a busca é a vigente: só as quatro inserções do filtro', () => {
  let esperado = corpo(vigente)
    .replace("p_limit integer DEFAULT 30)", "p_limit integer DEFAULT 30, p_section text DEFAULT NULL::text)")
    .replace("where t.prevalidation_id=pv.id) as text_tsv\n", "where t.prevalidation_id=pv.id) as text_tsv,\n r.repository_section as section\n")
    .replace(" to_tsvector('portuguese',coalesce(d.extracted_text,''))\n", " to_tsvector('portuguese',coalesce(d.extracted_text,'')),null::text\n")
    .replace("null::text,null::tsvector from", "null::text,null::tsvector,null::text from")
    .replace(" where public.vertice_evidence_can_manage(p_institution_id)\n", " where public.vertice_evidence_can_manage(p_institution_id)\n and (p_section is null or s.section = p_section)\n");
  assert.equal(corpo(novo), esperado);
});

test('assinatura antiga removida e permissões iguais às de produção (authenticated e service_role)', () => {
  assert.match(novo, /drop function public\.vertice_evidence_search\(uuid, uuid, text, boolean, integer\);/);
  assert.match(novo, /revoke all on function public\.vertice_evidence_search\(uuid, uuid, text, boolean, integer, text\) from public, anon;/);
  assert.match(novo, /grant execute on function public\.vertice_evidence_search\(uuid, uuid, text, boolean, integer, text\) to authenticated, service_role;/);
  assert.doesNotMatch(novo, /security definer/i, 'continua SECURITY INVOKER (RLS do usuário)');
});

// Execução real em PostgreSQL descartável: cadeia de migrações de produção + a nova.
import {readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const I='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000001',
 R1='30000000-0000-4000-8000-000000000001',R2='30000000-0000-4000-8000-000000000002',R3='30000000-0000-4000-8000-000000000003',
 F1='40000000-0000-4000-8000-000000000001',F2='40000000-0000-4000-8000-000000000002',F3='40000000-0000-4000-8000-000000000003';
const mig=(suffix)=>{const dir=new URL('supabase/migrations/',root);return readFileSync(new URL(readdirSync(dir).find(n=>n.endsWith(suffix)),dir),'utf8');};

test('com seção, só arquivos daquela seção; sem seção, o mesmo resultado da função vigente',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema vertice_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('app.aal',true))$$;
 create function vertice_private.can_read_institution(uuid) returns boolean language sql stable as $$select $1::text=current_setting('app.institution',true)$$;
 create function vertice_private.is_master() returns boolean language sql stable as $$select true$$;
 create function vertice_private.has_role(uuid,text[]) returns boolean language sql stable as $$select false$$;
 create table vertice_doc_prevalidation(id uuid primary key default gen_random_uuid(),institution_id uuid,repository_file_id uuid,document_id uuid,created_at timestamptz default now(),ai_error text);
 create table vertice_doc_indicator_links(prevalidation_id uuid,institution_id uuid,status text,instrument_code text,instrument_version text,object_code text,evidence_excerpts jsonb);
 create table vertice_repository_requests(id uuid,institution_id uuid,course_id uuid,goal_id uuid,repository_section text);
 create table vertice_repository_files(id uuid,institution_id uuid,request_id uuid,file_name text,document_category text,instrument_indicators text[]);
 create table vertice_documents(id uuid,institution_id uuid,course_id uuid,title text,category_code text,tags text[],extracted_text text,sha256 text);
 create table vertice_inep_library(id uuid,institution_id uuid,title text,library_key text,indicator text,sha256 text,active boolean);`);
 for(const s of ['_enade360_evidence_text_index.sql','_enade360_repository_index_queue.sql','_enade360_extraction_failure_trace.sql','_enade360_ocr_provenance_notice.sql','_enade360_busca_texto_preanalisado.sql'])await db.exec(mig(s));
 await db.exec(`insert into vertice_repository_requests values('${R1}','${I}',null,null,'recredenciamento_2017'),('${R2}','${I}',null,null,'novo_instrumento_2026_institucional'),('${R3}','${I}','${C}',null,null);
 insert into vertice_repository_files values('${F1}','${I}','${R1}','PDI vigente.pdf','instrumento',array['1.1']),('${F2}','${I}','${R2}','PDI 2026.pdf','instrumento',array['E1.1']),('${F3}','${I}','${R3}','PDI curso.pdf','instrumento',array['1.1']);
 insert into vertice_documents values(gen_random_uuid(),'${I}',null,'PDI geral','pdi',array['pdi'],'Plano de desenvolvimento institucional PDI',null);
 insert into vertice_inep_library values(gen_random_uuid(),'${I}','Guia PDI','guia','1.1',null,true);
 grant usage on schema auth,vertice_private to authenticated;grant select on all tables in schema public to authenticated;
 select set_config('app.uid','${C}',false),set_config('app.aal','aal2',false),set_config('app.institution','${I}',false);`);
 const q=async(sql,args)=>{await db.exec('set role authenticated');try{return (await db.query(sql,args)).rows;}finally{await db.exec('reset role');}};
 const antes=await q('select * from public.vertice_evidence_search($1,$2,$3,$4,50)',[I,C,'PDI',true]);
 assert.ok(antes.length>=4,'fixture cobre arquivos, documento e biblioteca');
 await db.exec(novo);
 const depois=await q('select * from public.vertice_evidence_search($1,$2,$3,$4,50)',[I,C,'PDI',true]);
 assert.deepEqual(depois,antes,'sem seção: idêntico à função vigente');
 const sec=(s)=>q('select source_id from public.vertice_evidence_search($1,null,$2,true,50,$3)',[I,'PDI',s]);
 assert.deepEqual((await sec('recredenciamento_2017')).map(r=>r.source_id),[F1]);
 assert.deepEqual((await sec('novo_instrumento_2026_institucional')).map(r=>r.source_id),[F2]);
 assert.equal((await sec('secao_inexistente')).length,0);
 assert.equal((await q("select has_function_privilege('anon','public.vertice_evidence_search(uuid,uuid,text,boolean,integer,text)','execute') as x",[]))[0].x,false);
 assert.equal((await q("select count(*)::int n from pg_proc where proname='vertice_evidence_search'",[]))[0].n,1,'assinatura antiga removida');
 await db.close();
});
