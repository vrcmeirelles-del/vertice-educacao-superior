import {describe,expect,it} from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {CARD,alignCard,homography,omrLayout,project,readMarks,readOmr,rectifiedQr,OMR_RULES,type GrayImage,type OmrLayout} from './omr';

type Fill=Record<number,Record<string,'full'|'faint'|'half'|'dot'>>;
const QR_TEXT='VA360:2:'+'0123456789ABCDEF'.repeat(4);
const qrModules=QRCode.create(QR_TEXT,{errorCorrectionLevel:'M'}).modules;
/** Imagem sintética do cartão "fotografado": perspectiva, fundo de mesa, ruído e luz desigual. */
function photo(layout:OmrLayout,fill:Fill,opt:{w:number;h:number;corners:Array<[number,number]>;noise:number;seed:number}):GrayImage{
 // Cartão (topo para baixo, pontos) → foto (pixels): homografia pelos 4 cantos do papel.
 const paper:Array<[number,number]>=[[0,0],[CARD.W,0],[0,CARD.H],[CARD.W,CARD.H]];
 const toCard=homography(opt.corners,paper);
 let s=opt.seed;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
 const data=new Uint8Array(opt.w*opt.h);
 for(let v=0;v<opt.h;v++)for(let u=0;u<opt.w;u++){
  const [x,yt]=project(toCard,u,v);let val:number;
  if(x<0||yt<0||x>CARD.W||yt>CARD.H)val=95;           // mesa
  else{
   const y=CARD.H-yt;val=245;
   for(const m of layout.markers)if(x>=m.x&&x<=m.x+m.size&&y>=m.y&&y<=m.y+m.size)val=15;
   const q=CARD.qr;if(x>=q.x&&x<=q.x+q.size&&y>=q.y&&y<=q.y+q.size){
    const n=qrModules.size,quiet=2,mod=q.size/(n+quiet*2);
    const mx=Math.floor((x-q.x)/mod)-quiet,my=Math.floor((q.y+q.size-y)/mod)-quiet;
    if(mx>=0&&my>=0&&mx<n&&my<n&&qrModules.get(mx,my))val=20;
   }
   for(const b of (y>=CARD.grid.bottom-12&&y<=CARD.grid.top+16)?layout.bubbles:[]){
    if(Math.abs(x-b.cx)>b.r+1||Math.abs(y-b.cy)>b.r+1)continue;
    const d=Math.hypot(x-b.cx,y-b.cy);
    if(Math.abs(d-b.r)<0.7)val=Math.min(val,70);
    const f=fill[b.displayNumber]?.[b.letter];
    if(f==='full'&&d<=b.r*0.85)val=30;
    if(f==='faint'&&d<=b.r*0.85&&((Math.floor(x*2)+Math.floor(y*2))%3===0))val=40; // ~1/3 preenchido
    if(f==='half'&&d<=b.r*0.85&&x<b.cx)val=35;
    if(f==='dot'&&d<=b.r*0.25)val=30;
   }
  }
  const light=0.82+0.18*(u/opt.w);                     // luz desigual
  data[v*opt.w+u]=Math.max(0,Math.min(255,Math.round(val*light+(rnd()-0.5)*opt.noise)));
 }
 return {width:opt.w,height:opt.h,data};
}
const items=Array.from({length:10},(_,i)=>({displayNumber:i+1,options:i===9?4:5}));
const layout=omrLayout(items);
const fill:Fill={1:{A:'full'},2:{C:'full'},3:{},4:{B:'full',D:'full'},5:{E:'full'},6:{B:'faint'},7:{A:'half'},8:{D:'full',B:'dot'},9:{B:'full'},10:{D:'full'}};

describe('leitura óptica do cartão (sem IA)',()=>{
 it('fluxo do aplicativo: alinha pelas marcas, lê o QR endireitado e depois as bolinhas da versão',()=>{
  const g=photo(layout,fill,{w:1000,h:1300,corners:[[120,60],[870,110],[60,1230],[930,1180]],noise:25,seed:5});
  const a=alignCard(g);
  expect(a.ok).toBe(true);
  if(!a.ok)return;
  const q=rectifiedQr(g,a.transform);
  expect(jsQR(q.data,q.width,q.height)?.data).toBe(QR_TEXT);
  expect(readMarks(g,layout,a.transform,a.threshold).sequence).toBe('AC-*E?ADBD');
 },30000);
 it('layout: posições fixas, 3 blocos, limites de capacidade e alternativas',()=>{
  expect(layout.markers).toHaveLength(4);
  expect(layout.bubbles).toHaveLength(49);
  expect(layout.capacity).toBe(75);
  expect(()=>omrLayout([{displayNumber:1,options:6}])).toThrow();
  expect(()=>omrLayout(Array.from({length:76},(_,i)=>({displayNumber:i+1,options:4})))).toThrow();
  const big=omrLayout(Array.from({length:30},(_,i)=>({displayNumber:i+1,options:4})));
  expect(big.rows[25].x).toBeGreaterThan(big.rows[24].x);
 },30000);
 it('foto de frente: lê marcação única, branco, dupla, fraca (duvidosa) e meia marcação',()=>{
  const g=photo(layout,fill,{w:900,h:1274,corners:[[20,18],[880,22],[16,1255],[884,1250]],noise:20,seed:7});
  const r=readOmr(g,layout);
  expect(r.ok).toBe(true);
  expect(r.sequence).toBe('AC-*E?ADBD');
  expect(r.questions[5].doubtful).toBe(true);
 },30000);
 it('foto inclinada e em perspectiva: mesma leitura',()=>{
  const g=photo(layout,fill,{w:1000,h:1300,corners:[[120,60],[870,110],[60,1230],[930,1180]],noise:30,seed:11});
  const r=readOmr(g,layout);
  expect(r.ok).toBe(true);
  expect(r.sequence).toBe('AC-*E?ADBD');
 },30000);
 it('é determinística e recusa foto sem as marcas',()=>{
  const g=photo(layout,fill,{w:900,h:1274,corners:[[20,18],[880,22],[16,1255],[884,1250]],noise:20,seed:7});
  expect(readOmr(g,layout)).toEqual(readOmr(g,layout));
  const blank:GrayImage={width:400,height:500,data:new Uint8Array(400*500).fill(230)};
  const r=readOmr(blank,layout);
  expect(r.ok).toBe(false);expect(r.error).toMatch(/marcas/);
  expect(r.rulesVersion).toBe(OMR_RULES.version);
 },30000);
});
