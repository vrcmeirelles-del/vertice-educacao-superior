import { useState } from 'react';
import type { Field } from '@/lib/area';
import { EMPTY_BRANDING, validateBranding } from '@/lib/institution-branding';
import RecordForm from './RecordForm';
import { BrandingFields } from './InstitutionBranding';

export default function NewInstitutionForm({ fields, onSubmit, onCancel }: { fields: Field[]; onSubmit: (v: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [branding, setBranding] = useState({ ...EMPTY_BRANDING }), [busy, setBusy] = useState(false);
  return <RecordForm title="Nova instituição" fields={fields} initial={{ status: 'ativa' }} onCancel={onCancel} submitDisabled={busy} onSubmit={v => onSubmit({ ...v, document_branding: validateBranding(branding) })}>
    <BrandingFields value={branding} onChange={setBranding} onBusy={setBusy} />
  </RecordForm>;
}
