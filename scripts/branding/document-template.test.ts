import assert from 'node:assert/strict';
import { PNG } from 'npm:pngjs@7.0.0';
import { zipSync, strToU8, strFromU8 } from 'npm:fflate@0.8.3';
import { personalizeTemplate, prepareTemplate, sha256, unpack, validateBranding, type Manifest } from '../../supabase/functions/_shared/document-template.ts';
import { libraryHandler } from '../../supabase/functions/vertice-inep-library/handler.ts';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const empty = { header_text: '', theme_color: null, logo_data: null };
export function logoData() { const p = new PNG({ width: 300, height: 120 }); for (let i=0;i<p.data.length;i+=4) { p.data[i]=240;p.data[i+1]=120;p.data[i+2]=10;p.data[i+3]=255; } return 'data:image/png;base64,' + PNG.sync.write(p).toString('base64'); }
export async function fixture() {
  const xml: Record<string,string> = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${R}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:pPr><w:pStyle w:val="InstitutionAccent"/></w:pPr><w:r><w:t>MODELO SINTÉTICO — plano de trabalho</w:t></w:r></w:p><w:p><w:r><w:t>Referência substantiva preservada: Faculdade Exemplo, resolução 42.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="SemanticWarning"/></w:pPr><w:r><w:t>Alerta semântico: revisar antes de usar.</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblStyle w:val="InstitutionTable"/><w:tblW w:w="9000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Campo temático aprovado</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:fill="C00000"/></w:tcPr><w:p><w:r><w:rPr><w:color w:val="FFFFFF"/></w:rPr><w:t>Alerta semântico preservado</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p/><w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1800" w:right="1440" w:bottom="1440" w:left="1440" w:header="600" w:footer="720"/></w:sectPr></w:body></w:document>`,
    'word/_rels/document.xml.rels': `<Relationships xmlns="${R}"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'word/header1.xml': `<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Cabeçalho antigo sintético</w:t></w:r></w:p></w:hdr>`,
    'word/footer1.xml': `<w:ftr xmlns:w="${W}"><w:p><w:r><w:t>Rodapé substantivo não aprovado para remoção</w:t></w:r></w:p></w:ftr>`,
    'word/styles.xml': `<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="InstitutionAccent"><w:name w:val="InstitutionAccent"/><w:rPr><w:rFonts w:ascii="Liberation Sans"/><w:b/><w:color w:val="0000FF"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SemanticWarning"><w:name w:val="SemanticWarning"/><w:rPr><w:color w:val="FF0000"/></w:rPr></w:style><w:style w:type="table" w:styleId="InstitutionTable"><w:name w:val="InstitutionTable"/><w:tcPr><w:shd w:val="clear" w:fill="0000FF"/></w:tcPr></w:style></w:styles>`,
    'docProps/core.xml': '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>',
  };
  const files = Object.fromEntries(Object.entries(xml).map(([k,v])=>[k,strToU8(v)]));
  // Unreferenced synthetic bytes exercise byte preservation without shipping real assets.
  files['word/fonts/synthetic-font.bin'] = new Uint8Array([1,2,3,4]);
  files['word/media/semantic.png'] = Uint8Array.from(atob(logoData().split(',')[1]),c=>c.charCodeAt(0));
  files['word/charts/chart1.xml'] = strToU8('<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:title/></c:chart></c:chartSpace>');
  const source = zipSync(files,{mtime:new Date('2000-01-01T00:00:00Z')});
  const manifest: Manifest = { classification:'reviewed-template', source_sha256:await sha256(source), review_ref:'synthetic-review-1', replace_headers:['word/header1.xml'], clear_footers:[], theme_style_ids:['InstitutionAccent','InstitutionTable'], preserved_parts_review:{'docProps/core.xml':await sha256(files['docProps/core.xml']), 'word/media/semantic.png':await sha256(files['word/media/semantic.png'])} };
  const template = await prepareTemplate(source,manifest);
  const expected = { template_sha256:await sha256(template), template_source_sha256:manifest.source_sha256, template_review_ref:manifest.review_ref };
  return { source,files,manifest,template,expected };
}
Deno.test('neutralization is explicit and hash-bound; preserves body, footer and font bytes', async()=>{
 const f=await fixture(), out=unpack(f.template);
 for(const n of ['word/document.xml','word/footer1.xml','word/fonts/synthetic-font.bin','word/media/semantic.png','word/charts/chart1.xml','word/styles.xml']) assert.deepEqual(out[n],f.files[n]);
 assert(!strFromU8(out['word/header1.xml']).includes('antigo'));
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,classification:'placeholder' as any}));
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,source_sha256:'a'.repeat(64)}));
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,preserved_parts_review:{}}));
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,theme_style_ids:['unknown']}));
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,replace_headers:['word/missing.xml']}));
 await assert.rejects(async()=>prepareTemplate(f.template,{...f.manifest,source_sha256:await sha256(f.template)}));
 const cleared=unpack(await prepareTemplate(f.source,{...f.manifest,clear_footers:['word/footer1.xml']}));
 assert(!strFromU8(cleared['word/footer1.xml']).includes('substantivo'));
 const pruned=unpack(await prepareTemplate(f.source,{...f.manifest,remove_parts:['docProps/core.xml','word/media/semantic.png']}));
 assert(!pruned['docProps/core.xml']);assert(!pruned['word/media/semantic.png']);assert.deepEqual(pruned['word/document.xml'],f.files['word/document.xml']);
 await assert.rejects(()=>prepareTemplate(f.source,{...f.manifest,remove_parts:['word/document.xml']}));
});
Deno.test('personalization is repeatable, XML-safe and changes only reviewed styles',async()=>{
 const f=await fixture(), b={header_text:'IES A & <Educação>\nTexto institucional',theme_color:'#FF8800',logo_data:logoData()};
 const a=await personalizeTemplate(f.template,b,f.expected), again=await personalizeTemplate(f.template,b,f.expected);
 assert.deepEqual(a,again);const out=unpack(a);
 for(const n of ['word/document.xml','word/footer1.xml','word/fonts/synthetic-font.bin','word/media/semantic.png','word/charts/chart1.xml']) assert.deepEqual(out[n],f.files[n]);
 const header=strFromU8(out['word/header1.xml']);assert(header.includes('&amp;'));assert(header.includes('&lt;Educação&gt;'));assert.equal((header.match(/<w:tbl>/g)||[]).length,1);assert(header.includes('1250'));assert(header.includes('3750'));
 const styles=strFromU8(out['word/styles.xml']);assert(styles.includes('w:val="FF0000"'));assert(styles.includes('Liberation Sans'));assert(!styles.includes('w:val="0000FF"'));assert(styles.includes('w:fill="FF8800"'));assert(strFromU8(out['word/document.xml']).includes('w:fill="C00000"'));
 const tableStyle=styles.split('w:styleId="InstitutionTable"')[1];assert(tableStyle.indexOf('<w:rPr>')<tableStyle.indexOf('<w:tcPr>'));
 const noLogo=unpack(await personalizeTemplate(f.template,empty,f.expected));assert(!noLogo['word/media/vertice-branding-logo.png']);
 assert(!strFromU8(noLogo['word/header1.xml']).includes('IES A'));
 await assert.rejects(()=>personalizeTemplate(f.template,b,{...f.expected,template_sha256:'0'.repeat(64)}));
 await assert.rejects(()=>personalizeTemplate(f.template,b,{...f.expected,template_review_ref:'other'}));
 await assert.rejects(()=>personalizeTemplate(f.template,b,{...f.expected,template_source_sha256:'0'.repeat(64)}));
});
Deno.test('rejects invalid logo, dimensions, color and long text; absent logo allowed',()=>{
 assert.equal(validateBranding(empty),null);
 for(const b of [{...empty,header_text:'a'.repeat(601)},{...empty,theme_color:'orange'},{...empty,logo_data:'data:image/svg+xml,<svg/>'},{...empty,logo_data:'data:image/png;base64,YmFk'}]) assert.throws(()=>validateBranding(b));
 assert(validateBranding({...empty,logo_data:logoData()}));
 const bad=Uint8Array.from(atob(logoData().split(',')[1]),c=>c.charCodeAt(0));bad[45]^=1;
 assert.throws(()=>validateBranding({...empty,logo_data:'data:image/png;base64,'+btoa(String.fromCharCode(...bad))}));
});
const iid='92000000-0000-4000-8000-000000000001', did='93000000-0000-4000-8000-000000000001';
Deno.test('download authorizes before storage; denies negatives; audits before delivering',async()=>{
 const f=await fixture();
 for(const scenario of ['ok','auth','rls','institution','source','template','audit','pdf','xlsx','unreviewed','legacy','legacy-template','cross-path']) {
  const events:string[]=[];
  const doc={id:did,institution_id:iid,file_name:'synthetic.docx',object_path:iid+'/source.docx',format:['pdf','xlsx'].includes(scenario)?scenario:'docx',sha256:f.manifest.source_sha256,...f.expected,template_object_path:['pdf','xlsx','unreviewed','legacy'].includes(scenario)?null:(scenario==='cross-path'?'another/templates/x.docx':iid+'/templates/'+f.expected.template_sha256+'.docx')};
  const user={auth:{getUser:async()=>{events.push('auth');return {data:{user:scenario==='auth'?null:{id:'user'}},error:null};}},from:(table:string)=>{events.push(table);const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:scenario==='rls'?null:doc}),single:async()=>({data:scenario==='institution'?null:{document_branding:{...empty,header_text:'IES test'}}})};return q;}};
  const admin={storage:{from:()=>({download:async(path:string)=>{events.push('storage');return {data:new Blob([scenario=== 'source'?new Uint8Array([0]):path===doc.object_path?f.source:scenario==='template'?f.source:f.template])};},createSignedUrl:async()=>{events.push('signed');return {data:{signedUrl:'https://example.invalid/signed'}};}})},from:()=>({insert:async()=>{events.push('audit');return {error:scenario==='audit'?new Error('audit'):null};}})};
  let calls=0;const handler=libraryHandler(()=>++calls===1?user:admin,()=> 'synthetic');
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({institutionId:iid,id:did,...(scenario.startsWith('legacy')?{}:{responseVersion:2})})}));
  if(['ok','pdf','xlsx','unreviewed','legacy'].includes(scenario)) {assert.equal(response.status,200);assert(events.includes('audit'));}
  else assert(response.status>=400,scenario);
  if(['auth','rls','institution','cross-path','legacy-template'].includes(scenario)) assert(!events.includes('storage'),scenario);
  if(['pdf','xlsx','unreviewed'].includes(scenario)) assert.deepEqual(new Uint8Array(await response.arrayBuffer()),f.source);
  if(scenario==='legacy') {assert.equal((await response.json()).url,'https://example.invalid/signed');assert(events.includes('audit'));}
  if(scenario==='ok') {assert(events.indexOf('vertice_institutions')<events.indexOf('storage'));assert.equal(response.headers.get('cache-control'),'no-store');assert(strFromU8(unpack(new Uint8Array(await response.arrayBuffer()))['word/header1.xml']).includes('IES test'));}
 }
});
Deno.test('rejects unsafe archives/external images and removal of referenced semantic assets; scopes fills',async()=>{
 const f=await fixture();
 assert.throws(()=>unpack(zipSync({...f.files,'../outside.xml':strToU8('<x/>')})));
 assert.throws(()=>unpack(zipSync({...f.files,'word/evil.xml':strToU8('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>')})));
 const rels=strFromU8(f.files['word/_rels/document.xml.rels']);
 const external=rels.replace('</Relationships>','<Relationship Id="bad" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.invalid/image.png" TargetMode="External"/></Relationships>');
 assert.throws(()=>unpack(zipSync({...f.files,'word/_rels/document.xml.rels':strToU8(external)})));
 const referenced=rels.replace('</Relationships>','<Relationship Id="semantic" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/semantic.png"/></Relationships>');
 const source=zipSync({...f.files,'word/_rels/document.xml.rels':strToU8(referenced)});
 await assert.rejects(async()=>prepareTemplate(source,{...f.manifest,source_sha256:await sha256(source),remove_parts:['word/media/semantic.png']}));
 const styles=strFromU8(f.files['word/styles.xml']).replace('<w:b/>','<w:b/><w:shd w:fill="0000FF" w:themeFill="accent1"/>');
 const shaded=zipSync({...f.files,'word/styles.xml':strToU8(styles)}), manifest={...f.manifest,source_sha256:await sha256(shaded)};
 const template=await prepareTemplate(shaded,manifest), expected={...f.expected,template_sha256:await sha256(template),template_source_sha256:manifest.source_sha256};
 const result=unpack(await personalizeTemplate(template,{...empty,theme_color:'#FF8800'},expected));
 assert(strFromU8(result['word/styles.xml']).includes('w:fill="FF8800"'));assert(!strFromU8(result['word/styles.xml']).includes('themeFill'));
 assert(strFromU8(result['word/styles.xml']).includes('w:val="FF0000"'));
});
Deno.test('rejects active simple/complex Word fields without external relationships',async()=>{
 const f=await fixture();
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 const complex=(pieces:string[])=>'<w:r><w:fldChar w:fldCharType="begin"/></w:r>'+pieces.map(s=>`<w:r><w:instrText xml:space="preserve">${escape(s)}</w:instrText></w:r>`).join('')+'<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>cached result</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
 const cases=[
  '<w:fldSimple w:instr="INCLUDEPICTURE &quot;https://example.invalid/tracker.png&quot;"><w:r><w:t>x</w:t></w:r></w:fldSimple>',
  ...['DDE','ddeauto',' IncludeText ','\tincludePICTURE\n'].map(s=>`<w:fldSimple w:instr="${escape(s+' '+ 'https://example.invalid/x')}"><w:r><w:t>x</w:t></w:r></w:fldSimple>`),
  complex([' IN','CLUDE','PICTURE ', '"https://example.invalid/x"']),complex([' d','De','AuTo ', 'app topic item']),complex([' INCLUDE','TEXT ', '"file:///tmp/private"']),
  '<w:fldSimple w:instr="DATE"/>',
  '<w:fldSimple w:instr="PAGE"><w:fldSimple w:instr="SECTION"/></w:fldSimple>',
  complex(['PAGE ', 'INCLUDEPICTURE "https://example.invalid/x"']),
  '<w:r><w:instrText>DDEAUTO app topic item</w:instrText></w:r>',
  '<w:r><w:delInstrText>INCLUDETEXT x</w:delInstrText></w:r>',
  '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  complex([' PAGE ']).replace('w:fldCharType="end"','w:fldCharType="begin"'),
  '<w:fldSimple w:instr="PAGE"><w:fldSimple w:instr="DDE x"/></w:fldSimple>',
  complex([' PAGE ']).replace('<w:t>cached result</w:t>','<w:instrText>DDE x</w:instrText>'),
 ];
 for(const field of cases) {
  const document=strToU8(strFromU8(f.files['word/document.xml']).replace('<w:body>','<w:body><w:p>'+field+'</w:p>'));
  const source=zipSync({...f.files,'word/document.xml':document});
  await assert.rejects(async()=>prepareTemplate(source,{...f.manifest,source_sha256:await sha256(source)}));
  // A previously approved template cannot bypass the same validation at download time.
  const prepared=zipSync({...unpack(f.template),'word/document.xml':document});
  await assert.rejects(async()=>personalizeTemplate(prepared,empty,{...f.expected,template_sha256:await sha256(prepared)}));
 }
 for(const part of ['word/header1.xml','word/footer1.xml','word/footnotes.xml']) {
  const source=zipSync({...f.files,[part]:strToU8(`<w:hdr xmlns:w="${W}"><w:p>${cases[0]}</w:p></w:hdr>`)});
  await assert.rejects(async()=>prepareTemplate(source,{...f.manifest,source_sha256:await sha256(source)}));
 }
});
Deno.test('preserves allowlisted passive pagination fields byte-for-byte',async()=>{
 const f=await fixture();
 const fields='<w:fldSimple w:instr=" pAgE \\* MERGEFORMAT "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> NUM</w:instrText></w:r><w:r><w:instrText>PAGES \\* Arabic </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>3</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:fldSimple w:instr="SECTION"/><w:fldSimple w:instr="SECTIONPAGES \\* ROMAN"/>';
 const body=strToU8(strFromU8(f.files['word/document.xml']).replace('<w:body>','<w:body><w:p>'+fields+'</w:p>'));
 const footer=strToU8(`<w:ftr xmlns:w="${W}"><w:p>${fields}</w:p></w:ftr>`);
 const source=zipSync({...f.files,'word/document.xml':body,'word/footer1.xml':footer});
 const manifest={...f.manifest,source_sha256:await sha256(source)};
 const template=await prepareTemplate(source,manifest);
 const result=unpack(await personalizeTemplate(template,empty,{...f.expected,template_sha256:await sha256(template),template_source_sha256:manifest.source_sha256}));
 assert.deepEqual(result['word/document.xml'],body);assert.deepEqual(result['word/footer1.xml'],footer);
});
Deno.test('rejects CRC-valid interlaced PNG before decoder; accepts normalized RGB/RGBA', async()=>{
 const { deflateSync } = await import('node:zlib');
 const { Buffer } = await import('node:buffer');
 const crc32=(data:Uint8Array)=>{let c=0xffffffff;for(const byte of data){c^=byte;for(let bit=0;bit<8;bit++) c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(name:string,data:Uint8Array)=>{const type=Buffer.from(name);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.set(type,4);out.set(data,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(300);header.writeUInt32BE(120,4);header[8]=8;header[9]=6;header[12]=1;
 // 200 KB controlled expansion; never inflate the payload in the validator test.
 const interlaced=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(200000))),chunk('IEND',Buffer.alloc(0))]);
 const read=PNG.sync.read;let calls=0;
 PNG.sync.read=()=>{calls++;throw new Error('decoder must not be reached');};
 try {
  assert.throws(()=>validateBranding({...empty,logo_data:'data:image/png;base64,'+interlaced.toString('base64')}),/Unsupported normalized PNG encoding/);
  assert.equal(calls,0);
  for(const [offset,value] of [[24,16],[25,0],[25,3],[25,4],[26,1],[27,1]]) {
   const bytes=Buffer.from(interlaced);bytes[28]=0;bytes[offset]=value;bytes.writeUInt32BE(crc32(bytes.subarray(12,29)),29);
   assert.throws(()=>validateBranding({...empty,logo_data:'data:image/png;base64,'+bytes.toString('base64')}),/Unsupported normalized PNG encoding/);
  }
  assert.equal(calls,0);
 } finally { PNG.sync.read=read; }
 assert(validateBranding({...empty,logo_data:logoData()}));
 const rgb=new PNG({width:300,height:120});rgb.data.fill(255);
 const bytes=PNG.sync.write(rgb,{colorType:2});assert.equal(bytes[25],2);
 assert(validateBranding({...empty,logo_data:'data:image/png;base64,'+bytes.toString('base64')}));
});
Deno.test('rejects renamed active content by MIME/relationship and scans XML-typed renamed parts',async()=>{
 const f=await fixture();
 const types=strFromU8(f.files['[Content_Types].xml']);
 const rejectBoth=async(changes:Record<string,Uint8Array>)=>{
  const source=zipSync({...f.files,...changes});
  await assert.rejects(async()=>prepareTemplate(source,{...f.manifest,source_sha256:await sha256(source)}));
  const prepared=zipSync({...unpack(f.template),...changes});
  await assert.rejects(async()=>personalizeTemplate(prepared,empty,{...f.expected,template_sha256:await sha256(prepared)}));
 };
 for(const mime of ['application/vnd.ms-office.vbaProject','application/vnd.ms-office.activeX+xml','application/vnd.ms-word.document.macroEnabled.main+xml']) {
  await rejectBoth({'word/neutral.bin':new Uint8Array([1,2,3]),'[Content_Types].xml':strToU8(types.replace('</Types>',`<Override PartName="/word/neutral.bin" ContentType="${mime}"/></Types>`))});
 }
 for(const main of ['application/vnd.ms-word.document.macroEnabled.main+xml','application/xml']) {
  await rejectBoth({'[Content_Types].xml':strToU8(types.replace('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',main))});
 }
 for(const type of ['vbaProject','control','activeXControlBinary','package']) {
  const relationships=strFromU8(f.files['word/_rels/document.xml.rels']).replace('</Relationships>',`<Relationship Id="hidden" Type="http://schemas.microsoft.com/office/2006/relationships/${type}" Target="neutral.bin"/></Relationships>`);
  await rejectBoth({'word/neutral.bin':new Uint8Array([1,2,3]),'word/_rels/document.xml.rels':strToU8(relationships)});
 }
 const payload=strToU8(`<w:ftr xmlns:w="${W}"><w:fldSimple w:instr="INCLUDETEXT &quot;https://example.invalid/x&quot;"/></w:ftr>`);
 for(const entry of ['<Override PartName="/word/hidden.dat" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>','<Default Extension="dat" ContentType="application/xml"/>']) {
  await rejectBoth({'word/hidden.dat':payload,'[Content_Types].xml':strToU8(types.replace('</Types>',entry+'</Types>'))});
 }
});
Deno.test('manifest is an internal OPC package part; rejects orphaned or ambiguous metadata',async()=>{
 const f=await fixture(), prepared=unpack(f.template);
 const root=strFromU8(prepared['_rels/.rels']);
 const relation=root.match(/<Relationship[^>]+Type="https:\/\/verticesuperior.com.br\/relationships\/document-template"[^>]*\/>/)![0];
 assert(relation.includes('Target="vertice/template.json"'));
 const result=unpack(await personalizeTemplate(f.template,empty,f.expected));
 assert.deepEqual(result['_rels/.rels'],prepared['_rels/.rels']);
 assert.deepEqual(result['vertice/template.json'],prepared['vertice/template.json']);
 assert.deepEqual(result['word/document.xml'],f.files['word/document.xml']);
 const malformed=[
  root.replace(relation,''), root.replace(relation,relation+relation),
  root.replace('Target="vertice/template.json"','Target="https://example.invalid/template.json" TargetMode="External"'),
  root.replace('Target="vertice/template.json"','Target="word/document.xml"'),
  root.replace('Id="rIdVerticeTemplate"','Id="rId1"'),
 ];
 for(const rels of malformed) {
  const bytes=zipSync({...prepared,'_rels/.rels':strToU8(rels)});
  await assert.rejects(async()=>personalizeTemplate(bytes,empty,{...f.expected,template_sha256:await sha256(bytes)}));
 }
 const wrongType=zipSync({...prepared,'[Content_Types].xml':strToU8(strFromU8(prepared['[Content_Types].xml']).replace('ContentType="application/json"','ContentType="text/plain"'))});
 await assert.rejects(async()=>personalizeTemplate(wrongType,empty,{...f.expected,template_sha256:await sha256(wrongType)}));
 // A pre-existing, unrelated relationship ID is retained; the new ID is unique.
 const originalRoot=strFromU8(f.files['_rels/.rels']).replace('Id="rId1"','Id="rIdVerticeTemplate"');
 const source=zipSync({...f.files,'_rels/.rels':strToU8(originalRoot)});
 const template=unpack(await prepareTemplate(source,{...f.manifest,source_sha256:await sha256(source)}));
 assert(strFromU8(template['_rels/.rels']).includes('Id="rIdVerticeTemplate1"'));
});
