import { BUILDING_TYPES, UNIT_TYPES, type BuildingType, type UnitType } from '../config/balance.js';
import type { CityState } from '../game/economy.js';
import { emptyUnits, type Loot, type UnitCounts } from '../game/combat.js';
import { plotOfBuilding } from '../config/districts.js';
import type { DB } from './connection.js';

/** Acceso a datos: único módulo que conoce el esquema SQL de las tablas de juego. */

export interface CityRow {
  id: number;
  player_id: number;
  name: string;
  last_update_at: number;
  wood: number;
  stone: number;
  food: number;
  gold: number;
  population: number;
  garrison_archers: number;
}

export interface ConstructionRow {
  id: number;
  city_id: number;
  building_type: BuildingType;
  target_level: number;
  started_at: number;
  finishes_at: number;
  status: 'active' | 'done';
}

export interface RecruitmentRow {
  id: number;
  city_id: number;
  unit_type: UnitType;
  quantity: number;
  started_at: number;
  finishes_at: number;
  status: 'active' | 'done';
}

export interface ExpeditionRow {
  id: number;
  city_id: number;
  camp_key: string;
  status: 'outbound' | 'returning' | 'completed';
  sent_at: number;
  travel_seconds: number;
  arrive_at: number;
  return_at: number;
  result: 'victory' | 'defeat' | null;
  resolved_at: number | null;
  completed_at: number | null;
  loot_json: string | null;
  delivered_json: string | null;
}

export interface ReportRow {
  id: number;
  city_id: number;
  expedition_id: number;
  camp_key: string;
  result: 'victory' | 'defeat';
  created_at: number;
  sent_json: string;
  lost_json: string;
  survivors_json: string;
  loot_json: string;
  delivered_json: string | null;
  delivered_at: number | null;
  details_json: string;
}

export type DueEvent = {
  kind: 'construction' | 'recruitment' | 'expedition_arrive' | 'expedition_return';
  id: number;
  at: number;
};

export const cityExists = (db: DB, id: number) => !!db.prepare('SELECT 1 FROM cities WHERE id = ?').get(id);

export function loadCityState(db: DB, cityId: number): CityState {
  const c = db.prepare('SELECT * FROM cities WHERE id = ?').get(cityId) as CityRow;
  const levels = {} as Record<BuildingType, number>;
  const workers = {} as Record<BuildingType, number>;
  for (const t of BUILDING_TYPES) {
    levels[t] = 0;
    workers[t] = 0;
  }
  const rows = db.prepare('SELECT type, level, workers FROM buildings WHERE city_id = ?').all(cityId) as {
    type: BuildingType;
    level: number;
    workers: number;
  }[];
  for (const b of rows) {
    levels[b.type] = b.level;
    workers[b.type] = b.workers;
  }
  return {
    id: c.id,
    lastUpdateAt: c.last_update_at,
    resources: { wood: c.wood, stone: c.stone, food: c.food, gold: c.gold },
    population: c.population,
    levels,
    workers,
  };
}

export function saveCityState(db: DB, s: CityState): void {
  db.prepare(
    'UPDATE cities SET last_update_at = ?, wood = ?, stone = ?, food = ?, gold = ?, population = ? WHERE id = ?',
  ).run(s.lastUpdateAt, s.resources.wood, s.resources.stone, s.resources.food, s.resources.gold, s.population, s.id);
}

export function setBuilding(db: DB, cityId: number, type: BuildingType, level: number, workers: number): void {
  // Upsert: una ciudad creada antes de añadirse un tipo de edificio no tiene su fila hasta la primera obra.
  const { districtId, plotId } = plotOfBuilding(type);
  db.prepare(
    'INSERT INTO buildings (city_id, type, level, workers, district_id, plot_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(city_id, type) DO UPDATE SET level = excluded.level, workers = excluded.workers',
  ).run(cityId, type, level, workers, districtId, plotId);
}

export function setWorkers(db: DB, cityId: number, type: BuildingType, workers: number): void {
  db.prepare('UPDATE buildings SET workers = ? WHERE city_id = ? AND type = ?').run(workers, cityId, type);
}

/** Evento vencido más antiguo (empates: construcción, reclutamiento, llegada, regreso; luego id). */
export function nextDueEvent(db: DB, cityId: number, now: number): DueEvent | undefined {
  return db
    .prepare(
      `SELECT kind, id, at FROM (
         SELECT 'construction' AS kind, id, finishes_at AS at, 0 AS rank FROM constructions WHERE city_id = @c AND status = 'active' AND finishes_at <= @now
         UNION ALL
         SELECT 'recruitment', id, finishes_at, 1 FROM recruitments WHERE city_id = @c AND status = 'active' AND finishes_at <= @now
         UNION ALL
         SELECT 'expedition_arrive', id, arrive_at, 2 FROM expeditions WHERE city_id = @c AND status = 'outbound' AND arrive_at <= @now
         UNION ALL
         SELECT 'expedition_return', id, return_at, 3 FROM expeditions WHERE city_id = @c AND status = 'returning' AND return_at <= @now
       ) ORDER BY at, rank, id LIMIT 1`,
    )
    .get({ c: cityId, now }) as DueEvent | undefined;
}

/** Colocación (distrito y parcela) de los edificios de la ciudad. */
export const getPlacements = (db: DB, cityId: number) =>
  db.prepare('SELECT type, district_id AS districtId, plot_id AS plotId FROM buildings WHERE city_id = ?').all(cityId) as {
    type: BuildingType;
    districtId: string;
    plotId: string;
  }[];

/* Guarnición de la muralla */
export const getGarrison = (db: DB, cityId: number): number =>
  (db.prepare('SELECT garrison_archers AS n FROM cities WHERE id = ?').get(cityId) as { n: number }).n;
export const setGarrison = (db: DB, cityId: number, n: number) =>
  db.prepare('UPDATE cities SET garrison_archers = ? WHERE id = ?').run(n, cityId);

/* Construcciones */
export const activeConstruction = (db: DB, cityId: number) =>
  db.prepare("SELECT * FROM constructions WHERE city_id = ? AND status = 'active'").get(cityId) as ConstructionRow | undefined;
export const getConstruction = (db: DB, id: number) =>
  db.prepare('SELECT * FROM constructions WHERE id = ?').get(id) as ConstructionRow;
export function insertConstruction(db: DB, cityId: number, type: BuildingType, target: number, start: number, end: number) {
  db.prepare(
    "INSERT INTO constructions (city_id, building_type, target_level, started_at, finishes_at, status) VALUES (?, ?, ?, ?, ?, 'active')",
  ).run(cityId, type, target, start, end);
}
/** Cierra la construcción una sola vez: devuelve false si ya estaba cerrada. */
export const closeConstruction = (db: DB, id: number) =>
  db.prepare("UPDATE constructions SET status = 'done' WHERE id = ? AND status = 'active'").run(id).changes === 1;

/* Reclutamiento */
export const getRecruitment = (db: DB, id: number) =>
  db.prepare('SELECT * FROM recruitments WHERE id = ?').get(id) as RecruitmentRow;
export const activeRecruitments = (db: DB, cityId: number) =>
  db.prepare("SELECT * FROM recruitments WHERE city_id = ? AND status = 'active' ORDER BY finishes_at, id").all(cityId) as RecruitmentRow[];
export function insertRecruitment(db: DB, cityId: number, unit: UnitType, qty: number, start: number, end: number) {
  db.prepare(
    "INSERT INTO recruitments (city_id, unit_type, quantity, started_at, finishes_at, status) VALUES (?, ?, ?, ?, ?, 'active')",
  ).run(cityId, unit, qty, start, end);
}
export const closeRecruitment = (db: DB, id: number) =>
  db.prepare("UPDATE recruitments SET status = 'done' WHERE id = ? AND status = 'active'").run(id).changes === 1;

/* Tropas en casa */
export function getTroops(db: DB, cityId: number): UnitCounts {
  const out = emptyUnits();
  for (const r of db.prepare('SELECT unit_type, quantity FROM troops WHERE city_id = ?').all(cityId) as {
    unit_type: UnitType;
    quantity: number;
  }[]) {
    out[r.unit_type] = r.quantity;
  }
  return out;
}
/** Suma (o resta, con delta negativo) tropas. La restricción CHECK impide cantidades negativas. */
export const addTroops = (db: DB, cityId: number, unit: UnitType, delta: number) =>
  db.prepare('UPDATE troops SET quantity = quantity + ? WHERE city_id = ? AND unit_type = ?').run(delta, cityId, unit);

/* Expediciones */
export const getExpedition = (db: DB, id: number) =>
  db.prepare('SELECT * FROM expeditions WHERE id = ?').get(id) as ExpeditionRow;
export const listExpeditions = (db: DB, cityId: number) =>
  db.prepare("SELECT * FROM expeditions WHERE city_id = ? AND status != 'completed' ORDER BY sent_at, id").all(cityId) as ExpeditionRow[];
export function insertExpedition(
  db: DB, cityId: number, campKey: string, sentAt: number, travelSeconds: number, arriveAt: number, returnAt: number,
): number {
  return Number(
    db
      .prepare(
        `INSERT INTO expeditions (city_id, camp_key, status, sent_at, travel_seconds, arrive_at, return_at)
         VALUES (?, ?, 'outbound', ?, ?, ?, ?)`,
      )
      .run(cityId, campKey, sentAt, travelSeconds, arriveAt, returnAt).lastInsertRowid,
  );
}
export const insertExpeditionUnit = (db: DB, expId: number, unit: UnitType, sent: number) =>
  db.prepare('INSERT INTO expedition_units (expedition_id, unit_type, sent) VALUES (?, ?, ?)').run(expId, unit, sent);
export function getExpeditionUnits(db: DB, expId: number): Record<UnitType, { sent: number; lost: number }> {
  const out = {} as Record<UnitType, { sent: number; lost: number }>;
  for (const u of UNIT_TYPES) out[u] = { sent: 0, lost: 0 };
  for (const r of db.prepare('SELECT unit_type, sent, lost FROM expedition_units WHERE expedition_id = ?').all(expId) as {
    unit_type: UnitType;
    sent: number;
    lost: number;
  }[]) {
    out[r.unit_type] = { sent: r.sent, lost: r.lost };
  }
  return out;
}
export const setExpeditionLost = (db: DB, expId: number, unit: UnitType, lost: number) =>
  db.prepare('UPDATE expedition_units SET lost = ? WHERE expedition_id = ? AND unit_type = ?').run(lost, expId, unit);
/** outbound -> returning, una sola vez. */
export const markExpeditionResolved = (db: DB, id: number, result: string, at: number, loot: Loot) =>
  db
    .prepare("UPDATE expeditions SET status = 'returning', result = ?, resolved_at = ?, loot_json = ? WHERE id = ? AND status = 'outbound'")
    .run(result, at, JSON.stringify(loot), id).changes === 1;
/** returning -> completed, una sola vez. */
export const markExpeditionCompleted = (db: DB, id: number, at: number, delivered: Loot) =>
  db
    .prepare("UPDATE expeditions SET status = 'completed', completed_at = ?, delivered_json = ? WHERE id = ? AND status = 'returning'")
    .run(at, JSON.stringify(delivered), id).changes === 1;

/* Informes */
export function insertReport(db: DB, r: Omit<ReportRow, 'id' | 'delivered_json' | 'delivered_at'>) {
  db.prepare(
    `INSERT INTO reports (city_id, expedition_id, camp_key, result, created_at, sent_json, lost_json, survivors_json, loot_json, details_json)
     VALUES (@city_id, @expedition_id, @camp_key, @result, @created_at, @sent_json, @lost_json, @survivors_json, @loot_json, @details_json)`,
  ).run(r);
}
export const completeReport = (db: DB, expId: number, at: number, delivered: Loot) =>
  db
    .prepare('UPDATE reports SET delivered_json = ?, delivered_at = ? WHERE expedition_id = ? AND delivered_json IS NULL')
    .run(JSON.stringify(delivered), at, expId).changes === 1;
export const listReports = (db: DB, cityId: number, limit: number) =>
  db.prepare('SELECT * FROM reports WHERE city_id = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(cityId, limit) as ReportRow[];

/* Idempotencia */
export const getIdempotent = (db: DB, key: string, cityId: number) =>
  db.prepare('SELECT status, response FROM idempotency_keys WHERE key = ? AND city_id = ?').get(key, cityId) as
    | { status: number; response: string }
    | undefined;
export const putIdempotent = (db: DB, key: string, cityId: number, status: number, response: string, at: number) =>
  db
    .prepare('INSERT OR IGNORE INTO idempotency_keys (key, city_id, status, response, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(key, cityId, status, response, at);
export const pruneIdempotent = (db: DB, before: number) =>
  db.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(before);
