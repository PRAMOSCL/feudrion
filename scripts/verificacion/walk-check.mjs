import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

/**
 * Comprueba las hojas de caminata v2 con los rectángulos y pivotes REALES del atlas (misma lógica que el renderer):
 *  - ninguna figura toca el borde de su rectángulo (no hay botas/brazos recortados),
 *  - el pivote cae sobre píxeles opacos de los pies,
 *  - dibuja una tira a altura real (36 px) y ampliada ×4 para revisión visual.
 * node walk-check.mjs <url-del-juego> <salida.png>
 */
const [URL, OUT] = process.argv.slice(2);
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
const res = await p.evaluate(async () => {
  const atlas = (await import('/src/live/atlasV2.json')).default;
  const out = { sheets: {}, strip: '' };
  const rows = [];
  for (const [name, def] of Object.entries(atlas.sheets)) {
    const img = new Image();
    img.src = '/assets/viva/' + def.file.split('/').pop();
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const problems = [];
    const frames = def.order.map((i) => def.frames[i]);
    frames.forEach((f, i) => {
      const [sx, sy, w, h] = f.rect;
      const d = x.getImageData(sx, sy, w, h).data;
      const a = (px, py) => d[(py * w + px) * 4 + 3];
      let edge = 0;
      for (let k = 0; k < w; k++) { if (a(k, 0) > 40) edge++; if (a(k, h - 1) > 40) edge++; }
      for (let k = 0; k < h; k++) { if (a(0, k) > 40) edge++; if (a(w - 1, k) > 40) edge++; }
      if (edge > 0) problems.push(`pose ${i}: ${edge} px opacos en el borde del rectángulo (posible recorte)`);
      // pies: algún píxel opaco a ≤ 12 px bajo/sobre el pivote y centrado
      const [pxv, pyv] = f.pivot;
      let feet = 0;
      for (let dy = -20; dy <= 6; dy++) for (let dx = -90; dx <= 90; dx++) {
        const qx = Math.round(pxv) + dx, qy = Math.round(pyv) + dy;
        if (qx >= 0 && qx < w && qy >= 0 && qy < h && a(qx, qy) > 160) feet++;
      }
      if (feet < 30) problems.push(`pose ${i}: pocos píxeles opacos junto al pivote (${feet})`);
      // altura de la figura frente a referenceHeight
      let top = h;
      for (let yy = 0; yy < h && top === h; yy++) for (let xx = 0; xx < w; xx++) if (a(xx, yy) > 160) { top = yy; break; }
      const height = pyv - top;
      if (Math.abs(height - def.referenceHeight) / def.referenceHeight > 0.12) problems.push(`pose ${i}: altura ${Math.round(height)} vs referencia ${def.referenceHeight}`);
    });
    out.sheets[name] = problems;
    // tira: altura 36 px (escala común), pies alineados, ampliada ×4
    const H = 36, s = H / def.referenceHeight, Z = 4;
    const strip = document.createElement('canvas');
    strip.width = 8 * 70 * Z;
    strip.height = 60 * Z;
    const sc = strip.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.fillStyle = '#6b7f3a';
    sc.fillRect(0, 0, strip.width, strip.height);
    frames.forEach((f, i) => {
      const [sx, sy, w, h] = f.rect;
      const ox = i * 70 * Z + 35 * Z;
      const oy = 50 * Z;
      sc.drawImage(img, sx, sy, w, h, ox - f.pivot[0] * s * Z, oy - f.pivot[1] * s * Z, w * s * Z, h * s * Z);
      sc.strokeStyle = 'rgba(255,0,0,.6)';
      sc.beginPath(); sc.moveTo(i * 70 * Z, oy); sc.lineTo((i + 1) * 70 * Z, oy); sc.stroke();
    });
    rows.push({ name, url: strip.toDataURL('image/png'), w: strip.width, h: strip.height });
  }
  const sheet = document.createElement('canvas');
  sheet.width = rows[0].w;
  sheet.height = rows.reduce((s, r) => s + r.h, 0);
  const sx = sheet.getContext('2d');
  let y = 0;
  for (const r of rows) {
    const im = new Image();
    im.src = r.url;
    await im.decode();
    sx.drawImage(im, 0, y);
    y += r.h;
  }
  out.strip = sheet.toDataURL('image/png');
  return out;
});
fs.writeFileSync(OUT, Buffer.from(res.strip.split(',')[1], 'base64'));
let ok = true;
for (const [k, v] of Object.entries(res.sheets)) {
  console.log(v.length ? 'AVISO' : 'PASS', k, v.length ? JSON.stringify(v) : '8 poses sin recorte, pies sobre el pivote');
  if (v.length) ok = false;
}
console.log(ok ? 'HOJAS OK' : 'REVISAR');
await p.close();
b.disconnect();
