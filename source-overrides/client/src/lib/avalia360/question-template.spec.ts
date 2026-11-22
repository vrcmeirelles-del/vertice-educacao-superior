import {describe,expect,it} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import {readSheet} from 'read-excel-file/node';
import {buildQuestionTemplate,parseHeaderRows,isBlankQuestion,HEADER_FIELDS,QUESTION_COLUMNS} from './question-template';
import {parseQuestionRows} from './question-spreadsheet';

const header={'Curso':'Direito','Disciplina':'Direito Civil','Semestre':'2027/1','Finalidade predominante':'Somativa',
 'Título da avaliação':'AV1 — Direito Civil','Nome do professor':'Prof. Exemplo','Instruções da avaliação':'Use caneta azul & preta <sem rasuras>.'};
const catalog={topics:[{id:'t1',title:'Parte Geral'}],competencies:[{id:'c1',code:'C1',title:'Interpretar normas'},{id:'c2',code:'C2',title:'Argumentar'}]};

describe('modelo de planilha do Avalia 360°',()=>{
 const bytes=buildQuestionTemplate({header,competencyCodes:['C1 — Interpretar normas'],topics:['Parte Geral']});
 it('gera um .xlsx com as abas Instruções, Cabeçalho e Questões, escapando caracteres especiais',()=>{
  const files=unzipSync(bytes);
  const wb=strFromU8(files['xl/workbook.xml']);
  expect(wb).toContain('name="Instruções"');expect(wb).toContain('name="Cabeçalho"');expect(wb).toContain('name="Questões"');
  expect(strFromU8(files['xl/worksheets/sheet2.xml'])).toContain('Use caneta azul &amp; preta &lt;sem rasuras&gt;.');
  expect(strFromU8(files['xl/worksheets/sheet3.xml'])).toContain('<dataValidation type="list"');
 });
 it('ida e volta: o cabeçalho volta com todos os campos e os exemplos importam sem erro',async()=>{
  const buffer=Buffer.from(bytes);
  const h=parseHeaderRows(await readSheet(buffer,'Cabeçalho') as unknown[][]);
  expect(h).toEqual(header);
  expect(Object.keys(h)).toHaveLength(HEADER_FIELDS.length);
  const rows=await readSheet(buffer,'Questões') as unknown[][];
  expect(rows[0]).toEqual(QUESTION_COLUMNS.map(([n])=>n));
  const r=parseQuestionRows(rows,'Direito Civil',catalog);
  expect(r.errors).toEqual([]);
  expect(r.questions.map(q=>q.kind)).toEqual(['objetiva','discursiva']);
  expect(r.questions[0].correctOptionId).toBe('A');
  expect(r.questions[1].competencyIds).toEqual(['c1','c2']);
  expect(r.questions[1].points).toBe(2);
 });
 it('cabeçalho vazio vai em branco e é ignorado na leitura',async()=>{
  const blank=buildQuestionTemplate({header:{}});
  expect(parseHeaderRows(await readSheet(Buffer.from(blank),'Cabeçalho') as unknown[][])).toEqual({});
 });
});

describe('questão vazia antes da importação',()=>{
 const blank={statement:'',options:['A','B','C','D','E'].map(id=>({id,text:''})),answerJustification:'',expectedAnswer:'',rubric:'',images:[],correctOptionId:''};
 it('reconhece a questão recém-criada e preserva qualquer questão iniciada',()=>{
  expect(isBlankQuestion(blank)).toBe(true);
  expect(isBlankQuestion({...blank,statement:'Enunciado'})).toBe(false);
  expect(isBlankQuestion({...blank,options:[{text:'x'}]})).toBe(false);
  expect(isBlankQuestion({...blank,images:[{}]})).toBe(false);
  expect(isBlankQuestion({...blank,correctOptionId:'A'})).toBe(false);
 });
});
