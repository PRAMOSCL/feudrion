import { BUILDING_TYPES, START, UNIT_TYPES } from '../config/balance.js';
import type { DB } from './connection.js';

/**
 * Crea el perfil local de demostración (jugador + ciudad con sus edificios y tropas)
 * solo si todavía no existe. Nunca borra ni reinicia progreso. Devuelve el id de la ciudad.
 */
export function ensureDemoProfile(db: DB, now: number): number {
  const existing = db
    .prepare('SELECT c.id FROM cities c JOIN players p ON p.id = c.player_id WHERE p.is_demo = 1 ORDER BY c.id LIMIT 1')
    .get() as { id: number } | undefined;
  if (existing) return existing.id;

  return db.transaction(() => {
    const player = db
      .prepare('INSERT INTO players (name, is_demo, created_at) VALUES (?, 1, ?)')
      .run(START.playerName, now);
    const r = START.resources;
    const city = db
      .prepare(
        `INSERT INTO cities (player_id, name, last_update_at, wood, stone, food, gold, population, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(player.lastInsertRowid, START.cityName, now, r.wood, r.stone, r.food, r.gold, START.population, now);
    const cityId = Number(city.lastInsertRowid);
    const insB = db.prepare('INSERT INTO buildings (city_id, type, level, workers) VALUES (?, ?, ?, ?)');
    for (const type of BUILDING_TYPES) insB.run(cityId, type, START.buildings[type].level, START.buildings[type].workers);
    const insT = db.prepare('INSERT INTO troops (city_id, unit_type, quantity) VALUES (?, ?, 0)');
    for (const u of UNIT_TYPES) insT.run(cityId, u);
    return cityId;
  })();
}

/** Borra todo el progreso. Solo debe invocarse desde la acción explícita `db:reset`. */
export function wipeAllData(db: DB): void {
  db.transaction(() => {
    for (const t of [
      'idempotency_keys', 'reports', 'expedition_units', 'expeditions', 'troops',
      'recruitments', 'constructions', 'buildings', 'cities', 'players',
    ]) {
      db.exec(`DELETE FROM ${t}`);
    }
  })();
}
