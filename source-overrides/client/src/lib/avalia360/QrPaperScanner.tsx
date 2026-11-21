import {useCallback,useEffect,useRef,useState} from 'react';

/**
 * Leitor de QR dos cadernos (câmera, foto ou código digitado). Decodificação local no navegador:
 * BarcodeDetector quando disponível; senão jsQR (algoritmo determinístico, sem IA e sem envio da imagem).
 */
type Detector={detect:(s:CanvasImageSource)=>Promise<Array<{rawValue:string}>>};
async function makeDecoder(){
 const BD=(globalThis as unknown as {BarcodeDetector?:new(o:{formats:string[]})=>Detector}).BarcodeDetector;
 if(BD){try{const d=new BD({formats:['qr_code']});return async(c:HTMLCanvasElement)=>(await d.detect(c))[0]?.rawValue??null;}catch{/* cai no jsQR */}}
 const jsQR=(await import('jsqr')).default;
 return async(c:HTMLCanvasElement)=>{
  const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  const img=ctx.getImageData(0,0,c.width,c.height);
  return jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'})?.data??null;
 };
}

export default function QrPaperScanner({onCode,disabled}:{onCode:(code:string)=>void;disabled?:boolean}){
 const video=useRef<HTMLVideoElement>(null);
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const last=useRef<{code:string;at:number}|null>(null);
 const [on,setOn]=useState(false);const [msg,setMsg]=useState('');const [typed,setTyped]=useState('');
 const stop=useCallback(()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setOn(false);},[]);
 useEffect(()=>stop,[stop]);
 const emit=useCallback((code:string)=>{
  const now=Date.now();
  if(last.current&&last.current.code===code&&now-last.current.at<4000)return;
  last.current={code,at:now};onCode(code);
 },[onCode]);
 useEffect(()=>{
  if(!on)return;
  let alive=true,timer=0;
  void (async()=>{
   const decode=await makeDecoder();
   const tick=async()=>{
    if(!alive)return;
    const v=video.current;
    if(v&&v.readyState>=2&&v.videoWidth){
     const c=canvas.current??(canvas.current=document.createElement('canvas'));
     const scale=Math.min(1,960/v.videoWidth);c.width=Math.round(v.videoWidth*scale);c.height=Math.round(v.videoHeight*scale);
     c.getContext('2d',{willReadFrequently:true})?.drawImage(v,0,0,c.width,c.height);
     try{const code=await decode(c);if(code)emit(code);}catch{/* quadro ilegível */}
    }
    timer=window.setTimeout(()=>void tick(),250);
   };
   void tick();
  })();
  return()=>{alive=false;window.clearTimeout(timer);};
 },[on,emit]);
 const start=async()=>{
  setMsg('');
  if(!navigator.mediaDevices?.getUserMedia){setMsg('Este navegador não oferece câmera. Use uma foto do caderno ou digite o código.');return;}
  try{
   const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   stream.current=s;setOn(true);
   requestAnimationFrame(()=>{if(video.current){video.current.srcObject=s;void video.current.play();}});
  }catch{setMsg('Câmera indisponível ou não autorizada. Use uma foto do caderno ou digite o código.');}
 };
 const fromPhoto=async(file:File)=>{
  setMsg('Lendo a foto…');
  try{
   const bmp=await createImageBitmap(file);
   const c=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(bmp.width,bmp.height));
   c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);
   c.getContext('2d',{willReadFrequently:true})?.drawImage(bmp,0,0,c.width,c.height);bmp.close();
   const code=await (await makeDecoder())(c);
   if(code){setMsg('');emit(code);}else setMsg('Nenhum QR encontrado na foto. Aproxime o QR e tente de novo, ou digite o código.');
  }catch{setMsg('Não foi possível ler a foto.');}
 };
 return <div style={{display:'grid',gap:8}}>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
   {on?<button type="button" onClick={stop}>Parar câmera</button>:<button type="button" disabled={disabled} onClick={()=>void start()}>Ler QR pela câmera</button>}
   <label style={{fontSize:13,cursor:'pointer',border:'1px solid #164B92',color:'#164B92',borderRadius:9,padding:'8px 12px',fontWeight:700}}>
    Ler de uma foto<input hidden type="file" accept="image/*" capture="environment" disabled={disabled}
     onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(f)void fromPhoto(f);}}/></label>
   <form style={{display:'flex',gap:6}} onSubmit={e=>{e.preventDefault();if(typed.trim()){emit(typed.trim());setTyped('');}}}>
    <input aria-label="Código do caderno" value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Código (ex.: ABCD-2345)"
     style={{padding:'8px 10px',border:'1px solid #DCE7F4',borderRadius:7,width:170}} disabled={disabled}/>
    <button type="submit" disabled={disabled||!typed.trim()}>Abrir</button>
   </form>
  </div>
  {on&&<video ref={video} muted playsInline aria-label="Câmera para leitura do QR" style={{width:'100%',maxWidth:420,borderRadius:10,background:'#000'}}/>}
  {msg&&<p role="status" style={{fontSize:13,margin:0}}>{msg}</p>}
 </div>;
}
