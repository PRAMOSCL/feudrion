import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Graba un clip del juego a velocidad NORMAL (sin seek) con la captura de pantalla de CDP (Page.startScreencast):
 * encuadre inicial → acercamiento a puente/cascadas → pausa (animaciones desactivadas) → reanudación.
 * node clip31.mjs <url> <db> <scenario.cjs> <outDir>   → escribe frames JPEG + frames.json (marcas de tiempo). El GIF se arma con make_gif.py.
 */
const [URL, DB, SCEN, OUT] = process.argv.slice(2);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
for (const f of fs.readdirSync(path.join(OUT, 'frames'))) fs.unlinkSync(path.join(OUT, 'frames', f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
execFileSync('node', [SCEN, DB, 'wall5'], { stdio: 'pipe' });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await browser.newPage();
await p.setViewport({ width: 1672, height: 941, deviceScaleFactor: 1 });
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('senorios.district', 'fortress');
  localStorage.removeItem('senorios.animations');
  localStorage.removeItem('senorios.debugPaths');
  localStorage.removeItem('senorios.debugLive');
});
await p.goto(URL, { waitUntil: 'networkidle0' });
await sleep(1500);
await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
await sleep(500);

const cdp = await p.createCDPSession();
const frames = [];
let n = 0;
cdp.on('Page.screencastFrame', async (f) => {
  const i = n++;
  fs.writeFileSync(path.join(OUT, 'frames', `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(f.data, 'base64'));
  frames.push({ i, t: f.metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const marks = {};
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
const t0 = Date.now();
const mark = (k) => (marks[k] = (Date.now() - t0) / 1000);
mark('inicio-encuadre-inicial');
await sleep(7000);
// acercamiento al puente y las cascadas: vista completa → rueda del ratón sobre el puente (la cámara conserva el punto bajo el cursor)
mark('acercamiento');
await p.click('[aria-label="Ver toda la fortaleza"]');
await sleep(800);
const cam = await p.evaluate(() => { const f = document.querySelector('.stage-frame'); const r = f.getBoundingClientRect(); return { s: +f.dataset.cameraScale, l: r.left, t: r.top }; });
await p.mouse.move(cam.l + 1290 * cam.s, cam.t + 885 * cam.s);
for (let k = 0; k < 4; k++) { await p.mouse.wheel({ deltaY: -250 }); await sleep(250); }
await sleep(600);
// llevar el puente y las cascadas (escena 1250,900) hacia el centro con arrastres reales del ratón (la cámara limita el desplazamiento)
for (let k = 0; k < 4; k++) {
  const c = await p.evaluate(() => { const f = document.querySelector('.stage-frame'); const r = f.getBoundingClientRect(); const v = document.querySelector('.stage-viewport').getBoundingClientRect(); return { s: +f.dataset.cameraScale, l: r.left, t: r.top, vx: v.left + v.width / 2, vy: v.top + v.height / 2 }; });
  const dx = c.vx - (c.l + 1250 * c.s), dy = c.vy - (c.t + 900 * c.s);
  if (Math.hypot(dx, dy) < 30) break;
  const sx = c.vx, sy = c.vy;
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  await p.mouse.move(sx + Math.max(-300, Math.min(300, dx)), sy + Math.max(-250, Math.min(250, dy)), { steps: 8 });
  await p.mouse.up();
  await sleep(300);
}
await sleep(4500);
mark('pausa (animaciones desactivadas)');
await p.evaluate(() => document.querySelector('[aria-label^="Desactivar animaciones"]').click());
await sleep(2500);
mark('reanudación');
await p.evaluate(() => document.querySelector('[aria-label^="Activar animaciones"]').click());
await sleep(3500);
mark('fin');
await cdp.send('Page.stopScreencast');
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ frames, marks, total: (Date.now() - t0) / 1000 }));
console.log('frames', frames.length, 'duración', ((Date.now() - t0) / 1000).toFixed(1), 's', marks);
await p.close();
browser.disconnect();
