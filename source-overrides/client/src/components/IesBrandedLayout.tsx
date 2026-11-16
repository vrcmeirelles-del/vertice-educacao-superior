import {useState, type ReactNode} from 'react';
import {institutionParam, PublicInstitutionProvider, usePublicInstitution} from '@/lib/public-institution';
export function useIesParam(): string | null { return institutionParam() || null; }
export default function IesBrandedLayout({children, institutionId}: {children: ReactNode; institutionId?: string | null; institutionName?: string | null}) {
  return <PublicInstitutionProvider institutionId={institutionId ?? institutionParam()}><InstitutionLayout>{children}</InstitutionLayout></PublicInstitutionProvider>;
}
function InstitutionLayout({children}: {children: ReactNode}) {
  const identity = usePublicInstitution()!;
  const ies = identity.institution, displayName = ies?.name || 'Instituição';
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = ies?.logoUrl && failedLogo !== ies.logoUrl ? ies.logoUrl : null;
  const initials = ies?.name.split(/\s+/).filter(Boolean).map(word => word[0]).slice(0, 3).join('').toUpperCase() || '?';
  return <div className="corporate-site ies-branded"><style>{`
    .ies-branded .corp-header { background: #0f172a; }
    .ies-branded .ies-brand-header { display: flex; align-items: center; gap: 16px; padding: 16px 24px; max-width: 1200px; margin: 0 auto; }
    .ies-branded .ies-brand-logo { width: 64px; height: 64px; padding: 4px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #1e293b; flex-shrink: 0; }
    .ies-branded .ies-brand-logo img { width: 100%; height: 100%; object-fit: contain; }
    .ies-branded .ies-brand-text { min-width: 0; overflow-wrap: anywhere; }
    .ies-branded .ies-brand-text h1 { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; margin: 0; line-height: 1.3; }
    .ies-branded .ies-brand-text p { font-size: .8rem; color: #cbd5e1; margin: 4px 0 0; }
    .ies-branded .ies-footer { background: #0f172a; color: #cbd5e1; text-align: center; padding: 24px 16px; font-size: .8rem; overflow-wrap: anywhere; }
    .ies-branded .ies-powered { margin-top: 8px; font-size: .75rem; color: #94a3b8; }
    @media (max-width: 640px) {
      .ies-branded .ies-brand-header { padding: 12px 16px; gap: 12px; }
      .ies-branded .ies-brand-logo { width: 52px; height: 52px; font-size: 17px; }
      .ies-branded .ies-brand-text h1 { font-size: 1rem; }
    }
  `}</style><header className="corp-header"><div className="ies-brand-header">
    <div className="ies-brand-logo">{logo ? <img src={logo} alt={`Logo de ${displayName}`} onError={() => setFailedLogo(logo)}/> : <span aria-hidden="true">{initials}</span>}</div>
    <div className="ies-brand-text"><h1>{displayName}</h1><p>Portal institucional</p></div>
  </div></header><main id="conteudo">{children}</main><footer className="ies-footer"><span>© {new Date().getFullYear()} {displayName}</span><div className="ies-powered">Tecnologia por Vértice Educação Superior</div></footer></div>;
}
