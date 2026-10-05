import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../src/api/routes.js';
import { openDatabase, type DB } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { ensureDemoProfile } from '../src/db/seed.js';

export const T0 = 1_700_000_000_000;
export const SEC = 1000;
export const MIN = 60_000;

export interface Env {
  db: DB;
  cityId: number;
  base: string;
  /** Reloj controlable del servidor de pruebas. */
  clock: { now: number };
  server: Server;
  api: (method: string, url: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; json: any }>;
  state: () => Promise<any>;
  close: () => Promise<void>;
}

/** Levanta un servidor real (HTTP en puerto efímero) con reloj falso. `file` permite probar reinicios. */
export async function createEnv(file = ':memory:', clock = { now: T0 }): Promise<Env> {
  const db = openDatabase(file);
  migrate(db);
  const cityId = ensureDemoProfile(db, clock.now);
  const app = createApp({ db, cityId, clock: () => clock.now });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const api: Env['api'] = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  };
  return {
    db,
    cityId,
    base,
    clock,
    server,
    api,
    state: async () => (await api('GET', '/api/state')).json,
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    },
  };
}

export function tmpDbFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'senorios-')), 'test.db');
}

/** Atajo de prueba: fija valores directamente en la base (simula estados de partida). */
export function setResources(env: Env, r: Partial<Record<'wood' | 'stone' | 'food' | 'gold', number>>) {
  for (const [k, v] of Object.entries(r)) env.db.prepare(`UPDATE cities SET ${k} = ? WHERE id = ?`).run(v, env.cityId);
}
export function setBuildingLevel(env: Env, type: string, level: number, workers = 0) {
  env.db.prepare('UPDATE buildings SET level = ?, workers = ? WHERE city_id = ? AND type = ?').run(level, workers, env.cityId, type);
}
export const building = (st: any, type: string) => st.buildings.find((b: any) => b.type === type);
export const unit = (st: any, type: string) => st.units.find((u: any) => u.type === type);
