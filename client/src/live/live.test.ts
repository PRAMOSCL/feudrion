import { describe, expect, it } from 'vitest';
import { SLOTS } from '../sceneConfig';
import { hitTestBuildings } from '../sceneGeometry';
import type { BuildingState, BuildingType, GameState } from '../types';
import { STATIONS, VILLAGER_ROAD } from './liveConfig';
import { ambientCount, buildLiveModel, figuresFor, guardsVisible, wallVisual } from './liveModel';
import { pingPong, pointAtDistance, routeLength } from './routes';
import { bandPath } from './WallLayers';

const b = (type: string, level: number, workers: number, activity: BuildingState['activity'] = null, extra: Partial<BuildingState> = {}): BuildingState =>
  ({ type, name: type, level, workers, maxLevel: 10, effect: {}, construction: null, upgrade: null, activity, ...extra }) as BuildingState;

const state = (buildings: BuildingState[], garrisonArchers = 0, population = 30): GameState =>
  ({ buildings, garrison: { archers: garrisonArchers, capacity: 8, availableArchers: 0 }, population: { current: population } }) as unknown as GameState;

const ok = { producing: true, reason: 'ok', resource: 'wood' } as const;

describe('actividad visual ligada a datos reales', () => {
  it('workers 0 → sin figuras; 20 asignados → solo 3 representantes (no una por trabajador)', () => {
    expect(figuresFor(0, true)).toBe(0);
    expect(figuresFor(1, true)).toBe(1);
    expect(figuresFor(7, true)).toBe(1);
    expect(figuresFor(8, true)).toBe(2);
    expect(figuresFor(20, true)).toBe(3);
    expect(figuresFor(500, true)).toBe(3);
  });

  it('producción parada (almacén lleno, sin trabajadores, sin construir) → nadie trabaja', () => {
    expect(figuresFor(20, false)).toBe(0);
    const m = buildLiveModel(state([b('sawmill', 5, 20, { producing: false, reason: 'storage_full', resource: 'wood' }), b('wall', 0, 0)]));
    expect(m.workers).toEqual([]);
    const m2 = buildLiveModel(state([b('sawmill', 5, 20, ok), b('wall', 0, 0)]));
    expect(m2.workers).toEqual([{ building: 'sawmill', figures: 3 }]);
  });

  it('un edificio en nivel 0 nunca muestra trabajadores aunque tenga asignados', () => {
    const m = buildLiveModel(state([b('sawmill', 0, 10, ok), b('wall', 0, 0)]));
    expect(m.workers).toEqual([]);
  });

  it('guardias: sin muralla no hay patrulla aunque haya arqueros; lo visible está acotado por el aspecto, no por los efectivos', () => {
    expect(guardsVisible(20, 0)).toBe(0);
    expect(guardsVisible(0, 3)).toBe(0);
    expect(guardsVisible(20, 1)).toBe(2);
    expect(guardsVisible(20, 2)).toBe(4);
    expect(guardsVisible(20, 3)).toBe(6);
    expect(guardsVisible(3, 3)).toBe(3);
    const wall = b('wall', 3, 0, null, { effect: { wallStage: 1 } });
    expect(buildLiveModel(state([wall], 0)).guards).toBe(0);
    expect(buildLiveModel(state([wall], 12)).guards).toBe(2);
    expect(buildLiveModel(state([b('wall', 0, 0)], 12)).guards).toBe(0);
  });

  it('habitantes ambientales: pocos (2–10), independientes de la población real', () => {
    expect(ambientCount(0)).toBe(2);
    expect(ambientCount(12)).toBe(4);
    expect(ambientCount(5000)).toBe(10);
  });

  it('la muralla no cuenta entre los edificios con parcela', () => {
    const m = buildLiveModel(state([b('castle', 2, 0), b('wall', 4, 0, null, { effect: { wallStage: 2 } })]));
    expect(m.built).toEqual(['castle']);
    expect(m.wallStage).toBe(2);
  });
});

describe('estados visuales de la muralla', () => {
  const wall = (level: number, construction: BuildingState['construction'], stage = 0) =>
    b('wall', level, 0, null, { construction, effect: { wallStage: stage as 0 } });

  it('sin construir → ningún overlay', () => {
    expect(wallVisual(wall(0, null), 0)).toEqual({ stage: 0, reveal: null });
  });
  it('construyendo (nivel 0): revela por tramos según el progreso; no regala la defensa completa', () => {
    const c = { targetLevel: 1, startedAt: 0, finishesAt: 600 };
    expect(wallVisual(wall(0, c), 0).reveal).toEqual({ stage: 1, sections: 0 });
    expect(wallVisual(wall(0, c), 300).reveal).toEqual({ stage: 1, sections: 3 });
    expect(wallVisual(wall(0, c), 599).reveal?.sections).toBe(5);
    expect(wallVisual(wall(0, c), 300).stage).toBe(0);
  });
  it('mejorando (nivel > 0): se conserva el overlay vigente hasta terminar', () => {
    const c = { targetLevel: 4, startedAt: 0, finishesAt: 600 };
    expect(wallVisual(wall(3, c, 1), 300)).toEqual({ stage: 1, reveal: null });
    expect(wallVisual(wall(4, null, 2), 0)).toEqual({ stage: 2, reveal: null });
  });
});

describe('rutas', () => {
  const route = [[0, 0], [100, 0], [100, 100]] as const;

  it('longitud y punto a distancia', () => {
    expect(routeLength(route)).toBe(200);
    const p = pointAtDistance(route, 150);
    expect(p.x).toBe(100);
    expect(p.y).toBeCloseTo(50, 6);
  });

  it('ida y vuelta: determinista, sin saltos y con pausa de giro en los extremos', () => {
    const speed = 50; // 4 s por pasada
    const opts = { turnPause: 1 };
    const a = pingPong(route, 0, speed, opts);
    expect([a.x, a.y]).toEqual([0, 0]);
    const mid = pingPong(route, 2, speed, opts);
    expect([mid.x, mid.y]).toEqual([100, 0]);
    const wait = pingPong(route, 4.5, speed, opts);
    expect([wait.x, wait.y, wait.moving]).toEqual([100, 100, false]);
    const back = pingPong(route, 5 + 2, speed, opts);
    expect([back.x, back.y]).toEqual([100, 0]);
    expect(pingPong(route, 123.4, speed, opts)).toEqual(pingPong(route, 123.4, speed, opts));
    let prev = pingPong(route, 0, speed, opts);
    for (let t = 0.05; t < 20; t += 0.05) {
      const q = pingPong(route, t, speed, opts);
      expect(Math.hypot(q.x - prev.x, q.y - prev.y)).toBeLessThanOrEqual(speed * 0.05 + 1e-6);
      prev = q;
    }
  });

  it('paradas: el actor espera `dwell` segundos y no se mueve', () => {
    const r = [[0, 0], [100, 0], [200, 0]] as const;
    const during = pingPong(r, 2.5, 50, { stops: [1], dwell: 2, turnPause: 0 });
    expect([during.x, during.moving]).toEqual([100, false]);
    expect(pingPong(r, 1, 50, { stops: [1], dwell: 2, turnPause: 0 }).moving).toBe(true);
  });

  it('habitantes y estaciones usan rutas válidas', () => {
    expect(VILLAGER_ROAD.length).toBeGreaterThan(2);
    for (const specs of Object.values(STATIONS)) for (const s of specs ?? []) expect(s.at || (s.path && s.path.length >= 2)).toBeTruthy();
  });
});

describe('muralla: selección e interacción', () => {
  const lv = (wall: number) => ({ castle: 1, sawmill: 0, quarry: 0, farm: 1, warehouse: 1, barracks: 0, wall }) as Record<BuildingType, number>;

  it('el portón responde aunque no haya muralla y no ocupa parcela', () => {
    const g = SLOTS.wall;
    expect(hitTestBuildings(g.x, g.y, lv(0), {})).toBe('wall');
    expect(hitTestBuildings(g.x + g.plot.rx + 6, g.y, lv(0), {})).toBeNull();
  });

  it('construida: el cuerpo de la muralla (máscara) selecciona la muralla; fuera de la silueta no', () => {
    const data = new Uint8Array(10 * 10);
    data[5 * 10 + 5] = 1; // celda (5,5) de la máscara 10×10 ≈ lienzo (768..921, 512..614)
    expect(hitTestBuildings(790, 540, lv(2), {}, { data, w: 10, h: 10 })).toBe('wall');
    expect(hitTestBuildings(100, 100, lv(2), {}, { data, w: 10, h: 10 })).toBeNull();
    expect(hitTestBuildings(790, 540, lv(0), {}, { data, w: 10, h: 10 })).toBeNull(); // sin construir la máscara no cuenta
  });

  it('un edificio delante gana sobre la muralla', () => {
    const f = SLOTS.farm;
    const mask = new Uint8Array(160 * 160).fill(1);
    const wallAll = { data: new Uint8Array(10 * 10).fill(1), w: 10, h: 10 };
    expect(hitTestBuildings(f.x, f.y - 40, lv(2), { farm: mask }, wallAll)).toBe('farm');
  });
});

describe('recortes del overlay', () => {
  it('bandPath limita la banda vertical y añade huecos con evenodd', () => {
    expect(bandPath(0, 470, 1536, [])).toBe("path(evenodd, 'M0 0 H1536 V470 H0 Z ')");
    expect(bandPath(470, 1024, 768, [[[10, 480], [20, 480], [20, 490]]])).toContain('M10 480 L20 480 L20 490 Z');
  });
});

describe('caminatas v2: atlas de rectángulos y fase por distancia', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const atlas = JSON.parse(JSON.stringify(require('./atlasV2.json')));
  it('cada hoja tiene 8 poses con rectángulo dentro de la imagen y pivote dentro de su rectángulo', () => {
    for (const [name, def] of Object.entries<any>(atlas.sheets)) {
      expect(def.frames.length, name).toBe(8);
      expect(def.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const f of def.frames) {
        const [x, y, w, h] = f.rect;
        expect(x >= 0 && y >= 0 && x + w <= def.imageSize[0] && y + h <= def.imageSize[1], name).toBe(true);
        expect(f.pivot[0] >= 0 && f.pivot[0] <= w && f.pivot[1] >= 0 && f.pivot[1] <= h, name).toBe(true);
      }
    }
  });
  it('la distancia caminada crece sin saltos en ida y vuelta y se congela en paradas y giros', () => {
    const route = [[0, 0], [100, 0]] as const;
    let prev = pingPong(route, 0, 50, { turnPause: 1, stops: [], dwell: 0 }).walked;
    for (let t = 0.05; t < 6; t += 0.05) {
      const w = pingPong(route, t, 50, { turnPause: 1 }).walked;
      expect(w).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(w - prev).toBeLessThanOrEqual(50 * 0.05 + 1e-6);
      prev = w;
    }
    expect(pingPong(route, 2.5, 50, { turnPause: 1 }).walked).toBeCloseTo(100, 6); // pausa de giro: congelada
    expect(pingPong(route, 3.5, 50, { turnPause: 1 }).walked).toBeCloseTo(125, 6); // ya vuelve
    expect(pingPong(route, 5, 50, { turnPause: 1 }).walked).toBeGreaterThan(100); // vuelta
    expect(pingPong(route, 5, 50, { turnPause: 1 }).moving).toBe(true);
  });
});
