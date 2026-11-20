/**
 * Avalia 360° — recibos de mídia são capabilities de escopo curto.
 * Não reutilizar em outra instituição, curso, disciplina ou questão.
 */
import type {UploadedImageReceipt} from './private-image-upload';
export interface ReceiptContext {
 institutionId:string;courseId:string;disciplineId:string;questionId:string;
}
export interface ScopedImageReceipt {
 receipt:UploadedImageReceipt;file:File;scopeKey:string;
}
export const receiptScopeKey=(context:ReceiptContext):string=>
 JSON.stringify([context.institutionId,context.courseId,context.disciplineId,context.questionId]);
export function reusableReceipt(
 stored:ScopedImageReceipt|undefined,file:File,context:ReceiptContext
):UploadedImageReceipt|null{
 if(!stored || stored.file!==file || stored.scopeKey!==receiptScopeKey(context))return null;
 const prefix=context.institutionId+'/'+context.courseId+'/';
 if(!stored.receipt.path.startsWith(prefix))return null;
 return stored.receipt;
}
