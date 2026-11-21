import {describe,expect,it} from 'vitest';
import {receiptScopeKey,reusableReceipt,type ReceiptContext} from './receipt-cache';
const ctx:ReceiptContext={institutionId:'ies-1',courseId:'direito',disciplineId:'civil',questionId:'q1'};
const file={name:'figura.png'} as File;
const receipt={imageId:'m1',path:'ies-1/direito/autor/q1/figura.png',sha256:'a'.repeat(64),mime:'image/png',sizeBytes:100};
const scoped={file,scopeKey:receiptScopeKey(ctx),receipt};
describe('cache de recibos do Avalia 360°',()=>{
 it('reutiliza apenas arquivo e escopo idênticos',()=>{
   expect(reusableReceipt(scoped,file,ctx)).toEqual(receipt);
 });
 it('não reutiliza em outra instituição, curso, disciplina ou questão',()=>{
   for(const field of ['institutionId','courseId','disciplineId','questionId'] as const)
     expect(reusableReceipt(scoped,file,{...ctx,[field]:'outro'})).toBeNull();
 });
 it('rejeita outro arquivo mesmo com mesmo nome',()=>{
   expect(reusableReceipt(scoped,{name:'figura.png'} as File,ctx)).toBeNull();
 });
 it('rejeita recibo de caminho incoerente com o escopo',()=>{
   expect(reusableReceipt({...scoped,receipt:{...receipt,path:'ies-2/direito/autor/q1/figura.png'}},file,ctx)).toBeNull();
 });
});
