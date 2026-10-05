import { useEffect, useState } from 'react';
import { ArmyInspector, ArmyMain } from './components/ArmyView';
import { BuildingInspector } from './components/BuildingInspector';
import { CityScene } from './components/CityScene';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReportsInspector, ReportsMain, useSelectedReport } from './components/ReportsView';
import { RulesModal } from './components/RulesModal';
import { Shell, type View } from './components/Shell';
import { CampInspector, WorldStage } from './components/WorldView';
import type { BuildingType } from './types';
import { useGame } from './useGame';

const SEEN_KEY = 'senorios.lastSeenReport';
const NAV_KEY = 'senorios.navCollapsed';

const readNumber = (key: string) => {
  try {
    return Number(localStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento local: solo se pierde la preferencia */
  }
};

export function App() {
  const { state, error, now, refresh, estimate } = useGame();
  const [view, setView] = useState<View>('city');
  const [building, setBuilding] = useState<BuildingType | null>(() => (window.innerWidth >= 1200 ? 'castle' : null));
  const [campKey, setCampKey] = useState<string | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [rules, setRules] = useState(false);
  const [seen, setSeen] = useState(() => readNumber(SEEN_KEY));
  const [navCollapsed, setNavCollapsed] = useState(() => readNumber(NAV_KEY) === 1);

  const latestReport = state?.reports[0]?.id ?? 0;
  useEffect(() => {
    if (view === 'reports' && latestReport > seen) {
      setSeen(latestReport);
      write(SEEN_KEY, String(latestReport));
    }
  }, [view, latestReport, seen]);

  const report = useSelectedReport(state ?? { reports: [] } as never, reportId);

  if (!state) {
    return (
      <div className="boot">
        <div className="boot-card">
          <h1>Señoríos</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button className="btn btn-secondary btn-md" onClick={() => void refresh()}>Reintentar</button>
            </>
          ) : (
            <p>Convocando a los habitantes de la villa…</p>
          )}
        </div>
      </div>
    );
  }

  const unread = state.reports.filter((r) => r.id > seen).length;
  const selectedBuilding = building ? state.buildings.find((b) => b.type === building) : undefined;
  const selectedCamp = campKey ? state.camps.find((c) => c.key === campKey) : undefined;
  const barracks = state.buildings.find((b) => b.type === 'barracks')!;
  const goBarracks = () => {
    setBuilding('barracks');
    setView('city');
  };

  let main: React.ReactNode = null;
  let inspector: React.ReactNode = null;
  if (view === 'city') {
    main = <CityScene buildings={state.buildings} selected={building} now={now} onSelect={setBuilding} />;
    inspector = selectedBuilding ? (
      <BuildingInspector key={selectedBuilding.type} state={state} building={selectedBuilding} now={now} estimate={estimate} onClose={() => setBuilding(null)} onChanged={refresh} onGoArmy={() => setView('army')} />
    ) : null;
  } else if (view === 'world') {
    main = <WorldStage state={state} now={now} selected={campKey} onSelect={setCampKey} />;
    inspector = selectedCamp ? (
      <CampInspector key={selectedCamp.key} camp={selectedCamp} state={state} now={now} onClose={() => setCampKey(null)} onChanged={refresh} onGoReports={() => setView('reports')} />
    ) : null;
  } else if (view === 'army') {
    main = <ArmyMain state={state} now={now} estimate={estimate} onChanged={refresh} onGoBarracks={goBarracks} />;
    inspector = <ArmyInspector state={state} barracks={barracks} onViewBarracks={goBarracks} />;
  } else {
    main = <ReportsMain state={state} selectedId={report?.id ?? null} onSelect={setReportId} onGoWorld={() => setView('world')} />;
    inspector = report ? <ReportsInspector state={state} report={report} /> : null;
  }

  return (
    <>
      <Shell
        state={state}
        view={view}
        now={now}
        error={error}
        estimate={estimate}
        unreadReports={unread}
        navCollapsed={navCollapsed}
        inspector={inspector}
        onView={setView}
        onToggleNav={() => {
          setNavCollapsed((c) => {
            write(NAV_KEY, c ? '0' : '1');
            return !c;
          });
        }}
        onRules={() => setRules(true)}
      >
        <ErrorBoundary resetKey={view} onReset={() => setView('city')}>
          {main}
        </ErrorBoundary>
      </Shell>
      {rules && <RulesModal state={state} onClose={() => setRules(false)} />}
    </>
  );
}
