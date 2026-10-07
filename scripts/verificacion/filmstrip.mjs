import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

/**
 * TIRA DE FOTOGRAMAS (NO es un clip): usa el gancho de depuración `__senoriosLive.seek(t)` para dibujar instantes concretos y recorta
 * una región de la escena de la Fortaleza (coordenadas del lienzo 1536×1024). Sirve para revisar rutas/profundidad cuando no hay
 * grabación de vídeo disponible; no sustituye a un clip real.
 * node filmstrip.mjs <url> <salida.png> <x,y,w,h> <t0> <t1> <paso> [cols]
 */
const [URL, OUT, REGION, T0, T1, STEP, COLS = '5'] = process.argv.slice(2);
const [rx, ry, rw, rh] = REGION.split(',').map(Number);
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('senorios.debugLive', '1');
  localStorage.setItem('senorios.district', 'fortress');
});
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
await new Promise((r) => setTimeout(r, 1500));
const frames = [];
for (let t = Number(T0); t <= Number(T1) + 1e-6; t += Number(STEP)) {
  await p.evaluate((tt) => window.__senoriosLive.seek(tt), t);
  await new Promise((r) => setTimeout(r, 80));
  const box = await p.evaluate(() => document.querySelector('.stage-frame').getBoundingClientRect().toJSON());
  const sx = box.width / 1536;
  const buf = await p.screenshot({ clip: { x: box.x + rx * sx, y: box.y + ry * sx, width: rw * sx, height: rh * sx }, encoding: 'base64' });
  frames.push({ t, data: buf });
}
const sheet = await p.evaluate(async (frames, cols) => {
  const imgs = await Promise.all(frames.map((f) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + f.data; })));
  const w = imgs[0].width, h = imgs[0].height, rows = Math.ceil(imgs.length / cols);
  const c = document.createElement('canvas'); c.width = w * cols; c.height = (h + 22) * rows;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.font = '16px sans-serif'; x.fillStyle = '#fff';
  imgs.forEach((im, i) => { const cx = (i % cols) * w, cy = Math.floor(i / cols) * (h + 22); x.drawImage(im, cx, cy + 22); x.fillText('t = ' + frames[i].t.toFixed(1) + ' s', cx + 6, cy + 16); });
  return c.toDataURL('image/png');
}, frames, Number(COLS));
fs.writeFileSync(OUT, Buffer.from(sheet.split(',')[1], 'base64'));
console.log('ok', OUT, frames.length, 'fotogramas');
await p.close();
b.disconnect();
