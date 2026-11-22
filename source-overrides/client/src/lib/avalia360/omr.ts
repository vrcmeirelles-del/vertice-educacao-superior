/**
 * Avalia 360° — leitura óptica do cartão de respostas (etapa 3), por algoritmo determinístico, sem IA.
 *
 * O mesmo layout (omrLayout) desenha o cartão no PDF e orienta a leitura da foto:
 *  1. limiarização global por Otsu (tons de cinza);
 *  2. quatro marcas de alinhamento: maiores quadrados sólidos perto de cada canto da imagem;
 *  3. homografia (4 pontos) das coordenadas do cartão para os pixels da foto;
 *  4. em cada bolinha, fração de pixels escuros no miolo (60% do raio), sem o contorno;
 *  5. regras por questão: uma marcada → letra; nenhuma → "-"; duas ou mais → "*";
 *     qualquer bolinha na faixa duvidosa → "?" (o professor confirma; nada é adivinhado).
 * Mesma foto ⇒ mesma leitura.
 */
export const OMR_RULES={
 version:'2026.11-1',
 filled:0.45,        // fração escura a partir da qual a bolinha conta como marcada
 empty:0.18,         // até aqui, em branco; entre os dois, duvidosa
 sampleRadius:0.6,   // miolo amostrado, em fração do raio
 maxImageSide:1600,
} as const;

// ── Layout do cartão (pontos PDF, origem no canto inferior esquerdo, A4) ──
export const CARD={W:595,H:842,marker:18,markerInset:28,qr:{x:455,y:688,size:86},
 grid:{top:652,bottom:84,left:44,blockWidth:178,rowHeight:22,labelWidth:34,gap:25,radius:7.5}} as const;
export const OMR_MAX_OPTIONS=5;
export interface OmrBubble {row:number;displayNumber:number;letter:string;cx:number;cy:number;r:number}
export interface OmrLayout {markers:Array<{x:number;y:number;size:number}>;bubbles:OmrBubble[];rows:Array<{row:number;displayNumber:number;x:number;y:number}>;capacity:number}

export function omrCapacity(){const g=CARD.grid;return Math.floor((g.top-g.bottom)/g.rowHeight)*3;}
/** Objetivas do cartão na ordem impressa: número exibido e quantidade de alternativas. */
export function omrLayout(items:Array<{displayNumber:number;options:number}>):OmrLayout{
 const g=CARD.grid,perBlock=Math.floor((g.top-g.bottom)/g.rowHeight),capacity=perBlock*3;
 if(items.length>capacity)throw Error('Cartão óptico comporta até '+capacity+' objetivas.');
 if(items.some(i=>i.options<2||i.options>OMR_MAX_OPTIONS))throw Error('Cartão óptico aceita de 2 a '+OMR_MAX_OPTIONS+' alternativas por questão.');
 const m=CARD.marker,ins=CARD.markerInset;
 const markers=[{x:ins,y:CARD.H-ins-m,size:m},{x:CARD.W-ins-m,y:CARD.H-ins-m,size:m},{x:ins,y:ins,size:m},{x:CARD.W-ins-m,y:ins,size:m}];
 const bubbles:OmrBubble[]=[],rows:OmrLayout['rows']=[];
 items.forEach((it,row)=>{
  const block=Math.floor(row/perBlock),line=row%perBlock;
  const x=g.left+block*g.blockWidth,y=g.top-line*g.rowHeight;
  rows.push({row,displayNumber:it.displayNumber,x,y});
  for(let j=0;j<it.options;j++)bubbles.push({row,displayNumber:it.displayNumber,letter:String.fromCharCode(65+j),
   cx:x+g.labelWidth+g.radius+j*g.gap,cy:y+4,r:g.radius});
 });
 return {markers,bubbles,rows,capacity};
}

// ── Leitura ──
export interface GrayImage {width:number;height:number;data:Uint8Array}
export function toGray(rgba:Uint8ClampedArray|Uint8Array,width:number,height:number):GrayImage{
 const data=new Uint8Array(width*height);
 for(let i=0,p=0;i<data.length;i++,p+=4)data[i]=(rgba[p]*299+rgba[p+1]*587+rgba[p+2]*114)/1000;
 return {width,height,data};
}
export function otsu(g:GrayImage):number{
 const hist=new Array(256).fill(0);for(const v of g.data)hist[v]++;
 const total=g.data.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
 let sumB=0,wB=0,best=0,threshold=127;
 for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];
  const mB=sumB/wB,mF=(sum-sumB)/wF,between=wB*wF*(mB-mF)**2;if(between>best){best=between;threshold=t;}}
 return threshold;
}
interface Blob {x0:number;y0:number;x1:number;y1:number;area:number;cx:number;cy:number}
/** Componentes escuros conectados (4-vizinhança), sobre imagem reduzida. */
function darkBlobs(g:GrayImage,th:number):Blob[]{
 const {width:w,height:h,data}=g,seen=new Uint8Array(w*h),out:Blob[]=[],stack:number[]=[];
 for(let s=0;s<w*h;s++){
  if(seen[s]||data[s]>th)continue;
  let x0=w,y0=h,x1=0,y1=0,area=0,sx=0,sy=0;seen[s]=1;stack.push(s);
  while(stack.length){const p=stack.pop()!;const x=p%w,y=(p/w)|0;area++;sx+=x;sy+=y;
   if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   for(const q of [p-1,p+1,p-w,p+w]){if(q<0||q>=w*h)continue;if((q===p-1&&x===0)||(q===p+1&&x===w-1))continue;
    if(!seen[q]&&data[q]<=th){seen[q]=1;stack.push(q);}}}
  out.push({x0,y0,x1,y1,area,cx:sx/area,cy:sy/area});
 }
 return out;
}
/** Homografia de 4 pontos (DLT com h33=1). */
export function homography(src:Array<[number,number]>,dst:Array<[number,number]>):number[]{
 const A:number[][]=[],b:number[]=[];
 for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=dst[i];
  A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;
  [A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];if(Math.abs(A[c][c])<1e-12)throw Error('Marcas de alinhamento degeneradas.');
  for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c];}}
 return [...b.map((v,i)=>v/A[i][i]),1];
}
export const project=(H:number[],x:number,y:number):[number,number]=>{const d=H[6]*x+H[7]*y+H[8];return [(H[0]*x+H[1]*y+H[2])/d,(H[3]*x+H[4]*y+H[5])/d];};

export interface OmrQuestionRead {displayNumber:number;mark:string;fills:Record<string,number>;doubtful:boolean}
export interface OmrRead {ok:boolean;error?:string;sequence:string;questions:OmrQuestionRead[];threshold:number;rulesVersion:string;transform?:number[]}

/** Localiza as 4 marcas: quadrados sólidos e grandes, o mais perto de cada canto da imagem. */
export function findMarkers(g:GrayImage,th:number):Array<[number,number]>|null{
 const scale=Math.min(1,800/Math.max(g.width,g.height));
 const sw=Math.max(1,Math.round(g.width*scale)),sh=Math.max(1,Math.round(g.height*scale));
 const small=new Uint8Array(sw*sh);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)small[y*sw+x]=g.data[Math.min(g.height-1,Math.round(y/scale))*g.width+Math.min(g.width-1,Math.round(x/scale))];
 const blobs=darkBlobs({width:sw,height:sh,data:small},th).filter(b=>{
  const bw=b.x1-b.x0+1,bh=b.y1-b.y0+1,ratio=bw/bh;
  return b.area>=Math.max(12,sw*sh*0.00008)&&ratio>0.6&&ratio<1.67&&b.area/(bw*bh)>0.72;
 });
 if(blobs.length<4)return null;
 const corners:Array<[number,number]>=[[0,0],[sw,0],[0,sh],[sw,sh]];
 const picked:Blob[]=[];
 for(const [kx,ky] of corners){
  const cand=blobs.filter(b=>!picked.includes(b)&&Math.abs(b.cx-kx)<sw*0.5&&Math.abs(b.cy-ky)<sh*0.5);
  if(!cand.length)return null;
  const maxArea=Math.max(...cand.map(b=>b.area));
  // Entre os grandes (≥ 50% do maior do quadrante), o mais próximo do canto.
  cand.sort((a,b)=>Math.hypot(a.cx-kx,a.cy-ky)-Math.hypot(b.cx-kx,b.cy-ky));
  picked.push(cand.find(b=>b.area>=maxArea*0.5)!);
 }
 const areas=picked.map(b=>b.area),mx=Math.max(...areas),mn=Math.min(...areas);
 if(mn<mx*0.35)return null;
 return picked.map(b=>[b.cx/scale,b.cy/scale]);
}

export interface CardAlignment {ok:true;transform:number[];threshold:number}
/** Fase 1: alinha o cartão pelas 4 marcas fixas (independe da versão da prova). */
export function alignCard(g:GrayImage):CardAlignment|{ok:false;error:string;threshold:number}{
 const th=otsu(g),found=findMarkers(g,th);
 if(!found)return {ok:false,error:'Não encontrei as 4 marcas pretas dos cantos. Fotografe o cartão inteiro, de frente e com boa luz.',threshold:th};
 const m=CARD.marker,ins=CARD.markerInset;
 const src:Array<[number,number]>=[[ins+m/2,ins+m/2],[CARD.W-ins-m/2,ins+m/2],[ins+m/2,CARD.H-ins-m/2],[CARD.W-ins-m/2,CARD.H-ins-m/2]];
 try{return {ok:true,transform:homography(src,found),threshold:th};}
 catch(e){return {ok:false,error:e instanceof Error?e.message:'Alinhamento impossível.',threshold:th};}
}
export function readOmr(g:GrayImage,layout:OmrLayout,aligned?:CardAlignment):OmrRead{
 const R=OMR_RULES;
 const a=aligned??alignCard(g);
 if(!a.ok)return {ok:false,error:a.error,sequence:'',questions:[],threshold:a.threshold,rulesVersion:R.version};
 return readMarks(g,layout,a.transform,a.threshold);
}
/** Fase 3: lê as bolinhas da versão identificada pelo QR. */
export function readMarks(g:GrayImage,layout:OmrLayout,H:number[],th:number):OmrRead{
 const R=OMR_RULES;
 const dark=(x:number,y:number)=>{const ix=Math.round(x),iy=Math.round(y);
  if(ix<0||iy<0||ix>=g.width||iy>=g.height)return null;return g.data[iy*g.width+ix]<=th;};
 const byRow=new Map<number,OmrBubble[]>();for(const b of layout.bubbles)byRow.set(b.row,[...(byRow.get(b.row)??[]),b]);
 const questions:OmrQuestionRead[]=[];
 for(const [,bs] of [...byRow.entries()].sort((a,b)=>a[0]-b[0])){
  const fills:Record<string,number>={};let doubtful=false;const marked:string[]=[];
  for(const b of bs){
   let n=0,d=0;const rr=b.r*R.sampleRadius;
   for(let dy=-rr;dy<=rr;dy+=rr/5)for(let dx=-rr;dx<=rr;dx+=rr/5){
    if(dx*dx+dy*dy>rr*rr)continue;const [px,py]=project(H,b.cx+dx,CARD.H-(b.cy+dy));const v=dark(px,py);
    if(v===null)continue;n++;if(v)d++;}
   const f=n?d/n:0;fills[b.letter]=Math.round(f*100)/100;
   if(f>=R.filled)marked.push(b.letter);else if(f>R.empty)doubtful=true;
  }
  const mark=marked.length>1?'*':doubtful?'?':marked.length===1?marked[0]:'-';
  questions.push({displayNumber:bs[0].displayNumber,mark,fills,doubtful:mark==='?'});
 }
 return {ok:true,sequence:questions.map(q=>q.mark).join(''),questions,threshold:th,rulesVersion:R.version,transform:H};
}

/** Região do QR endireitada pela homografia (RGBA), para decodificar mesmo em foto inclinada ou desfocada. */
export function rectifiedQr(g:GrayImage,H:number[],size=360):{data:Uint8ClampedArray;width:number;height:number}{
 const q=CARD.qr,pad=q.size*0.12,x0=q.x-pad,yTop=CARD.H-(q.y+q.size)-pad,span=q.size+pad*2;
 const data=new Uint8ClampedArray(size*size*4);
 for(let v=0;v<size;v++)for(let u=0;u<size;u++){
  const [px,py]=project(H,x0+span*u/size,yTop+span*v/size);
  const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  const at=(x:number,y:number)=>x<0||y<0||x>=g.width||y>=g.height?255:g.data[y*g.width+x];
  const val=at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;
  const o=(v*size+u)*4;data[o]=data[o+1]=data[o+2]=val;data[o+3]=255;
 }
 return {data,width:size,height:size};
}
