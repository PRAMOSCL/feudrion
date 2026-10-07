import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WALL, maxLevelOf, requirements, upgradeCost, upgradeSeconds } from '../src/config/balance.js';
import { SERVER_ROOT, openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { defenderStrength, garrisonCapacity, wallDefenseMultiplier, wallStage } from '../src/game/defense.js';
import { MIN, SEC, T0, building, createEnv, setBuildingLevel, setResources, unit, type Env } from './helpers.js';

let env: Env | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});
const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });
const setTroops = (e: Env, unitType: string, n: number) =>
  e.db.prepare('UPDATE troops SET quantity = ? WHERE city_id = ? AND unit_type = ?').run(n, e.cityId, unitType);
const garrisonOf = (e: Env) => (e.db.prepare('SELECT garrison_archers n FROM cities WHERE id = ?').get(e.cityId) as { n: number }).n;
const homeArchers = (e: Env) =>
  (e.db.prepare("SELECT quantity n FROM troops WHERE city_id = ? AND unit_type = 'arquero'").get(e.cityId) as { n: number }).n;
const awayArchers = (e: Env) =>
  (e.db.prepare("SELECT COALESCE(SUM(u.sent - u.lost), 0) n FROM expedition_units u JOIN expeditions x ON x.id = u.expedition_id WHERE x.status != 'completed' AND u.unit_type = 'arquero'").get() as { n: number }).n;
/** Invariante: arqueros totales = libres en casa + guarnición + en expedición. */
const totalArchers = (e: Env) => homeArchers(e) + garrisonOf(e) + awayArchers(e);

describe('muralla: reglas puras', () => {
  it('capacidad 4×nivel (0 sin muralla), defensa +5 % por nivel una sola vez y aspecto por tramos', () => {
    expect(garrisonCapacity(0)).toBe(0);
    expect(garrisonCapacity(5)).toBe(20);
    expect(wallDefenseMultiplier(0)).toBe(1);
    expect(wallDefenseMultiplier(4)).toBeCloseTo(1.2, 10);
    expect([0, 1, 3, 4, 6, 7, 9].map(wallStage)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(maxLevelOf('wall')).toBe(9);
  });

  it('defenderStrength: la bonificación se aplica una vez sobre la defensa base y la guarnición se limita a la capacidad', () => {
    const home = { lancero: 10, arquero: 0, espadachin: 0, ballestero: 0 }; // defensa 9 c/u = 90
    expect(defenderStrength(home, 0, 0)).toEqual({ baseDefense: 90, multiplier: 1, totalDefense: 90 });
    const withWall = defenderStrength(home, 8, 2); // 8 arqueros × 4 + 90 = 122, ×1,10
    expect(withWall.baseDefense).toBe(122);
    expect(withWall.totalDefense).toBeCloseTo(122 * 1.1, 6);
    // sin muralla la guarnición no cuenta; por encima de la capacidad tampoco
    expect(defenderStrength(home, 8, 0).baseDefense).toBe(90);
    expect(defenderStrength(home, 99, 1).baseDefense).toBe(90 + 4 * WALL.garrisonPerLevel);
  });

  it('costos y tiempos de la muralla siguen la escala del proyecto y no bloquean', () => {
    expect(upgradeSeconds('wall', 1)).toBeGreaterThanOrEqual(30);
    expect(upgradeSeconds('wall', 3)).toBeLessThanOrEqual(120);
    for (let l = 2; l <= 9; l++) expect(upgradeSeconds('wall', l)).toBeGreaterThan(upgradeSeconds('wall', l - 1));
    expect(upgradeCost('wall', 1).stone).toBeGreaterThan(upgradeCost('wall', 1).wood!);
    expect(requirements('wall', 1).castle).toBe(2);
  });
});

describe('muralla: construcción y evolución', () => {
  it('una partida nueva empieza sin muralla, sin guarnición y sin bonus', async () => {
    env = await createEnv();
    const s = await env.state();
    const wall = building(s, 'wall');
    expect(wall.level).toBe(0);
    expect(wall.effect).toEqual({ garrisonCapacity: 0, defenseBonusPct: 0, wallStage: 0 });
    expect(s.garrison).toEqual({ archers: 0, capacity: 0, availableArchers: 0 });
    expect(wall.maxLevel).toBe(9);
  });

  it('exige castillo 2; al construir no hay defensa hasta terminar; al mejorar se conserva la vigente', async () => {
    env = await createEnv();
    const blocked = await env.api('POST', '/api/buildings/wall/upgrade', {}, idem());
    expect(blocked.status).toBe(409);
    expect(blocked.json.error.message).toMatch(/Castillo nivel 2/);

    setBuildingLevel(env, 'castle', 2);
    setResources(env, { wood: 500, stone: 500, gold: 500 });
    expect((await env.api('POST', '/api/buildings/wall/upgrade', {}, idem())).status).toBe(200);

    env.clock.now = T0 + 30 * SEC; // a mitad de obra
    let s = await env.state();
    expect(building(s, 'wall').level).toBe(0);
    expect(building(s, 'wall').construction?.targetLevel).toBe(1);
    expect(building(s, 'wall').effect.garrisonCapacity).toBe(0); // sin defensa regalada

    env.clock.now = T0 + 5 * MIN;
    s = await env.state();
    expect(building(s, 'wall').level).toBe(1);
    expect(building(s, 'wall').effect).toEqual({ garrisonCapacity: 4, defenseBonusPct: 5, wallStage: 1 });

    // mejora a nivel 2: durante la obra sigue valiendo el nivel 1
    setResources(env, { wood: 900, stone: 900, gold: 900 });
    expect((await env.api('POST', '/api/buildings/wall/upgrade', {}, idem())).status).toBe(200);
    s = await env.state();
    expect(building(s, 'wall').level).toBe(1);
    expect(building(s, 'wall').effect.garrisonCapacity).toBe(4);
    expect(building(s, 'wall').construction?.targetLevel).toBe(2);
    // una sola obra activa por ciudad (la muralla comparte el bloqueo)
    expect((await env.api('POST', '/api/buildings/sawmill/upgrade', {}, idem())).json.error.code).toBe('CONSTRUCTION_BUSY');
  });

  it('no ocupa parcela: el resto de edificios no cambia al construirla', async () => {
    env = await createEnv();
    setBuildingLevel(env, 'castle', 2);
    setResources(env, { wood: 500, stone: 500, gold: 500 });
    const before = await env.state();
    await env.api('POST', '/api/buildings/wall/upgrade', {}, idem());
    env.clock.now = T0 + 10 * MIN;
    const after = await env.state();
    for (const b of ['sawmill', 'quarry', 'farm', 'warehouse', 'barracks']) expect(building(after, b).level).toBe(building(before, b).level);
  });
});

describe('guarnición de arqueros', () => {
  async function ready(wallLevel = 2): Promise<Env> {
    const e = await createEnv();
    setBuildingLevel(e, 'wall', wallLevel);
    setBuildingLevel(e, 'barracks', 2);
    setTroops(e, 'arquero', 10);
    return e;
  }

  it('sin muralla no hay guarnición', async () => {
    env = await createEnv();
    setTroops(env, 'arquero', 5);
    const r = await env.api('POST', '/api/garrison', { archers: 2 }, idem());
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('NO_WALL');
  });

  it('valida enteros, capacidad del nivel y arqueros reales; mantiene el invariante total = libres + guarnición', async () => {
    env = await ready(2); // capacidad 8
    for (const archers of [-1, 1.5, '3', null]) {
      expect((await env.api('POST', '/api/garrison', { archers }, idem())).status, JSON.stringify(archers)).toBe(400);
    }
    expect((await env.api('POST', '/api/garrison', { archers: 9 }, idem())).json.error.code).toBe('GARRISON_CAPACITY');

    expect((await env.api('POST', '/api/garrison', { archers: 6 }, idem())).status).toBe(200);
    let s = await env.state();
    expect(s.garrison).toEqual({ archers: 6, capacity: 8, availableArchers: 4 });
    expect(unit(s, 'arquero').home).toBe(4);
    expect(totalArchers(env)).toBe(10);

    // pedir más de los libres falla y no cambia nada
    setTroops(env, 'arquero', 1); // quedan 1 libre + 6 en guarnición
    const fail = await env.api('POST', '/api/garrison', { archers: 8 }, idem()); // necesita 2 más y solo hay 1
    expect(fail.status).toBe(409);
    expect(fail.json.error.code).toBe('NOT_ENOUGH_TROOPS');
    expect(garrisonOf(env)).toBe(6);
    expect(homeArchers(env)).toBe(1);

    // liberar devuelve las tropas a casa
    expect((await env.api('POST', '/api/garrison', { archers: 0 }, idem())).status).toBe(200);
    s = await env.state();
    expect(s.garrison.archers).toBe(0);
    expect(unit(s, 'arquero').home).toBe(1 + 6);
  });

  it('los reservados no pueden salir en expedición ni contarse como disponibles', async () => {
    env = await ready(2);
    await env.api('POST', '/api/garrison', { archers: 8 }, idem()); // quedan 2 libres
    const send = await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { arquero: 5 } }, idem());
    expect(send.status).toBe(409);
    expect(send.json.error.code).toBe('NOT_ENOUGH_TROOPS');
    expect((await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { arquero: 2 } }, idem())).status).toBe(200);
    expect(totalArchers(env)).toBe(10); // libres + guarnición + en expedición
  });

  it('el regreso de una expedición no toca la guarnición y mantiene el invariante', async () => {
    env = await ready(2);
    await env.api('POST', '/api/garrison', { archers: 5 }, idem());
    await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { arquero: 5 } }, idem());
    env.clock.now = T0 + 10 * MIN;
    const s = await env.state();
    expect(s.garrison.archers).toBe(5);
    expect(s.expeditions).toHaveLength(0);
    const lost = 10 - totalArchers(env); // bajas de la expedición
    expect(lost).toBeGreaterThanOrEqual(0);
    expect(garrisonOf(env) + homeArchers(env)).toBe(10 - lost);
  });

  it('solicitudes simultáneas con la misma clave no duplican la asignación', async () => {
    env = await ready(2);
    const key = { 'Idempotency-Key': 'garrison-1' };
    const res = await Promise.all(Array.from({ length: 5 }, () => env!.api('POST', '/api/garrison', { archers: 6 }, key)));
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(garrisonOf(env)).toBe(6);
    expect(totalArchers(env)).toBe(10);
  });
});

describe('actividad productiva real (la que gobierna la animación)', () => {
  it('produce solo con edificio terminado, trabajadores > 0 y espacio en el almacén', async () => {
    env = await createEnv();
    let s = await env.state();
    expect(building(s, 'farm').activity).toMatchObject({ producing: true, reason: 'ok', resource: 'food' });
    expect(building(s, 'sawmill').activity).toMatchObject({ producing: false, reason: 'not_built' });
    expect(building(s, 'castle').activity).toBeNull();

    await env.api('POST', '/api/workers', { farm: 0 });
    s = await env.state();
    expect(building(s, 'farm').activity).toMatchObject({ producing: false, reason: 'no_workers' });
    expect(s.resources.food.ratePerMinute).toBe(0);

    await env.api('POST', '/api/workers', { farm: 4 });
    setResources(env, { food: 500 }); // almacén nv1 = 500
    s = await env.state();
    expect(building(s, 'farm').activity).toMatchObject({ producing: false, reason: 'storage_full' });
  });

  it('la tasa es proporcional a los asignados (potencial × asignados/capacidad) y se conserva la capacidad existente', async () => {
    env = await createEnv();
    setBuildingLevel(env, 'sawmill', 5); // puestos 3+2·5 = 13 (se conserva la capacidad del balance existente)
    setBuildingLevel(env, 'castle', 2);
    env.db.prepare('UPDATE cities SET population = 40').run(); // habitantes suficientes (13 + 4 de la granja)
    const rate = async (workers: number) => {
      const r = await env!.api('POST', '/api/workers', { sawmill: workers });
      expect(r.status).toBe(200);
      return (await env!.state()).resources.wood.ratePerMinute;
    };
    const perWorker = 10 * (1 + 0.1 * 4);
    expect(await rate(0)).toBe(0);
    expect(await rate(13)).toBeCloseTo(13 * perWorker, 6);
    expect(await rate(4)).toBeCloseTo((4 / 13) * 13 * perWorker, 6);
    expect((await env.api('POST', '/api/workers', { sawmill: 14 })).json.error.code).toBe('WORKER_SLOTS');
  });
});

describe('migración aditiva', () => {
  it('convierte un guardado de la V1 sin tocar edificios, recursos ni tropas', () => {
    const db = openDatabase(':memory:');
    const dir = path.join(SERVER_ROOT, 'migrations');
    // estado "antes": solo la migración 001
    db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
    db.exec(fs.readFileSync(path.join(dir, '001_init.sql'), 'utf8'));
    db.prepare("INSERT INTO schema_migrations VALUES ('001_init.sql', 1)").run();
    db.prepare("INSERT INTO players (id, name, created_at) VALUES (1, 'x', 1)").run();
    db.prepare('INSERT INTO cities (id, player_id, name, last_update_at, wood, stone, food, gold, population, created_at) VALUES (1,1,?,5,123.5,45,67,89,33.25,1)').run('Mi villa');
    for (const [t, l, w] of [['castle', 4, 0], ['sawmill', 1, 5], ['quarry', 1, 5], ['farm', 1, 4], ['warehouse', 4, 0], ['barracks', 2, 0]] as const) {
      db.prepare('INSERT INTO buildings VALUES (1,?,?,?)').run(t, l, w);
    }
    db.prepare("INSERT INTO troops VALUES (1,'lancero',7)").run();

    expect(migrate(db)).toEqual(['002_wall_garrison.sql', '003_districts.sql']);

    const rows = db.prepare('SELECT type, level, workers FROM buildings WHERE city_id = 1 ORDER BY type').all();
    expect(rows).toEqual([
      { type: 'barracks', level: 2, workers: 0 },
      { type: 'castle', level: 4, workers: 0 },
      { type: 'farm', level: 1, workers: 4 },
      { type: 'quarry', level: 1, workers: 5 },
      { type: 'sawmill', level: 1, workers: 5 },
      { type: 'wall', level: 0, workers: 0 },
      { type: 'warehouse', level: 4, workers: 0 },
    ]);
    expect(db.prepare('SELECT wood, stone, food, gold, population, garrison_archers FROM cities').get()).toEqual({
      wood: 123.5,
      stone: 45,
      food: 67,
      gold: 89,
      population: 33.25,
      garrison_archers: 0,
    });
    expect(db.prepare('SELECT quantity FROM troops').get()).toEqual({ quantity: 7 });
    expect(migrate(db)).toEqual([]); // idempotente
    db.close();
  });
});
