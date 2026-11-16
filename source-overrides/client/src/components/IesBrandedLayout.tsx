/**
 * IesBrandedLayout — layout público com identidade da IES em destaque.
 *
 * Substitui o PublicLayout quando a URL identifica uma instituição (ies=UUID).
 * Oculta a logo e navegação da Vértice. Mostra nome/sigla da IES no header.
 * Usado em: /conecta-parceiros, /acesso-estudante e outras rotas públicas por IES.
 */
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IesInfo {
  name: string;
  acronym: string;
  logo_url: string | null;
}

export function useIesParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ies") ?? null;
}

export default function IesBrandedLayout({
  children,
  institutionId,
  institutionName,
}: {
  children: ReactNode;
  institutionId?: string | null;
  institutionName?: string | null;
}) {
  const paramIes = useIesParam();
  const iesId = institutionId || paramIes;
  const [ies, setIes] = useState<IesInfo | null>(
    institutionName ? { name: institutionName, acronym: "", logo_url: null } : null
  );

  useEffect(() => {
    if (!iesId || !UUID.test(iesId)) return;
    if (ies?.name && institutionName) return; // already have it from prop

    let alive = true;
    supabase
      .from("vertice_institutions")
      .select("name, acronym")
      .eq("id", iesId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        // Logo by convention: bucket vertice-institution-logos, file {id}.png
        const { data: urlData } = supabase.storage
          .from("vertice-institution-logos")
          .getPublicUrl(`${iesId}.png`);
        const logoCandidate = urlData?.publicUrl || null;
        if (logoCandidate) {
          fetch(logoCandidate, { method: "HEAD" })
            .then(r => {
              if (!alive) return;
              setIes({
                name: data.name || "",
                acronym: data.acronym || "",
                logo_url: r.ok ? logoCandidate : null,
              });
            })
            .catch(() => {
              if (!alive) return;
              setIes({ name: data.name || "", acronym: data.acronym || "", logo_url: null });
            });
        } else {
          setIes({ name: data.name || "", acronym: data.acronym || "", logo_url: null });
        }
      }, () => {});
    return () => { alive = false; };
  }, [iesId]);

  const displayName = ies?.acronym && ies.acronym !== ies.name
    ? `${ies.acronym} — ${ies.name}`
    : ies?.name || "Instituição";

  return (
    <div className="corporate-site ies-branded">
      <style>{`
        .ies-branded .corp-header { background: #0f172a; }
        .ies-branded .ies-brand-header {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 24px; max-width: 1200px; margin: 0 auto;
        }
        .ies-branded .ies-brand-logo {
          width: 56px; height: 56px; border-radius: 12px;
          background: #1e293b; display: flex; align-items: center;
          justify-content: center; font-size: 22px; font-weight: 700;
          color: #f1f5f9; flex-shrink: 0; letter-spacing: 1px;
        }
        .ies-branded .ies-brand-logo img {
          width: 100%; height: 100%; object-fit: contain; border-radius: 12px;
        }
        .ies-branded .ies-brand-text h1 {
          font-size: 1.15rem; font-weight: 700; color: #f1f5f9;
          margin: 0; line-height: 1.3;
        }
        .ies-branded .ies-brand-text p {
          font-size: 0.78rem; color: #94a3b8; margin: 2px 0 0;
        }
        .ies-branded .ies-footer {
          background: #0f172a; color: #94a3b8; text-align: center;
          padding: 24px 16px; font-size: 0.8rem;
        }
        .ies-branded .ies-footer a {
          color: #94a3b8; text-decoration: underline;
        }
        .ies-branded .ies-powered {
          display: flex; align-items: center; justify-content: center;
          gap: 6px; margin-top: 8px; font-size: 0.7rem; color: #475569;
        }
        @media (max-width: 640px) {
          .ies-branded .ies-brand-header { padding: 12px 16px; gap: 12px; }
          .ies-branded .ies-brand-logo { width: 44px; height: 44px; font-size: 17px; }
          .ies-branded .ies-brand-text h1 { font-size: 1rem; }
        }
      `}</style>

      <header className="corp-header">
        <div className="ies-brand-header">
          <div className="ies-brand-logo">
            {ies?.logo_url ? (
              <img src={ies.logo_url} alt={displayName} />
            ) : (
              <span>{(ies?.acronym || ies?.name || "?").slice(0, 4).toUpperCase()}</span>
            )}
          </div>
          <div className="ies-brand-text">
            <h1>{displayName}</h1>
            <p>Portal institucional</p>
          </div>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="ies-footer">
        <span>© {new Date().getFullYear()} {ies?.name || "Instituição"}</span>
        <div className="ies-powered">
          Tecnologia por Vértice Educação Superior
        </div>
      </footer>
    </div>
  );
}
