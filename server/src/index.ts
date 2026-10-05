import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './api/routes.js';
import { SERVER_ROOT, openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { ensureDemoProfile } from './db/seed.js';

const HOST = process.env.HOST ?? '127.0.0.1'; // solo localhost por defecto
const PORT = Number(process.env.PORT ?? 3001);

const db = openDatabase();
const applied = migrate(db);
if (applied.length) console.log(`Migraciones aplicadas: ${applied.join(', ')}`);

// Crea el perfil de demostración solo si no existe; jamás reinicia progreso existente.
const cityId = ensureDemoProfile(db, Date.now());

const app = createApp({ db, cityId, clock: Date.now });

// Si el cliente está compilado (`npm run build`), el propio backend lo sirve: `npm start` basta.
const clientDist = path.resolve(SERVER_ROOT, '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
const server = app.listen(PORT, HOST, () => {
  console.log(`Señoríos API escuchando en http://${HOST}:${PORT} (ciudad #${cityId})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
