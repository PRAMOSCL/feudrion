import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = process.env.OUT || 'E:\\Github Repo\\feudrion\\docs\\capturas';
fs.mkdirSync(OUT, { recursive: true });

/** usage: node shot.mjs <baseUrl> <scenario...>  (scenarios: name@WxH) */
const [base, ...scenarios] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const consoleErrors = [];

async function open(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${e.message}`));
  await page.goto(base, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 900));
  return page;
}
const clickText = async (page, sel, text) => {
  const ok = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(text));
    if (el) el.click();
    return !!el;
  }, sel, text);
  if (!ok) console.log('NO ENCONTRADO', sel, text);
  await new Promise((r) => setTimeout(r, 700));
};
const snap = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('ok', name);
};

for (const sc of scenarios) {
  const [name, size] = sc.split('@');
  const [w, h] = size.split('x').map(Number);
  const page = await open(w, h);
  if (name === 'ciudad-inspector-abierto') await snap(page, `${name}-${w}x${h}`);
  else if (name === 'ciudad-inspector-cerrado') {
    await page.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
    await new Promise((r) => setTimeout(r, 600));
    await snap(page, `${name}-${w}x${h}`);
  } else if (name === 'mundo') {
    await clickText(page, '.nav-item', 'Mundo');
    await snap(page, `mundo-vacio-${w}x${h}`);
    await page.evaluate(() => document.querySelector('.site-hit')?.click());
    await new Promise((r) => setTimeout(r, 600));
    await snap(page, `mundo-seleccion-${w}x${h}`);
  } else if (name === 'ejercito') {
    await clickText(page, '.nav-item', 'Ejército');
    await snap(page, `ejercito-${w}x${h}`);
  } else if (name === 'informes') {
    await clickText(page, '.nav-item', 'Informes');
    await snap(page, `informes-${w}x${h}`);
  } else if (name === 'ciudad-obra') {
    await page.evaluate(() => document.querySelector('.anchor-btn[aria-label^="Aserradero"]')?.click());
    await new Promise((r) => setTimeout(r, 700));
    await snap(page, `ciudad-obra-${w}x${h}`);
  } else if (name === 'nav-colapsada') {
    await page.evaluate(() => document.querySelector('[aria-label="Ocultar menú lateral"]')?.click());
    await new Promise((r) => setTimeout(r, 700));
    await snap(page, `ciudad-nav-colapsada-${w}x${h}`);
  } else if (name === 'foco-teclado') {
    await page.evaluate(() => document.querySelector('.anchor-btn[aria-label^="Granja"]')?.focus());
    await new Promise((r) => setTimeout(r, 500));
    const vis = await page.evaluate(() => !!document.querySelector('.anchor-btn:focus .chip-label'));
    console.log('etiqueta visible al enfocar con teclado:', vis);
    await snap(page, `ciudad-foco-teclado-${w}x${h}`);
  } else if (name === 'tablet-drawer') {
    await snap(page, `ciudad-tablet-cerrado-${w}x${h}`);
    await page.evaluate(() => document.querySelector('.anchor-btn')?.click());
    await new Promise((r) => setTimeout(r, 600));
    await snap(page, `ciudad-tablet-drawer-${w}x${h}`);
  }
  await page.close();
}
console.log('ERRORES DE CONSOLA:', consoleErrors.length ? consoleErrors : 'ninguno');
await browser.close();
