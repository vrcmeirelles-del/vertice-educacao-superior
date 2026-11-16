export type Sighting={url:string;source:string;title:string;published_on:string|null};
export const LISTS=[
 {name:'ABMES',url:'https://abmes.org.br/noticias'},
 {name:'CADE',url:'https://www.gov.br/cade/pt-br/assuntos/noticias'},
 {name:'Yduqs RI',url:'https://www.yduqs.com.br/'},
 {name:'Ânima RI',url:'https://ri.animaeducacao.com.br/'},
];
export function cleanText(s:string){return s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();}
export function canonical(raw:string,base:string):string|null{
 try{const u=new URL(raw,base),b=new URL(base);if(u.protocol!=='https:'||u.hostname!==b.hostname||u.username||u.password)return null;u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);return u.href;}catch{return null;}
}
export function parseLinks(html:string,source:{name:string;url:string}):Sighting[]{
 const seen=new Set<string>(),out:Sighting[]=[];
 // ABMES' featured headline is outside its "Leia mais" anchor.
 if(source.name==='ABMES'){
  const featured=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>[\s\S]{0,1600}?href\s*=\s*["']([^"']+)["']/i);
  if(featured){const title=cleanText(featured[1]).slice(0,500),url=canonical(featured[2],source.url);
   if(url&&/(aquisi[çc]|incorpora[çc]|fus[ãõa]|consolida[çc])/i.test(title)){seen.add(url);out.push({url,source:source.name,title,published_on:null});}
  }
 }
 for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const title=cleanText(m[2]).slice(0,500),url=canonical(m[1],source.url);
  if(!url||seen.has(url)||title.length<20||!/(aquisi[çc]|incorpora[çc]|fus[ãõa]|combina[çc].*neg[oó]cio|unifica[çc]|consolida[çc]|afya|yduqs|educa[çc].*venda)/i.test(title))continue;
  seen.add(url);out.push({url,source:source.name,title,published_on:null});if(out.length>=20)break;
 }
 return out;
}
export function parseSec(payload:unknown,cutoff:string):Sighting[]{
 const p=payload as {filings?:{recent?:{accessionNumber?:string[];form?:string[];filingDate?:string[];primaryDocument?:string[]}}};const r=p?.filings?.recent;if(!r)return [];
 const out:Sighting[]=[];for(let i=0;i<(r.accessionNumber?.length??0);i++){
 const date=r.filingDate?.[i]??'',form=r.form?.[i]??'',a=r.accessionNumber?.[i]??'',doc=r.primaryDocument?.[i]??'';
 if(date<cutoff||!['6-K','20-F','SC 13D','SC 13D/A'].includes(form)||!/^[0-9-]+$/.test(a)||!doc||doc.includes('..')||!/^[-a-zA-Z0-9_.]+$/.test(doc))continue;
 out.push({url:`https://www.sec.gov/Archives/edgar/data/1771007/${a.replace(/-/g,'')}/${doc}`,source:'Afya / SEC',title:`Afya · documento ${form} protocolado em ${date} · conteúdo a conferir`,published_on:date});if(out.length>=20)break;
 }return out;
}
