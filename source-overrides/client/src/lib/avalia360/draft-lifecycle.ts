/**
 * Vértice Avalia 360° — contrato de persistência e versionamento de rascunhos.
 * Puro e independente de banco. O backend deve autenticar, autorizar e persistir
 * atomicamente os eventos somente após a verificação do catálogo curricular.
 */
export type DraftStatus = 'draft' | 'submitted' | 'validated' | 'archived';
export type DraftOperation = 'save' | 'submit' | 'validate' | 'reopen' | 'archive';
export type DraftActorRole = 'professor' | 'coordenador' | 'nde' | 'gestor';
export interface DraftScope {
  institutionId: string; courseId: string; buildId: string; buildVersion: number;
  authorId: string; disciplineId: string;
}
export interface DraftSnapshot {
  id: string; revision: number; status: DraftStatus; scope: DraftScope;
  questionIds: string[]; mediaIds: string[];
}
export interface DraftCommand {
  operation: DraftOperation; expectedRevision: number; actorId: string;
  role: DraftActorRole; authorizedCourseId: string;
  nextQuestionIds?: string[]; nextMediaIds?: string[];
  curriculumReady: boolean; validatedMediaIds: string[];
}
export interface DraftTransition {
  ok: boolean; next?: DraftSnapshot;
  event?: {operation:DraftOperation; fromRevision:number; toRevision:number; actorId:string};
  errors: string[];
}
const distinct = (xs:string[]) => xs.length === new Set(xs).size && xs.every(s => !!s?.trim());
/** Retorna uma nova versão; nunca modifica a original. */
export function transitionDraft(current:DraftSnapshot, cmd:DraftCommand): DraftTransition {
  const errors:string[]=[];
  const add=(s:string)=>errors.push(s);
  if (!current.id || current.revision < 1 || !Number.isInteger(current.revision)) add('INVALID_DRAFT');
  if (!cmd.actorId || !current.scope.authorId || !current.scope.institutionId ||
      !current.scope.courseId || !current.scope.buildId || current.scope.buildVersion < 1)
    add('INVALID_SCOPE');
  if (cmd.authorizedCourseId !== current.scope.courseId) add('COURSE_FORBIDDEN');
  if (cmd.expectedRevision !== current.revision) add('VERSION_CONFLICT');
  if (!cmd.curriculumReady) add('CURRICULUM_UNAVAILABLE');
  const sameAuthor=cmd.actorId===current.scope.authorId;
  const manager=['coordenador','gestor'].includes(cmd.role);
  if (!sameAuthor && !manager) add('ACTOR_FORBIDDEN');
  const ids=cmd.nextQuestionIds ?? current.questionIds;
  const media=cmd.nextMediaIds ?? current.mediaIds;
  if (!distinct(ids) || !distinct(media)) add('DUPLICATE_OR_EMPTY_IDS');
  if (ids.length===0 && ['submit','validate'].includes(cmd.operation)) add('EMPTY_ASSESSMENT');
  if (media.some(id=>!cmd.validatedMediaIds.includes(id)) && cmd.operation!=='save')
    add('UNVERIFIED_MEDIA');
  const permitted:Record<DraftStatus,DraftOperation[]>={
    draft:['save','submit','archive'],
    submitted:['validate','reopen','archive'],
    validated:['archive'],
    archived:[]
  };
  if (!permitted[current.status]?.includes(cmd.operation)) add('INVALID_TRANSITION');
  if (cmd.operation==='validate' && !manager) add('VALIDATOR_REQUIRED');
  if (cmd.operation==='reopen' && !manager && !sameAuthor) add('REOPEN_FORBIDDEN');
  if (cmd.operation==='save' && !sameAuthor) add('AUTHOR_REQUIRED');
  if (cmd.operation==='submit' && !sameAuthor) add('AUTHOR_REQUIRED');
  if (errors.length) return {ok:false,errors:[...new Set(errors)]};
  const status:DraftStatus=cmd.operation==='submit'?'submitted':
    cmd.operation==='validate'?'validated':
    cmd.operation==='reopen'?'draft':
    cmd.operation==='archive'?'archived':current.status;
  const next:DraftSnapshot={...current,revision:current.revision+1,status,
    scope:{...current.scope},questionIds:[...ids],mediaIds:[...media]};
  return {ok:true,errors:[],next,event:{operation:cmd.operation,
    fromRevision:current.revision,toRevision:next.revision,actorId:cmd.actorId}};
}
