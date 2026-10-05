import { useEffect, useState } from 'react';
import { ArmyView } from './components/ArmyView';
import { BuildingPanel } from './components/BuildingPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CityScene } from './components/CityScene';
import { ReportsView } from './components/ReportsView';
import { RulesModal } from './components/RulesModal';
import { TopBar, type View } from './components/TopBar';
import { WorldView } from './components/WorldView';
import type { BuildingType } from './types';
import { useGame } from './useGame';

const SEEN_KEY = 'senorios.lastSeenReport';
const readSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0);
  } catch {
    return 0;
  }
};

export function App() {
  const { state, error, now, refresh, estimate } = useGame();
  const [view, setView] = useState<View>('city');
  const [selected, setSelected] = useState<BuildingType | null>(null);
  const [rules, setRules] = useState(false);
  const [seen, setSeen] = useState(readSeen);

  const latestReport = state?.reports[0]?.id ?? 0;
  useEffect(() => {
    if (view === 'reports' && latestReport > seen) {
      setSeen(latestReport);
      try {
        localStorage.setItem(SEEN_KEY, String(latestReport));
      } catch {
        /* sin almacenamiento local: solo se pierde el contador de no leídos */
      }
    }
  }, [view, latestReport, seen]);

  if (!state) {
    return (
      <div className="boot">
        <div className="boot-card">
          <h1>Señoríos</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button className="btn" onClick={() => void refresh()}>Reintentar</button>
            </>
          ) : (
            <p>Convocando a los habitantes de la villa…</p>
          )}
        </div>
      </div>
    );
  }

  const unread = state.reports.filter((r) => r.id > seen).length;
  const building = selected ? state.buildings.find((b) => b.type === selected) : undefined;

  return (
    <div className="app">
      <TopBar state={state} view={view} unreadReports={unread} estimate={estimate} onView={(v) => setView(v)} onRules={() => setRules(true)} />
      {error && <div className="banner" role="alert">{error} — mostrando el último estado conocido.</div>}

      <main className="main">
        <ErrorBoundary resetKey={view} onReset={() => setView('city')}>
        {view === 'city' && (
          <div className="city-view">
            <CityScene buildings={state.buildings} selected={selected} now={now} onSelect={setSelected} />
            {building && (
              <BuildingPanel
                key={building.type}
                state={state}
                building={building}
                now={now}
                estimate={estimate}
                onClose={() => setSelected(null)}
                onChanged={refresh}
                onGoArmy={() => setView('army')}
              />
            )}
            {!building && <p className="scene-hint">Pulsa un edificio o una parcela libre para gestionarlo.</p>}
          </div>
        )}
        {view === 'world' && <WorldView state={state} now={now} onChanged={refresh} onViewReports={() => setView('reports')} />}
        {view === 'army' && <ArmyView state={state} now={now} estimate={estimate} onChanged={refresh} onGoCity={() => setView('city')} />}
        {view === 'reports' && <ReportsView state={state} />}
        </ErrorBoundary>
      </main>

      {rules && <RulesModal state={state} onClose={() => setRules(false)} />}
    </div>
  );
}
