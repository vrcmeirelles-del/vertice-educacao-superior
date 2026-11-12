/**
 * InstitutionSubTabs — horizontal pill bar showing the workspace tabs
 * available inside the currently active macro tab.
 */
import type { Tab } from "@/lib/area";
import type { MacroTabDef } from "./InstitutionTabs";
import "./institution-subtabs.css";

interface SubTabEntry {
  key: Tab;
  label: string;
  icon?: string;
  locked?: boolean;
  tasting?: boolean;
}

interface Props {
  macro: MacroTabDef;
  entries: SubTabEntry[];
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}

export default function InstitutionSubTabs({ macro, entries, activeTab, onSelect }: Props) {
  if (entries.length <= 1) return null; // single tab = no picker needed
  return (
    <nav className="inst-subtabs" aria-label={`Sub-abas de ${macro.label}`}>
      <ul className="inst-subtabs-list" role="tablist">
        {entries.map(e => (
          <li key={e.key} role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === e.key}
              className={`inst-subtab${activeTab === e.key ? ' inst-subtab--active' : ''}${e.locked ? ' inst-subtab--locked' : ''}`}
              onClick={() => onSelect(e.key)}
            >
              {e.icon && <span className="inst-subtab-icon" aria-hidden="true">{e.locked ? '🔒' : e.icon}</span>}
              <span>{e.label}</span>
              {e.locked && <span className="inst-subtab-badge">Ativar</span>}
              {e.tasting && <span className="inst-subtab-badge tasting">Degustação</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
