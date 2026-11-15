import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
vi.mock('@/lib/area',()=>({explain:()=> 'Falha de gravação'}));
vi.mock('@/components/ContextHelp',()=>({HelpLabel:({children,...props}:any)=><label {...props}>{children}</label>}));
import BrandingPanel,{brandingError,normalizeDocumentLogo} from './BrandingPanel';
let el:HTMLDivElement,root:Root;
const institution={id:'ies-a',name:'UNITOP',updated_at:'2026-11-15T19:00:00Z',document_branding:{header_text:'UNITOP',theme_color:'#333333',logo_data:null}};
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;rpc.mockReset();el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
async function changeName(){const input=el.querySelector<HTMLInputElement>('input[maxlength="200"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Centro Universitário UNITOP');input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function save(){await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='Salvar identidade visual')!.click();});}
it('uses the protected RPC with canonical fields and expected revision',async()=>{rpc.mockResolvedValue({data:{updated_at:'2026-11-15T19:01:00Z'},error:null});const changed=vi.fn();await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={changed}/>));await changeName();await save();expect(rpc).toHaveBeenCalledWith('vertice_save_document_branding',{institution:'ies-a',expected_updated_at:institution.updated_at,branding:{header_text:'Centro Universitário UNITOP',theme_color:'#333333',logo_data:null}});expect(changed).toHaveBeenCalledOnce();expect(el.textContent).toContain('Identidade visual salva com sucesso.');});
it('keeps conflict errors distinct and never reports success',async()=>{rpc.mockResolvedValue({data:null,error:{code:'40001'}});await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={()=>{}}/>));await changeName();await save();expect(el.textContent).toContain('atualizada em outra tela');expect(el.textContent).not.toContain('salva com sucesso');});
it('offers no save control for readers',async()=>{await act(async()=>root.render(<BrandingPanel institution={institution} canEdit={false} onChanged={()=>{}}/>));expect(el.textContent).toContain('UNITOP');expect(el.querySelector('input[type=file]')).toBeNull();expect(rpc).not.toHaveBeenCalled();});
it('rejects oversized and unsupported images before decoding',async()=>{await expect(normalizeDocumentLogo(new Blob([new Uint8Array(2097153)],{type:'image/png'}))).rejects.toThrow('2 MB');await expect(normalizeDocumentLogo(new Blob(['<svg/>'],{type:'image/svg+xml'}))).rejects.toThrow('PNG, JPG ou WebP');expect(brandingError({code:'42501'})).toContain('verificação de segurança');});
