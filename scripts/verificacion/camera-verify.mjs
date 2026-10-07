import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';

/**
 * Verificación de la cámara de la Fortaleza (zoom, desplazamiento, inversa del clic, encuadre).
 * node camera-verify.mjs <url> <db> <scenario.cjs>   (Edge headless en :9333; base TEMPORAL)
 */
const [URL, DB, SCEN] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = (n) => execFileSync('node', [SCEN, DB, n], { stdio: 'pipe' });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
};
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const errors = [];

async function open(w, h) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('senorios.debugLive', '1');
    localStorage.setItem('senorios.district', 'fortress');
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1200);
  await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await sleep(300);
  return p;
}
const cam = (p) =>
  p.evaluate(() => {
    const f = document.querySelector('.stage-frame');
    const v = document.querySelector('.stage-viewport').getBoundingClientRect();
    const r = f.getBoundingClientRect();
    return { s: +f.dataset.cameraScale, cx: +f.dataset.cameraCx, cy: +f.dataset.cameraCy, rect: r.toJSON(), vp: v.toJSON() };
  });
const toScreen = (c, x, y) => ({ x: c.rect.left + x * c.s, y: c.rect.top + y * c.s });
const title = (p) => p.$eval('.insp-head h2', (e) => e.textContent).catch(() => '');
const closeInsp = (p) => p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());

// puntos de silueta (centro del sprite) de cada edificio: spriteBox de sceneConfig
const buildings = await (async () => {
  const p = await browser.newPage();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(async () => {
    const sc = await import('/src/sceneConfig.ts');
    return Object.keys(sc.SPRITE_SRC).map((t) => {
      const b = sc.spriteBox(t);
      return { t, x: b.left + b.size / 2, y: b.top + b.size * 0.55 };
    });
  });
  await p.close();
  return r;
})();
const names = { castle: 'Castillo', sawmill: 'Aserradero', quarry: 'Cantera', farm: 'Granja', warehouse: 'Almacén', barracks: 'Cuartel' };

scenario('wall4');
let p = await open(1672, 941);
let c = await cam(p);
const fit = Math.min(c.vp.width / 1536, c.vp.height / 1024);
check('encuadre inicial cercano: más cerca que «ver toda»', c.s > fit + 0.01, `s=${c.s} fit=${fit.toFixed(4)}`);
check('sin márgenes vacíos: el lienzo cubre el viewport', c.rect.left <= c.vp.left + 0.5 && c.rect.top <= c.vp.top + 0.5 && c.rect.right >= c.vp.right - 0.5 && c.rect.bottom >= c.vp.bottom - 0.5);
check('controles visibles: Acercar, Alejar y «Ver toda la fortaleza»', (await p.$$eval('.cam-controls button', (b) => b.map((x) => x.getAttribute('aria-label')))).join('|') === 'Acercar|Alejar|Ver toda la fortaleza');
check('un solo bucle de agua y de personajes', (await p.$$('.live-water')).length === 1 && (await p.$$('.live-actors')).length === 1);

// Todos los edificios alcanzables con el encuadre inicial (o tras desplazar)
const reach = {};
for (const b of buildings) {
  c = await cam(p);
  const sp = toScreen(c, b.x, b.y);
  const inside = sp.x > c.vp.left + 4 && sp.x < c.vp.right - 4 && sp.y > c.vp.top + 4 && sp.y < c.vp.bottom - 4;
  if (!inside) {
    reach[b.t] = 'fuera del encuadre inicial';
    continue;
  }
  await p.mouse.click(sp.x, sp.y);
  await sleep(350);
  reach[b.t] = await title(p);
  await closeInsp(p);
  await sleep(150);
}
check('cada edificio es visible y se selecciona por su silueta en el encuadre inicial', buildings.every((b) => reach[b.t] === names[b.t]), JSON.stringify(reach));

// Zoom con botón y rueda
const s0 = (await cam(p)).s;
await p.click('[aria-label="Acercar"]');
await sleep(300);
const s1 = (await cam(p)).s;
check('botón Acercar aumenta la escala', s1 > s0);
await p.click('[aria-label="Alejar"]');
await sleep(300);
check('botón Alejar la reduce', (await cam(p)).s < s1);
c = await cam(p);
const cursor = { x: c.vp.left + c.vp.width * 0.3, y: c.vp.top + c.vp.height * 0.4 };
const before = (() => { const k = c; return { x: (cursor.x - k.rect.left) / k.s, y: (cursor.y - k.rect.top) / k.s }; })();
await p.mouse.move(cursor.x, cursor.y);
await p.mouse.wheel({ deltaY: -300 });
await sleep(400);
c = await cam(p);
const after = { x: (cursor.x - c.rect.left) / c.s, y: (cursor.y - c.rect.top) / c.s };
check('rueda: acerca y el punto bajo el cursor no se mueve', c.s > s0 && Math.hypot(after.x - before.x, after.y - before.y) < 1.5, `Δ=${Math.hypot(after.x - before.x, after.y - before.y).toFixed(2)}px de escena`);

// Clic tras zoom: la inversa elige el edificio correcto (centro de cada uno, desplazando con arrastre real si hace falta)
const hits = {};
for (const b of buildings) {
  for (let attempt = 0; attempt < 6; attempt++) {
    c = await cam(p);
    const sp = toScreen(c, b.x, b.y);
    const ok = sp.x > c.vp.left + 30 && sp.x < c.vp.right - 30 && sp.y > c.vp.top + 30 && sp.y < c.vp.bottom - 30;
    if (ok) break;
    // arrastre real del ratón hacia el edificio
    const cxv = c.vp.left + c.vp.width / 2, cyv = c.vp.top + c.vp.height / 2;
    await p.mouse.move(cxv, cyv);
    await p.mouse.down();
    await p.mouse.move(cxv + Math.max(-250, Math.min(250, cxv - sp.x)), cyv + Math.max(-200, Math.min(200, cyv - sp.y)), { steps: 6 });
    await p.mouse.up();
    await sleep(250);
  }
  c = await cam(p);
  const sp = toScreen(c, b.x, b.y);
  await p.mouse.click(sp.x, sp.y);
  await sleep(350);
  hits[b.t] = await title(p);
  await closeInsp(p);
  await sleep(150);
}
check('tras zoom y arrastres reales todos los edificios siguen alcanzables y el clic acierta', buildings.every((b) => hits[b.t] === names[b.t]), JSON.stringify(hits));

// Umbral: un arrastre no selecciona; un clic con pequeño temblor sí
const cb = await cam(p);
const cs = toScreen(cb, buildings.find((b) => b.t === 'castle').x, buildings.find((b) => b.t === 'castle').y);
if (!(cs.x > cb.vp.left && cs.x < cb.vp.right && cs.y > cb.vp.top && cs.y < cb.vp.bottom)) {
  await p.click('[aria-label="Ver toda la fortaleza"]');
  await sleep(300);
}
const c2 = await cam(p);
const c2s = toScreen(c2, buildings.find((b) => b.t === 'castle').x, buildings.find((b) => b.t === 'castle').y);
await closeInsp(p);
await p.mouse.move(c2s.x, c2s.y);
await p.mouse.down();
await p.mouse.move(c2s.x + 3, c2s.y + 2);
await p.mouse.up();
await sleep(350);
check('clic con temblor de 3 px (< umbral) selecciona el edificio', (await title(p)) === 'Castillo');
await closeInsp(p);
await sleep(200);
const cA = await cam(p);
const sp2 = toScreen(cA, buildings.find((b) => b.t === 'castle').x, buildings.find((b) => b.t === 'castle').y);
await p.mouse.move(sp2.x, sp2.y);
await p.mouse.down();
await p.mouse.move(sp2.x + 40, sp2.y + 10, { steps: 5 });
await p.mouse.up();
await sleep(350);
const cB = await cam(p);
check('arrastrar 40 px mueve la cámara y NO abre inspector', (await title(p)) === '' && (Math.abs(cB.cx - cA.cx) > 1 || Math.abs(cB.s - cA.s) > 0), `Δcx=${(cB.cx - cA.cx).toFixed(1)}`);

// Inspector: abrir/cerrar no reajusta la cámara
await p.click('[aria-label="Ver toda la fortaleza"]');
await sleep(200);
await p.click('[aria-label="Acercar"]');
await sleep(200);
const k0 = await cam(p);
const sp3 = toScreen(k0, buildings.find((b) => b.t === 'warehouse').x, buildings.find((b) => b.t === 'warehouse').y);
await p.mouse.click(sp3.x, sp3.y);
await sleep(600);
const k1 = await cam(p);
check('abrir el inspector conserva magnificación y centro (sin saltar a vista lejana)', Math.abs(k1.s - k0.s) < 1e-3 && Math.abs(k1.cx - k0.cx) < 1 && Math.abs(k1.cy - k0.cy) < 1, `s ${k0.s}→${k1.s} cx ${k0.cx}→${k1.cx}`);
await closeInsp(p);
await sleep(600);
const k2 = await cam(p);
check('cerrar el inspector tampoco', Math.abs(k2.s - k0.s) < 1e-3 && Math.abs(k2.cx - k0.cx) < 1);

// Cambio de nivel de muralla (refresco del estado) no mueve la cámara
scenario('wall7');
await sleep(11500);
const k3 = await cam(p);
check('cambiar el nivel de la muralla (refresco periódico) no reajusta la cámara', Math.abs(k3.s - k2.s) < 1e-3 && Math.abs(k3.cx - k2.cx) < 1, `s ${k2.s}→${k3.s}`);

// Teclado
await p.focus('.stage-viewport');
const t0 = await cam(p);
await p.keyboard.press('ArrowRight');
await sleep(200);
check('teclado: flecha derecha desplaza (o ya está en el límite)', (await cam(p)).cx >= t0.cx);
await p.keyboard.press('+');
await sleep(200);
const t1 = await cam(p);
check('teclado: «+» acerca', t1.s >= t0.s);
await p.keyboard.press('0');
await sleep(300);
const t2 = await cam(p);
check('teclado: «0» = ver toda la fortaleza', Math.abs(t2.s - Math.min(t2.vp.width / 1536, t2.vp.height / 1024)) < 1e-3);
const wholeVisible = t2.rect.left >= t2.vp.left - 0.5 && t2.rect.right <= t2.vp.right + 0.5 && t2.rect.top >= t2.vp.top - 0.5 && t2.rect.bottom <= t2.vp.bottom + 0.5;
check('«ver toda»: la escena completa cabe en el viewport', wholeVisible);
await p.close();

// Viewports
for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 768]]) {
  scenario('wall4');
  const q = await open(w, h);
  const k = await cam(q);
  const f = Math.min(k.vp.width / 1536, k.vp.height / 1024);
  check(`${w}×${h}: encuadre cercano sin márgenes`, k.s >= f - 1e-6 && k.rect.left <= k.vp.left + 0.5 && k.rect.right >= k.vp.right - 0.5 && k.rect.top <= k.vp.top + 0.5 && k.rect.bottom >= k.vp.bottom - 0.5, `s=${k.s} fit=${f.toFixed(3)}`);
  let okAll = true;
  const got = {};
  for (const b of buildings) {
    let kk = await cam(q);
    let sp = toScreen(kk, b.x, b.y);
    for (let a = 0; a < 6 && !(sp.x > kk.vp.left + 20 && sp.x < kk.vp.right - 20 && sp.y > kk.vp.top + 20 && sp.y < kk.vp.bottom - 20); a++) {
      const cxv = kk.vp.left + kk.vp.width / 2, cyv = kk.vp.top + kk.vp.height / 2;
      await q.mouse.move(cxv, cyv);
      await q.mouse.down();
      await q.mouse.move(cxv + Math.max(-250, Math.min(250, cxv - sp.x)), cyv + Math.max(-200, Math.min(200, cyv - sp.y)), { steps: 5 });
      await q.mouse.up();
      await sleep(200);
      kk = await cam(q);
      sp = toScreen(kk, b.x, b.y);
    }
    await q.mouse.click(sp.x, sp.y);
    await sleep(300);
    got[b.t] = await title(q);
    if (got[b.t] !== names[b.t]) okAll = false;
    await closeInsp(q);
    await sleep(120);
  }
  check(`${w}×${h}: los 6 edificios alcanzables (con arrastre si hace falta) y clic correcto`, okAll, JSON.stringify(got));
  await q.close();
}
check('sin errores de consola ni respuestas ≥ 400', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
browser.disconnect();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
