import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

/**
 * node live-shot.mjs <url> <out.png> <WxH> [js-to-run-before] [waitMs] [clip x,y,w,h] [scale]
 * Se conecta al Edge headless ya iniciado con --remote-debugging-port=9333.
 */
const [url, out, size, pre = '', wait = '2500', clipArg = '', scaleArg = '1'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' :: ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')));
p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
await p.setViewport({ width: w, height: h, deviceScaleFactor: Number(scaleArg) });
await p.goto(url, { waitUntil: 'networkidle0' });
if (pre) await p.evaluate(pre);
await new Promise((r) => setTimeout(r, Number(wait)));
const clip = clipArg ? (([x, y, cw, ch]) => ({ x, y, width: cw, height: ch }))(clipArg.split(',').map(Number)) : undefined;
fs.mkdirSync(out.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
await p.screenshot({ path: out, clip });
console.log('ok', out, errors.length ? 'ERRORES: ' + JSON.stringify(errors) : 'sin errores');
await p.close();
b.disconnect();
