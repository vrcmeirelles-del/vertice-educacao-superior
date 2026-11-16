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
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function changeName(){const input=el.querySelector<HTMLInputElement>('input[maxlength="200"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Centro Universitário UNITOP');input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function save(){await act(async()=>{[...el.querySelectorAll('button')].find(b=>b.textContent==='Salvar identidade visual')!.click();});}
it('uses the protected RPC with canonical fields and expected revision',async()=>{rpc.mockResolvedValue({data:{updated_at:'2026-11-15T19:01:00Z'},error:null});const changed=vi.fn();await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={changed}/>));await changeName();await save();expect(rpc).toHaveBeenCalledWith('vertice_save_document_branding',{institution:'ies-a',expected_updated_at:institution.updated_at,branding:{header_text:'Centro Universitário UNITOP',theme_color:'#333333',logo_data:null}});expect(changed).toHaveBeenCalledOnce();expect(el.textContent).toContain('Identidade visual salva com sucesso.');});
it('keeps conflict errors distinct and never reports success',async()=>{rpc.mockResolvedValue({data:null,error:{code:'40001'}});await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={()=>{}}/>));await changeName();await save();expect(el.textContent).toContain('atualizada em outra tela');expect(el.textContent).not.toContain('salva com sucesso');});
it('offers no save control for readers',async()=>{await act(async()=>root.render(<BrandingPanel institution={institution} canEdit={false} onChanged={()=>{}}/>));expect(el.textContent).toContain('UNITOP');expect(el.querySelector('input[type=file]')).toBeNull();expect(rpc).not.toHaveBeenCalled();});
it('rejects oversized and unsupported images before decoding',async()=>{await expect(normalizeDocumentLogo(new Blob([new Uint8Array(2097153)],{type:'image/png'}))).rejects.toThrow('2 MB');await expect(normalizeDocumentLogo(new Blob(['<svg/>'],{type:'image/svg+xml'}))).rejects.toThrow('PNG, JPG ou WebP');expect(brandingError({code:'42501'})).toContain('verificação de segurança');});

it('prepares a local preview without persisting until the explicit save action',async()=>{
 const logo='data:image/png;base64,c3ludGhldGlj';
 vi.stubGlobal('FileReader',class{result=logo;onload:(()=>void)|null=null;readAsDataURL(){queueMicrotask(()=>this.onload?.());}});
 vi.stubGlobal('Image',class{naturalWidth=300;naturalHeight=120;onload:(()=>void)|null=null;set src(_value:string){queueMicrotask(()=>this.onload?.());}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as any);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(logo);
 await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={()=>{}}/>));
 const input=el.querySelector<HTMLInputElement>('input[type=file]')!;
 Object.defineProperty(input,'files',{value:[new File(['synthetic'],'logo-teste.png',{type:'image/png'})]});
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(el.querySelector<HTMLImageElement>('img[alt="Logo atual"]')?.src).toBe(logo);
 expect(el.textContent).toContain('Logo preparada');expect(rpc).not.toHaveBeenCalled();
 rpc.mockResolvedValue({data:{updated_at:'2026-11-15T19:01:00Z'},error:null});await save();
 expect(rpc.mock.calls[0][1].branding.logo_data).toBe(logo);
});

it('keeps authorization failures explicit and does not signal a confirmed save',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'42501'}});const changed=vi.fn();
 await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={changed}/>));
 await changeName();await save();expect(el.textContent).toContain('autorizar o salvamento');
 expect(el.textContent).not.toContain('salva com sucesso');expect(changed).not.toHaveBeenCalled();
});

it('reloads the persisted preview when the institution prop is refreshed',async()=>{
 const logo='data:image/png;base64,c3ludGhldGlj';
 await act(async()=>root.render(<BrandingPanel institution={institution} canEdit onChanged={()=>{}}/>));
 await act(async()=>root.render(<BrandingPanel institution={{...institution,document_branding:{...institution.document_branding,logo_data:logo}}} canEdit onChanged={()=>{}}/>));
 expect(el.querySelector<HTMLImageElement>('img[alt="Logo atual"]')?.src).toBe(logo);expect(rpc).not.toHaveBeenCalled();
});
