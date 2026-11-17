import { iesBootstrapRejected } from './ies/preAuthGuard';
import "@/lib/master-invitation-bootstrap";
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config';
// Capture the callback type before the SDK consumes and removes the fragment.
const callback = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
export const passwordCallback = ['recovery', 'invite'].includes(callback.get('type') || '');
export const callbackToken = passwordCallback ? callback.get('access_token') : null;
// Only the publishable key belongs in a browser. RLS controls data access.
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: typeof window !== 'undefined', storage: typeof window !== 'undefined' ? window.localStorage : undefined, autoRefreshToken: true, detectSessionInUrl: !iesBootstrapRejected, flowType: 'implicit' } }
);
