import { COMBAT, RESOURCES, UNITS, UNIT_TYPES, type CampDef, type ResourceKey, type UnitType } from '../config/balance.js';

export type UnitCounts = Record<UnitType, number>;
export type Loot = Record<ResourceKey, number>;

export const emptyUnits = (): UnitCounts => ({ lancero: 0, arquero: 0, espadachin: 0, ballestero: 0 });
export const emptyLoot = (): Loot => ({ wood: 0, stone: 0, food: 0, gold: 0 });

export interface CombatOutcome {
  result: 'victory' | 'defeat';
  ourAttack: number;
  ourDefense: number;
  ratio: number;
  lossFraction: number;
  lost: UnitCounts;
  survivors: UnitCounts;
  carryCapacity: number;
  loot: Loot;
}

export function armyAttack(units: UnitCounts): number {
  return UNIT_TYPES.reduce((s, u) => s + units[u] * UNITS[u].attack, 0);
}
export function armyDefense(units: UnitCounts): number {
  return UNIT_TYPES.reduce((s, u) => s + units[u] * UNITS[u].defense, 0);
}
export function armyCarry(units: UnitCounts): number {
  return UNIT_TYPES.reduce((s, u) => s + units[u] * UNITS[u].carry, 0);
}

/** Segundos de viaje (ida): el ejército marcha al ritmo de su unidad más lenta. */
export function travelSeconds(camp: CampDef, units: UnitCounts): number {
  const speeds = UNIT_TYPES.filter((u) => units[u] > 0).map((u) => UNITS[u].speed);
  return Math.max(1, Math.round(camp.travelSeconds / Math.min(...speeds)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Resolución determinista del combate. Ver la descripción de `COMBAT` en la configuración. */
export function resolveCombat(sent: UnitCounts, camp: CampDef): CombatOutcome {
  const ourAttack = armyAttack(sent);
  const ourDefense = armyDefense(sent);
  const ratio = ourAttack / camp.defense;
  const victory = ratio >= 1;

  const lossFraction = victory
    ? clamp(
        (COMBAT.winLossScale * (camp.attack / (camp.attack + ourDefense))) / Math.pow(ratio, 1.5),
        COMBAT.winLossMin,
        COMBAT.winLossMax,
      )
    : clamp(0.5 + 0.5 * (1 - ratio), COMBAT.defeatLossMin, COMBAT.defeatLossMax);

  const lost = emptyUnits();
  const survivors = emptyUnits();
  for (const u of UNIT_TYPES) {
    lost[u] = Math.min(sent[u], Math.round(sent[u] * lossFraction));
    survivors[u] = sent[u] - lost[u];
  }

  const carryCapacity = armyCarry(survivors);
  const loot = emptyLoot();
  if (victory) {
    const potentialTotal = RESOURCES.reduce((s, r) => s + camp.loot[r], 0);
    const scale = Math.min(1, carryCapacity / potentialTotal);
    for (const r of RESOURCES) loot[r] = Math.floor(camp.loot[r] * scale);
  }
  return { result: victory ? 'victory' : 'defeat', ourAttack, ourDefense, ratio, lossFraction, lost, survivors, carryCapacity, loot };
}
