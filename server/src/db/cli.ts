import { openDatabase } from './connection.js';
import { migrate } from './migrate.js';
import { ensureDemoProfile, wipeAllData } from './seed.js';

const command = process.argv[2];
const db = openDatabase();

if (command === 'migrate') {
  const applied = migrate(db);
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Base de datos al día.');
} else if (command === 'reset') {
  // Acción explícita de desarrollo: nunca se ejecuta al arrancar el servidor.
  migrate(db);
  wipeAllData(db);
  ensureDemoProfile(db, Date.now());
  console.log('Progreso reiniciado: perfil de demostración recreado desde cero.');
} else {
  console.error('Uso: db:migrate | db:reset');
  process.exitCode = 1;
}
db.close();
