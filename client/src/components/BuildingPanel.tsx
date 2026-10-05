import { useState } from 'react';
import { ApiError, api } from '../api';
import { RESOURCE_LABEL, costEntries, fmt, fmt1, fmtDuration } from '../format';
import { SCENE_W, SLOTS, SPRITE_SRC } from '../sceneConfig';
import type { BuildingEffect, BuildingState, BuildingType, GameState, ResourceKey } from '../types';
import { CheckIcon, ClockIcon, CrossIcon, HammerIcon, PeopleIcon, ResourceIcon, UnitIcon } from './Icons';

const FUNCTION_TEXT: Record<BuildingType, string> = {
  castle: 'Sede de tu señorío. Su nivel fija el límite de habitantes y los ingresos base de oro, y es requisito para mejorar el resto de edificios.',
  sawmill: 'Los leñadores talan el bosque cercano. Produce madera según los trabajadores asignados y el nivel.',
  quarry: 'Los canteros extraen bloques de piedra. Produce piedra según los trabajadores asignados y el nivel.',
  farm: 'Campos y huertos que alimentan a la villa. Produce alimentos según los trabajadores asignados y el nivel.',
  warehouse: 'Graneros y bodegas. Su nivel fija cuánta madera, piedra, alimentos y oro puedes guardar; lo que no cabe se pierde.',
  barracks: 'Aquí se entrena a la milicia. Sus niveles desbloquean nuevas unidades y acortan el tiempo de reclutamiento.',
};

const REQ_NAME: Record<string, string> = { castle: 'Castillo', warehouse: 'Almacén' };

function effectLines(type: BuildingType, e: BuildingEffect, state: GameState): string[] {
  switch (type) {
    case 'castle':
      return [`Límite de habitantes: ${e.maxPopulation}`, `Ingreso base de oro: +${e.goldPerMinute}/min`];
    case 'warehouse':
      return [`Capacidad por recurso: ${fmt(e.capacity ?? 0)}`];
    case 'barracks': {
      const names = (e.unlockedUnits ?? []).map((u) => state.units.find((x) => x.type === u)?.name).filter(Boolean);
      return [
        `Unidades: ${names.length ? names.join(', ') : 'ninguna'}`,
        `Tiempo de reclutamiento: ${Math.round((e.recruitTimeFactor ?? 1) * 100)} %`,
      ];
    }
    default:
      return [
        `Puestos de trabajo: ${e.slots}`,
        `Rinde ${fmt1(e.perWorkerPerMinute ?? 0)} ${RESOURCE_LABEL[e.resource as ResourceKey].toLowerCase()}/min por trabajador`,
      ];
  }
}

interface Props {
  state: GameState;
  building: BuildingState;
  now: number;
  estimate: (r: ResourceKey) => number;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onGoArmy: () => void;
}

export function BuildingPanel({ state, building: b, now, estimate, onClose, onChanged, onGoArmy }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const up = b.upgrade;
  const producing = b.type === 'sawmill' || b.type === 'quarry' || b.type === 'farm';
  const constructionActive = state.buildings.some((x) => x.construction);

  const affordable = up ? costEntries(up.cost).every(([r, v]) => estimate(r) >= v) : false;
  const reqOk = up ? up.requirements.every((r) => r.met) : false;
  const canClick = !!up && !b.construction && !constructionActive && reqOk && affordable && !busy;

  async function run(fn: () => Promise<unknown>, okText?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (okText) setMessage({ kind: 'ok', text: okText });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Error inesperado.' });
    } finally {
      await onChanged();
      setBusy(false);
    }
  }

  const buttonLabel = b.level === 0 ? 'Construir' : `Mejorar a nivel ${up?.targetLevel}`;
  const free = state.population.free;

  function setWorkers(n: number) {
    void run(() => api.workers({ [b.type]: n }));
  }
  const slots = b.effect.slots ?? 0;
  const maxWorkers = Math.min(slots, b.workers + Math.floor(free));

  let disabledHint: string | null = null;
  if (up && !canClick && !b.construction) {
    if (constructionActive) disabledHint = 'Ya hay una construcción en curso.';
    else if (!reqOk) disabledHint = 'Aún no cumples los requisitos.';
    else if (!affordable) disabledHint = 'Te faltan recursos.';
  }

  return (
    <aside className={`panel side-${SLOTS[b.type].x > SCENE_W / 2 ? 'left' : 'right'}`} role="dialog" aria-label={b.name}>
      <header className="panel-head">
        <img src={SPRITE_SRC[b.type]} alt="" className="panel-thumb" />
        <div>
          <h2>{b.name}</h2>
          <p className="level-line">
            {b.level > 0 ? `Nivel ${b.level} de ${b.maxLevel}` : 'Parcela libre · sin construir'}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar panel">
          <CrossIcon />
        </button>
      </header>

      <p className="fn-text">{FUNCTION_TEXT[b.type]}</p>

      <section className="block">
        <h3>{b.level > 0 ? 'Beneficio actual' : 'Beneficio al construir'}</h3>
        <ul className="lines">
          {effectLines(b.type, b.level > 0 ? b.effect : (up?.effect ?? b.effect), state).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {b.type === 'castle' && (
          <p className="muted">
            Habitantes: {fmt(state.population.current)} / {state.population.max} · libres {fmt(state.population.free)}
          </p>
        )}
        {b.type === 'barracks' && b.level > 0 && (
          <div className="unit-chips">
            {state.units.map((u) => (
              <span key={u.type} className={`chip ${u.unlocked ? '' : 'is-locked'}`} title={u.unlocked ? 'Disponible' : `Cuartel nivel ${u.unlockBarracks}`}>
                <UnitIcon unit={u.type} size={16} /> {u.name}
                {!u.unlocked && ` · Nv ${u.unlockBarracks}`}
              </span>
            ))}
          </div>
        )}
      </section>

      {producing && b.level > 0 && (
        <section className="block">
          <h3>Trabajadores</h3>
          <div className="stepper">
            <button className="btn small" disabled={busy || b.workers <= 0} onClick={() => setWorkers(b.workers - 1)} aria-label="Quitar trabajador">
              −
            </button>
            <span className="stepper-val">
              <PeopleIcon size={18} /> {b.workers} / {slots}
            </span>
            <button className="btn small" disabled={busy || b.workers >= maxWorkers} onClick={() => setWorkers(b.workers + 1)} aria-label="Añadir trabajador">
              +
            </button>
            <button className="btn small ghost" disabled={busy || b.workers >= maxWorkers} onClick={() => setWorkers(maxWorkers)}>
              Máx.
            </button>
          </div>
          <p className="muted">
            Producción actual: <strong>+{fmt1(b.workers * (b.effect.perWorkerPerMinute ?? 0))}</strong>{' '}
            {RESOURCE_LABEL[b.effect.resource as ResourceKey].toLowerCase()}/min · habitantes libres: {fmt(free)}
          </p>
        </section>
      )}

      {b.construction && (
        <section className="block construction-block">
          <h3>
            <HammerIcon size={18} /> En construcción
          </h3>
          <p>
            Nivel {b.construction.targetLevel} · termina en <strong>{fmtDuration((b.construction.finishesAt - now) / 1000)}</strong>
          </p>
          <div className="bar big">
            <i
              style={{
                width: `${Math.min(100, Math.max(0, ((now - b.construction.startedAt) / (b.construction.finishesAt - b.construction.startedAt)) * 100))}%`,
              }}
            />
          </div>
          <p className="muted">El progreso lo calcula el servidor: puedes cerrar el navegador.</p>
        </section>
      )}

      {up && !b.construction ? (
        <section className="block">
          <h3>{b.level === 0 ? 'Construcción' : `Mejora a nivel ${up.targetLevel}`}</h3>
          {b.level > 0 && (
            <ul className="lines next">
              {effectLines(b.type, up.effect, state).map((l) => (
                <li key={l}>→ {l}</li>
              ))}
            </ul>
          )}
          <div className="cost-row" aria-label="Costo">
            {costEntries(up.cost).map(([r, v]) => {
              const enough = estimate(r) >= v;
              return (
                <span key={r} className={`cost ${enough ? '' : 'short'}`} title={RESOURCE_LABEL[r]}>
                  <ResourceIcon resource={r} size={18} /> {fmt(v)}
                </span>
              );
            })}
            <span className="cost time" title="Duración">
              <ClockIcon size={18} /> {fmtDuration(up.seconds)}
            </span>
          </div>
          {up.requirements.length > 0 && (
            <ul className="reqs">
              {up.requirements.map((r) => (
                <li key={r.building} className={r.met ? 'met' : 'unmet'}>
                  {r.met ? <CheckIcon /> : <CrossIcon />} {REQ_NAME[r.building]} nivel {r.required}
                  <span className="muted"> (actual {r.current})</span>
                </li>
              ))}
            </ul>
          )}
          <button className="btn primary wide" disabled={!canClick} onClick={() => run(() => api.upgrade(b.type), 'Construcción iniciada.')}>
            <HammerIcon size={18} /> {buttonLabel}
          </button>
          {disabledHint && <p className="hint">{disabledHint}</p>}
        </section>
      ) : (
        !up && (
          <section className="block">
            <p className="muted">Este edificio está al nivel máximo.</p>
          </section>
        )
      )}

      {b.type === 'barracks' && b.level > 0 && (
        <button className="btn wide" onClick={onGoArmy}>
          Ir a reclutar tropas
        </button>
      )}

      {message && (
        <p className={`msg ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </aside>
  );
}
