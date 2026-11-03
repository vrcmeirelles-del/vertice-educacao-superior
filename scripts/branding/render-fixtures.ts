import { fixture, logoData, empty } from './document-template.test.ts';
import { personalizeTemplate, sha256 } from '../../supabase/functions/_shared/document-template.ts';
const directory = Deno.args[0]; if (!directory) throw new Error('Specify synthetic output directory');
await Deno.mkdir(directory,{recursive:true});
const f=await fixture();
await Deno.writeFile(directory+'/source.docx',f.source);
await Deno.writeTextFile(directory+'/manifest.json',JSON.stringify(f.manifest,null,2));
for(const [name,b] of Object.entries({normal:{header_text:'FACULDADE SINTÉTICA\nEnsino, pesquisa e extensão',theme_color:'#FF8800',logo_data:logoData()},absent:empty,long:{header_text:'Texto institucional sintético '.repeat(20),theme_color:'#FFFF00',logo_data:logoData()}})) {
 const result=await personalizeTemplate(f.template,b,f.expected);await Deno.writeFile(directory+'/'+name+'.docx',result);
 console.log(name,await sha256(result));
}
