import { describe, expect, it } from 'vitest';
import {
  BUILDING_TYPES,
  MAX_LEVEL,
  RESOURCES,
  requirements,
  upgradeCost,
  upgradeSeconds,
  warehouseCapacity,
} from '../src/config/balance.js';

describe('balance', () => {
  it('los primeros tres niveles de cada edificio están entre 30 y 120 segundos y crecen gradualmente', () => {
    for (const t of BUILDING_TYPES) {
      const first = [1, 2, 3].map((l) => upgradeSeconds(t, l));
      // castillo: el nivel 1 ya existe, su primer tiempo relevante es el nivel 2
      const relevant = t === 'castle' ? first.slice(1) : first;
      expect(relevant[0]).toBeGreaterThanOrEqual(30);
      expect(Math.max(...relevant)).toBeLessThanOrEqual(120);
      for (let l = 2; l <= MAX_LEVEL; l++) expect(upgradeSeconds(t, l)).toBeGreaterThan(upgradeSeconds(t, l - 1));
    }
  });

  it('sin bloqueos: todo costo es pagable con el almacén que el propio requisito exige', () => {
    for (const t of BUILDING_TYPES) {
      for (let l = 1; l <= MAX_LEVEL; l++) {
        const cost = upgradeCost(t, l);
        const req = requirements(t, l);
        const cap = warehouseCapacity(Math.max(1, req.warehouse));
        for (const r of RESOURCES) expect(cost[r] ?? 0, `${t} nv${l} ${r}`).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('el almacén siempre puede mejorarse a sí mismo (costo del nivel n+1 ≤ capacidad del nivel n)', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      const cost = upgradeCost('warehouse', l);
      for (const r of RESOURCES) expect(cost[r] ?? 0).toBeLessThanOrEqual(warehouseCapacity(l - 1));
      expect(requirements('warehouse', l).warehouse).toBeLessThan(l);
    }
  });

  it('la cadena de requisitos no es circular: el castillo no necesita un almacén que dependa de él', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      const needW = requirements('castle', l).warehouse;
      // el almacén que pide el castillo debe poder construirse con un castillo ya alcanzado (< l)
      expect(requirements('warehouse', needW).castle).toBeLessThan(l);
    }
  });
});
