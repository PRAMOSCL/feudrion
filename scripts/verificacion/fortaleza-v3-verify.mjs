import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Verificación de Fortaleza v3 (circuito completo, oclusión local, río con máscara, ciudadanos por el portón).
 * node fortaleza-v3-verify.mjs <url> <db> <scenario.cjs> <outDir>      (Edge headless en :9333; base TEMPORAL)
 * Las vueltas completas usan `seek(t)` del gancho de depuración (solo con senorios.debugLive=1): es aceleración de PRUEBA, no del juego.
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
async function open(w, h, dsf = 1) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('senorios.debugLive', '1');
    localStorage.setItem('senorios.district', 'fortress');
    localStorage.removeItem('senorios.animations'); // las pruebas que apagan animaciones no deben contaminar a las siguientes
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1400);
  await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
  await sleep(300);
  await p.evaluate(() => document.querySelector('[aria-label="Ver toda la fortaleza"]')?.click());
  await sleep(400);
  return p;
}
const snap = (p) => p.evaluate(() => window.__senoriosLive.snapshot());
const shot = async (p, name, clip) => {
  await p.screenshot({ path: path.join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
};
const cam = (p) =>
  p.evaluate(() => {
    const f = document.querySelector('.stage-frame');
    const r = f.getBoundingClientRect();
    return { s: +f.dataset.cameraScale, left: r.left, top: r.top };
  });
/** Recorte en pantalla alrededor de un punto de escena (en px de pantalla ±half). */
const clipAround = async (p, x, y, half = 120) => {
  const c = await cam(p);
  const vp = p.viewport();
  const cx = Math.max(half, Math.min(vp.width - half, c.left + x * c.s));
  const cy = Math.max(half, Math.min(vp.height - half, c.top + y * c.s));
  return { x: cx - half, y: cy - half, width: half * 2, height: half * 2 };
};

const SPEED = 15;
const STEP = 0.25;
const STAGES = [['wall2', 1, 2], ['wall5', 2, 4], ['wall8', 3, 6]];

// 1) Circuito completo por etapa (vuelta completa con seek)
for (const [name, stage, count] of STAGES) {
  scenario(name);
  const p = await open(1672, 941, 2);
  const meta = await p.evaluate(async (stage) => {
    const pc = await import('/src/live/patrolCircuit.ts');
    const c = pc.PATROL_CIRCUITS[stage];
    return { total: pc.circuitLength(c), issues: pc.validateCircuit(c), segs: c.segments.map((s) => ({ id: s.id, side: s.side, kind: s.kind, vis: s.visibility, layer: s.layer })) };
  }, stage);
  check(`etapa ${stage}: circuito válido (19 tramos, cerrado)`, meta.issues.length === 0 && meta.segs.length === 19, JSON.stringify(meta.issues));
  const s0 = await snap(p);
  check(`etapa ${stage}: ${count} guardias reales representados`, s0.archers === count && s0.model.wallStage === stage, `archers=${s0.archers}`);
  const lapT = meta.total / SPEED;
  const samples = await p.evaluate(
    (lapT, step) => {
      const r = window.__senoriosLive;
      const out = [];
      for (let t = 0; t <= lapT * 1.02; t += step) {
        r.seek(t);
        const g = r.snapshot().guards;
        out.push({ t, g: g.map((q) => ({ x: q.x, y: q.y, vis: q.visible, layer: q.layer, seg: q.segment, d: q.distance })) });
      }
      return out;
    },
    lapT,
    STEP,
  );
  const first = samples.map((s) => s.g[0]);
  const bySeg = Object.fromEntries(meta.segs.map((s) => [s.id, s]));
  const sides = new Set(first.map((g) => bySeg[g.seg].side));
  check(`etapa ${stage}: UN guardia recorre los cuatro lados en una vuelta`, ['north', 'east', 'south', 'west'].every((s) => sides.has(s)), [...sides].join(','));
  check(`etapa ${stage}: recorre los 19 tramos (incluidos pasos ocultos y plataforma del portón)`, new Set(first.map((g) => g.seg)).size === 19, `${new Set(first.map((g) => g.seg)).size}/19`);
  let uniform = true;
  let maxStep = 0;
  let maxJump = 0;
  for (let i = 1; i < first.length; i++) {
    const dd = first[i].d - first[i - 1].d;
    if (Math.abs(dd - SPEED * STEP) > 1e-6) uniform = false;
    const jump = Math.hypot(first[i].x - first[i - 1].x, first[i].y - first[i - 1].y);
    maxJump = Math.max(maxJump, jump);
    maxStep = Math.max(maxStep, dd);
  }
  check(`etapa ${stage}: velocidad uniforme ${SPEED} px/s por distancia (Δd=${SPEED * STEP} por paso)`, uniform, `maxΔd=${maxStep.toFixed(3)}`);
  check(`etapa ${stage}: sin teletransportes (salto máx ${maxJump.toFixed(2)} px ≤ ${(SPEED * STEP + 0.5).toFixed(2)})`, maxJump <= SPEED * STEP + 0.5);
  const hidden = first.filter((g) => !g.vis).length;
  const layers = new Set(first.map((g) => g.layer));
  check(`etapa ${stage}: pasos ocultos (${hidden} muestras sin dibujar) y capas back+front`, hidden > 0 && layers.has('back') && layers.has('front'));
  // distancia avanza también en oculto: entre dos muestras ocultas consecutivas Δd sigue siendo SPEED·STEP (ya cubierto por uniform)
  // ningún guardia sobre el trazado norte antiguo: todos los puntos muestreados están sobre algún tramo del circuito
  // Capturas: guardia visible back, visible front
  const pick = (layer) => samples.find((s) => s.g[0].vis && s.g[0].layer === layer && bySeg[s.g[0].seg].kind === 'wall_walk');
  for (const layer of ['back', 'front']) {
    const sp = pick(layer);
    await p.evaluate((t) => window.__senoriosLive.seek(t), sp.t);
    await sleep(120);
    await shot(p, `etapa${stage}-guardia-${layer}`, await clipAround(p, sp.g[0].x, sp.g[0].y, 150));
  }
  const gate = samples.find((s) => bySeg[s.g[0].seg].kind === 'gate_platform' && s.g[0].vis);
  if (gate) {
    await p.evaluate((t) => window.__senoriosLive.seek(t), gate.t);
    await sleep(120);
    await shot(p, `etapa${stage}-guardia-portón`, await clipAround(p, gate.g[0].x, gate.g[0].y, 150));
  }
  // paso oculto: capturar un instante oculto
  const hid = samples.find((s) => !s.g[0].vis);
  await p.evaluate((t) => window.__senoriosLive.seek(t), hid.t);
  await sleep(120);
  await shot(p, `etapa${stage}-torre-oculto`, await clipAround(p, hid.g[0].x, hid.g[0].y, 150));
  await shot(p, `etapa${stage}-escena-1672x941`);
  await p.close();
}

// 2) Máscaras locales: ningún píxel de guardia fuera del alfa de la muralla en tramos cubiertos por máscara (comprobación del lienzo)
scenario('wall5');
{
  const p = await open(1672, 941);
  const res = await p.evaluate(async () => {
    const pc = await import('/src/live/patrolCircuit.ts');
    const g = await import('/src/live/guards.ts');
    const art = await import('/src/artManifest.ts');
    const img = await new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.src = art.ART.walls[2];
    });
    const c = pc.PATROL_CIRCUITS[2];
    const missing = c.segments.filter((s) => s.kind !== 'tower_pass' && !g.OCCLUSION['2'][s.id]).map((s) => s.id);
    const wallAlpha = (() => {
      const k = document.createElement('canvas');
      k.width = 1536; k.height = 1024;
      const x = k.getContext('2d'); x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, 1536, 1024).data;
    })();
    // para cada máscara local: sus píxeles opacos deben caer sobre alfa de muralla > 0
    let bad = 0, total = 0;
    for (const [id, o] of Object.entries(g.OCCLUSION['2'])) {
      const m = g.buildLocalMask(img, o.polygon, 1536, 1024);
      const d = m.canvas.getContext('2d').getImageData(0, 0, m.canvas.width, m.canvas.height).data;
      for (let y = 0; y < m.canvas.height; y++) for (let x = 0; x < m.canvas.width; x++) {
        const a = d[(y * m.canvas.width + x) * 4 + 3];
        if (a > 0) { total++; if (wallAlpha[((y + m.y) * 1536 + (x + m.x)) * 4 + 3] === 0) bad++; }
      }
    }
    return { missing, bad, total };
  });
  check('etapa 2: todos los tramos visibles tienen máscara local', res.missing.length === 0, JSON.stringify(res.missing));
  check('etapa 2: la máscara local solo cubre píxeles con alfa de la muralla', res.bad === 0 && res.total > 1000, JSON.stringify({ bad: res.bad, total: res.total }));
  await p.close();
}

// 3) Río: máscara sin fugas, respeta apagado y pestaña oculta
scenario('wall2');
{
  const p = await open(1672, 941, 2);
  const leak = await p.evaluate(async () => {
    const art = await import('/src/artManifest.ts');
    const mask = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = art.ART.riverMask; });
    const k = document.createElement('canvas'); k.width = 1536; k.height = 1024;
    const kx = k.getContext('2d'); kx.drawImage(mask, 0, 0);
    const m = kx.getImageData(0, 0, 1536, 1024).data;
    const r = window.__senoriosLive;
    let leaks = 0, painted = 0, frames = 0;
    for (const t of [1, 3.3, 7.7, 12.1]) {
      r.seek(t);
      const w = document.querySelector('.live-water');
      const d = w.getContext('2d').getImageData(0, 0, w.width, w.height).data;
      frames++;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) { painted++; if (m[i] === 0) leaks++; }
      }
    }
    return { leaks, painted, frames, w: document.querySelector('.live-water').width };
  });
  check('río: ningún píxel de agua fuera de river_mask_v3 (4 instantes)', leak.leaks === 0 && leak.painted > 500, JSON.stringify(leak));
  await p.evaluate(() => window.__senoriosLive.seek(5));
  await shot(p, 'rio-t5', await clipAround(p, 540, 560, 260));
  const f0 = (await snap(p)).waterFrames;
  await p.evaluate(() => { /* reanuda bucle con un cambio de modo */ document.querySelector('[aria-label^="Desactivar animaciones"]')?.click(); });
  await sleep(400);
  const empty = await p.evaluate(() => {
    const w = document.querySelector('.live-water');
    return w.getContext('2d').getImageData(0, 0, w.width, w.height).data.some((v, i) => i % 4 === 3 && v > 0);
  });
  check('río: con animaciones desactivadas no queda agua dibujada ni bucle', !empty && !(await snap(p)).running);
  await p.close();
}

// 4) Ciudadano real entrando y saliendo por el portón (por etapa)
for (const [name, stage] of STAGES) {
  scenario(name);
  const p = await open(1672, 941, 2);
  const gatePts = await p.evaluate(async () => (await import('/src/live/liveConfig.ts')).GATE_CROSSING.slice(7)); // tramo de tierra, arco y paso interior (v3.1)
  const found = await p.evaluate((gatePts) => {
    const r = window.__senoriosLive;
    let prev = null;
    const enter = [], leave = [];
    for (let t = 0; t < 900; t += 0.25) {
      for (const [i, v] of r.villagerPoses(t).entries()) {
        const d = Math.min(...gatePts.map((g) => Math.hypot(g[0] - v.x, g[1] - v.y)));
        if (d < 12 && v.moving) (prev?.[i] != null && v.x < prev[i] ? leave : enter).push({ t, i, x: v.x, y: v.y });
      }
      prev = r.villagerPoses(t).map((v) => v.x);
    }
    return { enter: enter[0], leave: leave[0], nEnter: enter.length, nLeave: leave.length };
  }, gatePts);
  check(`etapa ${stage}: un habitante real cruza el portón (entra) y otro/el mismo sale`, !!found.enter && !!found.leave, JSON.stringify({ enter: found.enter, leave: found.leave }));
  for (const k of ['enter', 'leave']) {
    if (!found[k]) continue;
    await p.evaluate((t) => window.__senoriosLive.seek(t), found[k].t);
    await sleep(120);
    await shot(p, `etapa${stage}-habitante-${k === 'enter' ? 'entra' : 'sale'}`, await clipAround(p, found[k].x, found[k].y, 150));
  }
  await p.close();
}

// 5) Niveles 0, 1, 4, 7 × 4 viewports
const levels = [['fresh', 'nivel0'], ['wall1g0', 'nivel1'], ['wall4', 'nivel4'], ['wall7', 'nivel7']];
for (const [w, h] of [[1672, 941], [1920, 1080], [1366, 768], [1024, 768]]) {
  for (const [name, tag] of levels) {
    scenario(name);
    const p = await open(w, h);
    if (w <= 1100) await p.evaluate(() => document.querySelector('[aria-label="Cerrar inspector"]')?.click());
    const s = await snap(p);
    const expectGuards = s.model.wallStage > 0 ? s.model.guards : 0;
    check(`${w}×${h} ${tag}: etapa ${s.model.wallStage}, guardias reales ${s.model.guards} → ${s.archers} dibujados`, s.archers === expectGuards);
    await shot(p, `${tag}-${w}x${h}`);
    await p.close();
  }
}

// 6) Un guardia sobre el trazado norte antiguo ya no existe (la config antigua no se exporta)
{
  const p = await open(1672, 941);
  const gone = await p.evaluate(async () => {
    const cfg = await import('/src/live/liveConfig.ts');
    return cfg.PATROL_ROUTES === undefined;
  });
  check('ruta norte antigua eliminada de la configuración', gone);
  await p.close();
}

check('sin errores de consola ni respuestas ≥ 400 (sin 404)', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
browser.disconnect();
console.log(results.every(Boolean) ? 'TODO OK' : 'HAY FALLOS');
