import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { explain, type Row } from "@/lib/area";

/** Estrutura salva em vertice_institutions.document_branding (jsonb). */
type DocumentBranding = {
  logo_url?: string | null;
  display_name?: string | null;
  brand_color?: string | null;
};

const BUCKET = "vertice-institution-logos";
const SUPABASE_URL = "https://qvetbbmviatxxatzzuzc.supabase.co";

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
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
  const [displayName, setDisplayName] = useState(existing.display_name ?? "");
  const [brandColor, setBrandColor] = useState(existing.brand_color ?? "#333333");
  const [logoUrl, setLogoUrl] = useState(existing.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state when institution prop changes (e.g., after reload).
  useEffect(() => {
    const b = (institution.document_branding ?? {}) as DocumentBranding;
    setDisplayName(b.display_name ?? "");
    setBrandColor(b.brand_color ?? "#333333");
    setLogoUrl(b.logo_url ?? "");
  }, [institution.document_branding]);

  const dirty =
    displayName !== (existing.display_name ?? "") ||
    brandColor !== (existing.brand_color ?? "#333333") ||
    logoUrl !== (existing.logo_url ?? "");

  /** Upload logo to Supabase Storage. */
  const uploadLogo = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${institution.id}/logo.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;

        const url = publicUrl(path);
        setLogoUrl(url);
        setMessage("Logo enviado. Clique em Salvar para confirmar.");
      } catch (err) {
        setError(explain(err));
      } finally {
        setUploading(false);
      }
    },
    [institution.id],
  );

  /** Persist document_branding jsonb. */
  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const branding: DocumentBranding = {
        logo_url: logoUrl || null,
        display_name: displayName.trim() || null,
        brand_color: brandColor || null,
      };
      const { error: upErr } = await supabase
        .from("vertice_institutions")
        .update({ document_branding: branding })
        .eq("id", institution.id);
      if (upErr) throw upErr;
      setMessage("Identidade visual salva com sucesso.");
      onChanged();
    } catch (err) {
      setError(explain(err));
    } finally {
      setSaving(false);
    }
  }, [institution.id, logoUrl, displayName, brandColor, onChanged]);

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
          <label className="wide">
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
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
            />
            <small>PNG, JPG, SVG ou WebP — até 2 MB</small>
          </label>

          {/* Display name */}
          <label className="wide">
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
          </label>

          {/* Color picker */}
          <label>
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
          </label>

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
