import { useState } from 'react';
import { ApiError, api } from '../api';
import { ART, EXPECTED_FILE } from '../artManifest';
import { UNIT_NAME, fmt, fmtDuration } from '../format';
import type { BuildingState, GameState, ResourceKey, UnitState, UnitType } from '../types';
import { ClockIcon, LineIcon, StatIcon, UnitIcon } from './Icons';
import { BuildingPortrait, Button, Card, CostChips, EmptyState, ProgressBar, Stepper, UnitPortrait } from './ui';

interface MainProps {
  state: GameState;
  now: number;
  estimate: (r: ResourceKey) => number;
  onChanged: () => Promise<void>;
  onGoBarracks: () => void;
}

export function ArmyMain({ state, now, estimate, onChanged, onGoBarracks }: MainProps) {
  const barracks = state.buildings.find((b) => b.type === 'barracks')!;
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const quantityOf = (u: UnitState) => Math.max(1, Math.min(state.rules.recruitMaxQuantity, Math.floor(qty[u.type] ?? 1)));

  async function recruit(u: UnitState) {
    setBusy(true);
    setMsg(null);
    try {
      await api.recruit(u.type, quantityOf(u));
      setMsg({ kind: 'ok', text: `Reclutamiento de ${quantityOf(u)} ${UNIT_NAME[u.type].toLowerCase()} en cola.` });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Error inesperado.' });
    } finally {
      await onChanged();
      setBusy(false);
    }
  }

  return (
    <div className="page army-page">
      <header className="page-banner" style={ART.armyBanner ? ({ '--banner': `url(${ART.armyBanner})` } as React.CSSProperties) : undefined}>
        <LineIcon name="army" size={44} />
        <div>
          <h1>Ejército</h1>
          <p>Recluta y organiza tus tropas.</p>
        </div>
        {!ART.armyBanner && <small className="banner-note">Arte pendiente · {EXPECTED_FILE.armyBanner}</small>}
      </header>

      {barracks.level === 0 ? (
        <EmptyState
          inline
          art={<BuildingPortrait type="barracks" built={false} ghost height={190} className="empty-art" />}
          title="Aún no tienes Cuartel"
          action={<Button variant="primary" onClick={onGoBarracks}>Construir el Cuartel en la ciudad</Button>}
        >
          El Cuartel desbloquea el reclutamiento. Su parcela libre te espera en la ciudad.
        </EmptyState>
      ) : null}

      <div className="unit-cards">
        {state.units.map((u) => {
          const q = quantityOf(u);
          const secs = Math.max(1, Math.round(u.secondsPerUnit * q));
          const afford = Object.entries(u.cost).every(([r, v]) => estimate(r as ResourceKey) >= (v ?? 0) * q);
          const locked = !u.unlocked;
          return (
            <article key={u.type} className={`unit-card ${locked ? 'is-locked' : ''}`} aria-label={u.name}>
              <header>
                <UnitIcon unit={u.type} size={26} />
                <h3>{u.name}</h3>
              </header>
              <div className="portrait-wrap">
                <UnitPortrait unit={u.type} src={ART.portraits[u.type]} locked={locked} />
                {locked && (
                  <div className="lock-overlay">
                    <LineIcon name="lock" size={22} />
                    <span>Requiere Cuartel nivel {u.unlockBarracks}</span>
                  </div>
                )}
              </div>
              <ul className="stat-list">
                <li><StatIcon name="attack" /><span>Ataque</span><b>{u.attack}</b></li>
                <li><StatIcon name="defense" /><span>Defensa</span><b>{u.defense}</b></li>
                <li><StatIcon name="carry" /><span>Carga</span><b>{u.carry}</b></li>
                <li><StatIcon name="speed" /><span>Velocidad</span><b>{u.speed.toFixed(1)}</b></li>
              </ul>
              <CostChips cost={u.cost} estimate={locked ? undefined : estimate} multiplier={q} />
              <div className="kv-row"><span><ClockIcon size={16} /> Tiempo</span><b>{fmtDuration(secs)}</b></div>
              <Stepper label={`Cantidad de ${UNIT_NAME[u.type]} a reclutar`} value={q} min={1} max={state.rules.recruitMaxQuantity} disabled={locked || busy} onChange={(n) => setQty((s) => ({ ...s, [u.type]: n }))} />
              <Button variant="primary" block disabled={locked || busy || !afford} onClick={() => recruit(u)}>
                Reclutar
              </Button>
              {!locked && !afford && <p className="hint">Recursos insuficientes.</p>}
            </article>
          );
        })}
      </div>
      {msg && <p className={`msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}

      <Card title="Cola de reclutamiento" icon={<LineIcon name="people" size={20} />} className="queue-card">
        {state.recruitQueue.length === 0 ? (
          <p className="insp-note">No hay pedidos en curso (máximo {state.rules.recruitMaxQueue}). El tiempo se reduce con el nivel del cuartel.</p>
        ) : (
          <ul className="recruit-queue">
            {state.recruitQueue.map((q) => {
              const started = now >= q.startedAt;
              return (
                <li key={q.id}>
                  <UnitPortrait unit={q.unit} src={ART.portraits[q.unit]} size="row" />
                  <div className="grow">
                    <b>{UNIT_NAME[q.unit]}</b>
                    <small>{q.quantity} unidades</small>
                  </div>
                  <ProgressBar value={started ? (now - q.startedAt) / (q.finishesAt - q.startedAt) : 0} label={`Progreso de ${UNIT_NAME[q.unit]}`} />
                  <time>{started ? fmtDuration((q.finishesAt - now) / 1000) : `En espera · ${fmtDuration((q.startedAt - now) / 1000)}`}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ArmyInspector({ state, barracks, onViewBarracks }: { state: GameState; barracks: BuildingState; onViewBarracks: () => void }) {
  return (
    <div className="inspector" aria-label="Tropas y cuartel">
      <Card title="Tus tropas" icon={<LineIcon name="people" size={20} />}>
        <ul className="troop-list">
          {state.units.map((u) => (
            <li key={u.type}>
              <UnitPortrait unit={u.type as UnitType} src={ART.portraits[u.type]} size="row" />
              <span className="grow">{UNIT_NAME[u.type]}</span>
              <b>{fmt(u.home)}</b>
            </li>
          ))}
        </ul>
        {state.expeditions.length > 0 && <p className="insp-note">Hay {state.expeditions.length} expedición(es) en marcha; sus tropas no están disponibles hasta regresar.</p>}
      </Card>

      <Card title={`Cuartel · ${barracks.level > 0 ? `Nivel ${barracks.level}` : 'sin construir'}`} icon={<LineIcon name="city" size={20} />}>
        <BuildingPortrait type="barracks" built={barracks.level > 0} ghost />
        <p className="insp-text">Aumenta las unidades disponibles y acorta el tiempo de reclutamiento.</p>
        <Button variant="primary" block onClick={onViewBarracks}>
          {barracks.level > 0 ? 'Ver edificio' : 'Construir en la ciudad'}
        </Button>
        {barracks.construction && <p className="insp-note">En obra: nivel {barracks.construction.targetLevel}.</p>}
      </Card>
    </div>
  );
}
