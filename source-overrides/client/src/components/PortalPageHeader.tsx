import type { ReactNode } from 'react';
import { LayoutGrid, type LucideIcon } from 'lucide-react';
import '../styles/portal-design-system.css';

/** Cabeçalho visual único. Não consulta dados nem altera permissões. */
export default function PortalPageHeader({ title, eyebrow, description, icon: Icon = LayoutGrid, level = 2, id, children, className = '' }: {
  title: string;
  eyebrow: string;
  description?: string;
  icon?: LucideIcon;
  level?: 1 | 2 | 3;
  id?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Heading = `h${level}` as 'h1' | 'h2' | 'h3';
  return <header className={`portal-page-header ${className}`}>
    <span className="portal-page-header-icon" aria-hidden="true"><Icon size={30} strokeWidth={1.7} /></span>
    <div className="portal-page-header-copy">
      <p className="portal-page-header-eyebrow">{eyebrow}</p>
      <Heading id={id}>{title}</Heading>
      {description && <p className="portal-page-header-description">{description}</p>}
    </div>
    {children && <div className="portal-page-header-actions">{children}</div>}
  </header>;
}
