import {logoData,documentNotice,privacySource} from './branding-data.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function brandDownload(value,type,name){
 if(typeof value!=='string')return value;
 if(type.startsWith('text/html')){
  const head=`<header class="vertice-document-header"><img alt="Vértice Educação Superior" src="${logoData}" style="width:280px;max-width:80%;height:auto"><p>CONFIDENCIAL · circulação restrita ao mandato</p></header>`;
  const footer=`<footer class="vertice-document-footer"><p>${esc(documentNotice)}</p><p>As informações declaradas dependem de conferência; este documento não substitui aprovação profissional. Os hashes de versões arquivadas identificam o conteúdo original, sem esta apresentação de exportação.</p><a href="${privacySource}">LGPD — fonte legislativa</a></footer>`;
  const style='<style>.vertice-document-header{display:block;border-bottom:2px solid #328ea8;padding:0 0 18px;margin-bottom:25px;height:auto;background:white;color:#243653}.vertice-document-header p{font:11px Arial;letter-spacing:1px}.vertice-document-footer{display:block;border-top:1px solid #dbe3ea;padding:18px 0;margin-top:30px;font:10px/1.5 Arial;color:#52637a}body{color:#243653;font:14px/1.6 Arial;max-width:1100px;margin:35px auto;padding:20px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #dbe3ea;padding:7px;text-align:left}th{background:#edf5f8;color:#243653}@media print{.vertice-document-header{break-after:avoid}.vertice-document-footer{break-inside:avoid}body{margin:0;padding:0}}</style>';
  const doc=new DOMParser().parseFromString(value,'text/html');doc.head.insertAdjacentHTML('beforeend',style);
  if(!doc.body.querySelector('.vertice-document-header'))doc.body.insertAdjacentHTML('afterbegin',head);
  doc.body.insertAdjacentHTML('beforeend',footer);return '<!doctype html>'+doc.documentElement.outerHTML;
 }
 if(type.startsWith('text/plain'))return 'VÉRTICE EDUCAÇÃO SUPERIOR\n'+documentNotice+'\n\n'+value+'\n\nArquivo: '+name+'\nAviso de apresentação: hashes arquivados referem-se ao conteúdo original, sem este cabeçalho de exportação.\n';
 if(type.startsWith('application/json')){try{const body=JSON.parse(value);if(body&&typeof body==='object'&&!Array.isArray(body))return JSON.stringify({...body,export_notice:{confidentiality:documentNotice,source:privacySource,original_hashes_preserved:true}},null,2);}catch{}}
 return value;
}
