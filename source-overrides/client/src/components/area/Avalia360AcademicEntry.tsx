import { lazy, Suspense } from "react";

const Avalia360Studio = lazy(() => import("@/lib/avalia360/Avalia360Studio"));

export default function Avalia360AcademicEntry({ institutionId, courses, institutionName }: {
  institutionId: string;
  courses: Array<{ id: string; name: string }>;
  institutionName?: string;
}) {
  return <Suspense fallback={<p role="status">Carregando Avalia 360°…</p>}>
    <Avalia360Studio institutionId={institutionId} courses={courses} institutionName={institutionName} institutionalPersistence />
  </Suspense>;
}
