import { HelpLabel } from '@/components/ContextHelp';
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { explain, type Row } from "@/lib/area";

/** Estrutura salva em vertice_institutions.document_branding (jsonb). */
type DocumentBranding = {
  logo_data?: string | null;
  header_text?: string | null;
  theme_color?: string | null;
  logo_url?: string | null;
  display_name?: string | null;
  brand_color?: string | null;
};

const BUCKET = "vertice-institution-logos";
const SUPABASE_URL = "https://qvetbbmviatxxatzzuzc.supabase.co";

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function normalizeDocumentLogo(file:Blob):Promise<string> {
 if(file.size>2*1024*1024)throw new Error('A imagem deve ter até 2 MB.');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use uma imagem PNG, JPG ou WebP.');
 const url=URL.createObjectURL(file);
 try {
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('Imagem inválida.');
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=120;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a imagem.');
  const scale=Math.min(300/image.naturalWidth,120/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  ctx.drawImage(image,(300-width)/2,(120-height)/2,width,height);
  return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
export function brandingError(error:unknown):string {
 const e=error as {code?:string;message?:string};
 if(e.code==='40001')return 'A instituição foi atualizada em outra tela. Reabra o cadastro antes de salvar; suas alterações ainda não foram gravadas.';
 if(e.code==='23514')return 'A identidade visual não está no formato aceito. Selecione novamente a logo e confira a cor.';
 if(e.code==='42501')return 'Não foi possível autorizar o salvamento. Confira o perfil institucional e a verificação de segurança da sessão.';
 return e.message||explain(error);
}

/**
 * Painel "Identidade visual para documentos".
 * Permite enviar o logo, definir o nome de exibição (cabeçalho do .docx)
 * e a cor predominante da instituição.
 *
 * Salva tudo na coluna jsonb `document_branding` de vertice_institutions.
 */
export default function BrandingPanel({
  institution,
  canEdit,
  onChanged,
}: {
  institution: Row;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const existing = (institution.document_branding ?? {}) as DocumentBranding;
  const [displayName, setDisplayName] = useState(existing.header_text ?? existing.display_name ?? "");
  const [brandColor, setBrandColor] = useState(existing.theme_color ?? existing.brand_color ?? "#333333");
  const [logoUrl, setLogoUrl] = useState(existing.logo_data ?? existing.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state when institution prop changes (e.g., after reload).
  useEffect(() => {
    const b = (institution.document_branding ?? {}) as DocumentBranding;
    setDisplayName(b.header_text ?? b.display_name ?? "");
    setBrandColor(b.theme_color ?? b.brand_color ?? "#333333");
    setLogoUrl(b.logo_data ?? b.logo_url ?? "");
  }, [institution.id,institution.document_branding]);

  const dirty =
    displayName !== (existing.header_text ?? existing.display_name ?? "") ||
    brandColor !== (existing.theme_color ?? existing.brand_color ?? "#333333") ||
    logoUrl !== (existing.logo_data ?? existing.logo_url ?? "");

  /** Prepare the document logo locally; persist only through the versioned RPC. */
  const uploadLogo = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");
      try {
        if (!canEdit) throw new Error('Sem permissão para editar esta instituição.');
        const url = await normalizeDocumentLogo(file);
        setLogoUrl(url);
        setMessage("Logo preparada. Clique em Salvar para confirmar.");
      } catch (err) {
        setError(brandingError(err));
      } finally {
        setUploading(false);
      }
    },
    [institution.id,canEdit],
  );

  /** Persist document_branding jsonb. */
  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!canEdit) throw new Error('Sem permissão para editar esta instituição.');
      if (logoUrl && !logoUrl.startsWith('data:image/png;base64,')) throw new Error('Selecione a logo novamente para adequar a imagem ao formato dos documentos.');
      const branding = {logo_data:logoUrl || null,header_text:displayName.trim(),theme_color:brandColor || null};
      const {data,error:upErr}=await supabase.rpc('vertice_save_document_branding',{
        institution:institution.id, expected_updated_at:institution.updated_at, branding,
      });
      if(upErr)throw upErr;
      if(!data?.updated_at)throw new Error('O servidor não confirmou o salvamento.');
      setMessage("Identidade visual salva com sucesso.");
      onChanged();
    } catch (err) {
      setError(brandingError(err));
    } finally {
      setSaving(false);
    }
  }, [institution.id,institution.updated_at,canEdit,logoUrl,displayName,brandColor,onChanged]);

  const removeLogo = useCallback(() => {
    setLogoUrl("");
    setMessage("Logo removido. Clique em Salvar para confirmar.");
  }, []);

  return (
    <div className="area-panel">
      <div className="area-panel-head">
        <h3>Identidade visual para documentos</h3>
      </div>
      <p className="area-muted" style={{ margin: "0 0 16px", fontSize: ".9rem" }}>
        Estas informações são usadas para preencher o cabeçalho dos documentos
        (atas, formulários) baixados pelo coordenador.
      </p>

      {!canEdit ? (
        /* Modo leitura */
        <dl className="area-dl">
          {logoUrl && (
            <div className="wide">
              <dt>Logo</dt>
              <dd>
                <img
                  src={logoUrl}
                  alt="Logo da instituição"
                  style={{ maxHeight: 80, maxWidth: 200, objectFit: "contain" }}
                />
              </dd>
            </div>
          )}
          <div>
            <dt>Nome no cabeçalho</dt>
            <dd>{displayName || "—"}</dd>
          </div>
          <div>
            <dt>Cor predominante</dt>
            <dd style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: brandColor,
                  border: "1px solid #ccc",
                }}
              />
              {brandColor}
            </dd>
          </div>
        </dl>
      ) : (
        /* Modo edição */
        <div className="area-form-grid">
          {/* Logo upload */}
          <HelpLabel className="wide">
            <span>Logo da instituição</span>
            {logoUrl && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <img
                  src={logoUrl}
                  alt="Logo atual"
                  style={{
                    maxHeight: 64,
                    maxWidth: 180,
                    objectFit: "contain",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    padding: 4,
                    background: "#fafafa",
                  }}
                />
                <button
                  type="button"
                  className="corp-login-text-button"
                  onClick={removeLogo}
                  style={{ fontSize: ".85rem" }}
                >
                  Remover
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
            />
            <small>PNG, JPG ou WebP — até 2 MB. Ajuste proporcional para o cabeçalho (300 × 120 px).</small>
          </HelpLabel>

          <div className="wide"><button type="button" disabled={uploading||saving} onClick={async()=>{setUploading(true);setError('');try{const response=await fetch(publicUrl(`${institution.id}/logo.png`));if(!response.ok)throw new Error('Logo anterior não encontrada. Escolha o arquivo no computador.');const blob=await response.blob();setLogoUrl(await normalizeDocumentLogo(blob));setMessage('Logo recuperada. Clique em Salvar identidade visual para confirmar.');}catch(e){setError(brandingError(e));}finally{setUploading(false);}}}>Recuperar logo PNG já enviada</button></div>
          {/* Display name */}
          <HelpLabel className="wide">
            <span>Nome exibido no cabeçalho dos documentos</span>
            <input
              type="text"
              maxLength={200}
              placeholder={String(institution.name ?? "")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <small>
              Se vazio, será usado o nome cadastrado da instituição.
            </small>
          </HelpLabel>

          {/* Color picker */}
          <HelpLabel>
            <span>Cor predominante</span>
            <div className="area-color-row">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                style={{ width: 48, height: 40, padding: 2, cursor: "pointer" }}
              />
              <input
                type="text"
                maxLength={7}
                pattern="#[0-9a-fA-F]{6}"
                placeholder="#333333"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                style={{ width: 100 }}
              />
            </div>
            <small>
              Usada nas bordas e destaques dos documentos da instituição.
            </small>
          </HelpLabel>

          {/* Feedback */}
          {error && <p className="area-error wide">{error}</p>}
          {message && (
            <p className="wide" style={{ color: "#168878", fontWeight: 600, margin: 0 }}>
              {message}
            </p>
          )}

          {/* Actions */}
          <div className="area-form-actions wide">
            <button
              type="button"
              className="corp-button"
              disabled={saving || uploading || !dirty}
              onClick={() => void save()}
            >
              {saving ? "Salvando…" : "Salvar identidade visual"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
