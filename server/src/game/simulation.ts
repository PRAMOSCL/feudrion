import {
  CAMPS,
  PRODUCTION_BUILDINGS,
  RESOURCES,
  UNIT_TYPES,
  workerSlots,
  type BuildingType,
} from '../config/balance.js';
import type { DB } from '../db/connection.js';
import * as repo from '../db/repo.js';
import { emptyLoot, emptyUnits, resolveCombat, type Loot, type UnitCounts } from './combat.js';
import { assignedWorkers, integrate, storageCapacity, type CityState } from './economy.js';

/**
 * Actualización temporal: pone la ciudad al día hasta `now` (reloj del servidor).
 *
 * Los eventos vencidos (fin de construcción, fin de reclutamiento, llegada y regreso de
 * expediciones) se procesan en orden cronológico. Entre evento y evento se integra la
 * producción con las tasas vigentes, así que una mejora que termina durante una ausencia
 * cambia la producción exactamente desde su instante de finalización.
 *
 * DEBE ejecutarse dentro de una transacción de escritura. Cada evento se consume mediante
 * una transición de estado condicionada (`WHERE status = ...`), por lo que nunca se aplica dos veces.
 */
export function advanceCity(db: DB, cityId: number, now: number): CityState {
  const state = repo.loadCityState(db, cityId);

  for (;;) {
    const ev = repo.nextDueEvent(db, cityId, now);
    if (!ev) break;
    const at = Math.max(ev.at, state.lastUpdateAt);
    integrate(state, state.lastUpdateAt, at);
    state.lastUpdateAt = at;

    switch (ev.kind) {
      case 'construction':
        applyConstruction(db, state, ev.id);
        break;
      case 'recruitment':
        applyRecruitment(db, state, ev.id);
        break;
      case 'expedition_arrive':
        applyArrival(db, state, ev.id, ev.at);
        break;
      case 'expedition_return':
        applyReturn(db, state, ev.id, ev.at);
        break;
    }
  }

  if (now > state.lastUpdateAt) {
    integrate(state, state.lastUpdateAt, now);
    state.lastUpdateAt = now;
  }
  repo.saveCityState(db, state);
  return state;
}

function applyConstruction(db: DB, state: CityState, id: number): void {
  const c = repo.getConstruction(db, id);
  if (!repo.closeConstruction(db, id)) return;
  const type: BuildingType = c.building_type;
  const previous = state.levels[type];
  state.levels[type] = c.target_level;

  // Un edificio productivo recién construido recibe trabajadores libres hasta su límite de puestos.
  if (previous === 0 && (PRODUCTION_BUILDINGS as readonly string[]).includes(type)) {
    const free = Math.max(0, Math.floor(state.population) - assignedWorkers(state.workers));
    state.workers[type] = Math.min(workerSlots(c.target_level), free);
  }
  repo.setBuilding(db, state.id, type, state.levels[type], state.workers[type]);
}

function applyRecruitment(db: DB, state: CityState, id: number): void {
  const r = repo.getRecruitment(db, id);
  if (!repo.closeRecruitment(db, id)) return;
  repo.addTroops(db, state.id, r.unit_type, r.quantity);
}

/** La expedición llega al campamento: se resuelve el combate (una vez) y se agenda el regreso. */
function applyArrival(db: DB, state: CityState, id: number, at: number): void {
  const exp = repo.getExpedition(db, id);
  const camp = CAMPS.find((c) => c.key === exp.camp_key)!;
  const rows = repo.getExpeditionUnits(db, id);
  const sent: UnitCounts = emptyUnits();
  for (const u of UNIT_TYPES) sent[u] = rows[u].sent;

  const outcome = resolveCombat(sent, camp);
  if (!repo.markExpeditionResolved(db, id, outcome.result, at, outcome.loot)) return;
  for (const u of UNIT_TYPES) if (sent[u] > 0) repo.setExpeditionLost(db, id, u, outcome.lost[u]);

  repo.insertReport(db, {
    city_id: state.id,
    expedition_id: id,
    camp_key: camp.key,
    result: outcome.result,
    created_at: at,
    sent_json: JSON.stringify(sent),
    lost_json: JSON.stringify(outcome.lost),
    survivors_json: JSON.stringify(outcome.survivors),
    loot_json: JSON.stringify(outcome.loot),
    details_json: JSON.stringify({
      ourAttack: outcome.ourAttack,
      ourDefense: outcome.ourDefense,
      campAttack: camp.attack,
      campDefense: camp.defense,
      ratio: outcome.ratio,
      lossFraction: outcome.lossFraction,
      carryCapacity: outcome.carryCapacity,
    }),
  });
}

/** Las tropas regresan: supervivientes al hogar y botín al almacén (limitado por su capacidad), una sola vez. */
function applyReturn(db: DB, state: CityState, id: number, at: number): void {
  const exp = repo.getExpedition(db, id);
  const loot: Loot = JSON.parse(exp.loot_json ?? '{}');
  const rows = repo.getExpeditionUnits(db, id);

  const cap = storageCapacity(state.levels);
  const delivered = emptyLoot();
  for (const r of RESOURCES) {
    const space = Math.max(0, cap - state.resources[r]);
    delivered[r] = Math.min(loot[r] ?? 0, Math.floor(space));
  }

  if (!repo.markExpeditionCompleted(db, id, at, delivered)) return;
  for (const u of UNIT_TYPES) {
    const survivors = rows[u].sent - rows[u].lost;
    if (survivors > 0) repo.addTroops(db, state.id, u, survivors);
  }
  for (const r of RESOURCES) state.resources[r] += delivered[r];
  repo.completeReport(db, id, at, delivered);
}
