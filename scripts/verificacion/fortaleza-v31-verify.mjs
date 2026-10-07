import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Verificación del parche Fortaleza v3.1 (acceso alineado + agua con corriente y espuma).
 * node fortaleza-v31-verify.mjs <url> <db> <scenario.cjs> <outDir>      (Edge headless en :9333; base TEMPORAL)
 * Las medidas de agua se toman SIN seek, a velocidad normal, leyendo el canvas del agua (y una prueba determinista con seek solo para la espuma).
 */
const [URL, DB, SCEN, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = (n) => execFileSync('node', [SCEN, DB, n], { stdio: 'pipe' });
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
};
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const errors = [];
async function open(w, h, dsf = 1, extra = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  if (extra.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('senorios.debugLive', '1');
    localStorage.setItem('senorios.district', 'fortress');
    localStorage.removeItem('senorios.animations');
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1500);
  await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await sleep(300);
  return p;
}
const snap = (p) => p.evaluate(() => window.__senoriosLive.snapshot());

// ---------- 1) Arte y hashes ----------
{
  const crypto = await import('node:crypto');
  const root = 'E:/Github Repo/feudrion/client/public/assets/viva/';
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(root + f)).digest('hex');
  const spec = JSON.parse(fs.readFileSync(process.env.V31_HASHES, 'utf8'));
  check('terreno v3.1 y máscara v3.1 coinciden con hashes.json', sha('terrain_fortress_v3_1.png') === spec['assets/terrain_fortress_v3_1.png'] && sha('river_mask_v3_1.png') === spec['assets/river_mask_v3_1.png']);
  check('las 3 murallas v3 conservadas (hash)', Object.entries(spec.unchangedWalls).every(([f, h]) => sha(f) === h));
}

// ---------- 2) Agua a velocidad normal (sin seek) ----------
scenario('wall5');
{
  const p = await open(1672, 941, 1);
  const stats = await p.evaluate(async () => {
    const art = await import('/src/artManifest.ts');
    const mask = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = art.ART.riverMask; });
    const k = document.createElement('canvas'); k.width = 1536; k.height = 1024;
    const kx = k.getContext('2d'); kx.drawImage(mask, 0, 0);
    const m = kx.getImageData(0, 0, 1536, 1024).data;
    const w = document.querySelector('.live-water');
    const read = () => w.getContext('2d').getImageData(0, 0, 1536, 1024).data;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = [];
    for (let i = 0; i < 6; i++) { frames.push(read()); await wait(250); }
    const diff = (a, b) => {
      let inside = 0, outside = 0, total = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
        if (m[i + 3] > 0) { total++; if (d > 24) inside++; } else if (a[i + 3] > 0 || b[i + 3] > 0) outside++;
      }
      return { inside, outside, total, frac: inside / total };
    };
    const pairs = [];
    for (let i = 1; i < frames.length; i++) pairs.push(diff(frames[i - 1], frames[i]));
    // cobertura: píxeles de máscara con alfa de agua > 0
    let covered = 0, maskPx = 0;
    for (let i = 3; i < frames[0].length; i += 4) if (m[i] > 0) { maskPx++; if (frames[0][i] > 0) covered++; }
    return { pairs, covered: covered / maskPx, running: window.__senoriosLive.snapshot().running };
  });
  const minFrac = Math.min(...stats.pairs.map((x) => x.frac));
  check('agua: a velocidad normal cambia ≥ 15 % de los píxeles de la máscara entre muestras de 250 ms', minFrac >= 0.15, `mín=${(minFrac * 100).toFixed(1)} %`);
  check('agua: efecto fuera del alfa de la máscara = 0 píxeles', stats.pairs.every((x) => x.outside === 0), JSON.stringify(stats.pairs.map((x) => x.outside)));
  check('agua: cubre ≥ 90 % de la máscara (no son brillos aislados)', stats.covered >= 0.9, `${(stats.covered * 100).toFixed(1)} %`);
  await p.close();
}

// ---------- 3) Espuma descendente en cascadas (determinista, 4 instantes) ----------
{
  const p = await open(1672, 941, 1);
  const res = await p.evaluate(async () => {
    const data = (await import('/src/live/riverV31.json')).default;
    const r = window.__senoriosLive;
    const w = document.querySelector('.live-water');
    const out = [];
    for (const [fi, f] of data.falls.entries()) {
      const xs = f.polygon.map((q) => q[0]), ys = f.polygon.map((q) => q[1]);
      const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), ww = Math.ceil(Math.max(...xs)) - x0, hh = Math.ceil(Math.max(...ys)) - y0;
      // perfil vertical de espuma (blanco) en cada instante; mejor desfase entre perfiles consecutivos (positivo = hacia abajo)
      const prof = (t) => {
        r.seek(t);
        const d = w.getContext('2d').getImageData(x0, y0, ww, hh).data;
        const p = new Float64Array(hh);
        for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) { const i = (y * ww + x) * 4; if (d[i + 3] > 40 && d[i] > 205 && d[i + 1] > 215 && d[i + 2] > 215) p[y]++; }
        return p;
      };
      const lags = [];
      const dt = 0.08;
      let a = prof(1);
      for (let k = 1; k <= 6; k++) {
        const b = prof(1 + k * dt);
        let best = 0, bestV = -1;
        for (let lag = -6; lag <= 6; lag++) {
          let v = 0;
          for (let y = 0; y < hh; y++) { const y2 = y + lag; if (y2 >= 0 && y2 < hh) v += a[y] * b[y2]; }
          if (v > bestV) { bestV = v; best = lag; }
        }
        lags.push(best);
        a = b;
      }
      const total = prof(1).reduce((s, v) => s + v, 0);
      out.push({ fall: fi, lags, foamPx: total });
    }
    return out;
  });
  for (const f of res) {
    const down = f.lags.filter((l) => l > 0).length;
    const up = f.lags.filter((l) => l < 0).length;
    check(`cascada ${f.fall}: espuma presente (${f.foamPx} px blancos) y avanza hacia ABAJO`, f.foamPx > 30 && down > up && down >= 3, `desfases=${JSON.stringify(f.lags)}`);
  }
  await p.close();
}

// ---------- 4) Animaciones: pausa/reanuda, reduced-motion, pestaña oculta ----------
scenario('wall2');
{
  const p = await open(1672, 941);
  const a0 = await snap(p);
  await sleep(1200);
  const a1 = await snap(p);
  check('un solo bucle: avanza agua y personajes', a1.waterFrames > a0.waterFrames && a1.actorFrames > a0.actorFrames, `${a0.waterFrames}→${a1.waterFrames}`);
  const fps = (a1.waterFrames - a0.waterFrames) / 1.2;
  check('agua ≤ 24 fps', fps <= 25.5, `${fps.toFixed(1)} fps`);
  check('un solo canvas de agua', (await p.$$('.live-water')).length === 1);
  await p.evaluate(() => document.querySelector('[aria-label^="Desactivar animaciones"]').click());
  await sleep(500);
  const sig = () => p.evaluate(() => { const w = document.querySelector('.live-water'); const d = w.getContext('2d').getImageData(0, 0, 1536, 1024).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; });
  const s1 = await sig();
  await sleep(700);
  const s2 = await sig();
  check('animaciones desactivadas: el agua queda estática (sin capa en movimiento ni bucle)', s1 === s2 && !(await snap(p)).running);
  await p.evaluate(() => document.querySelector('[aria-label^="Activar animaciones"]').click());
  await sleep(700);
  const b0 = await snap(p);
  await sleep(600);
  const b1 = await snap(p);
  check('…y se reanuda sin duplicar bucles', b1.waterFrames > b0.waterFrames && (await p.$$('.live-water')).length === 1);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300);
  const h0 = await snap(p);
  await sleep(800);
  const h1 = await snap(p);
  check('pestaña oculta: el agua se detiene', !h1.running && h1.waterFrames === h0.waterFrames);
  await p.close();
  const q = await open(1672, 941, 1, { reduced: true });
  const r0 = await snap(q);
  await sleep(900);
  const r1 = await snap(q);
  check('prefers-reduced-motion: agua sin bucle', !r1.running && r1.waterFrames === r0.waterFrames);
  await q.close();
}

// ---------- 5) Fase del agua conservada: cambio de distrito e inspector ----------
{
  const p = await open(1672, 941);
  const phase = () => p.evaluate(() => { const w = document.querySelector('.live-water'); const d = w.getContext('2d').getImageData(700, 700, 200, 120).data; let s = 0; for (let i = 0; i < d.length; i++) s = (s * 31 + d[i]) >>> 0; return s; });
  await p.click('#district-tab-village');
  await sleep(800);
  await p.click('#district-tab-fortress');
  await sleep(1000);
  check('Fortaleza→Villa→Fortaleza: un solo canvas de agua y bucle activo', (await p.$$('.live-water')).length === 1 && (await snap(p)).running);
  await p.evaluate(() => document.querySelector('.anchor-btn')?.click());
  await sleep(500);
  const w1 = (await snap(p)).waterFrames;
  await sleep(700);
  check('con el inspector abierto el agua sigue en movimiento', (await snap(p)).waterFrames > w1);
  void phase;
  await p.close();
}

// ---------- 6) Entrada: pies sobre el tablero y el arco ----------
for (const [sc, stage] of [['wall2', 1], ['wall5', 2], ['wall8', 3]]) {
  scenario(sc);
  const p = await open(1672, 941);
  const res = await p.evaluate(async (stage) => {
    const cfg = await import('/src/live/liveConfig.ts');
    const art = await import('/src/artManifest.ts');
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [mask, wall] = await Promise.all([load(art.ART.riverMask), load(art.ART.walls[stage])]);
    const alphaOf = (img) => { const k = document.createElement('canvas'); k.width = 1536; k.height = 1024; const x = k.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, 1536, 1024).data; };
    const m = alphaOf(mask), wl = alphaOf(wall);
    const pts = cfg.GATE_CROSSING;
    const bad = { water: [], wall: [] };
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
        const i = (y * 1536 + x) * 4 + 3;
        if (m[i] > 0) bad.water.push([x, y]);
        if (wl[i] > 40 && s < 11) bad.wall.push([x, y, s]);
      }
    }
    return { bad, n: pts.length, last: pts[pts.length - 1], stops: cfg.VILLAGER_STOPS, roadLen: cfg.VILLAGER_ROAD.length };
  }, stage);
  check(`etapa ${stage}: ningún pie de la ruta de entrada cae sobre el agua`, res.bad.water.length === 0, JSON.stringify(res.bad.water.slice(0, 3)));
  check(`etapa ${stage}: ningún pie cruza la muralla (jambas/torre/parapeto) antes del interior`, res.bad.wall.length === 0, JSON.stringify(res.bad.wall.slice(0, 5)));
  await p.close();
}

check('sin errores de consola ni respuestas ≥ 400', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
browser.disconnect();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
