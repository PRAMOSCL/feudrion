import {
  BUILDINGS,
  BUILDING_TYPES,
  CAMPS,
  COMBAT,
  GOLD,
  HISTORY,
  GARRISON_UNIT,
  MAX_LEVEL,
  WALL,
  maxLevelOf,
  POPULATION,
  PRODUCTION,
  PRODUCTION_BUILDINGS,
  RECRUIT,
  RESOURCES,
  UNITS,
  UNIT_TYPES,
  perWorkerRate,
  recruitTimeFactor,
  requirements,
  upgradeCost,
  upgradeSeconds,
  warehouseCapacity,
  workerSlots,
  type BuildingType,
  type ProductionBuilding,
} from '../config/balance.js';
import type { DB } from '../db/connection.js';
import * as repo from '../db/repo.js';
import { type UnitCounts } from '../game/combat.js';
import { garrisonCapacity, wallDefenseMultiplier, wallStage } from '../game/defense.js';
import { assignedWorkers, currentRates, maxPopulation, storageCapacity, type CityState } from '../game/economy.js';
import { DISTRICTS, PLANNED_BUILDINGS, PLOTS } from '../config/districts.js';
import { advanceCity } from '../game/simulation.js';
import { missingResources, recruitSeconds, resName, upgradeBlock } from './commands.js';

/** Efecto de un edificio a un nivel dado (los números que muestra el panel). */
function effectAt(type: BuildingType, level: number) {
  switch (type) {
    case 'castle':
      return { maxPopulation: level > 0 ? POPULATION.maxForCastleLevel(level) : 0, goldPerMinute: level > 0 ? GOLD.castleBasePerMinute(level) : 0 };
    case 'warehouse':
      return { capacity: level > 0 ? warehouseCapacity(level) : 0 };
    case 'wall':
      return {
        garrisonCapacity: garrisonCapacity(level),
        defenseBonusPct: Math.round((wallDefenseMultiplier(level) - 1) * 100),
        wallStage: wallStage(level),
      };
    case 'barracks':
      return {
        unlockedUnits: UNIT_TYPES.filter((u) => level >= UNITS[u].unlockBarracks),
        recruitTimeFactor: level > 0 ? recruitTimeFactor(level) : 1,
      };
    default: {
      const b = type as ProductionBuilding;
      return {
        resource: PRODUCTION[b].resource,
        slots: workerSlots(level),
        perWorkerPerMinute: perWorkerRate(b, level),
      };
    }
  }
}

/**
 * Pone la ciudad al día y devuelve la fotografía completa del estado para la interfaz.
 * El instante `serverTime` permite al cliente estimar cuentas regresivas sin confiar en su reloj.
 */
export function getSnapshot(db: DB, cityId: number, now: number) {
  return db.transaction(() => {
    const state = advanceCity(db, cityId, now);
    return buildSnapshot(db, cityId, now, state);
  }).immediate();
}

/**
 * Actividad productiva REAL de un edificio: la misma condición que gobierna la economía (nivel > 0, trabajadores asignados > 0,
 * almacén con espacio). La interfaz anima trabajo solo cuando `producing` es true. Una mejora en curso no detiene la producción.
 */
function productionActivity(state: CityState, type: BuildingType) {
  if (!(PRODUCTION_BUILDINGS as readonly string[]).includes(type)) return null;
  const b = type as ProductionBuilding;
  const resource = PRODUCTION[b].resource;
  const cap = storageCapacity(state.levels);
  if (state.levels[b] <= 0) return { producing: false, reason: 'not_built' as const, resource };
  if (state.workers[b] <= 0) return { producing: false, reason: 'no_workers' as const, resource };
  if (state.resources[resource] >= cap - 1e-6) return { producing: false, reason: 'storage_full' as const, resource };
  return { producing: true, reason: 'ok' as const, resource };
}

/**
 * Distritos y parcelas (fase 2). Solo describe DÓNDE está cada cosa y qué está planificado: los edificios planificados no
 * existen como mecánica, no se pueden construir y no aportan recursos, defensa ni población.
 */
function districtsView(db: DB, cityId: number) {
  const placed = new Map(repo.getPlacements(db, cityId).map((p) => [p.plotId, p]));
  return DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    description: d.description,
    plots: PLOTS.filter((p) => p.districtId === d.id).map((p) => ({
      id: p.id,
      allowedTypes: p.allowedTypes,
      building: placed.get(p.id)?.type ?? null,
    })),
    planned: PLANNED_BUILDINGS.filter((b) => PLOTS.find((p) => p.id === b.plotId)?.districtId === d.id).map((b) => ({
      type: b.type,
      name: b.name,
      plotId: b.plotId,
      phase: b.phase,
      status: 'planned' as const,
      pending: b.pending,
    })),
  }));
}

export function buildSnapshot(db: DB, cityId: number, now: number, state: CityState) {
  const city = db.prepare('SELECT c.name, p.name AS player FROM cities c JOIN players p ON p.id = c.player_id WHERE c.id = ?').get(cityId) as {
    name: string;
    player: string;
  };
  const rates = currentRates(state);
  const cap = storageCapacity(state.levels);
  const construction = repo.activeConstruction(db, cityId);
  const troops = repo.getTroops(db, cityId);
  const workersTotal = assignedWorkers(state.workers);

  const resources = Object.fromEntries(
    RESOURCES.map((r) => [r, { amount: state.resources[r], capacity: cap, ratePerMinute: rates[r] }]),
  );

  const buildings = BUILDING_TYPES.map((type) => {
    const level = state.levels[type];
    const underConstruction = construction?.building_type === type ? construction : undefined;
    let upgrade = null;
    if (level < maxLevelOf(type)) {
      const target = level + 1;
      const cost = upgradeCost(type, target);
      const req = requirements(type, target);
      const block = upgradeBlock(state, type, !!construction);
      const missing = missingResources(state, cost);
      const reqList = [
        ...(req.castle > 0 ? [{ building: 'castle', required: req.castle, current: state.levels.castle, met: state.levels.castle >= req.castle }] : []),
        ...(req.warehouse > 0 ? [{ building: 'warehouse', required: req.warehouse, current: state.levels.warehouse, met: state.levels.warehouse >= req.warehouse }] : []),
      ];
      upgrade = {
        targetLevel: target,
        cost,
        seconds: upgradeSeconds(type, target),
        requirements: reqList,
        missing,
        canStart: !block && Object.keys(missing).length === 0,
        blockedReason: block
          ? block.message
          : Object.keys(missing).length
            ? `Faltan recursos: ${(Object.keys(missing) as (keyof typeof missing)[]).map((k) => `${missing[k]} de ${resName[k!]}`).join(', ')}.`
            : null,
        effect: effectAt(type, target),
      };
    }
    const place = repo.getPlacements(db, cityId).find((p) => p.type === type);
    return {
      type,
      districtId: place?.districtId ?? 'fortress',
      plotId: place?.plotId ?? `fortress:${type}`,
      name: BUILDINGS[type].name,
      level,
      workers: state.workers[type],
      maxLevel: maxLevelOf(type),
      effect: effectAt(type, level),
      activity: productionActivity(state, type),
      construction: underConstruction
        ? { targetLevel: underConstruction.target_level, startedAt: underConstruction.started_at, finishesAt: underConstruction.finishes_at }
        : null,
      upgrade,
    };
  });

  const units = UNIT_TYPES.map((u) => ({
    type: u,
    name: UNITS[u].name,
    unlockBarracks: UNITS[u].unlockBarracks,
    unlocked: state.levels.barracks >= UNITS[u].unlockBarracks,
    cost: UNITS[u].cost,
    secondsPerUnit: Math.max(1, UNITS[u].seconds * recruitTimeFactor(state.levels.barracks)),
    attack: UNITS[u].attack,
    defense: UNITS[u].defense,
    carry: UNITS[u].carry,
    speed: UNITS[u].speed,
    home: troops[u],
  }));

  const recruitQueue = repo.activeRecruitments(db, cityId).map((q) => ({
    id: q.id,
    unit: q.unit_type,
    quantity: q.quantity,
    startedAt: q.started_at,
    finishesAt: q.finishes_at,
  }));

  const expeditions = repo.listExpeditions(db, cityId).map((e) => {
    const rows = repo.getExpeditionUnits(db, e.id);
    return {
      id: e.id,
      camp: e.camp_key,
      status: e.status,
      sentAt: e.sent_at,
      arriveAt: e.arrive_at,
      returnAt: e.return_at,
      result: e.result,
      units: Object.fromEntries(UNIT_TYPES.filter((u) => rows[u].sent > 0).map((u) => [u, rows[u]])),
      loot: e.loot_json ? JSON.parse(e.loot_json) : null,
    };
  });

  const reports = repo.listReports(db, cityId, HISTORY.reportsShown).map((r) => ({
    id: r.id,
    camp: r.camp_key,
    result: r.result,
    createdAt: r.created_at,
    sent: JSON.parse(r.sent_json) as UnitCounts,
    lost: JSON.parse(r.lost_json) as UnitCounts,
    survivors: JSON.parse(r.survivors_json) as UnitCounts,
    loot: JSON.parse(r.loot_json),
    delivered: r.delivered_json ? JSON.parse(r.delivered_json) : null,
    deliveredAt: r.delivered_at,
    details: JSON.parse(r.details_json),
  }));

  const camps = CAMPS.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    difficulty: c.difficulty,
    attack: c.attack,
    defense: c.defense,
    travelSeconds: c.travelSeconds,
    loot: c.loot,
    map: c.map,
  }));

  return {
    serverTime: now,
    city: { id: cityId, name: city.name, player: city.player },
    resources,
    population: {
      current: state.population,
      max: maxPopulation(state.levels),
      workers: workersTotal,
      free: Math.max(0, state.population - workersTotal),
      growthPerMinute: state.population >= maxPopulation(state.levels) ? 0 : POPULATION.growthPerMinute,
    },
    buildings,
    districts: districtsView(db, cityId),
    garrison: {
      archers: repo.getGarrison(db, cityId),
      capacity: garrisonCapacity(state.levels.wall),
      availableArchers: troops[GARRISON_UNIT],
    },
    units,
    recruitQueue,
    expeditions,
    reports,
    camps,
    rules: {
      maxLevel: MAX_LEVEL,
      goldPerFreeInhabitantPerMinute: GOLD.perFreeInhabitantPerMinute,
      populationGrowthPerMinute: POPULATION.growthPerMinute,
      recruitMaxQuantity: RECRUIT.maxQuantityPerOrder,
      wall: { garrisonPerLevel: WALL.garrisonPerLevel, defenseBonusPerLevelPct: Math.round(WALL.defenseBonusPerLevel * 100), maxLevel: maxLevelOf('wall') },
      recruitMaxQueue: RECRUIT.maxQueueLength,
      combat: COMBAT,
      productionResources: Object.fromEntries(PRODUCTION_BUILDINGS.map((b) => [b, PRODUCTION[b].resource])),
    },
  };
}

