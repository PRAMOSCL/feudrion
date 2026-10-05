import {
  BUILDINGS,
  CAMPS,
  MAX_LEVEL,
  PRODUCTION_BUILDINGS,
  RECRUIT,
  RESOURCES,
  UNITS,
  UNIT_TYPES,
  recruitTimeFactor,
  requirements,
  upgradeCost,
  upgradeSeconds,
  workerSlots,
  type BuildingType,
  type Cost,
  type ProductionBuilding,
  type ResourceKey,
  type UnitType,
} from '../config/balance.js';
import type { DB } from '../db/connection.js';
import * as repo from '../db/repo.js';
import { emptyUnits, travelSeconds, type UnitCounts } from '../game/combat.js';
import { assignedWorkers, type CityState } from '../game/economy.js';
import { advanceCity } from '../game/simulation.js';
import { GameError } from './errors.js';

/**
 * Comandos del jugador. Cada uno recibe el estado ya actualizado hasta `now`, valida con las
 * reglas del servidor (el cliente solo indica QUÉ quiere hacer, nunca costos ni resultados),
 * y escribe dentro de la misma transacción.
 */

export interface CommandContext {
  db: DB;
  cityId: number;
  now: number;
  state: CityState;
}

export const resName: Record<ResourceKey, string> = { wood: 'madera', stone: 'piedra', food: 'alimentos', gold: 'oro' };

/** Recursos que faltan para pagar `cost` (vacío si alcanza). */
export function missingResources(state: CityState, cost: Cost): Partial<Record<ResourceKey, number>> {
  const missing: Partial<Record<ResourceKey, number>> = {};
  for (const r of RESOURCES) {
    const need = cost[r] ?? 0;
    if (state.resources[r] < need) missing[r] = Math.ceil(need - state.resources[r]);
  }
  return missing;
}

function pay(ctx: CommandContext, cost: Cost): void {
  const missing = missingResources(ctx.state, cost);
  const keys = Object.keys(missing) as ResourceKey[];
  if (keys.length) {
    throw new GameError(409, 'INSUFFICIENT_RESOURCES', `Recursos insuficientes: faltan ${keys.map((k) => `${missing[k]} de ${resName[k]}`).join(', ')}.`);
  }
  for (const r of RESOURCES) ctx.state.resources[r] -= cost[r] ?? 0;
  repo.saveCityState(ctx.db, ctx.state);
}

/* ------------------------------------------------------------------ */

/** Primer motivo que impide mejorar el edificio (null = se puede). */
export function upgradeBlock(state: CityState, type: BuildingType, busy: boolean): { code: string; message: string } | null {
  const level = state.levels[type];
  if (level >= MAX_LEVEL) return { code: 'MAX_LEVEL', message: 'El edificio ya está al nivel máximo.' };
  const target = level + 1;
  if (busy) return { code: 'CONSTRUCTION_BUSY', message: 'Ya hay una construcción en curso en la ciudad.' };
  const req = requirements(type, target);
  if (state.levels.castle < req.castle) {
    return { code: 'REQUIREMENT', message: `Requiere Castillo nivel ${req.castle}.` };
  }
  if (state.levels.warehouse < req.warehouse) {
    return { code: 'REQUIREMENT', message: `Requiere Almacén nivel ${req.warehouse}.` };
  }
  return null;
}

export function startUpgrade(ctx: CommandContext, type: BuildingType) {
  const busy = !!repo.activeConstruction(ctx.db, ctx.cityId);
  const block = upgradeBlock(ctx.state, type, busy);
  if (block) throw new GameError(409, block.code, block.message);

  const target = ctx.state.levels[type] + 1;
  pay(ctx, upgradeCost(type, target));
  const seconds = upgradeSeconds(type, target);
  repo.insertConstruction(ctx.db, ctx.cityId, type, target, ctx.now, ctx.now + seconds * 1000);
  return { building: type, targetLevel: target, finishesAt: ctx.now + seconds * 1000 };
}

/* ------------------------------------------------------------------ */

export function assignWorkers(ctx: CommandContext, assignment: Partial<Record<ProductionBuilding, number>>) {
  const next = { ...ctx.state.workers };
  for (const b of PRODUCTION_BUILDINGS) {
    const wanted = assignment[b];
    if (wanted === undefined) continue;
    const slots = workerSlots(ctx.state.levels[b]);
    if (wanted > slots) {
      throw new GameError(
        409,
        'WORKER_SLOTS',
        slots === 0
          ? `${BUILDINGS[b].name} aún no está construido: no tiene puestos de trabajo.`
          : `${BUILDINGS[b].name} nivel ${ctx.state.levels[b]} solo tiene ${slots} puestos de trabajo.`,
      );
    }
    next[b] = wanted;
  }
  const total = assignedWorkers(next);
  const inhabitants = Math.floor(ctx.state.population);
  if (total > inhabitants) {
    throw new GameError(409, 'NOT_ENOUGH_INHABITANTS', `Solo hay ${inhabitants} habitantes: no puedes asignar ${total} trabajadores.`);
  }
  for (const b of PRODUCTION_BUILDINGS) {
    if (next[b] !== ctx.state.workers[b]) repo.setWorkers(ctx.db, ctx.cityId, b, next[b]);
  }
  return { workers: Object.fromEntries(PRODUCTION_BUILDINGS.map((b) => [b, next[b]])) };
}

/* ------------------------------------------------------------------ */

export function recruitSeconds(unit: UnitType, quantity: number, barracksLevel: number): number {
  return Math.max(1, Math.round(UNITS[unit].seconds * quantity * recruitTimeFactor(barracksLevel)));
}

export function recruit(ctx: CommandContext, unit: UnitType, quantity: number) {
  const def = UNITS[unit];
  const barracks = ctx.state.levels.barracks;
  if (barracks === 0) throw new GameError(409, 'NO_BARRACKS', 'Necesitas construir el Cuartel para reclutar.');
  if (barracks < def.unlockBarracks) {
    throw new GameError(409, 'UNIT_LOCKED', `${def.name} se desbloquea con el Cuartel nivel ${def.unlockBarracks}.`);
  }
  if (quantity > RECRUIT.maxQuantityPerOrder) {
    throw new GameError(400, 'INVALID_QUANTITY', `Puedes reclutar como máximo ${RECRUIT.maxQuantityPerOrder} unidades por pedido.`);
  }
  const queue = repo.activeRecruitments(ctx.db, ctx.cityId);
  if (queue.length >= RECRUIT.maxQueueLength) {
    throw new GameError(409, 'QUEUE_FULL', `La cola de reclutamiento está llena (máximo ${RECRUIT.maxQueueLength} pedidos).`);
  }

  const cost: Cost = {};
  for (const r of RESOURCES) if (def.cost[r]) cost[r] = def.cost[r]! * quantity;
  pay(ctx, cost);

  // Los pedidos se entrenan uno tras otro: empieza cuando termina el anterior.
  const start = Math.max(ctx.now, ...queue.map((q) => q.finishes_at));
  const end = start + recruitSeconds(unit, quantity, barracks) * 1000;
  repo.insertRecruitment(ctx.db, ctx.cityId, unit, quantity, start, end);
  return { unit, quantity, startsAt: start, finishesAt: end };
}

/* ------------------------------------------------------------------ */

export function sendExpedition(ctx: CommandContext, campKey: string, units: Partial<Record<UnitType, number>>) {
  const camp = CAMPS.find((c) => c.key === campKey);
  if (!camp) throw new GameError(404, 'UNKNOWN_CAMP', 'Ese campamento no existe.');

  const sent: UnitCounts = emptyUnits();
  let total = 0;
  for (const u of UNIT_TYPES) {
    sent[u] = units[u] ?? 0;
    total += sent[u];
  }
  if (total <= 0) throw new GameError(400, 'NO_TROOPS', 'Selecciona al menos una unidad para la expedición.');

  const home = repo.getTroops(ctx.db, ctx.cityId);
  for (const u of UNIT_TYPES) {
    if (sent[u] > home[u]) {
      throw new GameError(409, 'NOT_ENOUGH_TROOPS', `No tienes suficientes ${UNITS[u].name.toLowerCase()}s disponibles (${home[u]}).`);
    }
  }

  for (const u of UNIT_TYPES) if (sent[u] > 0) repo.addTroops(ctx.db, ctx.cityId, u, -sent[u]);
  const secs = travelSeconds(camp, sent);
  const arriveAt = ctx.now + secs * 1000;
  const returnAt = arriveAt + secs * 1000;
  const id = repo.insertExpedition(ctx.db, ctx.cityId, camp.key, ctx.now, secs, arriveAt, returnAt);
  for (const u of UNIT_TYPES) if (sent[u] > 0) repo.insertExpeditionUnit(ctx.db, id, u, sent[u]);
  return { expeditionId: id, arriveAt, returnAt };
}

/* ------------------------------------------------------------------ */

/**
 * Ejecuta `fn` de forma atómica: transacción inmediata (bloquea escritores concurrentes),
 * simulación hasta `now` y, opcionalmente, deduplicación por clave de idempotencia.
 * Si `fn` lanza un error, toda la transacción se revierte (incluido el avance de la simulación,
 * que se recalculará idénticamente en la siguiente consulta).
 */
export function runCommand<T>(
  db: DB,
  cityId: number,
  now: number,
  idempotencyKey: string | undefined,
  fn: (ctx: CommandContext) => T,
): { status: number; body: T | unknown; replayed: boolean } {
  return db.transaction(() => {
    if (idempotencyKey) {
      const prev = repo.getIdempotent(db, idempotencyKey, cityId);
      if (prev) return { status: prev.status, body: JSON.parse(prev.response), replayed: true };
    }
    const state = advanceCity(db, cityId, now);
    const body = fn({ db, cityId, now, state });
    if (idempotencyKey) {
      repo.putIdempotent(db, idempotencyKey, cityId, 200, JSON.stringify(body), now);
      repo.pruneIdempotent(db, now - 24 * 3600 * 1000);
    }
    return { status: 200, body, replayed: false };
  }).immediate();
}

