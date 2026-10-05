import { RESOURCE_LABEL, RESOURCE_ORDER, fmt, fmt1 } from '../format';
import type { GameState, ResourceKey } from '../types';
import { BookIcon, PeopleIcon, ResourceIcon } from './Icons';

export type View = 'city' | 'world' | 'army' | 'reports';

const TABS: { id: View; label: string }[] = [
  { id: 'city', label: 'Ciudad' },
  { id: 'world', label: 'Mundo' },
  { id: 'army', label: 'Ejército' },
  { id: 'reports', label: 'Informes' },
];

interface Props {
  state: GameState;
  view: View;
  unreadReports: number;
  estimate: (r: ResourceKey) => number;
  onView: (v: View) => void;
  onRules: () => void;
}

export function TopBar({ state, view, unreadReports, estimate, onView, onRules }: Props) {
  const p = state.population;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="crest" aria-hidden />
        <div>
          <strong>Señoríos</strong>
          <small>{state.city.name}</small>
        </div>
      </div>

      <ul className="resources" aria-label="Recursos">
        {RESOURCE_ORDER.map((r) => {
          const res = state.resources[r];
          const amount = estimate(r);
          const full = amount >= res.capacity - 0.5;
          return (
            <li key={r} className={`res ${full ? 'is-full' : ''}`} title={`${RESOURCE_LABEL[r]}: ${fmt(amount)} de ${fmt(res.capacity)}${full ? ' (almacén lleno)' : ''}`}>
              <ResourceIcon resource={r} size={22} />
              <span className="res-main">
                <b data-resource={r}>{fmt(amount)}</b>
                <small>/ {fmt(res.capacity)}</small>
              </span>
              <span className="res-rate">{res.ratePerMinute > 0 ? `+${fmt1(res.ratePerMinute)}/min` : '—'}</span>
            </li>
          );
        })}
        <li className="res pop" title="Habitantes totales / límite del castillo. Los libres generan oro.">
          <PeopleIcon size={22} />
          <span className="res-main">
            <b>{fmt(p.current)}</b>
            <small>/ {p.max}</small>
          </span>
          <span className="res-rate">{fmt(p.free)} libres</span>
        </li>
      </ul>

      <button className="rules-btn" onClick={onRules} aria-label="Reglas del juego">
        <BookIcon /> <span>Reglas</span>
      </button>

      <nav className="tabs" aria-label="Navegación principal">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'is-active' : ''}`} onClick={() => onView(t.id)} aria-current={view === t.id ? 'page' : undefined}>
            {t.label}
            {t.id === 'reports' && unreadReports > 0 && <span className="badge">{unreadReports}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}
