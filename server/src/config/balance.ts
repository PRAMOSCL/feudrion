/**
 * Configuración de balance de Señoríos (V1).
 *
 * Todas las cifras del juego viven aquí: costos, tiempos, producción, capacidades,
 * requisitos, unidades y campamentos NPC. El cliente nunca decide estos valores;
 * solo los recibe ya calculados desde el servidor.
 *
 * Unidades de tiempo: las tasas de producción se expresan "por minuto" y las
 * duraciones en segundos. Internamente la simulación usa milisegundos.
 */

export const RESOURCES = ['wood', 'stone', 'food', 'gold'] as const;
export type ResourceKey = (typeof RESOURCES)[number];
export type Cost = Partial<Record<ResourceKey, number>>;

export const BUILDING_TYPES = ['castle', 'sawmill', 'quarry', 'farm', 'warehouse', 'barracks', 'wall'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];
export const PRODUCTION_BUILDINGS = ['sawmill', 'quarry', 'farm'] as const;
export type ProductionBuilding = (typeof PRODUCTION_BUILDINGS)[number];

export const MAX_LEVEL = 10;
/** Nivel máximo por edificio cuando difiere del general (la muralla llega a 9). */
const MAX_LEVEL_OVERRIDE: Partial<Record<BuildingType, number>> = { wall: 9 };
export const maxLevelOf = (type: BuildingType): number => MAX_LEVEL_OVERRIDE[type] ?? MAX_LEVEL;

export const UNIT_TYPES = ['lancero', 'arquero', 'espadachin', 'ballestero'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Valores iniciales                                                   */
/* ------------------------------------------------------------------ */

export const START = {
  cityName: 'Villa Robledal',
  playerName: 'Señor de Robledal',
  resources: { wood: 300, stone: 200, food: 250, gold: 150 } as Record<ResourceKey, number>,
  population: 12,
  buildings: {
    castle: { level: 1, workers: 0 },
    sawmill: { level: 0, workers: 0 },
    quarry: { level: 0, workers: 0 },
    farm: { level: 1, workers: 4 },
    warehouse: { level: 1, workers: 0 },
    barracks: { level: 0, workers: 0 },
    // Las partidas nuevas empiezan SIN muralla: nada de defensa gratuita.
    wall: { level: 0, workers: 0 },
  } as Record<BuildingType, { level: number; workers: number }>,
};

/* ------------------------------------------------------------------ */
/* Población y oro                                                     */
/* ------------------------------------------------------------------ */

export const POPULATION = {
  /** Habitantes nuevos por minuto mientras no se alcance el límite del castillo. */
  growthPerMinute: 6,
  /** Límite de habitantes según nivel del castillo. */
  maxForCastleLevel: (level: number) => 30 + 30 * (level - 1),
};

export const GOLD = {
  /** Oro por minuto por cada habitante libre (sin puesto de trabajo). */
  perFreeInhabitantPerMinute: 1,
  /** Ingreso base del castillo por minuto. */
  castleBasePerMinute: (level: number) => 5 * level,
};

/* ------------------------------------------------------------------ */
/* Edificios                                                           */
/* ------------------------------------------------------------------ */

interface BuildingDef {
  name: string;
  /** Costo del nivel 1. Los siguientes crecen con costGrowth. */
  baseCost: Cost;
  costGrowth: number;
  /** Duración (s) de construir el nivel 1. */
  baseSeconds: number;
  /** Nivel mínimo del castillo para el nivel 1 de este edificio. */
  firstLevelCastle: number;
}

const TIME_GROWTH = 1.38;

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  castle: { name: 'Castillo', baseCost: { wood: 120, stone: 100, gold: 40 }, costGrowth: 1.45, baseSeconds: 45, firstLevelCastle: 0 },
  sawmill: { name: 'Aserradero', baseCost: { wood: 60, stone: 40, gold: 20 }, costGrowth: 1.42, baseSeconds: 30, firstLevelCastle: 1 },
  quarry: { name: 'Cantera', baseCost: { wood: 70, stone: 30, gold: 20 }, costGrowth: 1.42, baseSeconds: 35, firstLevelCastle: 1 },
  farm: { name: 'Granja', baseCost: { wood: 60, stone: 40, gold: 15 }, costGrowth: 1.42, baseSeconds: 30, firstLevelCastle: 1 },
  warehouse: { name: 'Almacén', baseCost: { wood: 90, stone: 70, gold: 25 }, costGrowth: 1.4, baseSeconds: 30, firstLevelCastle: 1 },
  barracks: { name: 'Cuartel', baseCost: { wood: 140, stone: 110, gold: 60, food: 40 }, costGrowth: 1.45, baseSeconds: 50, firstLevelCastle: 2 },
  // Muralla: infraestructura del perímetro (no ocupa parcela). Piedra como recurso dominante; costos y tiempos en la escala del resto.
  wall: { name: 'Muralla', baseCost: { wood: 120, stone: 220, gold: 60 }, costGrowth: 1.4, baseSeconds: 60, firstLevelCastle: 2 },
};

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Costo de construir/mejorar hasta `targetLevel` (1..10). */
export function upgradeCost(type: BuildingType, targetLevel: number): Cost {
  const def = BUILDINGS[type];
  const cost: Cost = {};
  for (const r of RESOURCES) {
    const base = def.baseCost[r];
    if (base) cost[r] = roundTo5(base * Math.pow(def.costGrowth, targetLevel - 1));
  }
  return cost;
}

/** Duración en segundos de construir/mejorar hasta `targetLevel`. */
export function upgradeSeconds(type: BuildingType, targetLevel: number): number {
  return Math.round(BUILDINGS[type].baseSeconds * Math.pow(TIME_GROWTH, targetLevel - 1));
}

/** Capacidad del almacén (aplica a cada recurso). */
export function warehouseCapacity(level: number): number {
  return Math.round(500 * Math.pow(1.5, level - 1));
}

/** Puestos de trabajo y rendimiento de los edificios productivos. */
export const PRODUCTION: Record<ProductionBuilding, { resource: ResourceKey; perWorkerPerMinute: number }> = {
  sawmill: { resource: 'wood', perWorkerPerMinute: 10 },
  quarry: { resource: 'stone', perWorkerPerMinute: 8 },
  farm: { resource: 'food', perWorkerPerMinute: 12 },
};
export const workerSlots = (level: number) => (level <= 0 ? 0 : 3 + 2 * level);
export const perWorkerRate = (type: ProductionBuilding, level: number) =>
  level <= 0 ? 0 : PRODUCTION[type].perWorkerPerMinute * (1 + 0.1 * (level - 1));

/** Reducción del tiempo de reclutamiento por nivel del cuartel (5 % por nivel > 1, mínimo 50 %). */
export const recruitTimeFactor = (barracksLevel: number) => Math.max(0.5, 1 - 0.05 * (barracksLevel - 1));

/** Requisitos "de diseño" (no derivados del almacén) para alcanzar `targetLevel`. */
export function baseRequirements(type: BuildingType, targetLevel: number): { castle: number; warehouse: number } {
  if (type === 'castle') return { castle: 0, warehouse: targetLevel >= 2 ? Math.ceil((targetLevel - 1) / 2) : 0 };
  const def = BUILDINGS[type];
  // La muralla crece más despacio que el castillo: nivel n exige castillo ⌈n/2⌉+1 (mínimo 2).
  if (type === 'wall') return { castle: Math.max(def.firstLevelCastle, Math.ceil(targetLevel / 2) + 1), warehouse: 0 };
  return { castle: Math.max(def.firstLevelCastle, targetLevel - 1), warehouse: 0 };
}

/** Nivel mínimo de almacén cuya capacidad permite pagar `cost` (evita bloqueos). */
export function warehouseLevelToAfford(cost: Cost): number {
  const max = Math.max(...RESOURCES.map((r) => cost[r] ?? 0));
  let level = 1;
  while (warehouseCapacity(level) < max && level < MAX_LEVEL) level++;
  return level;
}

/** Requisitos completos: castillo y almacén (de diseño o por capacidad). */
export function requirements(type: BuildingType, targetLevel: number): { castle: number; warehouse: number } {
  const base = baseRequirements(type, targetLevel);
  const byCapacity = warehouseLevelToAfford(upgradeCost(type, targetLevel));
  return { castle: base.castle, warehouse: Math.max(base.warehouse, byCapacity > 1 ? byCapacity : 0) };
}

/* ------------------------------------------------------------------ */
/* Unidades                                                            */
/* ------------------------------------------------------------------ */

export interface UnitDef {
  name: string;
  /** Nivel de cuartel que la desbloquea. */
  unlockBarracks: number;
  cost: Cost;
  /** Segundos por unidad (antes del factor del cuartel). */
  seconds: number;
  attack: number;
  defense: number;
  carry: number;
  /** Multiplicador de velocidad de marcha (la expedición va al ritmo del más lento). */
  speed: number;
}

export const UNITS: Record<UnitType, UnitDef> = {
  lancero: { name: 'Lancero', unlockBarracks: 1, cost: { wood: 20, food: 15, gold: 8 }, seconds: 12, attack: 6, defense: 9, carry: 10, speed: 1.0 },
  arquero: { name: 'Arquero', unlockBarracks: 2, cost: { wood: 25, food: 15, gold: 14 }, seconds: 14, attack: 11, defense: 4, carry: 8, speed: 1.1 },
  espadachin: { name: 'Espadachín', unlockBarracks: 3, cost: { wood: 20, stone: 25, food: 20, gold: 22 }, seconds: 18, attack: 14, defense: 11, carry: 14, speed: 1.0 },
  ballestero: { name: 'Ballestero', unlockBarracks: 4, cost: { wood: 35, stone: 20, food: 20, gold: 30 }, seconds: 22, attack: 20, defense: 5, carry: 10, speed: 0.9 },
};

export const RECRUIT = {
  maxQuantityPerOrder: 200,
  /** Pedidos activos + en cola permitidos por ciudad. */
  maxQueueLength: 5,
};

/* ------------------------------------------------------------------ */
/* Campamentos NPC y combate                                           */
/* ------------------------------------------------------------------ */

export interface CampDef {
  key: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  attack: number;
  defense: number;
  /** Segundos de viaje de ida con velocidad 1.0 (la vuelta tarda lo mismo). */
  travelSeconds: number;
  loot: Record<ResourceKey, number>;
  /** Posición en el mapa SVG (0..100). */
  map: { x: number; y: number };
}

export const CAMPS: CampDef[] = [
  {
    key: 'bandidos', name: 'Campamento de bandidos', difficulty: 1,
    description: 'Una banda de salteadores acampada junto al camino real.',
    attack: 35, defense: 55, travelSeconds: 60,
    loot: { wood: 90, stone: 60, food: 80, gold: 60 }, map: { x: 26, y: 28 },
  },
  {
    key: 'fortin', name: 'Fortín de saqueadores', difficulty: 2,
    description: 'Una empalizada de madera defendida por mercenarios curtidos.',
    attack: 110, defense: 170, travelSeconds: 105,
    loot: { wood: 220, stone: 170, food: 150, gold: 160 }, map: { x: 76, y: 30 },
  },
  {
    key: 'bastion', name: 'Bastión del señor de la guerra', difficulty: 3,
    description: 'Una torre de piedra con una guarnición numerosa y bien armada.',
    attack: 280, defense: 430, travelSeconds: 150,
    loot: { wood: 520, stone: 420, food: 300, gold: 380 }, map: { x: 70, y: 68 },
  },
];

/**
 * Combate determinista (sin azar):
 *   ataque propio  = Σ n·ataque,  defensa propia = Σ n·defensa
 *   razón r        = ataque propio / defensa del campamento
 *   r ≥ 1 → victoria. Fracción de bajas = clamp(0.9·A_npc/(A_npc+D_propia)/r^1.5, 0.03, 0.9)
 *   r < 1 → derrota.  Fracción de bajas = clamp(0.5 + 0.5·(1−r), 0.5, 0.95)
 *   Bajas por tipo = round(n·fracción). El botín (solo victoria) es el potencial del
 *   campamento limitado por la capacidad de carga de los supervivientes.
 */
export const COMBAT = {
  winLossScale: 0.9,
  winLossMin: 0.03,
  winLossMax: 0.9,
  defeatLossMin: 0.5,
  defeatLossMax: 0.95,
};

export const HISTORY = { reportsShown: 30 };

/* ------------------------------------------------------------------ */
/* Muralla y guarnición (propuesta CONFIGURABLE, no validada por juego) */
/* ------------------------------------------------------------------ */

export const WALL = {
  /** Arqueros que caben en la guarnición por nivel de muralla (0 si no está construida). */
  garrisonPerLevel: 4,
  /** Bonificación de defensa por nivel, como multiplicador único sobre la defensa base del defensor. */
  defenseBonusPerLevel: 0.05,
  /** Aspecto visual por tramos de nivel: 1–3 empalizada, 4–6 piedra, 7–9 reforzada (comparten sprite; las estadísticas son por nivel). */
  stageBreakpoints: [3, 6, 9] as const,
};

/** Única unidad que puede guarnecer la muralla. */
export const GARRISON_UNIT: UnitType = 'arquero';
