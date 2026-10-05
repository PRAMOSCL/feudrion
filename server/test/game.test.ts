import { afterEach, describe, expect, it } from 'vitest';
import { CAMPS, UNITS, upgradeCost, upgradeSeconds } from '../src/config/balance.js';
import { resolveCombat } from '../src/game/combat.js';
import { MIN, SEC, T0, building, createEnv, setBuildingLevel, setResources, tmpDbFile, unit, type Env } from './helpers.js';

let env: Env | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});

const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

describe('producción y tiempo', () => {
  it('produce durante una ausencia (sin navegador) y respeta la capacidad del almacén', async () => {
    env = await createEnv();
    const s0 = await env.state();
    expect(s0.resources.food.amount).toBeCloseTo(250, 6);

    // Granja nv1 con 4 trabajadores: 4 × 12 = 48 alimentos/min. 3 min de ausencia.
    env.clock.now = T0 + 3 * MIN;
    const s1 = await env.state();
    expect(s1.resources.food.amount).toBeCloseTo(250 + 48 * 3, 6);

    // Tras mucho tiempo, topa en la capacidad del almacén nv1 (500).
    env.clock.now = T0 + 120 * MIN;
    const s2 = await env.state();
    expect(s2.resources.food.amount).toBe(500);
    expect(s2.resources.gold.amount).toBe(500);
  });

  it('no pierde fracciones al consultar con frecuencia', async () => {
    env = await createEnv();
    for (let i = 1; i <= 90; i++) {
      env.clock.now = T0 + i * 2 * SEC;
      await env.state();
    }
    env.clock.now = T0 + 3 * MIN;
    const s = await env.state();
    expect(s.resources.food.amount).toBeCloseTo(250 + 48 * 3, 6);
  });

  it('la población crece hasta el límite y el oro depende de los habitantes libres', async () => {
    env = await createEnv();
    env.clock.now = T0 + 2 * MIN;
    const s = await env.state();
    expect(s.population.current).toBeCloseTo(12 + 6 * 2, 6);
    // oro: base 5/min + 1 por habitante libre; libres(t) = 12 + 6t − 4 → integral exacta
    const expectedGold = 150 + 5 * 2 + (8 * 2 + (6 * 2 * 2) / 2);
    expect(s.resources.gold.amount).toBeCloseTo(expectedGold, 6);
    env.clock.now = T0 + 60 * MIN;
    expect((await env.state()).population.current).toBe(30);
  });

  it('una construcción terminada durante una ausencia se aplica una sola vez, con trabajadores automáticos', async () => {
    env = await createEnv();
    const up = await env.api('POST', '/api/buildings/sawmill/upgrade', {}, idem());
    expect(up.status).toBe(200);
    const cost = upgradeCost('sawmill', 1);
    let s = await env.state();
    expect(s.resources.wood.amount).toBeCloseTo(300 - cost.wood!, 6);
    expect(building(s, 'sawmill').construction).not.toBeNull();

    env.clock.now = T0 + 5 * MIN; // el navegador estuvo cerrado
    s = await env.state();
    expect(building(s, 'sawmill').level).toBe(1);
    expect(building(s, 'sawmill').construction).toBeNull();
    expect(building(s, 'sawmill').workers).toBe(5);
    // aplicar de nuevo no cambia nada
    const again = await env.state();
    expect(building(again, 'sawmill').level).toBe(1);
  });

  it('la producción cambia exactamente cuando termina la mejora', async () => {
    env = await createEnv();
    await env.api('POST', '/api/buildings/farm/upgrade', {}, idem()); // granja 1→2, 43 s
    env.clock.now = T0 + 3 * MIN;
    const s = await env.state();
    const finishAt = upgradeSeconds('farm', 2); // s
    const before = 4 * 12 * (finishAt / 60); // tasa nv1
    const after = 4 * 12 * 1.1 * (3 - finishAt / 60); // tasa nv2
    expect(s.resources.food.amount).toBeCloseTo(250 + before + after, 5);
    expect(building(s, 'farm').level).toBe(2);
  });

  it('sobrevive a un reinicio del servidor', async () => {
    const file = tmpDbFile();
    const clock = { now: T0 };
    env = await createEnv(file, clock);
    await env.api('POST', '/api/buildings/quarry/upgrade', {}, idem());
    await env.close();

    clock.now = T0 + 10 * MIN;
    env = await createEnv(file, clock); // misma base, servidor nuevo
    const s = await env.state();
    expect(building(s, 'quarry').level).toBe(1);
    expect(building(s, 'quarry').workers).toBeGreaterThan(0);
    expect(s.resources.food.amount).toBeGreaterThan(250);
    // el perfil de demostración no se duplicó ni se reinició
    expect((env.db.prepare('SELECT COUNT(*) n FROM cities').get() as any).n).toBe(1);
  });
});

describe('validaciones', () => {
  it('rechaza mejoras sin recursos suficientes y no descuenta nada', async () => {
    env = await createEnv();
    setResources(env, { wood: 10 });
    const r = await env.api('POST', '/api/buildings/sawmill/upgrade', {}, idem());
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('INSUFFICIENT_RESOURCES');
    expect(r.json.error.message).toMatch(/madera/);
    expect((await env.state()).resources.wood.amount).toBeCloseTo(10, 6);
  });

  it('valida requisitos, una sola construcción activa y nivel máximo', async () => {
    env = await createEnv();
    const barracks = await env.api('POST', '/api/buildings/barracks/upgrade', {}, idem());
    expect(barracks.status).toBe(409);
    expect(barracks.json.error.message).toMatch(/Castillo nivel 2/);

    await env.api('POST', '/api/buildings/sawmill/upgrade', {}, idem());
    const busy = await env.api('POST', '/api/buildings/quarry/upgrade', {}, idem());
    expect(busy.status).toBe(409);
    expect(busy.json.error.code).toBe('CONSTRUCTION_BUSY');

    const bad = await env.api('POST', '/api/buildings/torre/upgrade', {}, idem());
    expect(bad.status).toBe(400);
  });

  it('valida cantidades enteras positivas y datos inválidos', async () => {
    env = await createEnv();
    setBuildingLevel(env, 'barracks', 1);
    for (const quantity of [0, -3, 1.5, '5', null, 1e9]) {
      const r = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity }, idem());
      expect(r.status, JSON.stringify(quantity)).toBe(400);
      expect(r.json.error.message).toBeTruthy();
    }
    expect((await env.api('POST', '/api/recruit', { unit: 'dragon', quantity: 1 }, idem())).status).toBe(400);
    // el cliente no puede inyectar costos ni recursos
    const hack = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 1, cost: 0, gold: 99999 }, idem());
    expect(hack.status).toBe(400);
    expect((await env.api('POST', '/api/workers', { sawmill: -1 })).status).toBe(400);
    expect((await env.api('POST', '/api/workers', { castle: 3 })).status).toBe(400);
    const tooMany = await env.api('POST', '/api/workers', { farm: 99 });
    expect(tooMany.status).toBe(409);
  });

  it('reclutamiento exige cuartel, nivel de desbloqueo y recursos', async () => {
    env = await createEnv();
    const noBarracks = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 1 }, idem());
    expect(noBarracks.json.error.code).toBe('NO_BARRACKS');
    setBuildingLevel(env, 'barracks', 1);
    const locked = await env.api('POST', '/api/recruit', { unit: 'arquero', quantity: 1 }, idem());
    expect(locked.json.error.code).toBe('UNIT_LOCKED');
    const poor = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 200 }, idem());
    expect(poor.json.error.code).toBe('INSUFFICIENT_RESOURCES');
  });

  it('asigna trabajadores respetando puestos y habitantes', async () => {
    env = await createEnv();
    const ok = await env.api('POST', '/api/workers', { farm: 5 });
    expect(ok.status).toBe(200);
    expect(building(await env.state(), 'farm').workers).toBe(5);
    const noBuilding = await env.api('POST', '/api/workers', { sawmill: 1 });
    expect(noBuilding.json.error.code).toBe('WORKER_SLOTS');
  });
});

describe('concurrencia', () => {
  it('solicitudes simultáneas de mejora no duplican el gasto', async () => {
    env = await createEnv();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => env!.api('POST', '/api/buildings/sawmill/upgrade', {}, idem())),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    const s = await env.state();
    expect(s.resources.wood.amount).toBeCloseTo(300 - upgradeCost('sawmill', 1).wood!, 6);
    expect((env.db.prepare('SELECT COUNT(*) n FROM constructions').get() as any).n).toBe(1);
  });

  it('la misma clave de idempotencia no repite el reclutamiento', async () => {
    env = await createEnv();
    setBuildingLevel(env, 'barracks', 1);
    const key = { 'Idempotency-Key': 'misma-clave' };
    const res = await Promise.all(
      Array.from({ length: 5 }, () => env!.api('POST', '/api/recruit', { unit: 'lancero', quantity: 5 }, key)),
    );
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect((env.db.prepare('SELECT COUNT(*) n FROM recruitments').get() as any).n).toBe(1);
    const s = await env.state();
    expect(s.resources.wood.amount).toBeCloseTo(300 - 5 * UNITS.lancero.cost.wood!, 6);
  });

  it('con recursos para un solo pedido, solo uno de varios pedidos distintos prospera', async () => {
    env = await createEnv();
    setBuildingLevel(env, 'barracks', 1);
    setResources(env, { wood: 100, food: 100, gold: 40 }); // alcanza para 5 lanceros, no para 10
    const res = await Promise.all(
      Array.from({ length: 6 }, () => env!.api('POST', '/api/recruit', { unit: 'lancero', quantity: 5 }, idem())),
    );
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect((env.db.prepare('SELECT COUNT(*) n FROM recruitments').get() as any).n).toBe(1);
  });
});

describe('ejército y expediciones', () => {
  async function armyReady(): Promise<Env> {
    const e = await createEnv();
    setBuildingLevel(e, 'barracks', 1);
    setResources(e, { wood: 500, food: 500, gold: 500, stone: 500 });
    return e;
  }

  it('recluta por tiempo y las tropas llegan una sola vez', async () => {
    env = await armyReady();
    const r = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 10 }, idem());
    expect(r.status).toBe(200);
    env.clock.now = T0 + 60 * SEC;
    expect(unit(await env.state(), 'lancero').home).toBe(0); // 120 s de entrenamiento
    env.clock.now = T0 + 3 * MIN;
    for (let i = 0; i < 5; i++) expect(unit(await env.state(), 'lancero').home).toBe(10);
  });

  it('encola pedidos de forma secuencial', async () => {
    env = await armyReady();
    await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 5 }, idem()); // 60 s
    const r2 = await env.api('POST', '/api/recruit', { unit: 'lancero', quantity: 5 }, idem());
    expect(r2.json.startsAt).toBe(T0 + 60 * SEC);
    expect(r2.json.finishesAt).toBe(T0 + 120 * SEC);
  });

  async function trained(n: number) {
    await env!.api('POST', '/api/recruit', { unit: 'lancero', quantity: n }, idem());
    env!.clock.now += n * 12 * SEC + SEC;
  }

  it('ciclo completo: envío, combate, regreso y botín sin duplicaciones', async () => {
    env = await armyReady();
    await trained(12);
    const before = await env.state();
    const t0 = env.clock.now;

    const send = await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: 12 } }, idem());
    expect(send.status).toBe(200);
    let s = await env.state();
    expect(unit(s, 'lancero').home).toBe(0); // dejan de estar disponibles
    expect(s.expeditions[0].status).toBe('outbound');

    // no se pueden reenviar tropas que ya salieron
    const again = await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: 1 } }, idem());
    expect(again.json.error.code).toBe('NOT_ENOUGH_TROOPS');

    env.clock.now = t0 + 61 * SEC; // llegada y combate resueltos
    s = await env.state();
    expect(s.expeditions[0].status).toBe('returning');
    expect(s.reports).toHaveLength(1);
    expect(s.reports[0].result).toBe('victory');
    expect(s.reports[0].delivered).toBeNull();
    expect(unit(s, 'lancero').home).toBe(0);

    env.clock.now = t0 + 130 * SEC; // regreso
    const woodBefore = before.resources.wood.amount;
    for (let i = 0; i < 4; i++) s = await env.state(); // consultas repetidas
    const report = s.reports[0];
    expect(s.reports).toHaveLength(1);
    expect(s.expeditions).toHaveLength(0);
    const survivors = 12 - Object.values<number>(report.lost).reduce((a, b) => a + b, 0);
    expect(unit(s, 'lancero').home).toBe(survivors);
    expect(report.delivered).not.toBeNull();
    expect(report.delivered.wood).toBeGreaterThan(0);
    // botín entregado exactamente una vez: el reclutamiento descontó wood, luego se suma el botín
    expect(report.deliveredAt).toBe(t0 + 120 * SEC);
    expect(s.resources.wood.amount).toBeGreaterThan(woodBefore - 12 * 20 - 1);
    expect(
      (env.db.prepare("SELECT COUNT(*) n FROM expeditions WHERE status = 'completed'").get() as any).n,
    ).toBe(1);
  });

  it('el botín entregado respeta la capacidad del almacén', async () => {
    env = await armyReady();
    await trained(12);
    await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: 12 } }, idem());
    // justo antes de volver, la comida está casi llena (capacidad 500)
    env.clock.now += 61 * SEC;
    await env.state();
    setResources(env, { food: 495 });
    env.clock.now += 60 * SEC;
    const s = await env.state();
    expect(s.resources.food.amount).toBeLessThanOrEqual(500);
    expect(s.reports[0].delivered.food).toBeLessThanOrEqual(5 + 48); // espacio libre + producción mínima
    expect(s.reports[0].loot.food).toBeGreaterThan(s.reports[0].delivered.food);
  });

  it('una derrota no da botín y registra bajas', async () => {
    env = await armyReady();
    await trained(5);
    await env.api('POST', '/api/expeditions', { camp: 'bastion', units: { lancero: 5 } }, idem());
    env.clock.now += 400 * SEC;
    const s = await env.state();
    expect(s.reports[0].result).toBe('defeat');
    expect(Object.values<number>(s.reports[0].loot).every((v) => v === 0)).toBe(true);
    expect(unit(s, 'lancero').home).toBeLessThan(5);
  });

  it('valida expediciones inválidas', async () => {
    env = await armyReady();
    expect((await env.api('POST', '/api/expeditions', { camp: 'nada', units: { lancero: 1 } }, idem())).status).toBe(404);
    expect((await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: {} }, idem())).json.error.code).toBe('NO_TROOPS');
    expect((await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: -1 } }, idem())).status).toBe(400);
    expect((await env.api('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: 2.5 } }, idem())).status).toBe(400);
  });
});

describe('combate (fórmula pura)', () => {
  const camp = CAMPS[0];
  it('es determinista', () => {
    const a = resolveCombat({ lancero: 12, arquero: 0, espadachin: 0, ballestero: 0 }, camp);
    const b = resolveCombat({ lancero: 12, arquero: 0, espadachin: 0, ballestero: 0 }, camp);
    expect(a).toEqual(b);
    expect(a.result).toBe('victory');
  });
  it('gana con ataque ≥ defensa del campamento y pierde por debajo', () => {
    expect(resolveCombat({ lancero: 10, arquero: 0, espadachin: 0, ballestero: 0 }, camp).result).toBe('victory'); // 60 ≥ 55
    expect(resolveCombat({ lancero: 9, arquero: 0, espadachin: 0, ballestero: 0 }, camp).result).toBe('defeat'); // 54 < 55
  });
  it('el botín está limitado por la capacidad de carga', () => {
    const o = resolveCombat({ lancero: 10, arquero: 0, espadachin: 0, ballestero: 0 }, camp);
    const total = Object.values(o.loot).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(o.carryCapacity);
  });
});

describe('progresión sin bloqueos', () => {
  it('un jugador que solo mejora lo más barato avanza todos los edificios sin quedar atascado', async () => {
    env = await createEnv();
    const order = ['sawmill', 'quarry', 'castle', 'warehouse', 'farm', 'barracks'];
    const maxHours = 12;
    while (env.clock.now < T0 + maxHours * 3600 * SEC) {
      env.clock.now += 15 * SEC;
      const s = await env.state();
      if (s.buildings.some((b: any) => b.construction)) continue;
      // lo más atrasado primero, entre lo que se puede empezar ya
      const candidates = s.buildings
        .filter((b: any) => b.upgrade?.canStart)
        .sort((a: any, b: any) => a.level - b.level || order.indexOf(a.type) - order.indexOf(b.type));
      if (candidates.length) await env.api('POST', `/api/buildings/${candidates[0].type}/upgrade`, {}, idem());
      // el jugador asigna trabajadores libres a los edificios productivos
      for (const b of ['sawmill', 'quarry', 'farm']) {
        const cur = building(s, b);
        if (cur.level > 0) await env.api('POST', '/api/workers', { [b]: Math.min(cur.effect.slots, cur.workers + Math.floor(s.population.free)) });
      }
    }
    const s = await env.state();
    const levels = Object.fromEntries(s.buildings.map((b: any) => [b.type, b.level]));
    // tras 12 h simuladas todo debe haber superado el nivel 5
    for (const [type, level] of Object.entries(levels)) expect(level as number, type).toBeGreaterThanOrEqual(5);
  }, 120_000);
});
