import {openTextPdf} from '../../../supabase/functions/vertice-doc-prevalidate/pdf-runtime.mjs';
import {extractDocument} from '../../../supabase/functions/vertice-doc-prevalidate/document-text.mjs';
// Resolve the exact pinned package installed from package-lock.json.
Deno.test('real PDF parser lifecycle in Deno; synthetic text fixture is not academic evidence',async()=>{
 const pdfjs=await import('./node_modules/pdfjs-dist/legacy/build/pdf.mjs');
 const bytes=await Deno.readFile(new URL('./fixtures/synthetic-text-layer.pdf',import.meta.url));
 const result=await extractDocument(bytes,'fixture.pdf',{pdf:(b:Uint8Array)=>openTextPdf(b,pdfjs.getDocument)});
 if(result.pageCount!==1||result.partial||!result.text.includes('EVIDENCIA SINTETICA DE REGRESSAO'))throw Error('PDF extraction regression');
});
