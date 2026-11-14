import { supabase } from './supabase';
import type { AcSubmission } from './atividades-complementares';

export class AcSubmissionPendingError extends Error {}

// Reconcile a lost write response before deleting its attachment or allowing a retry.
export async function submitAcWithAttachment(record: {
  institution_id: string; student_id: string; rule_id: string; category_id: string;
  title: string; issuer: string | null; documentary_minutes: number | null; status: string;
}, file: File | null): Promise<AcSubmission> {
  const id = crypto.randomUUID();
  let path: string | null = null;
  if (file) {
    const ext = file.name.split('.').pop() || 'pdf';
    path = `ac/${record.institution_id}/${record.student_id}/${id}.${ext}`;
    const uploaded = await supabase.storage.from('vertice-documents').upload(path, file, { contentType: file.type });
    if (uploaded.error) throw new Error('Erro no upload: ' + uploaded.error.message);
  }
  const payload = { ...record, id, ...(path ? { external_url: path } : {}) };
  let failure: unknown;
  try {
    const result = await supabase.from('vertice_ac_submissions').insert(payload).select().single();
    if (!result.error && result.data) return result.data as AcSubmission;
    failure = result.error ?? new Error('Resposta de gravação vazia.');
  } catch (error) { failure = error; }

  // A timeout may occur after COMMIT. Only remove after an authorized read confirms absence.
  try {
    const confirmed = await supabase.from('vertice_ac_submissions').select('*')
      .eq('institution_id', record.institution_id).eq('student_id', record.student_id).eq('id', id).maybeSingle();
    if (confirmed.error) throw confirmed.error;
    if (confirmed.data) return confirmed.data as AcSubmission;
  } catch {
    throw new AcSubmissionPendingError('Não foi possível confirmar o envio. O comprovante foi preservado. Recarregue as solicitações antes de tentar novamente.');
  }
  if (path) {
    try {
      const removed = await supabase.storage.from('vertice-documents').remove([path]);
      if (removed.error) throw removed.error;
    } catch {
      throw new AcSubmissionPendingError('A solicitação não foi gravada e a remoção do comprovante ficou pendente. Peça à coordenação para verificar o envio antes de repetir.');
    }
  }
  throw new Error('A solicitação não foi gravada. ' + (failure instanceof Error ? failure.message : (failure as {message?: string})?.message || 'Tente novamente.'));
}
