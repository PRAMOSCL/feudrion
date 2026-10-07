import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.argv[2];
const OUT = 'E:\\Github Repo\\feudrion\\docs\\capturas\\flujo';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', name, extra);
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1672, height: 941, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
const api = async () => (await fetch(WEB + 'api/state')).json();
const text = (sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
const nav = async (name) => {
  await page.evaluate((n) => [...document.querySelectorAll('.nav-item')].find((e) => e.textContent.trim().startsWith(n))?.click(), name);
  await sleep(500);
};
const clickBtn = async (txt, scope = 'body') => {
  const ok = await page.evaluate((txt, scope) => {
    const b = [...document.querySelector(scope).querySelectorAll('button')].find((e) => e.textContent.trim().startsWith(txt) && !e.disabled);
    b?.click();
    return !!b;
  }, txt, scope);
  await sleep(700);
  return ok;
};
const stageClick = async (sx, sy) => {
  const r = await page.evaluate(() => {
    const b = document.querySelector('.stage-frame').getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await page.mouse.click(r.l + (sx / 1536) * r.w, r.t + (sy / 1024) * r.h);
  await sleep(600);
};

// esperar a que no haya obra activa
for (let i = 0; i < 40; i++) {
  const s = await api();
  if (!s.buildings.some((b) => b.construction)) break;
  await sleep(3000);
}
await page.goto(WEB, { waitUntil: 'networkidle0' });
await sleep(1200);

// 1) Ciudad: clic por silueta (almacén a través del margen transparente del castillo) y parcela libre
await stageClick(720, 248);
check('hit-test silueta: clic en margen transparente del castillo abre Almacén', (await text('.insp-head h2')) === 'Almacén', await text('.insp-head h2'));
await stageClick(350, 292);
check('clic en parcela libre abre Cantera', (await text('.insp-head h2')) === 'Cantera');
const before = await api();
check('construir cantera (UI)', await clickBtn('Construir', '.inspector'));
const after = await api();
check('obra registrada en servidor', after.buildings.find((b) => b.type === 'quarry').construction?.targetLevel === 1);
check('recursos descontados por el servidor', after.resources.wood.amount < before.resources.wood.amount);
check('cola de construcción visible en el inspector', /Cantera · Nivel 1/.test(await text('.inspector')));
await page.screenshot({ path: `${OUT}\\1-ciudad-obra-iniciada.png` });
check('segunda obra bloqueada (una activa por ciudad)', !(await page.evaluate(() => [...document.querySelectorAll('.inspector button')].some((b) => /^(Construir|Mejorar)/.test(b.textContent.trim()) && !b.disabled))));

// 2) Ejército: reclutar con stepper
await nav('Ejército');
const q0 = (await api()).recruitQueue.length;
await page.evaluate(() => {
  const inp = document.querySelector('.unit-card input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(inp, '3');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);
check('stepper valida: 3 lanceros', (await page.$eval('.unit-card input', (e) => e.value)) === '3');
await clickBtn('Reclutar', '.unit-cards');
const s2 = await api();
check('reclutamiento en cola (servidor)', s2.recruitQueue.length === q0 + 1 && s2.recruitQueue.at(-1).quantity === 3);
await page.screenshot({ path: `${OUT}\\2-ejercito-reclutando.png`, fullPage: false });

// 3) Mundo: enviar expedición
await nav('Mundo');
await page.evaluate(() => document.querySelector('.site-hit').click());
await sleep(500);
await page.evaluate(() => {
  const inp = document.querySelector('.troop-rows input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(inp, '10');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);
const homeBefore = (await api()).units.find((u) => u.type === 'lancero').home;
check('enviar expedición (UI)', await clickBtn('Enviar expedición', '.inspector'));
const s3 = await api();
check('expedición registrada y tropas no disponibles', s3.expeditions.length >= 1 && s3.units.find((u) => u.type === 'lancero').home === homeBefore - 10);
await page.screenshot({ path: `${OUT}\\3-mundo-expedicion.png` });

// 4) Esperar llegada + regreso (60 s + 60 s) y comprobar informe
const reportsBefore = s3.reports.length;
console.log('esperando combate y regreso (~125 s)…');
for (let i = 0; i < 60; i++) {
  await sleep(3000);
  const s = await api();
  if (!s.expeditions.some((e) => e.camp === 'bandidos' && e.sentAt === s3.expeditions.at(-1).sentAt) && s.reports.length > reportsBefore) break;
}
await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
await nav('Informes');
const s4 = await api();
check('informe creado y entregado una sola vez', s4.reports.length === reportsBefore + 1 && s4.reports[0].delivered !== null, JSON.stringify(s4.reports[0].delivered));
check('informe visible tras recargar (persistencia)', /Victoria|Derrota/.test(await text('.report-detail h2')), await text('.report-detail h2'));
await page.screenshot({ path: `${OUT}\\4-informes-tras-recargar.png` });
check('sin errores de consola', errors.length === 0, JSON.stringify(errors));
await browser.close();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
