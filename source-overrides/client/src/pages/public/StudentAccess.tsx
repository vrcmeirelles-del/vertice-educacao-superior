// Public identity is shared with the header; academic authentication remains in the existing portals.
import {InstitutionAccessState, PublicInstitutionBoundary, usePublicInstitution} from '@/lib/public-institution';
import StudentAccessPortal from '@/components/area/StudentAccessPortal';
import ConectaStudentPortal from '@/components/area/ConectaStudentPortal';
export default function StudentAccess() { return <PublicInstitutionBoundary><StudentAccessContent/></PublicInstitutionBoundary>; }
function StudentAccessContent() {
  const identity = usePublicInstitution()!;
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const mod = params.get('mod') ?? 'ac', token = params.get('token');
  const purpose = mod === 'estagio' || mod === 'mandatory_internship' ? 'mandatory_internship' : 'complementary_activities';
  if (identity.status !== 'ready' || !identity.institution) return <InstitutionAccessState audience="student"/>;
  const props = {institutionId: identity.institutionId, institutionName: identity.institution.name, token};
  if (mod === 'conecta') return <ConectaStudentPortal key={identity.institutionId} {...props}/>;
  return <StudentAccessPortal key={identity.institutionId} {...props} purpose={purpose}/>;
}
