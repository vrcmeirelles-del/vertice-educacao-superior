// Compatibilidade de empacotamento; fonte canônica em supabase/functions.
import {portalInvitationHandler} from '../../../../supabase/functions/_shared/portal-invitations.ts';
Deno.serve(portalInvitationHandler);
