import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './connection.js';
import { SERVER_ROOT } from './connection.js';

const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'migrations');

/** Aplica, en orden, las migraciones `NNN_nombre.sql` que aún no se hayan ejecutado. */
export function migrate(db: DB): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map((r) => r.version),
  );
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(file, Date.now());
    })();
    done.push(file);
  }
  return done;
}
