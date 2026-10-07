import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDING_TYPES } from '../src/config/balance.js';
import { DISTRICTS, DISTRICT_IDS, PLANNED_BUILDINGS, PLANNED_TYPES, PLOTS } from '../src/config/districts.js';
import { SERVER_ROOT, openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { building, createEnv, setBuildingLevel, setResources, type Env } from './helpers.js';

let env: Env | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});
const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

describe('registro de distritos y parcelas', () => {
  it('IDs únicos y estables; cada parcela pertenece a un distrito existente', () => {
    const ids = PLOTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLOTS) {
      expect(DISTRICT_IDS).toContain(p.districtId);
      expect(p.id.startsWith(`${p.districtId}:`)).toBe(true);
    }
    expect(DISTRICTS.map((d) => d.id)).toEqual([...DISTRICT_IDS]);
  });

  it('cada edificio implementado tiene exactamente una parcela en la Fortaleza (se conservan los IDs)', () => {
    for (const t of BUILDING_TYPES) {
      const plots = PLOTS.filter((p) => p.allowedTypes.includes(t));
      expect(plots.map((p) => p.id), t).toEqual([`fortress:${t}`]);
    }
  });

  it('los edificios planificados apuntan a una parcela de Villa que admite su tipo y no son edificios implementados', () => {
    for (const b of PLANNED_BUILDINGS) {
      const plot = PLOTS.find((p) => p.id === b.plotId)!;
      expect(plot.districtId).toBe('village');
      expect(plot.allowedTypes).toContain(b.type);
      expect((BUILDING_TYPES as readonly string[]).includes(b.type)).toBe(false);
      expect(b.pending.length).toBeGreaterThan(0);
    }
    for (const t of PLANNED_TYPES) expect(PLANNED_BUILDINGS.some((b) => b.type === t)).toBe(true);
  });

  it('Oficios y Campo están reservados (future) y no tienen parcelas ni escena', () => {
    for (const id of ['crafts', 'countryside'] as const) {
      expect(DISTRICTS.find((d) => d.id === id)!.status).toBe('future');
      expect(PLOTS.filter((p) => p.districtId === id)).toEqual([]);
    }
    expect(DISTRICTS.find((d) => d.id === 'village')!.status).toBe('planning');
  });
});

describe('snapshot de distritos', () => {
  it('una partida nueva coloca cada edificio en su parcela y la Villa solo muestra planificación', async () => {
    env = await createEnv();
    const s = await env.state();
    for (const t of BUILDING_TYPES) {
      const b = building(s, t);
      expect(b.districtId).toBe('fortress');
      expect(b.plotId).toBe(`fortress:${t}`);
    }
    const fortress = s.districts.find((d: any) => d.id === 'fortress');
    expect(fortress.plots.map((p: any) => p.building).sort()).toEqual([...BUILDING_TYPES].sort());
    const village = s.districts.find((d: any) => d.id === 'village');
    expect(village.status).toBe('planning');
    expect(village.plots.every((p: any) => p.building === null)).toBe(true);
    expect(village.planned.every((p: any) => p.status === 'planned')).toBe(true);
  });

  it('abrir la Villa no suma edificios, recursos, defensa ni población a la ciudad real', async () => {
    env = await createEnv();
    const s = await env.state();
    expect(s.buildings.map((b: any) => b.type).sort()).toEqual([...BUILDING_TYPES].sort());
    expect(env.db.prepare('SELECT COUNT(*) n FROM buildings').get()).toEqual({ n: BUILDING_TYPES.length });
    expect(s.garrison.capacity).toBe(0);
    expect(s.resources.gold.ratePerMinute).toBeGreaterThan(0); // la economía sigue siendo la misma de siempre
  });

  it('los edificios planificados NO se pueden construir ni consumen recursos', async () => {
    env = await createEnv();
    setResources(env, { wood: 900, stone: 900, gold: 900, food: 900 });
    const before = await env.state();
    for (const type of PLANNED_TYPES) {
      const r = await env.api('POST', `/api/buildings/${type}/upgrade`, {}, idem());
      expect(r.status, type).toBe(409);
      expect(r.json.error.code).toBe('PLANNED_ONLY');
      expect(r.json.error.message).toMatch(/planificado/);
    }
    const after = await env.state();
    expect(after.resources.wood.amount).toBeGreaterThanOrEqual(before.resources.wood.amount);
    expect(env.db.prepare('SELECT COUNT(*) n FROM constructions').get()).toEqual({ n: 0 });
    expect(env.db.prepare('SELECT COUNT(*) n FROM buildings').get()).toEqual({ n: BUILDING_TYPES.length });
  });

  it('la construcción de un edificio existente sigue funcionando y no duplica filas ni parcelas', async () => {
    env = await createEnv();
    const r = await env.api('POST', '/api/buildings/sawmill/upgrade', {}, idem());
    expect(r.status).toBe(200);
    env.clock.now += 5 * 60_000;
    const s = await env.state();
    expect(building(s, 'sawmill').level).toBe(1);
    expect(building(s, 'sawmill').plotId).toBe('fortress:sawmill');
    expect(env.db.prepare('SELECT COUNT(*) n FROM buildings').get()).toEqual({ n: BUILDING_TYPES.length });
    setBuildingLevel(env, 'sawmill', 1, 3);
  });

  it('el índice único impide dos edificios en la misma parcela', async () => {
    env = await createEnv();
    expect(() =>
      env!.db.prepare("INSERT INTO buildings (city_id, type, level, workers, district_id, plot_id) VALUES (?, 'house', 0, 0, 'village', 'fortress:castle')").run(env!.cityId),
    ).toThrow();
  });
});

describe('migración 003 sobre un guardado con la muralla y la guarnición (estado real de la partida)', () => {
  it('anota distrito y parcela sin tocar niveles, trabajadores, recursos, tropas, guarnición ni informes', () => {
    const db = openDatabase(':memory:');
    const dir = path.join(SERVER_ROOT, 'migrations');
    db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
    for (const f of ['001_init.sql', '002_wall_garrison.sql']) {
      db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      db.prepare('INSERT INTO schema_migrations VALUES (?, 1)').run(f);
    }
    db.prepare("INSERT INTO players (id, name, created_at) VALUES (1, 'x', 1)").run();
    db.prepare('INSERT INTO cities (id, player_id, name, last_update_at, wood, stone, food, gold, population, created_at, garrison_archers) VALUES (1,1,?,5,1688.5,1688,1688,1688,120,1,6)').run('Mi villa');
    db.prepare('DELETE FROM buildings').run();
    for (const [t, l, w] of [['castle', 4, 0], ['sawmill', 1, 5], ['quarry', 1, 5], ['farm', 1, 4], ['warehouse', 4, 0], ['barracks', 2, 0], ['wall', 4, 0]] as const) {
      db.prepare('INSERT INTO buildings (city_id, type, level, workers) VALUES (1,?,?,?)').run(t, l, w);
    }
    db.prepare("INSERT INTO troops VALUES (1,'lancero',14)").run();
    db.prepare("INSERT INTO troops VALUES (1,'arquero',3)").run();

    expect(migrate(db)).toEqual(['003_districts.sql']);

    const rows = db.prepare('SELECT type, level, workers, district_id d, plot_id p FROM buildings ORDER BY type').all();
    expect(rows).toEqual([
      { type: 'barracks', level: 2, workers: 0, d: 'fortress', p: 'fortress:barracks' },
      { type: 'castle', level: 4, workers: 0, d: 'fortress', p: 'fortress:castle' },
      { type: 'farm', level: 1, workers: 4, d: 'fortress', p: 'fortress:farm' },
      { type: 'quarry', level: 1, workers: 5, d: 'fortress', p: 'fortress:quarry' },
      { type: 'sawmill', level: 1, workers: 5, d: 'fortress', p: 'fortress:sawmill' },
      { type: 'wall', level: 4, workers: 0, d: 'fortress', p: 'fortress:wall' },
      { type: 'warehouse', level: 4, workers: 0, d: 'fortress', p: 'fortress:warehouse' },
    ]);
    expect(db.prepare('SELECT wood, stone, food, gold, population, garrison_archers g FROM cities').get()).toEqual({
      wood: 1688.5, stone: 1688, food: 1688, gold: 1688, population: 120, g: 6,
    });
    expect(db.prepare('SELECT unit_type, quantity FROM troops ORDER BY unit_type').all()).toEqual([
      { unit_type: 'arquero', quantity: 3 },
      { unit_type: 'lancero', quantity: 14 },
    ]);
    expect(migrate(db)).toEqual([]); // idempotente
    db.close();
  });
});
