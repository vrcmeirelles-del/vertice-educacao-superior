import React, { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { clearPendingMasterInvitation } from '@/lib/master-invitation-bootstrap';

// Unmount synchronously before BFCache snapshots DOM/state. Unmount also invalidates
// outstanding component request guards; it does not cancel an admitted server write.
export default function MasterPageLifecycle({ children }: { children: ReactNode }) {
  const [page, setPage] = useState({ suspended: false, revision: 0 });
  useEffect(() => {
    const hide = () => {
      clearPendingMasterInvitation();
      flushSync(() => setPage(previous => ({ suspended: true, revision: previous.revision + 1 })));
    };
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      clearPendingMasterInvitation();
      setPage(previous => ({ suspended: false, revision: previous.revision + 1 }));
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, []);
  if (page.suspended) return null;
  return <React.Fragment key={page.revision}>{children}</React.Fragment>;
}
