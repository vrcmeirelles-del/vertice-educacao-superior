import {describe,expect,it,vi} from 'vitest';
vi.mock('@/lib/supabase',()=>({supabase:{}}));
import {cleanDistractorNotes,editableQuestionsFromSnapshot} from './draft-api';
describe('erro conceitual por alternativa',()=>{
 it('guarda só alternativas erradas existentes, com texto aparado e até 200 caracteres',()=>{
  expect(cleanDistractorNotes({options:[{id:'A',text:'a'},{id:'B',text:'b'},{id:'C',text:'c'}],correctOptionId:'A',
   distractorNotes:{A:'não vale (é a correta)',B:'  Confunde   prescrição  ',C:'',Z:'inexistente'}})).toEqual({B:'Confunde prescrição'});
  expect(cleanDistractorNotes({options:[{id:'A',text:'a'},{id:'B',text:'b'}],correctOptionId:'A',distractorNotes:{B:'x'.repeat(300)}}).B).toHaveLength(200);
 });
 it('volta ao reabrir o caderno salvo',()=>{
  const out=editableQuestionsFromSnapshot({questions:[{id:'q1',kind:'objetiva',statement:'Enunciado do caso concreto',options:[{id:'A',text:'a'},{id:'B',text:'b'}],
   correctOptionId:'A',distractorNotes:{B:'Confunde prescrição'},images:[]}]});
  expect(out?.questions[0].distractorNotes).toEqual({B:'Confunde prescrição'});
 });
});
