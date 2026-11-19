import { describe, expect, it } from 'vitest';
import { validateImageMetadata, type QuestionImage } from './question-media';

const image:QuestionImage={
 id:'img1',questionId:'q1',storageKey:'instituicao/curso/prova/img1.webp',
 sha256:'a'.repeat(64),mime:'image/webp',sizeBytes:2048,width:800,height:600,
 placement:'enunciado',order:0,caption:'Figura 1',altText:'Gráfico de distribuição de notas',
 rightsStatus:'autoral'
};
describe('mídia da questão Avalia 360°',()=>{
 it('aceita imagem do enunciado com metadados completos',()=>{
   expect(validateImageMetadata('q1',[image])).toEqual([]);
 });
 it('rejeita imagem pertencente a outra questão',()=>{
   expect(validateImageMetadata('q2',[image]).map(x=>x.code)).toContain('OTHER_QUESTION_IMAGE');
 });
 it('impede formato inseguro e arquivo excessivo',()=>{
   const output=validateImageMetadata('q1',[{...image,mime:'image/svg+xml' as QuestionImage['mime'],sizeBytes:11*1024*1024}]);
   expect(output.map(x=>x.code)).toEqual(expect.arrayContaining(['INVALID_IMAGE_MIME','INVALID_IMAGE_SIZE']));
 });
 it('exige alternativa para imagem vinculada a alternativa',()=>{
   expect(validateImageMetadata('q1',[{...image,placement:'alternativa'}]).map(x=>x.code)).toContain('MISSING_ALTERNATIVE');
 });
 it('exige descrição acessível e hash de integridade',()=>{
   const errors=validateImageMetadata('q1',[{...image,altText:'',sha256:'not-a-hash'}]);
   expect(errors.map(x=>x.code)).toEqual(expect.arrayContaining(['MISSING_ALT_TEXT','MISSING_HASH']));
 });
 it('detecta colisões de ordem e identificador',()=>{
   const errors=validateImageMetadata('q1',[image,{...image}]);
   expect(errors.map(x=>x.code)).toEqual(expect.arrayContaining(['DUPLICATE_IMAGE','DUPLICATE_SLOT']));
 });
});
