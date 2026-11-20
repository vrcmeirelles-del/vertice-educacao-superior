import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const src=readFileSync(new URL('../../../supabase/functions/vertice-instrumento-sync/index.ts',import.meta.url),'utf8');
const part=src.slice(src.indexOf('const CATALOG'),src.indexOf('const codes'))+src.slice(src.indexOf('type Doc'),src.indexOf('Deno.serve('));
const {heuristicLinks}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(part)));
const link=(title,file='a.pdf',instructions='')=>heuristicLinks([{file:{id:'f1',file_name:file},request:{title,instructions}}]).map(x=>x.object_code);
test('correspondência 2017→2026 por algoritmo: siglas, termos distintivos e nada genérico',()=>{
 assert.deepEqual(link('PDI vigente','pdi.pdf','Plano de Desenvolvimento Institucional vigente.')[0],'E1.1');
 assert.deepEqual(link('Política de privacidade e LGPD','lgpd.pdf','Encarregado de dados (DPO)'),['E4.3']);
 assert.deepEqual(link('Regimento interno','regimento.pdf'),['E4.1']);
 assert.ok(link('Relatório da CPA 2025','cpa.pdf','Autoavaliação institucional').includes('E1.2'));
 assert.deepEqual(link('Horário de aulas e de avaliações','horario.pdf','Evidenciar planejamento e divulgação'),[]);
 const [l]=heuristicLinks([{file:{id:'f1',file_name:'lgpd.pdf'},request:{title:'LGPD'}}]);
 assert.match(l.rationale,/conteúdo do arquivo não analisado/);assert.ok(l.confidence>=0.5&&l.confidence<=0.85);
});
test('a função não chama mais IA',()=>{
 const body=src.replace(/\{const __aiFetch[\s\S]*?as typeof fetch;\}/,'');
 assert.doesNotMatch(body,/api\.openai\.com|OPENAI_API_KEY|ai_metadata/);
});
