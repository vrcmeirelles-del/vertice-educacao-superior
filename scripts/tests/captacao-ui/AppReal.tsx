import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CaptacaoIntegrada from '../../client/src/components/area/CaptacaoIntegrada';
import { selectTestActor, institutions } from './real-client';
function App() {
 const [actor,setActor]=useState('managerA');
 const [ready,setReady]=useState(false);
 const [ies,setIes]=useState(institutions.a);
 useEffect(()=>{let live=true;setReady(false);void selectTestActor(actor as Parameters<typeof selectTestActor>[0]).then(()=>{if(live)setReady(true)});return()=>{live=false}},[actor]);
 return <main style={{maxWidth:1180,margin:'20px auto',padding:12}}><p>Homologação · Supabase local · dados sintéticos</p><label>Operador sintético<select aria-label="Operador sintético" value={actor} onChange={e=>setActor(e.target.value)}><option value="managerA">Gestor A com MFA</option><option value="managerB">Gestor B com MFA</option><option value="reader">Leitor com MFA</option><option value="master">Master com MFA</option><option value="noMfa">Gestor sem MFA</option></select></label><label>IES de teste<select aria-label="IES de teste" value={ies} onChange={e=>setIes(e.target.value)}><option value={institutions.a}>IES sintética A</option><option value={institutions.b}>IES sintética B</option></select></label>{ready?<CaptacaoIntegrada key={actor} institutionId={ies} institutionName={ies===institutions.a?'IES sintética A':'IES sintética B'} overview={<p>Visão geral de homologação</p>}/>:<p role="status">Autenticando sessão sintética…</p>}</main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
