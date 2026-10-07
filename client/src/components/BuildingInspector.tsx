import { useState } from 'react';
import { ApiError, api } from '../api';
import { RESOURCE_LABEL, RESOURCE_ORDER, fmt, fmt1, fmtDuration } from '../format';
import type { BuildingEffect, BuildingState, BuildingType, GameState, ResourceKey } from '../types';
import { CheckIcon, ClockIcon, CrossIcon, HammerIcon, LineIcon, ResourceIcon, UnitIcon } from './Icons';
import { GarrisonCard } from './GarrisonCard';
import { BuildingPortrait, Button, Card, CloseButton, CostChips, ProgressBar, Stepper } from './ui';

const FUNCTION_TEXT: Record<BuildingType, string> = {
  castle: 'Centro de tu señorío. Su nivel fija el límite de habitantes y los ingresos base de oro, y es requisito para mejorar el resto de edificios.',
  sawmill: 'Los leñadores talan el bosque cercano. Produce madera según los trabajadores asignados y el nivel.',
  quarry: 'Los canteros extraen bloques de piedra. Produce piedra según los trabajadores asignados y el nivel.',
  farm: 'Campos y huertos que alimentan a la villa. Produce alimentos según los trabajadores asignados y el nivel.',
  warehouse: 'Graneros y bodegas. Su nivel fija cuánta madera, piedra, alimentos y oro puedes guardar; lo que no cabe se pierde.',
  barracks: 'Aquí se entrena a la milicia. Sus niveles desbloquean nuevas unidades y acortan el tiempo de reclutamiento.',
  wall: 'Perímetro defensivo de la villa. No ocupa parcela: se selecciona desde el portón. Cada nivel amplía la guarnición de arqueros y suma un 5 % a la defensa; su aspecto evoluciona de empalizada a piedra y a reforzada.',
};

const WALL_STAGE_NAME = ['sin construir', 'empalizada', 'piedra', 'reforzada'];
const ACTIVITY_TEXT: Record<string, string> = {
  ok: 'Trabajando',
  no_workers: 'Sin trabajadores asignados: no produce',
  storage_full: 'Almacén lleno: producción detenida',
  not_built: 'Sin construir',
};

const REQ_NAME: Record<string, string> = { castle: 'Castillo', warehouse: 'Almacén' };

function effectLines(type: BuildingType, e: BuildingEffect, state: GameState): string[] {
  switch (type) {
    case 'castle':
      return [`Límite de habitantes: ${e.maxPopulation}`, `Ingreso base de oro: +${e.goldPerMinute}/min`];
    case 'warehouse':
      return [`Capacidad por recurso: ${fmt(e.capacity ?? 0)}`];
    case 'wall':
      return [
        `Aspecto: ${WALL_STAGE_NAME[e.wallStage ?? 0]}`,
        `Guarnición: hasta ${e.garrisonCapacity} arqueros`,
        `Defensa del defensor: +${e.defenseBonusPct} %`,
      ];
    case 'barracks': {
      const names = (e.unlockedUnits ?? []).map((u) => state.units.find((x) => x.type === u)?.name).filter(Boolean);
      return [`Unidades: ${names.length ? names.join(', ') : 'ninguna'}`, `Tiempo de reclutamiento: ${Math.round((e.recruitTimeFactor ?? 1) * 100)} %`];
    }
    default:
      return [`Puestos de trabajo: ${e.slots}`, `Rinde ${fmt1(e.perWorkerPerMinute ?? 0)} ${RESOURCE_LABEL[e.resource as ResourceKey].toLowerCase()}/min por trabajador`];
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

/** Inspector derecho de la ciudad: todo el contenido sale del estado real del servidor. */
export function BuildingInspector({ state, building: b, now, estimate, onClose, onChanged, onGoArmy }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const up = b.upgrade;
  const producing = b.type === 'sawmill' || b.type === 'quarry' || b.type === 'farm';
  const activeBuilding = state.buildings.find((x) => x.construction) ?? null;

  const affordable = up ? Object.entries(up.cost).every(([r, v]) => estimate(r as ResourceKey) >= (v ?? 0)) : false;
  const reqOk = up ? up.requirements.every((r) => r.met) : false;
  const canClick = !!up && !b.construction && !activeBuilding && reqOk && affordable && !busy;

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

  const slots = b.effect.slots ?? 0;
  const maxWorkers = Math.min(slots, b.workers + Math.floor(state.population.free));
  let disabledHint: string | null = null;
  if (up && !canClick && !b.construction) {
    if (activeBuilding) disabledHint = `Ya hay una obra en curso: ${activeBuilding.name}.`;
    else if (!reqOk) disabledHint = 'Aún no cumples los requisitos.';
    else if (!affordable) disabledHint = 'Te faltan recursos.';
  }
  const verb = b.level === 0 ? 'Construir' : `Mejorar a nivel ${up?.targetLevel}`;

  return (
    <div className="inspector" role="dialog" aria-label={`Inspector: ${b.name}`}>
      <header className="insp-head">
        <div>
          <h2>{b.name}</h2>
          <p>{b.level > 0 ? `Nivel ${b.level} de ${b.maxLevel}` : 'Parcela libre'}</p>
        </div>
        <CloseButton onClick={onClose} label="Cerrar inspector" />
      </header>

      <BuildingPortrait type={b.type} built={b.level > 0} ghost wallStage={b.type === 'wall' ? (b.effect.wallStage ?? 0) || up?.effect.wallStage || 1 : 0} />
      <p className="insp-text">{FUNCTION_TEXT[b.type]}</p>

      {up && !b.construction ? (
        <Card title={b.level === 0 ? 'Construcción' : verb} icon={<HammerIcon size={20} />}>
          {b.level > 0 && (
            <ul className="effect-next">
              {effectLines(b.type, up.effect, state).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <CostChips cost={up.cost} estimate={estimate} />
          <div className="kv-row">
            <span>
              <ClockIcon size={18} /> Tiempo de {b.level === 0 ? 'construcción' : 'mejora'}
            </span>
            <b>{fmtDuration(up.seconds)}</b>
          </div>
          {up.requirements.length > 0 && (
            <ul className="reqs">
              {up.requirements.map((r) => (
                <li key={r.building} className={r.met ? 'met' : 'unmet'}>
                  {r.met ? <CheckIcon size={15} /> : <CrossIcon size={15} />} {REQ_NAME[r.building]} nivel {r.required}
                  <small> (actual {r.current})</small>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" block disabled={!canClick} onClick={() => run(() => api.upgrade(b.type), 'Construcción iniciada.')}>
            {b.level === 0 ? 'Construir' : 'Mejorar'}
          </Button>
          {disabledHint && <p className="hint">{disabledHint}</p>}
        </Card>
      ) : !up ? (
        <Card title="Nivel máximo">
          <p className="insp-text">Este edificio ya está al nivel máximo.</p>
        </Card>
      ) : null}

      {b.level > 0 && (
        <Card title="Beneficio actual" icon={<LineIcon name="shield" size={20} />}>
          <ul className="lines">
            {effectLines(b.type, b.effect, state).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {b.type === 'barracks' && (
            <div className="unit-chips">
              {state.units.map((u) => (
                <span key={u.type} className={`chip ${u.unlocked ? '' : 'is-locked'}`}>
                  <UnitIcon unit={u.type} size={16} /> {u.name}
                  {!u.unlocked && ` · Nv ${u.unlockBarracks}`}
                </span>
              ))}
            </div>
          )}
          {b.type === 'barracks' && (
            <Button block onClick={onGoArmy}>
              Ir a reclutar tropas
            </Button>
          )}
        </Card>
      )}

      {producing && b.level > 0 && (
        <Card title="Trabajadores" icon={<LineIcon name="people" size={20} />} aside={`${b.workers} / ${slots}`}>
          {b.activity && (
            <p className={`activity-line ${b.activity.producing ? 'is-on' : 'is-off'}`} role="status">
              <span className="dot" aria-hidden /> {ACTIVITY_TEXT[b.activity.reason]}
            </p>
          )}
          {b.workers < slots && Math.floor(state.population.free) > 0 && (
            <p className="insp-note hint-assign">Tienes {fmt(state.population.free)} habitantes libres: asígnalos para producir más.</p>
          )}
          <Stepper label={`Trabajadores en ${b.name}`} value={b.workers} min={0} max={maxWorkers} disabled={busy} onChange={(n) => run(() => api.workers({ [b.type]: n }))} />
          <p className="insp-note">
            Producción actual: <b>+{fmt1(b.workers * (b.effect.perWorkerPerMinute ?? 0))}</b> {RESOURCE_LABEL[b.effect.resource as ResourceKey].toLowerCase()}/min · habitantes libres: {fmt(state.population.free)}
          </p>
        </Card>
      )}

      {b.type === 'wall' && (
        <GarrisonCard state={state} wallLevel={b.level} busy={busy} onApply={(n) => run(() => api.garrison(n), 'Guarnición actualizada.')} />
      )}

      <Card title="Producción" icon={<LineIcon name="city" size={20} />}>
        <ul className="prod-list">
          {RESOURCE_ORDER.map((r) => (
            <li key={r}>
              <ResourceIcon resource={r} size={22} />
              <span>{RESOURCE_LABEL[r]}</span>
              <b>
                {fmt(estimate(r))} <small>/ {fmt(state.resources[r].capacity)}</small>
              </b>
              <em className={state.resources[r].ratePerMinute > 0 ? 'up' : ''}>{state.resources[r].ratePerMinute > 0 ? `+${fmt1(state.resources[r].ratePerMinute)}/min` : '0/min'}</em>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Cola de construcción" icon={<HammerIcon size={20} />}>
        {activeBuilding?.construction ? (
          <div className="queue-row">
            <BuildingPortrait type={activeBuilding.type} built={activeBuilding.level > 0} ghost height={56} width={76} k={0.22} className="is-thumb" />
            <div className="grow">
              <b>
                {activeBuilding.name} · Nivel {activeBuilding.construction.targetLevel}
              </b>
              <ProgressBar
                label={`Progreso de ${activeBuilding.name}`}
                value={(now - activeBuilding.construction.startedAt) / (activeBuilding.construction.finishesAt - activeBuilding.construction.startedAt)}
              />
            </div>
            <time>{fmtDuration((activeBuilding.construction.finishesAt - now) / 1000)}</time>
          </div>
        ) : (
          <p className="insp-note">Sin obras en curso. Solo puede haber una construcción activa por ciudad.</p>
        )}
      </Card>

      {message && (
        <p className={`msg ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
