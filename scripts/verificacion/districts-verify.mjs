import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';

/**
 * Verificación de la fase 2 (distritos) en el navegador contra una instancia con BASE TEMPORAL.
 * node districts-verify.mjs <url> <db> <scenario.cjs> <api>      (requiere Edge headless con --remote-debugging-port=9333)
 */
const [URL, DB, SCEN, API = 'http://127.0.0.1:3003'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = (n) => execFileSync('node', [SCEN, DB, n], { stdio: 'pipe' });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
};
const state = async () => (await fetch(API + '/api/state')).json();

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const errors = [];
async function open(w = 1672, h = 941, opts = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  if (opts.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument((district) => {
    localStorage.setItem('senorios.debugLive', '1');
    if (district === null && !sessionStorage.getItem('__reset')) { localStorage.removeItem('senorios.district'); sessionStorage.setItem('__reset', '1'); }
  }, opts.district === null ? null : 'keep');
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1200);
  return p;
}
const tab = (p, name) => p.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.trim().startsWith(n))?.click(), name);
const counts = (p) => p.evaluate(() => ({ actors: document.querySelectorAll('.live-actors').length, water: document.querySelectorAll('.live-water').length, plan: document.querySelectorAll('.plan-svg').length, frame: document.querySelectorAll('.stage-frame').length }));
const stageClick = async (p, sx, sy, w, h) => {
  const r = await p.evaluate(() => {
    const b = document.querySelector('.stage-frame').getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await p.mouse.click(r.l + (sx / w) * r.w, r.t + (sy / h) * r.h);
  await sleep(500);
  return p.$eval('.insp-head h2', (e) => e.textContent).catch(() => '');
};

scenario('wall2');
let p = await open(1672, 941, { district: null });

// 1) Selector
const tabs = await p.$$eval('[role=tab]', (els) => els.map((e) => ({ t: e.textContent.trim(), sel: e.getAttribute('aria-selected') })));
check('selector: pestañas Fortaleza y Villa (Fortaleza seleccionada)', tabs.length === 2 && tabs[0].t.startsWith('Fortaleza') && tabs[0].sel === 'true' && tabs[1].t.startsWith('Villa'), JSON.stringify(tabs));
const future = await p.$$eval('.district-future li', (els) => els.map((e) => ({ t: e.textContent.trim(), tag: e.tagName, focusable: e.tabIndex >= 0 })));
check('Oficios y Campo: notas «futuro», no botones ni enfocables', future.length === 2 && future.every((f) => f.tag === 'LI' && !f.focusable && /futuro/.test(f.t)), JSON.stringify(future));
check('Fortaleza inicial: terreno, un bucle de agua y uno de personajes', JSON.stringify(await counts(p)) === JSON.stringify({ actors: 1, water: 1, plan: 0, frame: 1 }), JSON.stringify(await counts(p)));

// 2) Selección en Fortaleza y estado previo
const stateA = await state();
const sawName = await (async () => {
  const r = await p.evaluate(() => { const b = document.querySelector('.stage-frame').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  await p.mouse.click(r.l + (305 / 1536) * r.w, r.t + (440 / 1024) * r.h);
  await sleep(500);
  return p.$eval('.insp-head h2', (e) => e.textContent);
})();
check('Fortaleza: clic en el aserradero abre su inspector', sawName === 'Aserradero', sawName);

// 3) Cambiar a Villa
await tab(p, 'Villa');
await sleep(700);
let c = await counts(p);
check('Villa: se descarta la escena anterior (0 bucles animados) y aparece el plano', c.actors === 0 && c.water === 0 && c.plan === 1, JSON.stringify(c));
check('Villa: aviso «parcelas planificadas» (con terreno, sin construcciones)', (await p.$eval('.plan-banner', (e) => e.textContent)).includes('parcelas planificadas'));
const anchors = await p.$$eval('.plan-anchor', (els) => els.map((e) => e.getAttribute('aria-label')));
check('Villa: 8 parcelas, todas «planificado, mecánica pendiente»', anchors.length === 8 && anchors.every((a) => a.includes('planificado, mecánica pendiente')), String(anchors.length));
check('Villa: sin botones de construir/mejorar en la escena', (await p.$$eval('button', (bs) => bs.filter((b) => /^(Construir|Mejorar)/.test(b.textContent.trim())).length)) === 0);
const vFrame = await p.evaluate(() => document.querySelector('.stage-frame').getBoundingClientRect().toJSON());
// iglesia (0.65, 0.26) → clic por la inversa de la transformación
const ch = await stageClick(p, 860, 268, 1536, 1024);
check('Villa: clic en la parcela de la iglesia abre «Iglesia» (inversa de la transformación)', ch === 'Iglesia', ch);
check('Inspector planificado: «Planificado · mecánica pendiente» y sin CTA de construir', (await p.$eval('.inspector', (e) => e.textContent)).includes('Planificado · mecánica pendiente') && (await p.$$('.inspector .btn-primary')).length === 0);
check('clic sobre una calle (entrada) no selecciona nada nuevo', (await stageClick(p, 300, 190, 1536, 1024)) === 'Iglesia');

// 4) Volver a Fortaleza: una sola escena, selección conservada
await tab(p, 'Fortaleza');
await sleep(900);
c = await counts(p);
check('Fortaleza otra vez: exactamente 1 bucle de agua y 1 de personajes (sin duplicados)', c.actors === 1 && c.water === 1 && c.plan === 0, JSON.stringify(c));
check('la selección de la Fortaleza (Aserradero) se conserva', (await p.$eval('.insp-head h2', (e) => e.textContent)) === 'Aserradero');
for (let i = 0; i < 6; i++) {
  await tab(p, 'Villa');
  await sleep(120);
  await tab(p, 'Fortaleza');
  await sleep(120);
}
await sleep(800);
c = await counts(p);
check('12 cambios rápidos de escena: sigue habiendo 1 bucle de agua y 1 de personajes', c.actors === 1 && c.water === 1, JSON.stringify(c));
const f0 = await p.evaluate(() => window.__senoriosLive.snapshot().actorFrames);
await sleep(1500);
const f1 = await p.evaluate(() => window.__senoriosLive.snapshot().actorFrames);
check('sin animadores duplicados: ≤ ~30 fps de personajes tras los cambios', (f1 - f0) / 1.5 <= 34 && f1 > f0, `${((f1 - f0) / 1.5).toFixed(1)} fps`);
await p.evaluate(() => document.querySelector('[aria-label^="Desactivar animaciones"]').click());
await tab(p, 'Villa');
await sleep(300);
await tab(p, 'Fortaleza');
await sleep(500);
check('animaciones desactivadas se respetan tras cambiar de escena', !(await p.evaluate(() => window.__senoriosLive.snapshot().running)));
await p.evaluate(() => document.querySelector('[aria-label^="Activar animaciones"]').click());

// 5) Teclado
await p.focus('#district-tab-fortress');
await p.keyboard.press('ArrowRight');
await sleep(500);
check('teclado: ArrowRight pasa a Villa y mueve el foco', (await p.evaluate(() => document.activeElement?.id)) === 'district-tab-village' && (await counts(p)).plan === 1);
await p.keyboard.press('Tab');
await sleep(200);
check('teclado: Tab llega a una parcela planificada y Enter abre su inspector', await (async () => {
  await p.keyboard.press('Enter');
  await sleep(400);
  return (await p.$eval('.inspector', (e) => e.getAttribute('aria-label'))).startsWith('Inspector: ');
})());
await p.keyboard.press('Home');
await p.focus('#district-tab-village');
await p.keyboard.press('ArrowLeft');
await sleep(600);
check('teclado: ArrowLeft vuelve a Fortaleza', (await counts(p)).actors === 1);

// 6) Persistencia: Villa → recargar
await tab(p, 'Villa');
await sleep(400);
await p.reload({ waitUntil: 'networkidle0' });
await sleep(1200);
check('recargar conserva el distrito elegido (Villa)', (await counts(p)).plan === 1 && (await p.$eval('[role=tab][aria-selected=true]', (e) => e.textContent)).startsWith('Villa'));
await tab(p, 'Fortaleza');
await sleep(600);
const stateB = await state();
const same = JSON.stringify(stateA.buildings.map((b) => [b.type, b.level, b.workers, b.districtId, b.plotId])) === JSON.stringify(stateB.buildings.map((b) => [b.type, b.level, b.workers, b.districtId, b.plotId]));
check('ciudad idéntica tras Fortaleza→Villa→Fortaleza→recarga (edificios, niveles, trabajadores, parcelas)', same);
check('guarnición idéntica', JSON.stringify(stateA.garrison) === JSON.stringify(stateB.garrison));
check('recursos: solo el tick legítimo (nunca disminuyen ni se regalan)', ['wood', 'stone', 'food', 'gold'].every((r) => stateB.resources[r].amount >= stateA.resources[r].amount - 1e-6 && stateB.resources[r].amount <= stateA.resources[r].capacity));
check('sin duplicación de edificios (7 filas, 7 parcelas únicas)', new Set(stateB.buildings.map((b) => b.plotId)).size === 7 && stateB.buildings.length === 7);
await p.close();

// 7) API: planificados no se construyen
const post = (u) => fetch(API + u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: '{}' });
const r1 = await post('/api/buildings/church/upgrade');
const j1 = await r1.json();
check('API: «church» (planificado) responde 409 PLANNED_ONLY y no gasta nada', r1.status === 409 && j1.error.code === 'PLANNED_ONLY');
const after = await state();
check('API: tras intentarlo no hay obras ni edificios nuevos', after.buildings.length === 7 && !after.buildings.some((b) => b.construction && b.type !== 'wall' && b.type !== 'sawmill'));

// 8) Viewports, tablet y errores
for (const [w, h] of [[1672, 941], [1920, 1080], [1366, 768], [1024, 768]]) {
  scenario('wall2');
  const q = await open(w, h, { district: null });
  const bar = await q.$eval('.district-bar', (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sw: e.scrollWidth <= e.clientWidth + 1 }; });
  check(`${w}×${h}: selector visible sin desbordar`, bar.h > 20 && bar.sw, JSON.stringify(bar));
  await tab(q, 'Villa');
  await sleep(500);
  const g = await stageClick(q, 860, 268, 1536, 1024);
  check(`${w}×${h}: Villa → clic en Iglesia abre su inspector`, g === 'Iglesia', g);
  if (w <= 1100) await q.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await tab(q, 'Fortaleza');
  await sleep(500);
  if (w <= 1100) await q.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  const gate = await stageClick(q, 1292, 800, 1536, 1024);
  check(`${w}×${h}: Fortaleza → el portón sigue abriendo Muralla`, gate === 'Muralla', gate);
  await q.close();
}
check('sin errores de consola ni respuestas ≥ 400 (sin 404)', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
browser.disconnect();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
