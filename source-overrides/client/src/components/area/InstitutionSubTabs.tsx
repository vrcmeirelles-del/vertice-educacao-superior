import type { Tab } from "@/lib/area";
import type { MacroTabDef } from "./InstitutionTabs";
import "./institution-subtabs.css";
import InstitutionalModuleLink from "./InstitutionalModuleLink";

interface SubTabEntry {
  key: Tab;
  label: string;
  icon?: string;
  description?: string;
  locked?: boolean;
  tasting?: boolean;
}

interface Props {
  macro: MacroTabDef;
  entries: SubTabEntry[];
  activeTab: Tab | null;
  onSelect: (tab: Tab) => void;
  moduleHref?: (tab: Tab) => string | undefined;
  query?: string;
  onQueryChange?: (query: string) => void;
  favorites?: Tab[];
  onToggleFavorite?: (tab: Tab) => void;
  onlyFavorites?: boolean;
  sortByLabel?: boolean;
  onToggleOnlyFavorites?: () => void;
}

const academicLabelOrder = new Intl.Collator("pt-BR", { usage: "sort", sensitivity: "base", numeric: true });

/** Presentation only: retain the supplied membership, IDs, badges and priority for equal labels. */
export function orderAcademicModules<T>(entries: readonly T[], label: (entry: T) => string): T[] {
  return [...entries].sort((first, second) => academicLabelOrder.compare(label(first), label(second)));
}

/** Persistent module navigation; activation and authorization stay with the caller. */
export default function InstitutionSubTabs({ macro, entries, activeTab, onSelect, moduleHref, query = "", onQueryChange, favorites = [], onToggleFavorite, onlyFavorites = false, onToggleOnlyFavorites, sortByLabel = false }: Props) {
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = entries.filter(entry => (!onlyFavorites || favorites.includes(entry.key)) && (!search || `${entry.label} ${entry.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(search)));
  const shown = sortByLabel ? orderAcademicModules(filtered, entry => entry.label) : filtered;
  return (
    <nav className="inst-subtabs" aria-label={`Módulos de ${macro.label}`}>
      <div className="inst-subtabs-head">
        <strong>{macro.label}</strong>
        <div className="inst-subtabs-tools">
          {onQueryChange && <input type="search" aria-label="Buscar módulo nesta área" placeholder="Buscar módulo" value={query} onChange={event => onQueryChange(event.target.value)} />}
          {onToggleOnlyFavorites && <button type="button" className="inst-subtabs-filter" aria-pressed={onlyFavorites} onClick={onToggleOnlyFavorites}>{onlyFavorites ? "★ Favoritos" : "☆ Favoritos"}</button>}
          {(query || onlyFavorites) && <button type="button" className="inst-subtabs-filter" onClick={() => { onQueryChange?.(""); if (onlyFavorites) onToggleOnlyFavorites?.(); }}>Limpar filtros</button>}
        </div>
      </div>
      <ul className="inst-subtabs-list">
        {shown.map(entry => (
          <li key={entry.key} className={activeTab === entry.key ? "inst-subtab-entry inst-subtab-entry--active" : "inst-subtab-entry"}>
            <InstitutionalModuleLink
              href={entry.locked ? undefined : moduleHref?.(entry.key)}
              active={activeTab === entry.key}
              className={`inst-subtab${entry.locked ? " inst-subtab--locked" : ""}`}
              onSelect={() => onSelect(entry.key)}
              title={entry.description}
            >
              {entry.icon && <span className="inst-subtab-icon" aria-hidden="true">{entry.locked ? "🔒" : entry.icon}</span>}
              <span>{entry.label}</span>
              {entry.locked && <span className="inst-subtab-badge">Ativar</span>}
              {entry.tasting && <span className="inst-subtab-badge tasting">Degustação</span>}
            </InstitutionalModuleLink>
            {onToggleFavorite && <button type="button" className="inst-subtab-star" aria-label={`${favorites.includes(entry.key) ? "Remover" : "Adicionar"} ${entry.label} ${favorites.includes(entry.key) ? "dos" : "aos"} favoritos`} aria-pressed={favorites.includes(entry.key)} onClick={() => onToggleFavorite(entry.key)}>{favorites.includes(entry.key) ? "★" : "☆"}</button>}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="inst-subtabs-empty">Nenhum módulo encontrado nesta área. Revise os filtros.</p>}
    </nav>
  );
}
