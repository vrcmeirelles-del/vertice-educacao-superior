import { useEffect, useState } from 'react';
import { IMAGE_MAX_BYTES, IMAGE_MAX_PER_QUESTION, IMAGE_MIME_TYPES, type ImagePlacement } from './question-media';

export interface PendingQuestionImage {
  localId: string;
  file: File;
  altText: string;
  caption: string;
  placement: ImagePlacement;
  alternativeId?: string;
  rightsStatus: 'nao_informado' | 'autoral' | 'licenciado' | 'uso_autorizado';
}
interface Props {
  questionId: string;
  value: PendingQuestionImage[];
  onChange: (images: PendingQuestionImage[]) => void;
  disabled?: boolean;
}
const createId = () => crypto.randomUUID();
/**
 * Campo reutilizável a conectar ao futuro formulário de questões.
 * Arquivos permanecem somente no navegador até upload assinado por backend.
 * Não sugere publicação/armazenamento do anexo.
 */
export function QuestionImageField({questionId,value,onChange,disabled=false}:Props) {
  const [error,setError] = useState('');
  const [previews,setPreviews] = useState<Record<string,string>>({});
  useEffect(()=>{
    const entries=value.map(item=>[item.localId,URL.createObjectURL(item.file)] as const);
    setPreviews(Object.fromEntries(entries));
    return ()=>entries.forEach(([,url])=>URL.revokeObjectURL(url));
  },[value]);
  const addFiles=(files:FileList|null)=>{
    if (!files) return;
    setError('');
    const proposed:PendingQuestionImage[]=[];
    for(const file of Array.from(files)) {
      if (!IMAGE_MIME_TYPES.includes(file.type as typeof IMAGE_MIME_TYPES[number])) {
        setError('Use imagens PNG, JPEG ou WebP.');continue;
      }
      if (file.size<=0 || file.size>IMAGE_MAX_BYTES) {
        setError('Cada arquivo deve ter até 10 MB.');continue;
      }
      if (value.length+proposed.length>=IMAGE_MAX_PER_QUESTION) {
        setError('Limite de 12 imagens por questão.');break;
      }
      proposed.push({localId:createId(),file,altText:'',caption:'',placement:'enunciado',rightsStatus:'nao_informado'});
    }
    if (proposed.length) onChange([...value,...proposed]);
  };
  const patch=(id:string,change:Partial<PendingQuestionImage>)=>
    onChange(value.map(x=>x.localId===id?{...x,...change}:x));
  return <fieldset disabled={disabled} aria-label={`Imagens da questão ${questionId}`}
    style={{border:'1px solid var(--border,#d7e0ec)',borderRadius:10,padding:16}}>
    <legend>Imagens e figuras da questão (opcional)</legend>
    <p style={{fontSize:13}}>Anexe gráficos, fotografias, radiografias, esquemas ou figuras. Adicione legenda e descrição acessível. O anexo só será salvo após confirmação no formulário.</p>
    <label style={{display:'block',marginBottom:12}}>
      <span>Selecionar imagens (PNG, JPEG ou WebP; até 10 MB cada)</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple
        onChange={e=>{addFiles(e.currentTarget.files);e.currentTarget.value='';}}
        style={{display:'block',marginTop:8}} />
    </label>
    {error&&<p role="alert" style={{color:'#ae2e24'}}>{error}</p>}
    {value.map(item=><div key={item.localId} style={{display:'grid',gap:8,borderTop:'1px solid #ddd',padding:'12px 0'}}>
      {previews[item.localId]&&<img src={previews[item.localId]} alt={item.altText||'Prévia da imagem ainda sem descrição'} style={{maxWidth:270,maxHeight:180,objectFit:'contain'}}/>}
      <strong>{item.file.name}</strong>
      <label>Posição
        <select value={item.placement} onChange={e=>patch(item.localId,{placement:e.target.value as ImagePlacement,alternativeId:undefined})}>
          <option value="enunciado">Enunciado</option><option value="alternativa">Alternativa</option><option value="apoio">Material de apoio</option>
        </select>
      </label>
      {item.placement==='alternativa'&&<label>Identificador da alternativa
        <input value={item.alternativeId||''} required onChange={e=>patch(item.localId,{alternativeId:e.target.value})}
          placeholder="Ex.: A, B, C, D ou E" />
      </label>}
      <label>Descrição acessível da imagem
        <textarea required rows={2} value={item.altText}
          onChange={e=>patch(item.localId,{altText:e.target.value})}
          placeholder="Descreva o conteúdo relevante para compreender a questão" />
      </label>
      <label>Legenda (opcional)
        <input value={item.caption} onChange={e=>patch(item.localId,{caption:e.target.value})}
          placeholder="Ex.: Figura 1 — esquema do processo" />
      </label>
      <label>Direito de uso
        <select value={item.rightsStatus} onChange={e=>patch(item.localId,{rightsStatus:e.target.value as PendingQuestionImage['rightsStatus']})}>
          <option value="nao_informado">Selecione o direito de uso</option><option value="autoral">Imagem autoral</option><option value="licenciado">Licenciada</option>
          <option value="uso_autorizado">Uso autorizado</option>
        </select>
      </label>
      <button type="button" onClick={()=>onChange(value.filter(x=>x.localId!==item.localId))}>
        Remover imagem
      </button>
    </div>)}
  </fieldset>;
}
