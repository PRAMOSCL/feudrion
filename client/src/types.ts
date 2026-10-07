// Forma del JSON que entrega GET /api/state (el servidor es la fuente de verdad).

export type ResourceKey = 'wood' | 'stone' | 'food' | 'gold';
export type BuildingType = 'castle' | 'sawmill' | 'quarry' | 'farm' | 'warehouse' | 'barracks' | 'wall';
/** Edificios que ocupan una parcela del terreno (la muralla es infraestructura del perímetro). */
export type PlotBuilding = Exclude<BuildingType, 'wall'>;
export type UnitType = 'lancero' | 'arquero' | 'espadachin' | 'ballestero';
export type Cost = Partial<Record<ResourceKey, number>>;
export type Loot = Record<ResourceKey, number>;
export type UnitCounts = Record<UnitType, number>;

export interface ResourceState {
  amount: number;
  capacity: number;
  ratePerMinute: number;
}

export interface BuildingEffect {
  maxPopulation?: number;
  goldPerMinute?: number;
  capacity?: number;
  unlockedUnits?: UnitType[];
  recruitTimeFactor?: number;
  resource?: ResourceKey;
  slots?: number;
  perWorkerPerMinute?: number;
  /** Muralla */
  garrisonCapacity?: number;
  defenseBonusPct?: number;
  wallStage?: 0 | 1 | 2 | 3;
}

/** Actividad productiva REAL (la misma condición que gobierna la economía): la animación solo trabaja si `producing`. */
export interface BuildingActivity {
  producing: boolean;
  reason: 'ok' | 'no_workers' | 'storage_full' | 'not_built';
  resource: ResourceKey;
}

export interface UpgradeInfo {
  targetLevel: number;
  cost: Cost;
  seconds: number;
  requirements: { building: BuildingType; required: number; current: number; met: boolean }[];
  missing: Partial<Record<ResourceKey, number>>;
  canStart: boolean;
  blockedReason: string | null;
  effect: BuildingEffect;
}

export interface PlannedBuildingState {
  type: string;
  name: string;
  plotId: string;
  phase: number;
  status: 'planned';
  pending: string[];
}

export interface DistrictState {
  id: 'fortress' | 'village' | 'crafts' | 'countryside';
  name: string;
  status: 'active' | 'planning' | 'future';
  description: string;
  plots: { id: string; allowedTypes: string[]; building: BuildingType | null }[];
  planned: PlannedBuildingState[];
}

export interface BuildingState {
  type: BuildingType;
  districtId: string;
  plotId: string;
  name: string;
  level: number;
  workers: number;
  maxLevel: number;
  effect: BuildingEffect;
  construction: { targetLevel: number; startedAt: number; finishesAt: number } | null;
  upgrade: UpgradeInfo | null;
  activity: BuildingActivity | null;
}

export interface UnitState {
  type: UnitType;
  name: string;
  unlockBarracks: number;
  unlocked: boolean;
  cost: Cost;
  secondsPerUnit: number;
  attack: number;
  defense: number;
  carry: number;
  speed: number;
  home: number;
}

export interface ExpeditionState {
  id: number;
  camp: string;
  status: 'outbound' | 'returning';
  sentAt: number;
  arriveAt: number;
  returnAt: number;
  result: 'victory' | 'defeat' | null;
  units: Partial<Record<UnitType, { sent: number; lost: number }>>;
  loot: Loot | null;
}

export interface CampState {
  key: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  attack: number;
  defense: number;
  travelSeconds: number;
  loot: Loot;
  map: { x: number; y: number };
}

export interface ReportState {
  id: number;
  camp: string;
  result: 'victory' | 'defeat';
  createdAt: number;
  sent: UnitCounts;
  lost: UnitCounts;
  survivors: UnitCounts;
  loot: Loot;
  delivered: Loot | null;
  deliveredAt: number | null;
  details: {
    ourAttack: number;
    ourDefense: number;
    campAttack: number;
    campDefense: number;
    ratio: number;
    lossFraction: number;
    carryCapacity: number;
  };
}

export interface GameState {
  serverTime: number;
  city: { id: number; name: string; player: string };
  resources: Record<ResourceKey, ResourceState>;
  population: { current: number; max: number; workers: number; free: number; growthPerMinute: number };
  buildings: BuildingState[];
  /** Distritos y parcelas (fase 2). Solo ubicación y planificación; los planificados no son mecánicas. */
  districts: DistrictState[];
  garrison: { archers: number; capacity: number; availableArchers: number };
  units: UnitState[];
  recruitQueue: { id: number; unit: UnitType; quantity: number; startedAt: number; finishesAt: number }[];
  expeditions: ExpeditionState[];
  reports: ReportState[];
  camps: CampState[];
  rules: {
    maxLevel: number;
    goldPerFreeInhabitantPerMinute: number;
    populationGrowthPerMinute: number;
    recruitMaxQuantity: number;
    recruitMaxQueue: number;
    wall: { garrisonPerLevel: number; defenseBonusPerLevelPct: number; maxLevel: number };
  };
}
