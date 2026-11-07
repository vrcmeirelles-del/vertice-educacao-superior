import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MinutesDrafts from '../../client/src/components/area/MinutesDrafts';
import { fixture } from './supabase';
import './preview.css';
function Preview() {
 const [show, setShow] = useState(true), [ies, setIes] = useState('ies-a');
 return <main><div className="preview-nav"><strong>Vértice · teste sintético</strong><button onClick={() => setShow(!show)}>{show ? 'Sair da aba' : 'Voltar à aba'}</button><button onClick={() => setIes(ies === 'ies-a' ? 'ies-b' : 'ies-a')}>Trocar IES</button><button onClick={() => { fixture.delay = 1200; }}>Simular rede lenta</button><button onClick={() => { fixture.loseResponse = true; }}>Perder próxima confirmação</button></div>{show && <MinutesDrafts key={ies} institutionId={ies} />}</main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
