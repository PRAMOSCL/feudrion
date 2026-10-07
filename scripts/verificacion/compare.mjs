import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const IMG = 'C:/Users/Erwin/AppData/Local/Temp/claude/E--Github-Repo-feudrion/f3a19ea0-9026-47a8-9107-c28523926492/images';
const CAP = 'E:/Github Repo/feudrion/docs/capturas';
const OUT = 'E:/Github Repo/feudrion/docs/capturas/comparacion';
fs.mkdirSync(OUT, { recursive: true });
const pairs = [
  ['ciudad', `${IMG}/1.webp`, `${CAP}/ciudad-inspector-abierto-1672x941.png`],
  ['ejercito', `${IMG}/2.webp`, `${CAP}/poblado/ejercito-1672x941.png`],
  ['informes', `${IMG}/3.webp`, `${CAP}/poblado/informes-1672x941.png`],
  ['mundo', `${IMG}/4.webp`, `${CAP}/poblado/mundo-seleccion-1672x941.png`],
];
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
for (const [name, ref, ours] of pairs) {
  const html = `<html><body style="margin:0;background:#000;display:flex;font:14px sans-serif;color:#fff">
  <div style="width:836px"><div style="padding:4px">Referencia</div><img src="file:///${ref}" style="width:836px;display:block"></div>
  <div style="width:836px"><div style="padding:4px">Implementación</div><img src="file:///${ours}" style="width:836px;display:block"></div></body></html>`;
  const f = `${process.cwd()}/cmp-${name}.html`;
  fs.writeFileSync(f, html);
  const p = await b.newPage();
  await p.setViewport({ width: 1672, height: 500, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(f).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: OUT + '/' + name + '-referencia-vs-implementacion.png', fullPage: true });
  console.log('ok', name);
  await p.close();
}
await b.close();
