import type { ReactNode } from "react";

export default function InstitutionalModuleLink({ href, className, active, title, onSelect, children }: {
  href?: string;
  className: string;
  active: boolean;
  title?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const current = active ? "page" : undefined;
  if (!href) {
    return <button type="button" className={className} aria-current={current} title={title} onClick={onSelect}>{children}</button>;
  }
  return <a href={href} className={className} aria-current={current} title={title} style={{ textDecoration: "none" }}
    onClick={event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onSelect();
    }}>{children}</a>;
}
