import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CaptacaoIntegrada from '../../client/src/components/area/CaptacaoIntegrada';
function App() {
 const [ies,setIes]=useState('bb000000-0000-4000-8000-000000000001');
 return <main style={{maxWidth:1180,margin:'20px auto',padding:12}}><label>IES de teste<select aria-label="IES de teste" value={ies} onChange={e=>setIes(e.target.value)}><option value="bb000000-0000-4000-8000-000000000001">IES sintética A</option><option value="bb000000-0000-4000-8000-000000000002">IES sintética B</option></select></label><CaptacaoIntegrada institutionId={ies} institutionName={ies.endsWith('1')?'IES sintética A':'IES sintética B'} overview={<p>Visão geral legada preservada · ambiente sintético</p>}/></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
