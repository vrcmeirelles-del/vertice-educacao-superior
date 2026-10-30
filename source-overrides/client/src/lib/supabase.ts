import { createClient } from '@supabase/supabase-js';
// Capture the callback type before the SDK consumes and removes the fragment.
const callback = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
export const passwordCallback = ['recovery', 'invite'].includes(callback.get('type') || '');
export const callbackToken = passwordCallback ? callback.get('access_token') : null;
// Only the publishable key belongs in a browser. RLS controls data access.
export const supabase = createClient(
  'https://qvetbbmviatxxatzzuzc.supabase.co',
  'sb_publishable_id8AJN7W1v1TyYIp4R7yTg_gclHJ0T1',
  { auth: { persistSession: typeof window !== 'undefined', storage: typeof window !== 'undefined' ? window.localStorage : undefined, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }
);
