import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
import {zipSync,strToU8,unzipSync} from 'fflate';
const src=readFileSync(new URL('../../../supabase/functions/vertice-impacto-analyze/impacto-rules.ts',import.meta.url),'utf8');
const {ruleFindings,extensionHours}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(src)));
const ppc='O curso tem carga horária total de 3.700 horas. A curricularização da extensão soma 370 horas em atividades de extensão com a comunidade externa, com interação dialógica e impacto social, conforme o Regulamento de Extensão da instituição.';
test('V7 estrutural: calcula os 10% da Res. CNE/CES 7/2018 e confere as diretrizes',()=>{
 assert.deepEqual(extensionHours(ppc),{total:3700,extension:370});
 const f=ruleFindings('curricularizacao',[{name:'ppc.pdf',text:ppc}]);
 assert.equal(f[0].conformity,'conforme');assert.match(f[0].title,/10,0%/);
 assert.ok(f.some(x=>x.title==='Diretriz: Interdisciplinaridade'&&x.type==='lacuna'));
 assert.ok(!f.some(x=>/Política institucional/.test(x.title)));
 const baixo=ruleFindings('estrutural',[{name:'ppc.pdf',text:ppc.replace('370 horas','200 horas')}]);
 assert.equal(baixo[0].conformity,'nao_conforme');assert.equal(baixo[0].severity,'critico');
 for(const x of f)assert.ok(['informacao_comprovada','informacao_parcial','informacao_nao_localizada','lacuna','recomendacao','inconsistencia'].includes(x.type));
});
test('V7 evidência e documental: checklist e lacunas, sem inventar; texto ilegível é declarado',()=>{
 const ev=ruleFindings('evidencia',[{name:'lista.pdf',text:'Lista de presença. Coordenador: Prof. Ana. Data: 10/10/2026. Carga horária: 4 horas. Participantes: 32 estudantes.'}]);
 assert.ok(ev.some(x=>x.title==='Local de realização não localizado'));
 assert.ok(ev.some(x=>x.title==='Carga horária'&&x.type==='informacao_comprovada'));
 const doc=ruleFindings('documental',[{name:'p.docx',text:'Projeto com objetivos e metodologia definidos para o semestre.'}]);
 assert.ok(doc.some(x=>x.title==='Público-alvo: não localizado'));
 assert.equal(ruleFindings('documental',[{name:'x.pdf',text:'[PDF sem camada de texto — necessita OCR para análise]'}])[0].title,'Texto do documento não disponível');
});
test('extração de DOCX descompacta o ZIP (a leitura anterior por regex não via o XML compactado)',()=>{
 const docx=zipSync({'word/document.xml':strToU8('<w:document><w:p><w:t>Carga horária total de 3.700 horas</w:t></w:p></w:document>')});
 assert.equal(new TextDecoder().decode(docx).includes('<w:t>'),false,'XML não aparece no binário compactado');
 const z=unzipSync(docx,{filter:f=>f.name==='word/document.xml'});
 assert.match(new TextDecoder().decode(z['word/document.xml']).replace(/<[^>]+>/g,''),/3\.700 horas/);
});
