import { describe, expect, it } from 'vitest';
import { GuardTracker, OCCLUSION } from './guards';
import { PATROL_CIRCUITS, circuitLength, sampleCircuit, segmentLength, validateCircuit, type PatrolCircuit, type PatrolSegment } from './patrolCircuit';
import * as cfg from './liveConfig';
import { GATE_CROSSING, GUARD_SPEED, VILLAGER_ROAD, VILLAGER_STOPS } from './liveConfig';

/** Circuito SINTÉTICO (rectángulo) solo para probar el validador: no son coordenadas del juego. */
const seg = (id: string, side: PatrolSegment['side'], kind: PatrolSegment['kind'], feet: [number, number][], next: string[]): PatrolSegment => ({
  id,
  side,
  kind,
  feet,
  visibility: kind === 'tower_pass' ? 'hidden' : 'visible',
  layer: side === 'south' ? 'front' : 'back',
  spriteHeight: 25,
  next,
});
const good = (): PatrolCircuit => ({
  stage: 2,
  segments: [
    seg('n', 'north', 'wall_walk', [[0, 0], [100, 0]], ['t1']),
    seg('t1', 'north', 'tower_pass', [[100, 0], [110, 0]], ['e']),
    seg('e', 'east', 'wall_walk', [[110, 0], [110, 100]], ['t2']),
    seg('t2', 'east', 'tower_pass', [[110, 100], [110, 110]], ['g']),
    seg('g', 'south', 'gate_platform', [[110, 110], [60, 110]], ['s']),
    seg('s', 'south', 'wall_walk', [[60, 110], [0, 110]], ['t3']),
    seg('t3', 'south', 'tower_pass', [[0, 110], [0, 100]], ['w']),
    seg('w', 'west', 'wall_walk', [[0, 100], [0, 10]], ['t4']),
    seg('t4', 'west', 'tower_pass', [[0, 10], [0, 0]], ['n']),
  ],
});

describe('registro de patrulla completa', () => {
  it('los tres circuitos v3 son válidos y cerrados, con 19 segmentos y 9 pasos ocultos por torre', () => {
    for (const st of [1, 2, 3] as const) {
      const c = PATROL_CIRCUITS[st];
      expect(c.segments.length).toBe(19);
      expect(validateCircuit(c)).toEqual([]);
      expect(c.segments.filter((x) => x.visibility === 'hidden').length).toBe(9);
    }
  });
  it('la ruta norte antigua ya no existe', () => {
    expect((cfg as Record<string, unknown>).PATROL_ROUTES).toBeUndefined();
  });
  it('cada tramo visible tiene máscara de oclusión; el muestreo es continuo y de velocidad uniforme', () => {
    for (const st of [1, 2, 3] as const) {
      const c = PATROL_CIRCUITS[st];
      const total = circuitLength(c);
      for (const s of c.segments.filter((x) => x.kind !== 'tower_pass')) expect(OCCLUSION[String(st)][s.id], `${st}/${s.id}`).toBeDefined();
      let prev = sampleCircuit(c, 0);
      for (let d = 1; d <= total; d += 1) {
        const p = sampleCircuit(c, d);
        expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(1.01);
        prev = p;
      }
      const w = sampleCircuit(c, total);
      expect(Math.hypot(w.x - sampleCircuit(c, 0).x, w.y - sampleCircuit(c, 0).y)).toBeLessThan(0.01);
    }
  });
  it('el guardia avanza GUARD_SPEED·Δt por distancia, también en pasos ocultos, y conserva el progreso', () => {
    const tr = new GuardTracker();
    tr.sync(2, 2, PATROL_CIRCUITS, 0, GUARD_SPEED);
    const a = tr.poses(PATROL_CIRCUITS[2], 10, GUARD_SPEED);
    tr.sync(2, 2, PATROL_CIRCUITS, 10, GUARD_SPEED); // refresco del estado: no reinicia
    const b = tr.poses(PATROL_CIRCUITS[2], 10, GUARD_SPEED);
    expect(b.map((g) => g.distance)).toEqual(a.map((g) => g.distance));
    const c = tr.poses(PATROL_CIRCUITS[2], 14, GUARD_SPEED);
    expect(c[0].distance - b[0].distance).toBeCloseTo(4 * GUARD_SPEED, 6);
    // recorre todo el circuito: hay instantes ocultos (torres) y cambios de capa
    const layers = new Set<string>();
    let hidden = 0;
    for (let t = 0; t < circuitLength(PATROL_CIRCUITS[2]) / GUARD_SPEED; t += 0.5) {
      const g = tr.poses(PATROL_CIRCUITS[2], t, GUARD_SPEED)[0];
      layers.add(g.layer);
      if (!g.visible) hidden++;
    }
    expect(layers).toEqual(new Set(['back', 'front']));
    expect(hidden).toBeGreaterThan(0);
  });
  it('sin muralla o sin arqueros no hay guardias; al cambiar de etapa se conserva la fracción', () => {
    const tr = new GuardTracker();
    tr.sync(0, 3, PATROL_CIRCUITS, 0, GUARD_SPEED);
    expect(tr.count).toBe(0);
    tr.sync(1, 0, PATROL_CIRCUITS, 0, GUARD_SPEED);
    expect(tr.count).toBe(0);
    tr.sync(1, 1, PATROL_CIRCUITS, 5, GUARD_SPEED);
    const f1 = (tr.poses(PATROL_CIRCUITS[1], 5, GUARD_SPEED)[0].distance % circuitLength(PATROL_CIRCUITS[1])) / circuitLength(PATROL_CIRCUITS[1]);
    tr.sync(2, 1, PATROL_CIRCUITS, 5, GUARD_SPEED);
    const f2 = (tr.poses(PATROL_CIRCUITS[2], 5, GUARD_SPEED)[0].distance % circuitLength(PATROL_CIRCUITS[2])) / circuitLength(PATROL_CIRCUITS[2]);
    expect(f2).toBeCloseTo(f1, 6);
  });
  it('los ciudadanos entran por la ruta del paquete v3 (puente→interior)', () => {
    expect(VILLAGER_ROAD.length).toBeGreaterThan(5);
    expect(VILLAGER_STOPS).toEqual([5, 25, 30]);
    expect(VILLAGER_ROAD[0]).toEqual([1524, 977]); // prefijo exterior v3.1
    expect(VILLAGER_ROAD[13]).toEqual([1236, 705]); // punto de unión sin duplicar
    expect(VILLAGER_ROAD[14]).not.toEqual([1236, 705]);
    expect(VILLAGER_ROAD[VILLAGER_STOPS[1]]).toEqual([700, 322]); // paradas interiores: mismos puntos que antes del parche
    expect(VILLAGER_ROAD[VILLAGER_STOPS[2]]).toEqual([402, 368]);
    expect(GATE_CROSSING.length).toBeGreaterThan(1);
  });
  it('un circuito cerrado y continuo es válido', () => {
    expect(validateCircuit(good())).toEqual([]);
    expect(circuitLength(good())).toBeGreaterThan(400);
    expect(segmentLength(good().segments[0])).toBe(100);
  });
  it('detecta saltos de pies, conexiones inexistentes y circuitos abiertos', () => {
    const jump = good();
    (jump.segments[2].feet as unknown as [number, number][])[0] = [150, 0];
    expect(validateCircuit(jump).some((m) => m.includes('saltan'))).toBe(true);

    const dangling = good();
    (dangling.segments[0] as unknown as { next: string[] }).next = ['no-existe'];
    expect(validateCircuit(dangling).some((m) => m.includes('no existe'))).toBe(true);

    const open = good();
    (open.segments[8] as unknown as { next: string[] }).next = [];
    expect(validateCircuit(open).some((m) => m.includes('no es cerrado'))).toBe(true);
  });
  it('exige los cuatro lados, la plataforma del portón y pasos por torres ocultos', () => {
    const noGate = good();
    noGate.segments = noGate.segments.filter((s) => s.kind !== 'gate_platform');
    expect(validateCircuit(noGate).some((m) => m.includes('portón'))).toBe(true);
    const noWest = good();
    noWest.segments = noWest.segments.filter((s) => s.side !== 'west');
    expect(validateCircuit(noWest).some((m) => m.includes('west'))).toBe(true);
    const visibleTower = good();
    (visibleTower.segments[1] as unknown as { visibility: string }).visibility = 'visible';
    expect(validateCircuit(visibleTower).some((m) => m.includes('oculto'))).toBe(true);
  });
  it('detecta segmentos inalcanzables', () => {
    const c = good();
    c.segments = [...c.segments, seg('huerfano', 'north', 'wall_walk', [[500, 500], [600, 500]], ['n'])];
    expect(validateCircuit(c).some((m) => m.includes('inalcanzable'))).toBe(true);
  });
});
