import {describe,expect,it} from 'vitest';
import {transitionDraft,type DraftSnapshot,type DraftCommand} from './draft-lifecycle';
const original:DraftSnapshot={id:'draft-1',revision:1,status:'draft',
  scope:{institutionId:'ies-a',courseId:'direito',buildId:'ppc-v2',buildVersion:2,
    authorId:'docente-a',disciplineId:'direito-civil'},
  questionIds:['q1'],mediaIds:['m1']};
const command:DraftCommand={operation:'save',expectedRevision:1,actorId:'docente-a',
  role:'professor',authorizedCourseId:'direito',curriculumReady:true,
  validatedMediaIds:['m1']};
describe('ciclo de vida de rascunhos do Avalia 360°',()=>{
  it('salva nova revisão sem modificar a original',()=>{
    const before=structuredClone(original);
    const out=transitionDraft(original,command);
    expect(out.ok).toBe(true);
    expect(out.next?.revision).toBe(2);
    expect(original).toEqual(before);
  });
  it('bloqueia sobrescrita concorrente',()=>{
    expect(transitionDraft(original,{...command,expectedRevision:0}).errors).toContain('VERSION_CONFLICT');
  });
  it('não permite que professor de outro curso grave',()=>{
    expect(transitionDraft(original,{...command,authorizedCourseId:'medicina'}).errors).toContain('COURSE_FORBIDDEN');
  });
  it('rejeita mídia não validada antes do envio',()=>{
    expect(transitionDraft(original,{...command,operation:'submit',validatedMediaIds:[]}).errors).toContain('UNVERIFIED_MEDIA');
  });
  it('exige matriz curricular íntegra',()=>{
    expect(transitionDraft(original,{...command,curriculumReady:false}).errors).toContain('CURRICULUM_UNAVAILABLE');
  });
  it('exige autor para salvar e submeter',()=>{
    expect(transitionDraft(original,{...command,actorId:'gestor',role:'gestor'}).errors).toContain('AUTHOR_REQUIRED');
  });
  it('exige responsável com permissão para homologação',()=>{
    const submitted={...original,status:'submitted' as const};
    expect(transitionDraft(submitted,{...command,operation:'validate',role:'professor'}).errors).toContain('VALIDATOR_REQUIRED');
  });
  it('homologa sem alterar questões e preserva auditoria',()=>{
    const submitted={...original,status:'submitted' as const};
    const out=transitionDraft(submitted,{...command,operation:'validate',role:'coordenador',actorId:'coord'});
    expect(out.ok).toBe(true);
    expect(out.next?.status).toBe('validated');
    expect(out.event).toMatchObject({operation:'validate',fromRevision:1,toRevision:2});
  });
  it('bloqueia modificações em versões já homologadas',()=>{
    expect(transitionDraft({...original,status:'validated'},command).errors).toContain('INVALID_TRANSITION');
  });
  it('recusa identificadores duplicados',()=>{
    expect(transitionDraft(original,{...command,nextQuestionIds:['q1','q1']}).errors).toContain('DUPLICATE_OR_EMPTY_IDS');
  });
});
