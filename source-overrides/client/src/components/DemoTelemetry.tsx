import {useEffect} from 'react';
import {useLocation} from 'wouter';
import {demoEvent,hasDemoSession,updateDemo} from '@/lib/commercial-demo';
const allowed=new Set(['/','/demonstracao','/servicos','/aquisicoes','/metodo','/caso-real','/fundador','/contato','/reitor','/guia']);
export default function DemoTelemetry(){
 const [location]=useLocation();
 useEffect(()=>{const page=location.split('?')[0].replace(/\.html$/,'').replace(/\/$/,'')||'/';if(!allowed.has(page))return;
  const started=Date.now();if(hasDemoSession())void updateDemo({events:[demoEvent('page',page)]}).catch(()=>{});
  const record=()=>{if(hasDemoSession())void updateDemo({events:[demoEvent('dwell',page,Math.min(300,Math.round((Date.now()-started)/1000)))]}).catch(()=>{});};
  return record;
 },[location]);return null;
}
