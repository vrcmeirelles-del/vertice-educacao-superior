import React from 'react';
import {createRoot} from 'react-dom/client';
import Avalia360Studio from '../client/src/lib/avalia360/Avalia360Studio';

const root=document.getElementById('root');
if(!root)throw new Error('Raiz da prévia ausente');
createRoot(root).render(<React.StrictMode>
 <Avalia360Studio previewMode institutionId="00000000-0000-4000-8000-000000000011" courses={[
  {id:'00000000-0000-4000-8000-000000000021',name:'Direito · Exemplo demonstrativo'},
  {id:'00000000-0000-4000-8000-000000000022',name:'Pedagogia · Exemplo demonstrativo'},
  {id:'00000000-0000-4000-8000-000000000023',name:'Medicina · Exemplo demonstrativo'}
 ]}/>
</React.StrictMode>);
