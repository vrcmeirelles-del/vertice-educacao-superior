import {describe,expect,it} from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {PDFDocument} from 'pdf-lib';
import {assignVariants,normalizeScannedCode} from './papers-api';
import {matchingShuffleMode} from './IssuedPapersPanel';
import {buildVariantMap,snapshotQuestions} from './answer-entry';
import {buildIndividualizedPdf,registeredIssues} from './individualized-pdf';
import type {QuestionDraft} from './question-draft';
import type {StoredAssessmentDraft} from './draft-api';

const base={disciplineId:'civil',rubric:'',topicIds:[],competencyIds:[],purpose:['formativa'] as QuestionDraft['purpose'],estimatedDifficulty:3 as const,examTags:[],images:[]};
const qs:QuestionDraft[]=[
 {...base,id:'q1',kind:'objetiva',statement:'Qual alternativa é correta no caso apresentado?',options:[{id:'A',text:'Primeira'},{id:'B',text:'Segunda'},{id:'C',text:'Terceira'}],correctOptionId:'B',answerJustification:'B.',points:2},
 {...base,id:'q2',kind:'objetiva',statement:'Assinale a alternativa adequada ao enunciado.',options:[{id:'A',text:'Um'},{id:'B',text:'Dois'}],correctOptionId:'A',answerJustification:'A.',points:1},
];
const draft={id:'d',revision:1,status:'validated',snapshot:{questions:qs as unknown as Array<Record<string,unknown>>,meta:{title:'AV1'}}} as StoredAssessmentDraft;
const token='a'.repeat(32)+'0123456789abcdef0123456789abcdef';
const qr='VA360:2:'+token.toUpperCase();

describe('cadernos com QR registrado',()=>{
 it('normaliza o código lido ou digitado',()=>{
  expect(normalizeScannedCode(' abcd-2345 ')).toBe('ABCD2345');
  expect(normalizeScannedCode(qr.toLowerCase())).toBe(qr);
 });
 it('distribui as versões alternadamente na ordem da lista',()=>{
  expect(assignVariants([{a:1},{a:2},{a:3}],['A','B']).map(x=>x.variant)).toEqual(['A','B','A']);
  expect(()=>assignVariants([{a:1}],[])).toThrow();
 });
 it('identifica o embaralhamento que reproduz o mapa gravado (e recusa mapa alheio)',()=>{
  const snap=snapshotQuestions(draft.snapshot.questions);
  for(const m of ['questoes','alternativas','ambos'] as const){
   const map=buildVariantMap(snap,2,m);
   const found=matchingShuffleMode(draft,{variantCount:2,variantMap:map});
   expect(found).not.toBeNull();
   expect(buildVariantMap(snap,2,found!)).toEqual(map);
  }
  expect(matchingShuffleMode(draft,{variantCount:1,variantMap:{A:[{q:'q2',o:['B','A']},{q:'q1',o:['A','B','C']}]}})).toBeNull();
 });
 it('o QR impresso é lido de volta pelo mesmo decodificador da câmera (jsQR)',async()=>{
  const code=QRCode.create(qr,{errorCorrectionLevel:'M'});
  const n=code.modules.size,scale=6,quiet=4,size=(n+quiet*2)*scale;
  const rgba=new Uint8ClampedArray(size*size*4).fill(255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(code.modules.get(x,y))
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=(((y+quiet)*scale+dy)*size+(x+quiet)*scale+dx)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;}
  expect(jsQR(rgba,size,size)?.data).toBe(qr);
 });
 it('o PDF registrado usa a versão atribuída pelo servidor e recusa versão inexistente',async()=>{
  const info={institutionName:'Vértice',courseName:'Direito',discipline:'Civil',title:'AV1',semester:'2027/1',classLabel:'3º',questions:qs,variantCount:2,shuffleMode:'ambos' as const};
  const papers=[{paperId:'p1',label:'Ana',enrollment:'2027001',variant:'B',qr,shortCode:'ABCD2345',studentId:'s1'},
   {paperId:'p2',label:'Ouvinte 01',enrollment:null,variant:'A',qr:qr.replace('A','B'),shortCode:'EFGH6789',studentId:null}];
  const bytes=await buildIndividualizedPdf(info,registeredIssues(papers));
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(4);
  await expect(buildIndividualizedPdf(info,registeredIssues([{...papers[0],variant:'Z'}]))).rejects.toThrow(/Versão Z/);
 });
});
