import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Exporta la escena REAL de la Fortaleza (posiciones, capas, rutas, arte exacto y composiciones diagnósticas) para producir arte v3.
 * Lee los valores desde los módulos reales del cliente servidos por vite (no de capturas) y renderiza a tamaño nativo (1536×1024).
 * No usa SQLite ni la partida: dibuja los seis edificios con su configuración de escena.
 *
 *   node export-fortaleza-v3.mjs <url-vite> <repo> <carpeta-salida>      (Edge headless en :9333)
 */
const [URL, REPO, OUT] = process.argv.slice(2);
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['', 'art', 'diagnostico', 'src']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.setViewport({ width: 1672, height: 941 });
await p.goto(URL, { waitUntil: 'networkidle0' });

const data = await p.evaluate(async () => {
  const sc = await import('/src/sceneConfig.ts');
  const live = await import('/src/live/liveConfig.ts');
  const art = (await import('/src/artManifest.ts')).ART;
  const cm = await import('/src/cameraMath.ts');
  const dist = await import('/src/districts/districtConfig.ts');
  const W = sc.SCENE_W, H = sc.SCENE_H;
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const ctxOf = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const img = {};
  img.ground = await load(art.cityGround);
  for (const s of [1, 2, 3]) img['wall' + s] = await load(art.walls[s]);
  for (const t of Object.keys(sc.SPRITE_SRC)) img[t] = await load(sc.SPRITE_SRC[t]);
  img.archer = await load(art.sheets.archer);

  // ---- alfa de muros y de edificios en coordenadas de escena ----
  const wallAlpha = {};
  for (const s of [1, 2, 3]) { const [, x] = ctxOf(); x.drawImage(img['wall' + s], 0, 0); wallAlpha[s] = x.getImageData(0, 0, W, H).data; }
  const bldAlpha = {};
  const buildings = [];
  for (const t of Object.keys(sc.SPRITE_SRC)) {
    const box = sc.spriteBox(t);
    const slot = sc.SLOTS[t];
    const [, x] = ctxOf();
    x.drawImage(img[t], box.left, box.top, box.size, box.size);
    const d = x.getImageData(0, 0, W, H).data;
    bldAlpha[t] = d;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (d[(y * W + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const nat = img[t].naturalWidth;
    buildings.push({
      type: t,
      plotId: 'fortress:' + t,
      file: sc.SPRITE_SRC[t],
      nativeSize: [nat, img[t].naturalHeight],
      drawRect: { x: box.left, y: box.top, w: box.size, h: box.size },
      drawScale: box.size / nat,
      pivot: { scene: [slot.x, slot.y], inSprite: [nat / 2, nat * slot.anchorY], anchorY: slot.anchorY, note: 'La base del edificio (centro de su huella) se coloca en `scene`; el sprite se dibuja centrado en x y con anchorY de su altura sobre ese punto.' },
      door: null,
      doorNote: 'No existe puerta/acceso documentado para los edificios: el juego no tiene datos de puertas (solo el portón de la muralla). No se inventa.',
      footprint: { kind: 'ellipse', center: [slot.x, slot.y], rx: slot.plot.rx, ry: slot.plot.ry, note: 'Elipse de la parcela vacía (afordancia de clic); es el único «footprint» conocido, no una huella física medida.' },
      interactiveSilhouette: { rule: 'alfa > 40 del PNG reducido a 160×160 (MASK_SIZE) y mapeado al drawRect; el clic se resuelve de delante hacia atrás por y de anclaje', opaqueBBoxScene: { x0, y0, x1, y1 } },
      zIndex: Math.round(slot.y),
    });
  }

  // ---- solapes muralla / edificios (capa delantera y < split) ----
  const split = live.WALL_SPLIT_Y;
  const overlaps = {};
  for (const t of Object.keys(sc.SPRITE_SRC)) {
    overlaps[t] = {};
    for (const s of [1, 2, 3]) {
      let front = 0, back = 0;
      const ba = bldAlpha[t], wa = wallAlpha[s];
      for (let k = 3; k < ba.length; k += 4) if (ba[k] > 40 && wa[k] > 40) { if (Math.floor((k - 3) / 4 / W) >= split) front++; else back++; }
      overlaps[t][s] = { frontLayerPx: front, backLayerPx: back };
    }
  }
  const cabin = {};
  for (const s of [1, 2, 3]) { let n = 0; for (let y = 660; y < 870; y++) for (let x = 170; x < 450; x++) if (wallAlpha[s][(y * W + x) * 4 + 3] > 40) n++; cabin[s] = n; }

  // ---- apertura del portón por etapa (tramo transparente que contiene x=1283) ----
  const gateOpening = {};
  for (const s of [1, 2, 3]) {
    const rows = {};
    for (let y = 700; y <= 840; y += 4) {
      const a = (x) => wallAlpha[s][(y * W + x) * 4 + 3];
      if (a(1283) > 40) { rows[y] = null; continue; }
      let l = 1283, r = 1283;
      while (l > 1100 && a(l - 1) <= 40) l--;
      while (r < 1500 && a(r + 1) <= 40) r++;
      rows[y] = [l, r];
    }
    gateOpening[s] = rows;
  }

  // ---- atlas del guardia (misma medida que el renderer) ----
  const cw = img.archer.naturalWidth / 3, ch = img.archer.naturalHeight / 2;
  const [, ax] = ctxOf(cw, ch);
  const archerFrames = [];
  for (let i = 0; i < 6; i++) {
    ax.clearRect(0, 0, cw, ch);
    ax.drawImage(img.archer, (i % 3) * cw, Math.floor(i / 3) * ch, cw, ch, 0, 0, cw, ch);
    const d = ax.getImageData(0, 0, cw, ch).data;
    let l = cw, r = 0, top = ch, bot = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 160) { if (x < l) l = x; if (x > r) r = x; if (y < top) top = y; if (y > bot) bot = y; }
    archerFrames.push({ index: i, cell: [(i % 3) * cw, Math.floor(i / 3) * ch, cw, ch], pivotInCell: [(l + r) / 2, bot], opaqueHeight: bot - top });
  }
  const maxH = Math.max(...archerFrames.map((f) => f.opaqueHeight));

  // ---- imágenes diagnósticas ----
  const out = {};
  const png = (c) => c.toDataURL('image/png');
  const drawBuildings = (x) => { for (const bd of [...buildings].sort((a, c) => a.drawRect.y + a.drawRect.h * 0 - c.drawRect.y)) { /* orden por y de anclaje */ } for (const bd of [...buildings].sort((a, c) => a.pivot.scene[1] - c.pivot.scene[1])) x.drawImage(img[bd.type], bd.drawRect.x, bd.drawRect.y, bd.drawRect.w, bd.drawRect.h); };
  const drawWall = (x, s, part) => { x.save(); x.beginPath(); if (part === 'back') x.rect(0, 0, W, split); else x.rect(0, split, W, H - split); x.clip(); x.drawImage(img['wall' + s], 0, 0); x.restore(); };
  { const [c, x] = ctxOf(); x.drawImage(img.ground, 0, 0); drawBuildings(x); out['01-edificios-sin-muro.png'] = png(c); }
  for (const s of [1, 2, 3]) { const [c, x] = ctxOf(); x.drawImage(img.ground, 0, 0); drawWall(x, s, 'back'); drawBuildings(x); drawWall(x, s, 'front'); out[`02-composicion-muro-etapa-${s}.png`] = png(c); }
  // máscaras alfa alineadas a escena
  const maskImg = (types, color = '#fff') => { const [c, x] = ctxOf(); const id = x.createImageData(W, H); for (const t of types) { const a = bldAlpha[t]; for (let k = 0; k < a.length; k += 4) if (a[k + 3] > 40) { id.data[k] = 255; id.data[k + 1] = 255; id.data[k + 2] = 255; id.data[k + 3] = 255; } } x.putImageData(id, 0, 0); return png(c); };
  out['03-mascara-aserradero.png'] = maskImg(['sawmill']);
  out['03-mascara-granja.png'] = maskImg(['farm']);
  out['03-mascara-todos-los-edificios.png'] = maskImg(Object.keys(sc.SPRITE_SRC));
  // solapes (rojo = pixel de edificio cubierto por muro) — capa delantera y trasera
  for (const s of [1, 2, 3]) {
    const [c, x] = ctxOf(); x.drawImage(img.ground, 0, 0); x.globalAlpha = 0.5; x.drawImage(img['wall' + s], 0, 0); x.globalAlpha = 1;
    const id = x.getImageData(0, 0, W, H);
    for (const t of Object.keys(sc.SPRITE_SRC)) { const ba = bldAlpha[t], wa = wallAlpha[s]; for (let k = 3; k < ba.length; k += 4) if (ba[k] > 40) { const front = Math.floor((k - 3) / 4 / W) >= split; if (wa[k] > 40 && front) { id.data[k - 3] = 255; id.data[k - 2] = 0; id.data[k - 1] = 0; id.data[k] = 255; } else { id.data[k - 3] = (id.data[k - 3] + 40) | 0; } } }
    x.putImageData(id, 0, 0);
    x.fillStyle = '#fff'; x.font = 'bold 18px sans-serif'; x.fillText(`Etapa ${s}: ROJO = silueta de edificio cubierta por la capa DELANTERA de la muralla (y ≥ ${split})`, 12, 24);
    out[`04-solapes-etapa-${s}.png`] = png(c);
  }
  // geometría
  const routes = { habitantes: live.VILLAGER_ROAD, portonPuenteInterior: live.GATE_CROSSING, patrullaActual: live.PATROL_ROUTES, estaciones: live.STATIONS };
  {
    const [c, x] = ctxOf(); x.drawImage(img.ground, 0, 0); drawWall(x, 2, 'back'); drawBuildings(x); drawWall(x, 2, 'front');
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, H);
    const line = (pts, col, wd = 3) => { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); x.fillStyle = col; pts.forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }); };
    for (const bd of buildings) {
      x.strokeStyle = '#ff40ff'; x.lineWidth = 2; x.strokeRect(bd.drawRect.x, bd.drawRect.y, bd.drawRect.w, bd.drawRect.h);
      const bb = bd.interactiveSilhouette.opaqueBBoxScene; x.strokeStyle = '#ffe600'; x.strokeRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      x.strokeStyle = '#00e5ff'; x.beginPath(); x.ellipse(bd.footprint.center[0], bd.footprint.center[1], bd.footprint.rx, bd.footprint.ry, 0, 0, 7); x.stroke();
      const [px, py] = bd.pivot.scene; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(px - 12, py); x.lineTo(px + 12, py); x.moveTo(px, py - 12); x.lineTo(px, py + 12); x.stroke();
      x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.fillText(bd.type, px + 8, py - 8);
    }
    const g = sc.SLOTS.wall; x.strokeStyle = '#ff9000'; x.lineWidth = 3; x.beginPath(); x.ellipse(g.x, g.y, g.plot.rx, g.plot.ry, 0, 0, 7); x.stroke(); x.fillStyle = '#ff9000'; x.fillText('selector del portón', g.x - 70, g.y + g.plot.ry + 18);
    line(live.VILLAGER_ROAD, '#ff40ff', 2); line(live.GATE_CROSSING, '#ff9000', 4);
    line(live.PATROL_ROUTES[1], '#ffd400', 3); line(live.PATROL_ROUTES[2], '#00e5ff', 3);
    for (const specs of Object.values(live.STATIONS)) for (const s of specs) { if (s.path) line(s.path, '#7cff00', 2); if (s.at) { x.fillStyle = '#7cff00'; x.fillRect(s.at[0] - 4, s.at[1] - 4, 8, 8); } }
    for (const rl of live.RIVER_LINES) line(rl, '#ff3030', 2);
    x.fillStyle = '#ff3030'; x.beginPath(); x.arc(live.FOAM.x, live.FOAM.y, 6, 0, 7); x.fill();
    x.setLineDash([10, 8]); x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(0, split); x.lineTo(W, split); x.stroke(); x.setLineDash([]);
    const leg = [['#ff40ff', 'rect de dibujo del sprite / ruta de habitantes'], ['#ffe600', 'bbox opaco (silueta clicable)'], ['#00e5ff', 'elipse de parcela (huella) / ronda etapa 2'], ['#ffd400', 'ronda actual etapa 1'], ['#ff9000', 'selector del portón / ruta puente→hueco→interior'], ['#7cff00', 'estaciones y rutas de trabajadores'], ['#ff3030', 'líneas del río y espuma'], ['#fff', 'pivote (base) y línea de corte trasera/delantera y = ' + split]];
    x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(10, H - 22 * leg.length - 16, 560, 22 * leg.length + 10);
    leg.forEach(([col, t], i) => { x.fillStyle = col; x.fillRect(18, H - 22 * leg.length - 8 + i * 22, 14, 14); x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(t, 40, H - 22 * leg.length + 4 + i * 22); });
    out['05-geometria-rectangulos-pivotes-rutas.png'] = png(c);
  }

  const vp = { w: 1164, h: 821 };
  const closeCam = cm.initialCamera(sc.CAMERA_FOCUS, vp, { w: W, h: H }, sc.CAMERA_MAX_SCALE);
  const sceneJson = {
    generatedFrom: 'módulos reales del cliente (sceneConfig, liveConfig, artManifest, cameraMath, districtConfig) servidos por vite; sin SQLite ni partida',
    scene: { width: W, height: H, origin: 'esquina superior izquierda', axes: 'x → derecha, y → abajo; unidades = px del terreno nativo', uniformTransformForAllLayers: true },
    camera: {
      model: 'pantalla = (vw/2, vh/2) + (escena − centro)·s ; inversa: escena = centro + (pantalla − (vw/2, vh/2))/s ; un solo s para terreno, edificios, muros, agua y actores',
      focusZone: sc.CAMERA_FOCUS, maxScale: sc.CAMERA_MAX_SCALE,
      minScaleRule: 'cubrir: max(vw/W, vh/H) (sin márgenes); «ver toda»: min(vw/W, vh/H) (puede dejar márgenes)',
      exampleViewport1672x941InspectorOpen: { viewport: vp, initialCamera: closeCam, fitScale: cm.fitScaleOf(vp, { w: W, h: H }) },
      source: 'client/src/cameraMath.ts, components/ScaledStage.tsx',
    },
    terrain: { file: art.cityGround, fallback: sc.GROUND_FALLBACK_SRC, nativeSize: [img.ground.naturalWidth, img.ground.naturalHeight], drawOffset: [0, 0], scale: 1, pivot: [0, 0], layer: 'terreno (primero)' },
    walls: Object.fromEntries([1, 2, 3].map((s) => [s, { file: art.walls[s], nativeSize: [img['wall' + s].naturalWidth, img['wall' + s].naturalHeight], transform: live.WALL_TRANSFORM[s], pivot: [0, 0], backClip: `y < ${split}`, frontClip: `y ≥ ${split}`, holes: live.WALL_HOLES[s], revealSectionsDuringFirstBuild: live.WALL_REVEAL_SECTIONS, levels: s === 1 ? '1–3 empalizada' : s === 2 ? '4–6 piedra' : '7–9 reforzada' }])),
    layerOrder: [
      'terreno', 'agua (canvas, z 1)', 'muralla trasera (z 2, recorte y < ' + split + ')', 'parcelas/portón SVG (z 3)', 'edificios (z = round(y de anclaje))', 'personajes (canvas ×2, z 900)', 'muralla delantera + portón (z 950, y ≥ ' + split + ')', 'etiquetas HTML (z ≥ 1000)',
    ],
    occlusionMasks: { actors: 'cada actor se recorta con la silueta (alfa del PNG) de los edificios cuya base (y de anclaje) está DELANTE de sus pies; no hay otras máscaras', wall: 'la muralla se parte en dos capas por la línea horizontal y = ' + split + ' (única «máscara» de muralla actual; es insuficiente y es parte del defecto)' },
    buildings,
    plots: Object.values(dist.FORTRESS.plots).map((p) => ({ id: p.id, anchor: p.anchor, footprint: p.footprint, interaction: p.interaction, depth: p.depth })),
    reservedCorridors: 'La Fortaleza no tiene corredores reservados definidos (exclusions: []); solo existen las rutas de abajo. Villa es otra escena y no se mezcla.',
    gate: { selectorEllipse: { center: [sc.SLOTS.wall.x, sc.SLOTS.wall.y], rx: sc.SLOTS.wall.plot.rx, ry: sc.SLOTS.wall.plot.ry }, bridgeStart: live.GATE_CROSSING[0], routeBridgeToInterior: live.GATE_CROSSING, routeNote: 'puente → centro del hueco → interior; calibrada contra el alfa de los overlays v2 (ver gateOpeningByStage)', gateOpeningByStage: gateOpening },
    routes: {
      citizens: { feet: live.VILLAGER_ROAD, direction: 'ida y vuelta (ping-pong); espejo horizontal al volver', stopsIndexes: live.VILLAGER_STOPS, dwellSeconds: live.VILLAGER_DWELL_SECONDS, limits: 'entra por el puente y el portón; sin colisiones con edificios (no hay navegación): la ruta evita parcelas a ojo', visualHeightPx: 26, speedPxPerSecond: '22–28' },
      workers: { stations: live.STATIONS, note: 'tala (hacha) fija en el aserradero; transporte genérico con rutas de ida y vuelta; alturas visuales 28–40 px' },
      guardsCurrent: { note: 'LIMITADA al tramo norte visible entre almacén y cuartel; NO es patrulla completa', byStage: live.PATROL_ROUTES, visualHeightPx: 25, speedPxPerSecond: 15 },
      guardsFullCircuit: { status: 'sin geometría: estructura en client/src/live/patrolCircuit.ts (PATROL_CIRCUITS vacío)' },
    },
    guardSprite: { file: art.sheets.archer, sheet: [3, 2], cell: [cw, ch], frames: archerFrames, referenceHeight: maxH, drawnHeightPx: 25, drawnScale: 25 / maxH, pivotRule: 'centro horizontal y pies (fila opaca más baja) de cada pose; escala común = altura / referenceHeight', actorCanvasResolution: 2 },
    river: { lines: live.RIVER_LINES, foam: live.FOAM, params: live.WATER_FX, directions: null, regions: null, masks: null, state: 'activo (canvas de agua z 1, ≤ 24 fps, desactivable, pausa con pestaña oculta y reduced-motion)', note: 'No hay máscara de agua, regiones ni direcciones de flujo calibradas: solo trayectorias aproximadas. Falta para el terreno v3.' },
    diagnostics: { splitY: split, wallOverlapsByBuilding: overlaps, wallPixelsInsideCabinRect170_450_x_660_870: cabin },
  };
  return { sceneJson, images: out };
});

fs.writeFileSync(path.join(OUT, 'scene.json'), JSON.stringify(data.sceneJson, null, 2));
for (const [name, url] of Object.entries(data.images)) fs.writeFileSync(path.join(OUT, 'diagnostico', name), Buffer.from(url.split(',')[1], 'base64'));
await p.close();
b.disconnect();

// ---- arte exacto y fuentes ----
const pub = (f) => path.join(REPO, 'client', 'public', f.replace(/^\//, ''));
const artFiles = [
  data.sceneJson.terrain.file, ...Object.values(data.sceneJson.walls).map((w) => w.file), ...data.sceneJson.buildings.map((x) => x.file), data.sceneJson.guardSprite.file,
];
const hashes = {};
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for (const f of artFiles) {
  const dst = path.join(OUT, 'art', path.basename(f));
  fs.copyFileSync(pub(f), dst);
  hashes['art/' + path.basename(f)] = sha(dst);
}
const sources = [
  'client/src/sceneConfig.ts', 'client/src/sceneGeometry.ts', 'client/src/cameraMath.ts', 'client/src/components/ScaledStage.tsx', 'client/src/components/CityScene.tsx',
  'client/src/live/liveConfig.ts', 'client/src/live/routes.ts', 'client/src/live/liveRenderer.ts', 'client/src/live/liveModel.ts', 'client/src/live/WallLayers.tsx', 'client/src/live/spriteAtlas.ts',
  'client/src/live/patrolCircuit.ts', 'client/src/live/atlasV2.json', 'client/src/artManifest.ts', 'client/src/districts/districtConfig.ts', 'client/src/styles/city.css',
];
for (const f of sources) {
  const dst = path.join(OUT, 'src', f.replace(/\//g, '__'));
  fs.copyFileSync(path.join(REPO, f), dst);
  hashes['src/' + f.replace(/\//g, '__')] = sha(dst);
}
for (const n of fs.readdirSync(path.join(OUT, 'diagnostico'))) hashes['diagnostico/' + n] = sha(path.join(OUT, 'diagnostico', n));
hashes['scene.json'] = sha(path.join(OUT, 'scene.json'));
fs.writeFileSync(path.join(OUT, 'HASHES.sha256.json'), JSON.stringify(hashes, null, 2));
console.log('exportado', Object.keys(hashes).length, 'archivos en', OUT);
