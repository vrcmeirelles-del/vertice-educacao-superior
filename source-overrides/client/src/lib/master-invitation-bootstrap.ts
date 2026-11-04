import './ies/preAuthGuard';
import { consumeMasterFragment, type MasterCredential } from './master-invitation-token';
let pending: MasterCredential | null = typeof window === 'undefined' ? null : consumeMasterFragment(window.location, window.history);
export function getPendingMasterInvitation(): MasterCredential | null { return pending; }
export function clearPendingMasterInvitation(): void { pending = null; }

// Clear even before React mounts (login, recovery or an interrupted bootstrap).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', clearPendingMasterInvitation);
  window.addEventListener('pageshow', event => { if (event.persisted) clearPendingMasterInvitation(); });
}
