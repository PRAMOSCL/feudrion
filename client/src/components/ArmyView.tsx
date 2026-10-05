import { useState } from 'react';
import { ApiError, api } from '../api';
import { RESOURCE_LABEL, UNIT_NAME, costEntries, fmt, fmtDuration } from '../format';
import type { GameState, ResourceKey, UnitState } from '../types';
import { ClockIcon, ResourceIcon, UnitIcon } from './Icons';

interface Props {
  state: GameState;
  now: number;
  estimate: (r: ResourceKey) => number;
  onChanged: () => Promise<void>;
  onGoCity: () => void;
}

export function ArmyView({ state, now, estimate, onChanged, onGoCity }: Props) {
  const barracks = state.buildings.find((b) => b.type === 'barracks')!;
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const quantityOf = (u: UnitState) => Math.max(1, Math.floor(qty[u.type] ?? 5));

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
    <div className="view army">
      {barracks.level === 0 && (
        <div className="notice">
          <p>
            Aún no tienes <b>Cuartel</b>. Constrúyelo en la ciudad para reclutar tropas.
          </p>
          <button className="btn" onClick={onGoCity}>Ir a la ciudad</button>
        </div>
      )}

      <section className="card">
        <h2>Reclutamiento</h2>
        <p className="muted">
          Cuartel nivel {barracks.level}. Los pedidos se entrenan en cola (máx. {state.rules.recruitMaxQueue}); el tiempo se reduce con el nivel del cuartel.
        </p>
        <div className="unit-grid">
          {state.units.map((u) => {
            const q = quantityOf(u);
            const secs = Math.max(1, Math.round(u.secondsPerUnit * q));
            const afford = costEntries(u.cost).every(([r, v]) => estimate(r) >= v * q);
            return (
              <article key={u.type} className={`unit-card ${u.unlocked ? '' : 'is-locked'}`}>
                <header>
                  <UnitIcon unit={u.type} size={28} />
                  <div>
                    <h3>{u.name}</h3>
                    <small className="muted">En casa: <b>{u.home}</b></small>
                  </div>
                </header>
                <dl className="mini-stats">
                  <div><dt>Ataque</dt><dd>{u.attack}</dd></div>
                  <div><dt>Defensa</dt><dd>{u.defense}</dd></div>
                  <div><dt>Carga</dt><dd>{u.carry}</dd></div>
                  <div><dt>Velocidad</dt><dd>{u.speed.toFixed(1)}</dd></div>
                </dl>
                <div className="cost-row">
                  {costEntries(u.cost).map(([r, v]) => (
                    <span key={r} className={`cost ${estimate(r) >= v * q ? '' : 'short'}`} title={RESOURCE_LABEL[r]}>
                      <ResourceIcon resource={r} size={16} /> {fmt(v * q)}
                    </span>
                  ))}
                  <span className="cost time"><ClockIcon size={16} /> {fmtDuration(secs)}</span>
                </div>
                {u.unlocked ? (
                  <div className="recruit-row">
                    <input
                      type="number"
                      min={1}
                      max={state.rules.recruitMaxQuantity}
                      step={1}
                      value={qty[u.type] ?? 5}
                      onChange={(e) => setQty((s) => ({ ...s, [u.type]: Number(e.target.value) }))}
                      aria-label={`Cantidad de ${UNIT_NAME[u.type]} a reclutar`}
                    />
                    <button className="btn primary" disabled={busy || !afford} onClick={() => recruit(u)}>
                      Reclutar
                    </button>
                  </div>
                ) : (
                  <p className="locked-note">Se desbloquea con el Cuartel nivel {u.unlockBarracks}.</p>
                )}
              </article>
            );
          })}
        </div>
        {msg && <p className={`msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Cola de reclutamiento</h2>
          {state.recruitQueue.length === 0 ? (
            <p className="muted">No hay pedidos en curso.</p>
          ) : (
            <ul className="queue">
              {state.recruitQueue.map((q) => {
                const started = now >= q.startedAt;
                return (
                  <li key={q.id}>
                    <UnitIcon unit={q.unit} size={20} />
                    <span className="grow">{q.quantity} × {UNIT_NAME[q.unit]}</span>
                    <span className="muted">{started ? `termina en ${fmtDuration((q.finishesAt - now) / 1000)}` : `empieza en ${fmtDuration((q.startedAt - now) / 1000)}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>Ejército</h2>
          <ul className="queue">
            {state.units.map((u) => (
              <li key={u.type}>
                <UnitIcon unit={u.type} size={20} />
                <span className="grow">{UNIT_NAME[u.type]}</span>
                <b>{u.home}</b>
              </li>
            ))}
          </ul>
          {state.expeditions.length > 0 && (
            <p className="muted">
              {state.expeditions.length} expedición(es) en marcha: sus tropas no están disponibles hasta regresar.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
