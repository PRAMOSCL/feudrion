import { GARRISON_UNIT, UNITS, UNIT_TYPES, WALL } from '../config/balance.js';
import type { UnitCounts } from './combat.js';

/**
 * Defensa de la ciudad (reglas PURAS).
 *
 * IMPORTANTE: en esta V1 NO existe ningún ataque contra la ciudad, así que estas funciones todavía no se usan
 * en ningún combate real. Solo exponen las estadísticas de la muralla y un cálculo verificable para una futura
 * integración de invasiones. No afectan a las expediciones ofensivas del jugador.
 */

/** Capacidad de guarnición: 0 si la muralla no está construida. */
export const garrisonCapacity = (wallLevel: number): number => (wallLevel > 0 ? WALL.garrisonPerLevel * wallLevel : 0);

/** Multiplicador único sobre la defensa base del defensor (1 sin muralla). */
export const wallDefenseMultiplier = (wallLevel: number): number => 1 + (wallLevel > 0 ? WALL.defenseBonusPerLevel * wallLevel : 0);

/** Aspecto visual: 0 = sin muralla, 1 = empalizada, 2 = piedra, 3 = reforzada. */
export function wallStage(wallLevel: number): 0 | 1 | 2 | 3 {
  if (wallLevel <= 0) return 0;
  const [a, b] = WALL.stageBreakpoints;
  return wallLevel <= a ? 1 : wallLevel <= b ? 2 : 3;
}

export interface DefenderStrength {
  /** Σ defensa de las tropas en casa y de los arqueros de guarnición (sin muralla). */
  baseDefense: number;
  multiplier: number;
  /** baseDefense × multiplicador (la bonificación se aplica una sola vez). */
  totalDefense: number;
}

/**
 * Defensa del defensor ante una hipotética invasión. Los arqueros de guarnición solo cuentan si la muralla existe y
 * hasta su capacidad; cuenta la guarnición REAL, no los sprites visibles.
 */
export function defenderStrength(homeTroops: UnitCounts, garrisonArchers: number, wallLevel: number): DefenderStrength {
  const garrison = Math.min(Math.max(0, Math.floor(garrisonArchers)), garrisonCapacity(wallLevel));
  let base = garrison * UNITS[GARRISON_UNIT].defense;
  for (const u of UNIT_TYPES) base += homeTroops[u] * UNITS[u].defense;
  const multiplier = wallDefenseMultiplier(wallLevel);
  return { baseDefense: base, multiplier, totalDefense: base * multiplier };
}
