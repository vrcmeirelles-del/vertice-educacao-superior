import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=readFileSync('client/src/lib/avalia360/Avalia360Studio.tsx','utf8');
const css=readFileSync('client/src/lib/avalia360/avalia-wizard.css','utf8');
describe('fluxo visual docente Avalia 360°',()=>{
 it('expõe três etapas e mantém seus controles com navegação funcional',()=>{
  expect(source).toContain('Preparar avaliação');
  expect(source).toContain('Elaborar questões');
  expect(source).toContain('Revisar e finalizar');
  expect(source).toContain('step===1');
  expect(source).toContain('step===2');
  expect(source).toContain('step===3');
  expect(source).toContain('onClick={()=>setStep(x.n)}');
  expect(source).toContain('setStep(3)');
 });
 it('preserva recursos críticos e mantém parâmetros avançados acessíveis',()=>{
  for(const value of [
   'QuestionBankPanel','QuestionImageField','RuleCurationPanel',
   'PedagogicalParameters','ClassBatchPublisher','Padrão de resposta esperado',
   'Critérios de correção','Competências associadas','Opções pedagógicas e análise longitudinal'
  ])expect(source).toContain(value);
 });
 it('encaminha a emissão institucional para a aplicação do caderno validado',()=>{
  expect(source).toContain('Emissão nominal com QR registrado');
  expect(source).toContain('Abrir Aplicação e respostas');
  expect(source).toContain("receipt?.status==='validated'");
  expect(source).toContain('{previewMode&&<ClassBatchPublisher previewMode={true}');
  expect(source).not.toContain('{persistenceAvailable&&<ClassBatchPublisher');
 });
 it('não promete salvamento automático nem validação jurídica',()=>{
  expect(source).toContain('Ainda não salvo. Salve na etapa final.');
  expect(source).toContain('Verificações estruturais, sem análise jurídica semântica.');
  expect(source).not.toContain('Rascunho salvo automaticamente');
 });
 it('inclui responsividade e foco visível',()=>{
  expect(css).toContain('@media(max-width:590px)');
  expect(css).toContain('.avalia-wizard button:focus-visible');
  expect(css).toContain('.avalia-columns');
 });
});
