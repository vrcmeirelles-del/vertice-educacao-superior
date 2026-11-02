import {logoData,documentNotice} from './branding-data.ts';
import {unzipSync,zipSync,strFromU8,strToU8} from 'npm:fflate@0.8.2';
const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function brandWord(raw:Uint8Array){
 const files=unzipSync(raw),document=strFromU8(files['word/document.xml']);
 if(document.includes('rIdVerticeIdentity'))return raw;
 const logo=Uint8Array.from(atob(logoData.split(',')[1]),c=>c.charCodeAt(0));files['word/media/vertice-identidade.png']=logo;
 const drawing='<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="3200400" cy="732960"/><wp:docPr id="982001" name="Vértice Educação Superior"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="982001" name="vertice-identidade.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdVerticeIdentity"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3200400" cy="732960"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
 const notice='<w:p><w:r><w:rPr><w:color w:val="243653"/><w:sz w:val="16"/></w:rPr><w:t>'+xml(documentNotice)+'</w:t></w:r></w:p>';
 files['word/document.xml']=strToU8(document.replace(/<w:body[^>]*>/,m=>m+drawing+notice));
 const rp='word/_rels/document.xml.rels',rels=files[rp]?strFromU8(files[rp]):'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
 files[rp]=strToU8(rels.replace('</Relationships>','<Relationship Id="rIdVerticeIdentity" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/vertice-identidade.png"/></Relationships>'));
 let types=strFromU8(files['[Content_Types].xml']);if(!/Extension="png"/.test(types))types=types.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');files['[Content_Types].xml']=strToU8(types);
 // PNG já é comprimido. STORE evita recomprimir a logo em cada um dos 32
 // modelos e mantém a biblioteca dentro do orçamento de CPU da função.
 return zipSync(files,{level:0});
}
export function brandLibrary(raw:Uint8Array){const files=unzipSync(raw);for(const key of Object.keys(files))if(key.endsWith('.docx'))files[key]=brandWord(files[key]);files['CONFIDENCIALIDADE-E-LGPD.txt']=strToU8(documentNotice);if(files['catalogo.json']){const c=JSON.parse(strFromU8(files['catalogo.json']));c.document_notice=documentNotice;c.models=c.models.map(({sha256,size,...m}:any)=>({...m,source_sha256:sha256,source_size:size,download_presentation:'Cópia com logo e aviso; hashes da fonte identificam os modelos originais.'}));files['catalogo.json']=strToU8(JSON.stringify(c,null,2));}return zipSync(files,{level:0});}
