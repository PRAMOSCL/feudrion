import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const WEB = process.argv[2];
const sizes = [[1672, 941], [1920, 1080], [1366, 768], [1024, 768]];
const expected = { bandidos: 'Campamento de bandidos', fortin: 'Fortín de saqueadores', bastion: 'Bastión del señor de la guerra' };
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
let allOk = true;
const errors = [];
for (const [w, h] of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto(WEB, { waitUntil: 'networkidle0' });
  await page.evaluate(() => [...document.querySelectorAll('.nav-item')].find((e) => e.textContent.trim().startsWith('Mundo'))?.click());
  await new Promise((r) => setTimeout(r, 700));
  const names = await page.$$eval('.site-hit', (els) => els.map((e) => e.getAttribute('aria-label').split(',')[0]));
  for (const n of names) {
    // En tablet el inspector es un cajón que tapa parte del mapa: se cierra con su botón antes de elegir otro destino.
    if (w <= 1100) {
      await page.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
      await new Promise((r) => setTimeout(r, 400));
    }
    const s = await page.evaluate((n) => {
      const e = [...document.querySelectorAll('.site-hit')].find((x) => x.getAttribute('aria-label').startsWith(n));
      const r = e.getBoundingClientRect();
      return { name: n, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, n);
    // cerrar inspector previo para medir desde estado limpio
    await page.mouse.click(s.x, s.y);
    await new Promise((r) => setTimeout(r, 500));
    const title = await page.$eval('.insp-head h2', (e) => e.textContent).catch(() => '');
    const ok = title === s.name;
    allOk &&= ok;
    console.log(`${w}x${h}`, ok ? 'PASS' : 'FAIL', 'hotspot', s.name, '→', title);
    // el hotspot debe seguir sobre el mismo punto del arte tras abrir el inspector: recalcular y comparar posición relativa al marco
  }
  // posiciones relativas al marco del mapa (invariantes ante la escala) + solapes de etiquetas
  const rel = await page.evaluate(() => {
    const f = document.querySelector('.stage-frame').getBoundingClientRect();
    const hits = [...document.querySelectorAll('.site-hit')].map((e) => { const r = e.getBoundingClientRect(); return { n: e.getAttribute('aria-label').split(',')[0], rx: (r.left + r.width / 2 - f.left) / f.width, ry: (r.top + r.height / 2 - f.top) / f.height }; });
    const labels = [...document.querySelectorAll('.chip-label')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), l: r.left, t0: r.top, r: r.right, b: r.bottom }; });
    let overlaps = 0;
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; if (a.l < b.r && b.l < a.r && a.t0 < b.b && b.t0 < a.b) overlaps++; }
    const inside = labels.every((l) => l.l >= f.left - 1 && l.r <= f.right + 1 && l.t0 >= f.top - 1 && l.b <= f.bottom + 1);
    return { hits, overlaps, inside, scale: f.width / 1600 };
  });
  console.log(`${w}x${h}`, 'escala', rel.scale.toFixed(3), 'solapes de etiquetas', rel.overlaps, 'etiquetas dentro del mapa', rel.inside, rel.hits.map((h) => `${h.n}:${h.rx.toFixed(3)},${h.ry.toFixed(3)}`).join(' | '));
  allOk &&= rel.overlaps === 0 && rel.inside;
  await page.close();
}
console.log('ERRORES / 404:', errors.length ? errors : 'ninguno');
console.log(allOk && errors.length === 0 ? 'HOTSPOTS OK' : 'HAY PROBLEMAS');
await browser.close();
