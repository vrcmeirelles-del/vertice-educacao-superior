import React from 'react';
import { createRoot } from 'react-dom/client';
import { MasterDirectory, MasterInvitationGate } from '../../client/src/components/area/MasterAccess';
createRoot(document.getElementById('root')!).render(<><MasterDirectory/><MasterInvitationGate onAccepted={()=>{}}/></>);
