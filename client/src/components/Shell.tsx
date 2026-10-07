import type { ReactNode } from 'react';
import { RESOURCE_LABEL, RESOURCE_ORDER, fmt, fmt1, fmtDuration } from '../format';
import type { GameState, ResourceKey } from '../types';
import { CrestIcon, LineIcon, PopulationIcon, ResourceIcon, type NavIconName } from './Icons';

export type View = 'city' | 'world' | 'army' | 'reports';

const NAV: { id: View; label: string; icon: NavIconName }[] = [
  { id: 'city', label: 'Ciudad', icon: 'city' },
  { id: 'world', label: 'Mundo', icon: 'world' },
  { id: 'army', label: 'Ejército', icon: 'army' },
  { id: 'reports', label: 'Informes', icon: 'reports' },
];

interface Props {
  state: GameState;
  view: View;
  now: number;
  error: string | null;
  estimate: (r: ResourceKey) => number;
  unreadReports: number;
  navCollapsed: boolean;
  /** Contenido del inspector derecho; `null` = cerrado (el espacio vuelve al área central). */
  inspector: ReactNode | null;
  /** En el rediseño, Ejército e Informes muestran siempre su inspector; Ciudad y Mundo solo con selección. */
  onView: (v: View) => void;
  onToggleNav: () => void;
  onRules: () => void;
  /** Animaciones de la ciudad (agua, personajes): preferencia del usuario. */
  animationsOn: boolean;
  animationsForcedOff: boolean;
  onToggleAnimations: () => void;
  children: ReactNode;
}

export function Shell({ state, view, now, error, estimate, unreadReports, navCollapsed, inspector, onView, onToggleNav, onRules, animationsOn, animationsForcedOff, onToggleAnimations, children }: Props) {
  const active = state.expeditions.length;
  const next = state.expeditions.map((e) => (e.status === 'outbound' ? e.arriveAt : e.returnAt)).sort((a, b) => a - b)[0];
  const serverClock = new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="shell" data-view={view} data-nav={navCollapsed ? 'collapsed' : 'full'} data-inspector={inspector ? 'open' : 'closed'}>
      <header className="shell-header">
        <div className="brand">
          <CrestIcon size={38} />
          <div>
            <strong>Señoríos</strong>
            <small>{state.city.name}</small>
          </div>
        </div>

        <ul className="res-bar" aria-label="Recursos">
          {RESOURCE_ORDER.map((r) => {
            const res = state.resources[r];
            const amount = estimate(r);
            const full = amount >= res.capacity - 0.5;
            return (
              <li key={r} className={`res-pill ${full ? 'is-full' : ''}`} title={`${RESOURCE_LABEL[r]}: ${fmt(amount)} de ${fmt(res.capacity)}${full ? ' — almacén lleno: la producción se detiene' : ''}`}>
                <ResourceIcon resource={r} size={34} />
                <span className="res-text">
                  <small>{RESOURCE_LABEL[r]}</small>
                  <b>
                    {fmt(amount)} <span>/ {fmt(res.capacity)}</span>
                  </b>
                </span>
                {full ? <em className="res-flag">Lleno</em> : <span className="res-rate">{res.ratePerMinute > 0 ? `+${fmt1(res.ratePerMinute)}/min` : ''}</span>}
              </li>
            );
          })}
          <li className="res-pill" title="Habitantes / límite del castillo. Los habitantes libres generan oro.">
            <PopulationIcon size={34} />
            <span className="res-text">
              <small>Población</small>
              <b>
                {fmt(state.population.current)} <span>/ {state.population.max}</span>
              </b>
            </span>
            <span className="res-rate">{fmt(state.population.free)} libres</span>
          </li>
        </ul>

        <div className="header-actions">
          <button
            type="button"
            className="hdr-btn"
            aria-label={animationsOn ? 'Desactivar animaciones de la ciudad' : 'Activar animaciones de la ciudad'}
            aria-pressed={animationsOn && !animationsForcedOff}
            title={animationsForcedOff ? 'El sistema pide reducir el movimiento: animaciones desactivadas' : animationsOn ? 'Animaciones activadas' : 'Animaciones desactivadas'}
            disabled={animationsForcedOff}
            onClick={onToggleAnimations}
          >
            <LineIcon name="motion" size={24} />
          </button>
          <button type="button" className="hdr-btn" aria-label="Reglas y ayuda" title="Reglas y ayuda" onClick={onRules}>
            <LineIcon name="help" size={24} />
          </button>
          <button type="button" className="hdr-btn" aria-label={navCollapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral'} aria-pressed={!navCollapsed} title="Menú lateral" onClick={onToggleNav}>
            <LineIcon name="menu" size={26} />
          </button>
        </div>
      </header>

      <nav className="shell-nav" aria-label="Navegación principal">
        <ul>
          {NAV.map((n) => (
            <li key={n.id}>
              <button type="button" className={`nav-item ${view === n.id ? 'is-active' : ''}`} aria-current={view === n.id ? 'page' : undefined} title={n.label} onClick={() => onView(n.id)}>
                <LineIcon name={n.icon} size={26} />
                <span className="nav-label">{n.label}</span>
                {n.id === 'reports' && unreadReports > 0 && <span className="nav-badge" aria-label={`${unreadReports} sin leer`}>{unreadReports}</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="nav-item nav-rules" title="Reglas" onClick={onRules}>
          <LineIcon name="rules" size={26} />
          <span className="nav-label">Reglas</span>
        </button>
      </nav>

      <main className="shell-main">
        {error && (
          <div className="conn-banner" role="alert">
            {error} — mostrando el último estado conocido.
          </div>
        )}
        {children}
      </main>

      {inspector && <aside className="shell-inspector">{inspector}</aside>}

      <footer className="shell-footer">
        <span className="foot-item foot-city">
          <LineIcon name="fleur" size={20} />
          <b>{state.city.name}</b>
        </span>
        <span className="foot-sep" aria-hidden />
        <span className="foot-item">
          <LineIcon name="pin" size={18} />
          {active === 0 ? 'Sin expediciones activas.' : `${active} expedición${active > 1 ? 'es' : ''} en marcha · próximo evento en ${fmtDuration((next - now) / 1000)}`}
        </span>
        <span className="foot-spacer" />
        <span className="foot-item foot-clock" title="Hora del servidor (la que gobierna todos los temporizadores)">
          Hora del servidor · {serverClock}
        </span>
      </footer>
    </div>
  );
}
