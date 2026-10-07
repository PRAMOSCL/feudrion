// Comprueba contra el ALFA REAL de cada overlay que la ruta puente→portón→interior no cruza píxeles opacos de la pared
// en la zona visible del hueco (y ≥ 735). Lee la ruta desde el módulo servido por vite (misma fuente que el juego).
import puppeteer from 'puppeteer-core';
const WEB = process.argv[2] || 'http://127.0.0.1:5175/';
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.goto(WEB, { waitUntil: 'networkidle0' });
const res = await p.evaluate(async () => {
  const cfg = await import('/src/live/liveConfig.ts');
  const route = cfg.GATE_CROSSING;
  const out = {};
  for (const s of [1, 2, 3]) {
    const img = new Image(); img.src = `/assets/viva/wall_stage_${s}${s > 1 ? '_v2' : ''}.png`; await img.decode();
    const c = document.createElement('canvas'); c.width = 1536; c.height = 1024; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    let blocked = [];
    let visibleSamples = 0;
    const alphaAt = (px, py) => x.getImageData(Math.round(px), Math.round(py), 1, 1).data[3];
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, ay] = route[i], [bx, by] = route[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      for (let k = 0; k <= len; k += 2) {
        const px = ax + ((bx - ax) * k) / len, py = ay + ((by - ay) * k) / len;
        // el pie del actor está en (px,py); es zona visible mientras no esté bajo el dintel (y >= 738)
        if (py >= 738) { visibleSamples++; if (alphaAt(px, py) > 40) blocked.push([Math.round(px), Math.round(py)]); }
      }
    }
    // la parte final (detrás de la pared) debe quedar CUBIERTA por píxeles opacos para que el muro oculte al actor
    const [hx, hy] = route[route.length - 1];
    out[s] = { visibleSamples, blocked: blocked.length, firstBlocked: blocked[0] || null, hiddenPointCovered: alphaAt(hx, hy - 10) > 40 };
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await p.close(); b.disconnect();
