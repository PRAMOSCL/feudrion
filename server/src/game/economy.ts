import {
  GOLD,
  POPULATION,
  PRODUCTION,
  PRODUCTION_BUILDINGS,
  RESOURCES,
  perWorkerRate,
  warehouseCapacity,
  type BuildingType,
  type ResourceKey,
} from '../config/balance.js';

/** Estado económico de una ciudad en un instante (puro, sin acceso a la base de datos). */
export interface CityState {
  id: number;
  lastUpdateAt: number;
  resources: Record<ResourceKey, number>;
  population: number;
  levels: Record<BuildingType, number>;
  workers: Record<BuildingType, number>;
}

export const maxPopulation = (levels: Record<BuildingType, number>) => POPULATION.maxForCastleLevel(levels.castle);
export const storageCapacity = (levels: Record<BuildingType, number>) => warehouseCapacity(levels.warehouse);
export const assignedWorkers = (workers: Record<BuildingType, number>) =>
  PRODUCTION_BUILDINGS.reduce((sum, b) => sum + workers[b], 0);

/** Producción por minuto de cada recurso con la configuración actual (oro con la población actual). */
export function currentRates(state: CityState): Record<ResourceKey, number> {
  const rates: Record<ResourceKey, number> = { wood: 0, stone: 0, food: 0, gold: 0 };
  for (const b of PRODUCTION_BUILDINGS) {
    rates[PRODUCTION[b].resource] += state.workers[b] * perWorkerRate(b, state.levels[b]);
  }
  const free = Math.max(0, state.population - assignedWorkers(state.workers));
  rates.gold = GOLD.castleBasePerMinute(state.levels.castle) + GOLD.perFreeInhabitantPerMinute * free;
  return rates;
}

/**
 * Avanza la economía de `t0` a `t1` (ms) con los niveles y trabajadores vigentes.
 * Se invoca por tramos: cada vez que un evento cambia niveles, trabajadores o límites,
 * el tramo anterior ya quedó integrado con las tasas antiguas.
 *
 * La población crece linealmente hasta el límite; como el oro depende de los habitantes
 * libres (lineal en el tiempo), se integra de forma exacta con la media del tramo.
 */
export function integrate(state: CityState, t0: number, t1: number): void {
  const dt = (t1 - t0) / 60000;
  if (dt <= 0) return;
  const maxPop = maxPopulation(state.levels);
  const g = POPULATION.growthPerMinute;
  const p0 = state.population;

  const segments: { dt: number; avgPop: number }[] = [];
  let endPop: number;
  if (p0 >= maxPop) {
    segments.push({ dt, avgPop: p0 });
    endPop = p0;
  } else {
    const tCap = (maxPop - p0) / g;
    if (tCap >= dt) {
      segments.push({ dt, avgPop: p0 + (g * dt) / 2 });
      endPop = p0 + g * dt;
    } else {
      segments.push({ dt: tCap, avgPop: (p0 + maxPop) / 2 });
      segments.push({ dt: dt - tCap, avgPop: maxPop });
      endPop = maxPop;
    }
  }

  const gains: Record<ResourceKey, number> = { wood: 0, stone: 0, food: 0, gold: 0 };
  for (const b of PRODUCTION_BUILDINGS) {
    gains[PRODUCTION[b].resource] += state.workers[b] * perWorkerRate(b, state.levels[b]) * dt;
  }
  const workers = assignedWorkers(state.workers);
  for (const seg of segments) {
    const free = Math.max(0, seg.avgPop - workers);
    gains.gold += (GOLD.castleBasePerMinute(state.levels.castle) + GOLD.perFreeInhabitantPerMinute * free) * seg.dt;
  }

  const cap = storageCapacity(state.levels);
  for (const r of RESOURCES) {
    // Con tasas constantes el recurso solo crece: topar al final del tramo es exacto.
    state.resources[r] = Math.max(state.resources[r], Math.min(cap, state.resources[r] + gains[r]));
  }
  state.population = endPop;
}
