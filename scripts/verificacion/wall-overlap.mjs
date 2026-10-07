import puppeteer from 'puppeteer-core';

/**
 * Cuenta píxeles donde la silueta de cada edificio actual (en su posición real de `sceneConfig`) coincide con píxeles opacos del overlay
 * de cada etapa de muralla, y comprueba que la cabaña/embarcadero (x170–450, y660–870) queda libre de muralla.
 * node wall-overlap.mjs <url-del-juego>
 */
const URL = process.argv[2];
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle0' });
const res = await p.evaluate(async () => {
  const sc = await import('/src/sceneConfig.ts');
  const art = (await import('/src/artManifest.ts')).ART;
  const load = async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    return i;
  };
  const wallData = {};
  for (const s of [1, 2, 3]) {
    const i = await load(art.walls[s]);
    const c = document.createElement('canvas');
    c.width = 1536;
    c.height = 1024;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(i, 0, 0);
    wallData[s] = x.getImageData(0, 0, 1536, 1024).data;
  }
  const out = {};
  for (const [type, src] of Object.entries(sc.SPRITE_SRC)) {
    const i = await load(src);
    const box = sc.spriteBox(type);
    const c = document.createElement('canvas');
    c.width = 1536;
    c.height = 1024;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(i, box.left, box.top, box.size, box.size);
    const bd = x.getImageData(0, 0, 1536, 1024).data;
    out[type] = {};
    for (const s of [1, 2, 3]) {
      let n = 0;
      for (let k = 3 + 470 * 1536 * 4; k < bd.length; k += 4) if (bd[k] > 40 && wallData[s][k] > 40) n++; // solo la capa DELANTERA (y ≥ 470): la trasera queda detrás de los edificios por diseño
      out[type][s] = n;
    }
  }
  out.cabana = {};
  for (const s of [1, 2, 3]) {
    let n = 0;
    for (let y = 660; y < 870; y++) for (let xx = 170; xx < 450; xx++) if (wallData[s][(y * 1536 + xx) * 4 + 3] > 40) n++;
    out.cabana[s] = n;
  }
  return out;
});
console.log('Píxeles de edificio cubiertos por muralla (por etapa 1/2/3) y muralla dentro del rectángulo de la cabaña:');
let bad = false;
for (const [k, v] of Object.entries(res)) {
  console.log(k.padEnd(10), JSON.stringify(v));
  if (k !== 'cabana' && (v[1] > 0 || v[2] > 0 || v[3] > 0)) bad = true;
}
console.log(bad ? 'HAY SOLAPES' : 'SIN SOLAPES ENTRE MURALLA Y EDIFICIOS');
await p.close();
b.disconnect();
