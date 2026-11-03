import { consumeMasterFragment, type MasterCredential } from './master-invitation-token';
let pending: MasterCredential | null = typeof window === 'undefined' ? null : consumeMasterFragment(window.location, window.history);
export function getPendingMasterInvitation(): MasterCredential | null { return pending; }
export function clearPendingMasterInvitation(): void { pending = null; }
