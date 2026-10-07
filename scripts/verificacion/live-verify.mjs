import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';

/**
 * Verificación de la ciudad viva contra la instancia de la copia de trabajo (base temporal).
 * node live-verify.mjs <url> <db> <scenario.cjs>
 */
const [URL, DB, SCEN] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = (name) => execFileSync('node', [SCEN, DB, name], { stdio: 'pipe' });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
};

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const errors = [];
async function open(w = 1672, h = 941, opts = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  if (opts.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('senorios.debugLive', '1');
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1500);
  return p;
}
const snap = (p) => p.evaluate(() => window.__senoriosLive?.snapshot());
const stageClick = async (p, sx, sy) => {
  const r = await p.evaluate(() => {
    const b = document.querySelector('.stage-frame').getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await p.mouse.click(r.l + (sx / 1536) * r.w, r.t + (sy / 1024) * r.h);
  await sleep(500);
  return p.$eval('.insp-head h2', (e) => e.textContent).catch(() => '');
};

// 1) Partida nueva: sin muralla, sin guarnición, sin patrullas
scenario('fresh');
let p = await open();
let s = await snap(p);
check('nivel 0: sin overlay de muralla', (await p.$$('.wall-layer')).length === 0);
check('nivel 0: sin arqueros visibles', s.archers === 0, JSON.stringify({ archers: s.archers }));
check('granja con 4 trabajadores → 1 figura (transporte genérico), sin hacha', s.carry === 1 && s.chop === 0, `carry=${s.carry} chop=${s.chop}`);
check('habitantes ambientales pocos (2–10)', s.villagers >= 2 && s.villagers <= 10, `villagers=${s.villagers}`);
check('el portón (sin muralla) se puede seleccionar y abre «Muralla»', (await stageClick(p, 1292, 800)) === 'Muralla');
await p.close();

// 2) Arqueros libres pero sin muralla → sin patrullas
scenario('wall0g');
p = await open();
check('sin muralla y con arqueros libres: sin patrullas', (await snap(p)).archers === 0);
await p.close();

// 3) Muralla 2 con guarnición 6 → 2 representantes (empalizada)
scenario('wall2');
p = await open();
s = await snap(p);
check('muralla nv2 (empalizada) + guarnición 6 → 2 arqueros visibles', s.archers === 2 && s.model.wallStage === 1, `archers=${s.archers} stage=${s.model.wallStage}`);
check('aserradero nv5 con 13 trabajadores activos → 2 figuras (1 hacha + 1 transporte)', s.chop + s.carry >= 3, `chop=${s.chop} carry=${s.carry}`);
check('clic en el cuerpo de la muralla selecciona Muralla', (await stageClick(p, 700, 800)) === 'Muralla');
check('clic en el aserradero sigue abriendo Aserradero', (await stageClick(p, 305, 440)) === 'Aserradero');
check('clic en el castillo sigue abriendo Castillo', (await stageClick(p, 835, 380)) === 'Castillo');
await p.close();

// 4) Aspectos de piedra / reforzada y 12 arqueros → 4 / 6 visibles
for (const [name, stage, guards] of [['wall5', 2, 4], ['wall8', 3, 6]]) {
  scenario(name);
  p = await open();
  s = await snap(p);
  check(`${name}: aspecto ${stage} y ${guards} guardias visibles (12 reales)`, s.model.wallStage === stage && s.archers === guards, `stage=${s.model.wallStage} archers=${s.archers}`);
  await p.close();
}

// 5) Sin trabajadores → sin figuras productivas
scenario('noworkers');
p = await open();
s = await snap(p);
check('aserradero con 0 asignados: nadie tala ni transporta allí', s.chop === 0, `chop=${s.chop} carry=${s.carry}`);
await p.close();

// 6) Almacén lleno → trabajadores retirados
scenario('wall2');
execFileSync('node', ['-e', `const D=require('E:/Github Repo/feudrion/node_modules/better-sqlite3');new D(process.argv[1]).prepare('UPDATE cities SET wood=1125').run()`, DB]);
p = await open();
s = await snap(p);
check('almacén de madera lleno: el aserradero deja de mostrar trabajo', s.chop === 0, `chop=${s.chop} carry=${s.carry}`);
await p.close();

// 7) Obra: muralla en construcción → tramos revelados (sin defensa), sin guardias
scenario('building');
p = await open();
s = await snap(p);
const reveal = await p.$$eval('.wall-layer', (els) => els.map((e) => e.style.clipPath.slice(0, 40)));
check('muralla en construcción: capas con tramos revelados y 0 guardias', reveal.length === 2 && s.archers === 0, JSON.stringify(reveal));
await p.close();

// 8) Mejorando: se conserva el aspecto vigente y la guarnición
scenario('upgrading');
p = await open();
s = await snap(p);
check('muralla nv3 mejorando a nv4: sigue la empalizada y 2 guardias', s.model.wallStage === 1 && s.archers === 2, `stage=${s.model.wallStage} archers=${s.archers}`);
await p.close();

// 9) Animación: bucle activo, reduced-motion, desactivar, pestaña oculta
scenario('wall2');
p = await open();
const a0 = await snap(p);
await sleep(1500);
const a1 = await snap(p);
check('bucle activo: avanzan los fotogramas de personajes y agua', a1.actorFrames > a0.actorFrames && a1.waterFrames > a0.waterFrames, `${a0.actorFrames}→${a1.actorFrames} / ${a0.waterFrames}→${a1.waterFrames}`);
const fps = (a1.actorFrames - a0.actorFrames) / 1.5;
check('personajes ≤ ~30 fps (limitados) y sin consulta al servidor por fotograma', fps <= 34, `${fps.toFixed(1)} fps`);
const reqBefore = await p.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/')).length);
await sleep(3000);
const reqAfter = await p.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/')).length);
check('peticiones a /api en 3 s ≤ 1 (sondeo cada 10 s, no por fotograma)', reqAfter - reqBefore <= 1, `${reqAfter - reqBefore}`);
await p.evaluate(() => document.querySelector('[aria-label^="Desactivar animaciones"]').click());
await sleep(600);
const off0 = await snap(p);
await sleep(1200);
const off1 = await snap(p);
check('botón «animaciones» desactiva el bucle (modo estático)', !off1.running && off1.actorFrames === off0.actorFrames, JSON.stringify({ running: off1.running }));
await p.evaluate(() => document.querySelector('[aria-label^="Activar animaciones"]').click());
await sleep(800);
check('…y se puede reactivar', (await snap(p)).running);
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await sleep(300);
const h0 = await snap(p);
await sleep(1000);
const h1 = await snap(p);
check('pestaña oculta: el bucle se detiene', !h1.running && h1.actorFrames === h0.actorFrames);
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
await sleep(500);
check('…y se reanuda al volver', (await snap(p)).running);
await p.close();

p = await open(1672, 941, { reduced: true });
const r0 = await snap(p);
await sleep(1200);
const r1 = await snap(p);
check('prefers-reduced-motion: bucle detenido, escena estática con personajes dibujados', !r1.running && r1.actorFrames === r0.actorFrames && r1.actors > 0, JSON.stringify({ running: r1.running, actors: r1.actors }));
check('prefers-reduced-motion: el botón de animaciones queda deshabilitado', await p.$eval('[aria-label*="animaciones"]', (e) => e.disabled));
await p.close();

// 10) Posición relativa de los hotspots y errores por viewport
for (const [w, h] of [[1672, 941], [1920, 1080], [1366, 768], [1024, 768]]) {
  scenario('wall2');
  p = await open(w, h);
  if (w <= 1100) await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await sleep(400);
  const gate = await stageClick(p, 1292, 800);
  check(`${w}×${h}: portón abre Muralla`, gate === 'Muralla', gate);
  if (w <= 1100) await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await sleep(300);
  const saw = await stageClick(p, 305, 440);
  check(`${w}×${h}: aserradero abre Aserradero`, saw === 'Aserradero', saw);
  await p.close();
}

check('sin errores de consola ni respuestas ≥ 400 (sin 404 de assets)', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
browser.disconnect();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
