// Ciclo producir → construir (muralla) → reclutar → guarnición → expedición → informe contra la API de la copia de trabajo.
import { execFileSync } from 'node:child_process';
const API = 'http://127.0.0.1:3003';
const [DB, SCEN] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (m, u, b) => {
  const r = await fetch(API + u, { method: m, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, json: await r.json() };
};
const ok = [];
const check = (n, v, x = '') => { ok.push(v); console.log(v ? 'PASS' : 'FAIL', n, x); };

execFileSync('node', [SCEN, DB, 'wall2']);
execFileSync('node', ['-e', `const D=require('E:/Github Repo/feudrion/node_modules/better-sqlite3');const d=new D(process.argv[1]);d.prepare("UPDATE troops SET quantity=14 WHERE unit_type='lancero'").run();d.prepare("UPDATE troops SET quantity=10 WHERE unit_type='arquero'").run();d.prepare('UPDATE cities SET garrison_archers=0, wood=900, stone=900, gold=900, food=900').run();d.prepare("UPDATE buildings SET level=4 WHERE type='castle'").run();d.prepare("UPDATE buildings SET level=4 WHERE type='warehouse'").run();`, DB]);

let s = (await call('GET', '/api/state')).json;
const wood0 = s.resources.wood.amount;
await sleep(3000);
s = (await call('GET', '/api/state')).json;
check('producir: la madera sube con el tiempo (trabajadores activos)', s.resources.wood.amount > wood0 || s.resources.wood.amount >= s.resources.wood.capacity - 1, `${wood0.toFixed(1)} → ${s.resources.wood.amount.toFixed(1)}`);

const up = await call('POST', '/api/buildings/wall/upgrade', {});
check('construir: mejora de muralla 2→3 aceptada', up.status === 200, JSON.stringify(up.json));
s = (await call('GET', '/api/state')).json;
const wall = s.buildings.find((b) => b.type === 'wall');
check('mientras se mejora, la defensa vigente (nivel 2, capacidad 8) no cambia', wall.level === 2 && wall.effect.garrisonCapacity === 8 && !!wall.construction);

const g = await call('POST', '/api/garrison', { archers: 6 });
check('guarnición: 6 arqueros asignados', g.status === 200 && g.json.garrison === 6);
s = (await call('GET', '/api/state')).json;
check('los reservados salen de los libres (10 → 4)', s.units.find((u) => u.type === 'arquero').home === 4 && s.garrison.archers === 6);
const bad = await call('POST', '/api/expeditions', { camp: 'bandidos', units: { arquero: 5 } });
check('no pueden salir en expedición los reservados', bad.status === 409);

const rec = await call('POST', '/api/recruit', { unit: 'lancero', quantity: 2 });
check('reclutar: 2 lanceros en cola', rec.status === 200);
const exp = await call('POST', '/api/expeditions', { camp: 'bandidos', units: { lancero: 12 } });
check('expedición enviada', exp.status === 200, JSON.stringify(exp.json));
console.log('esperando combate y regreso (~125 s)…');
for (let i = 0; i < 60; i++) {
  await sleep(3000);
  s = (await call('GET', '/api/state')).json;
  if (s.expeditions.length === 0 && s.reports.length >= 1) break;
}
check('informe único con botín entregado', s.reports.length >= 1 && !!s.reports[0].delivered, JSON.stringify(s.reports[0]?.delivered));
const arch = s.units.find((u) => u.type === 'arquero').home;
check('invariante de arqueros: libres + guarnición = 10', arch + s.garrison.archers === 10, `${arch} + ${s.garrison.archers}`);
console.log(ok.every(Boolean) ? 'CICLO OK' : 'CICLO CON FALLOS');
